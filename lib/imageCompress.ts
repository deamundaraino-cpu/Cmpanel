import sharp from "sharp";

// Los recortes transparentes venían del navegador como PNG sin optimizar
// (canvas.toDataURL no deja elegir compresión): hasta 2,4 MB por foto, releídos
// desde Postgres en cada render. Aquí se recomprimen una sola vez, al guardarlos.
//
// Se mantiene PNG porque el renderizador de portadas (Satori) no acepta WebP
// —comprobado— y el recorte necesita canal alfa. No se reduce la paleta: medido
// sobre las fotos reales, cuantizar no ahorra nada frente a color completo, así
// que todo el ahorro viene de la resolución y del encoder.

/** El lienzo de las portadas mide 1080 de ancho: más resolución no se ve. */
export const MAX_CUTOUT_WIDTH = 1080;

const DATA_URL = /^data:image\/(png|jpeg|jpg|webp);base64,([\s\S]+)$/;

export type CompressResult = { dataUrl: string; width: number; height: number; before: number; after: number };

/**
 * Recomprime un recorte en data URL. Si algo falla devuelve el original: una
 * foto sin optimizar es mejor que una subida rota.
 */
export async function compressCutout(dataUrl: string, maxWidth = MAX_CUTOUT_WIDTH): Promise<CompressResult | null> {
  const m = DATA_URL.exec(dataUrl || "");
  if (!m) return null;
  const input = Buffer.from(m[2], "base64");
  try {
    const out = await sharp(input)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .png({ compressionLevel: 9, effort: 10 })
      .toBuffer();
    const meta = await sharp(out).metadata();
    // Solo merece la pena si el ahorro es real: re-codificar un PNG ya
    // optimizado da diferencias de unos bytes y haría que la migración
    // reescribiera filas en cada pasada.
    if (out.length > input.length * 0.98) return null;
    return {
      dataUrl: `data:image/png;base64,${out.toString("base64")}`,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      before: input.length,
      after: out.length,
    };
  } catch {
    return null;
  }
}
