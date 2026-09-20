// Grafismos de fondo generados como SVG: partículas, mallas, líneas, ondas,
// órbitas o grano sobre el color de marca, para que los fondos planos o con
// degradado no se vean vacíos. La IA elige estilo, intensidad y color según el
// análisis de la marca. La opacidad va incorporada al color (Satori no compone
// capas) y todo es determinista: la misma marca produce siempre el mismo fondo.

export type TextureKind =
  | "none"
  | "puntos"
  | "cuadricula"
  | "malla"
  | "lineas"
  | "ondas"
  | "orbitas"
  | "destellos"
  | "granulado";

export type TextureIntensity = "sutil" | "medio" | "marcado";

export const TEXTURES: { value: TextureKind; label: string; hint: string }[] = [
  { value: "none", label: "Sin grafismo", hint: "Fondo limpio, sin nada detrás." },
  { value: "puntos", label: "Partículas", hint: "Puntos dispersos como polvo de luz. Energía y movimiento." },
  { value: "cuadricula", label: "Cuadrícula de puntos", hint: "Retícula de puntos regular. Orden, producto, método." },
  { value: "malla", label: "Malla", hint: "Rejilla de líneas finas con nodos. Técnico, datos, ingeniería." },
  { value: "lineas", label: "Líneas diagonales", hint: "Rayado inclinado constante. Dinamismo sobrio, deportivo." },
  { value: "ondas", label: "Ondas", hint: "Curvas tipo mapa topográfico. Calma, terreno, recorrido." },
  { value: "orbitas", label: "Órbitas", hint: "Círculos concéntricos amplios. Alcance, visión, escala." },
  { value: "destellos", label: "Destellos", hint: "Halos difuminados de luz. Premium, nocturno, cinematográfico." },
  { value: "granulado", label: "Granulado", hint: "Grano muy fino de papel. Editorial, analógico, artesanal." },
];

export const TEXTURE_INTENSITIES: { value: TextureIntensity; label: string }[] = [
  { value: "sutil", label: "Sutil" },
  { value: "medio", label: "Medio" },
  { value: "marcado", label: "Marcado" },
];

const INTENSITY_FACTOR: Record<TextureIntensity, number> = { sutil: 0.55, medio: 1, marcado: 1.8 };

function rgba(hex: string, a: number): string {
  const c = hex.replace("#", "");
  const n = c.length === 6 ? c : "888888";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${Math.min(1, a).toFixed(3)})`;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function textureDataUri(
  kind: TextureKind,
  color: string,
  w: number,
  h: number,
  seed = 7,
  intensity: TextureIntensity = "medio"
): string | null {
  if (kind === "none") return null;
  const k = INTENSITY_FACTOR[intensity] ?? 1;
  const a = (base: number) => rgba(color, base * k);
  const rand = rng(seed);
  const parts: string[] = [];
  const defs: string[] = [];

  if (kind === "puntos" || kind === "cuadricula") {
    const step = Math.round(Math.min(w, h) / (kind === "cuadricula" ? 26 : 22));
    for (let y = step; y < h; y += step) {
      for (let x = step; x < w; x += step) {
        parts.push(`<circle cx="${x}" cy="${y}" r="${kind === "cuadricula" ? 3.2 : 2.2}" fill="${a(kind === "cuadricula" ? 0.26 : 0.16)}"/>`);
      }
    }
    if (kind === "puntos") {
      for (let i = 0; i < 90; i++) {
        const x = Math.round(rand() * w);
        const y = Math.round(rand() * h);
        parts.push(`<circle cx="${x}" cy="${y}" r="${(3 + rand() * 6).toFixed(1)}" fill="${a(0.22 + rand() * 0.38)}"/>`);
      }
    }
  }

  if (kind === "malla") {
    const step = Math.round(Math.min(w, h) / 12);
    for (let x = step; x < w; x += step) parts.push(`<rect x="${x}" y="0" width="1" height="${h}" fill="${a(0.14)}"/>`);
    for (let y = step; y < h; y += step) parts.push(`<rect x="0" y="${y}" width="${w}" height="1" fill="${a(0.14)}"/>`);
    for (let i = 0; i < 14; i++) {
      const x = Math.round((rand() * w) / step) * step;
      const y = Math.round((rand() * h) / step) * step;
      parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${a(0.5)}"/>`);
    }
  }

  if (kind === "lineas") {
    // Rayado a 30°: se dibuja como líneas largas que cruzan todo el lienzo.
    const step = Math.round(Math.min(w, h) / 14);
    for (let x = -h; x < w + h; x += step) {
      parts.push(`<line x1="${x}" y1="${h}" x2="${x + h * 0.58}" y2="0" stroke="${a(0.13)}" stroke-width="2"/>`);
    }
  }

  if (kind === "ondas") {
    const bands = 9;
    const gap = h / bands;
    const amp = gap * 0.55;
    for (let i = 0; i <= bands; i++) {
      const y = i * gap;
      const pts: string[] = [];
      for (let x = 0; x <= w; x += Math.round(w / 24)) {
        pts.push(`${x},${(y + Math.sin((x / w) * Math.PI * 2 + i * 0.7) * amp).toFixed(1)}`);
      }
      parts.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${a(0.16)}" stroke-width="2"/>`);
    }
  }

  if (kind === "orbitas") {
    const cx = w * 0.82;
    const cy = h * 0.22;
    for (let i = 1; i <= 6; i++) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${i * Math.round(Math.min(w, h) / 5)}" fill="none" stroke="${a(0.14)}" stroke-width="2"/>`);
    }
    for (let i = 0; i < 5; i++) {
      parts.push(`<circle cx="${Math.round(rand() * w)}" cy="${Math.round(rand() * h)}" r="5" fill="${a(0.5)}"/>`);
    }
  }

  if (kind === "destellos") {
    for (let i = 0; i < 5; i++) {
      const id = `g${i}`;
      const r = Math.round(Math.min(w, h) * (0.1 + rand() * 0.16));
      defs.push(
        `<radialGradient id="${id}"><stop offset="0%" stop-color="${a(0.22)}"/><stop offset="100%" stop-color="${rgba(color, 0)}"/></radialGradient>`
      );
      parts.push(`<circle cx="${Math.round(rand() * w)}" cy="${Math.round(rand() * h)}" r="${r}" fill="url(#${id})"/>`);
    }
  }

  if (kind === "granulado") {
    const count = Math.round((w * h) / 2600);
    for (let i = 0; i < count; i++) {
      parts.push(
        `<rect x="${Math.round(rand() * w)}" y="${Math.round(rand() * h)}" width="2" height="2" fill="${a(0.1 + rand() * 0.22)}"/>`
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${
    defs.length ? `<defs>${defs.join("")}</defs>` : ""
  }${parts.join("")}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
