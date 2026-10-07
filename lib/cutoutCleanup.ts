import sharp from "sharp";

// Limpieza de los recortes de MODNet (lib/photoProcessing.ts).
//
// MODNet es un modelo de retrato: de hombros para arriba recorta bien, pero con
// ropa oscura sobre fondo de estudio oscuro el tercio inferior sale roto —manchas
// negras sueltas junto a las piernas, restos del decorado (una planta), huecos
// en la camiseta y bordes deshilachados—. Sobre fondo oscuro apenas se ve; en
// las portadas de fondo claro (Editorial) salta a la vista.
//
// Tres pasos, sobre el canal alfa:
//   1. Islas: se queda la figura principal y lo que tenga tamaño de parte del
//      cuerpo; las manchas sueltas desaparecen.
//   2. Zona rota: se busca, de la mitad hacia abajo, la primera franja donde
//      abundan los píxeles a medio recortar o la silueta se llena de huecos.
//   3. Desvanecido (solo si hay zona rota): desde ahí hasta el borde inferior
//      la figura se funde, más rápido hacia los lados. Queda como un busto
//      deliberado en vez de un borde roto. Un recorte sano no se funde.

/** Versión de la limpieza guardada en el recorte: evita reprocesar. */
export const CUTOUT_CLEAN_VERSION = 1;

const SOLID = 32; // alfa a partir del cual un píxel cuenta como figura
const PARTIAL_LO = 24;
const PARTIAL_HI = 224;

export type RawRgba = { data: Uint8Array | Uint8ClampedArray; width: number; height: number };

export type CleanStats = { islasBorradas: number; inicioFundido: number; altoFigura: number };

/** Componentes conexos (4-vecindad) del alfa sólido. Devuelve etiqueta por píxel y tamaños. */
function components(alpha: Uint8Array, w: number, h: number): { label: Int32Array; sizes: number[] } {
  const label = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || alpha[start] <= SOLID) continue;
    const id = sizes.length;
    let top = 0;
    let size = 0;
    stack[top++] = start;
    label[start] = id;
    while (top) {
      const p = stack[--top];
      size++;
      const x = p % w;
      const y = (p - x) / w;
      const near = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of near) {
        if (q >= 0 && label[q] === -1 && alpha[q] > SOLID) {
          label[q] = id;
          stack[top++] = q;
        }
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

/**
 * Limpia el alfa en sitio. Núcleo puro (sin sharp) para poder testearlo.
 * Devuelve qué hizo, para registrarlo en la migración.
 */
export function cleanAlpha(img: RawRgba): CleanStats {
  const { data, width: w, height: h } = img;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];

  // 1. Islas: la mayor es la persona; se conserva lo que mida al menos un 8 %
  // de ella (una mano separada del cuerpo por un hueco del recorte).
  const { label, sizes } = components(alpha, w, h);
  const mayor = Math.max(0, ...sizes);
  const conservar = sizes.map((s) => s >= mayor * 0.08);
  let islasBorradas = 0;
  sizes.forEach((_, i) => !conservar[i] && islasBorradas++);
  for (let p = 0; p < w * h; p++) {
    const l = label[p];
    // Borra islas pequeñas y el halo semitransparente que no toca la figura.
    if ((l >= 0 && !conservar[l]) || (l === -1 && alpha[p] > 0 && !touchesKept(p, w, h, label, conservar))) {
      alpha[p] = 0;
    }
  }

  // Caja de la figura ya limpia.
  let top = h;
  let bottom = -1;
  const rowSolid = new Int32Array(h);
  const rowPartial = new Int32Array(h);
  const rowSpan = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let minX = w;
    let maxX = -1;
    for (let x = 0; x < w; x++) {
      const a = alpha[y * w + x];
      if (a > SOLID) {
        rowSolid[y]++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      if (a > PARTIAL_LO && a < PARTIAL_HI) rowPartial[y]++;
    }
    rowSpan[y] = maxX >= minX ? maxX - minX + 1 : 0;
    if (rowSolid[y]) {
      if (y < top) top = y;
      bottom = y;
    }
  }
  if (bottom < 0) return { islasBorradas, inicioFundido: h, altoFigura: 0 };
  const alto = bottom - top + 1;

  // 2. Zona rota: de la mitad hacia abajo, la primera franja (ventana del 4 %
  // de la figura) con muchos píxeles a medio recortar. Medido en las fotos
  // reales: en zona limpia la proporción es ≤ 0,05 y en la rota pasa de 0,08
  // de forma sostenida.
  // (Contar huecos dentro de la silueta no sirve: un brazo separado del torso
  // también los produce.)
  const ventana = Math.max(3, Math.round(alto * 0.04));
  let rota = -1;
  // Se busca entre el 50 % y el 90 %: en el último 10 % los pies y su sombra
  // dan bordes suaves de forma natural (medido en fotos de cuerpo entero sanas,
  // con picos solo ahí), y eso no es un recorte roto.
  const fin = top + Math.round(alto * 0.9) - ventana;
  for (let y = top + Math.round(alto * 0.5); y <= fin; y++) {
    let parcial = 0;
    let solido = 0;
    for (let k = 0; k < ventana; k++) {
      parcial += rowPartial[y + k];
      solido += rowSolid[y + k];
    }
    if (parcial / Math.max(1, solido + parcial) > 0.08) {
      rota = y;
      break;
    }
  }
  // Recorte sano (p. ej. cuerpo entero en exterior): solo se quitan las islas.
  // Fundirlo borraría pies y zapatos que están bien recortados.
  if (rota < 0) {
    for (let i = 0; i < w * h; i++) data[i * 4 + 3] = alpha[i];
    return { islasBorradas, inicioFundido: alto, altoFigura: alto };
  }

  // El fundido arranca un poco antes de la zona rota para que, al llegar a
  // ella, ya esté medio transparente. Límites: no por encima del 55 % (se
  // perdería el torso) y al menos un 18 % de figura fundida (se notaría el corte).
  let inicio = rota - Math.round(alto * 0.06);
  inicio = Math.max(top + Math.round(alto * 0.55), Math.min(inicio, bottom - Math.round(alto * 0.18)));

  // Eje de la figura a la altura del inicio del fundido: centro y semiancho.
  let suma = 0;
  let n = 0;
  let lo = w;
  let hi = -1;
  for (let y = Math.max(top, inicio - ventana); y <= inicio; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > SOLID) {
        suma += x;
        n++;
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    }
  }
  const cx = n ? suma / n : w / 2;
  const semi = Math.max(1, (hi - lo) / 2);

  // 3. Fundido hasta el borde inferior (curva suave), más rápido hacia los
  // lados: las manchas aparecen junto a las piernas, no en el centro. La base
  // queda en forma de busto en vez de un corte recto.
  const largo = Math.max(1, bottom - inicio);
  for (let y = inicio; y <= bottom; y++) {
    const t = (y - inicio) / largo;
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx) / semi;
      const te = Math.min(1, t * (1 + 2 * dx * dx));
      const k = 1 - te * te * (3 - 2 * te);
      alpha[y * w + x] = Math.round(alpha[y * w + x] * k);
    }
  }
  for (let y = bottom + 1; y < h; y++) for (let x = 0; x < w; x++) alpha[y * w + x] = 0;

  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = alpha[i];
  return { islasBorradas, inicioFundido: inicio - top, altoFigura: alto };
}

/** ¿Un píxel semitransparente (sin etiqueta) está pegado a una parte conservada? */
function touchesKept(p: number, w: number, h: number, label: Int32Array, conservar: boolean[]): boolean {
  const x = p % w;
  const y = (p - x) / w;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const l = label[ny * w + nx];
      if (l >= 0 && conservar[l]) return true;
    }
  }
  return false;
}

/**
 * Limpia un recorte en data URL y lo recorta a su nuevo contorno.
 * Si algo falla devuelve null: mejor el recorte original que ninguno.
 */
export async function cleanCutout(
  dataUrl: string
): Promise<{ dataUrl: string; width: number; height: number; stats: CleanStats } | null> {
  const m = /^data:image\/png;base64,([\s\S]+)$/.exec(dataUrl || "");
  if (!m) return null;
  try {
    const { data, info } = await sharp(Buffer.from(m[1], "base64"))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const stats = cleanAlpha({ data, width: info.width, height: info.height });
    if (!stats.altoFigura) return null;
    const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .trim({ threshold: 0 })
      .png({ compressionLevel: 9, effort: 10 })
      .toBuffer({ resolveWithObject: true });
    return {
      dataUrl: `data:image/png;base64,${out.data.toString("base64")}`,
      width: out.info.width,
      height: out.info.height,
      stats,
    };
  } catch {
    return null;
  }
}
