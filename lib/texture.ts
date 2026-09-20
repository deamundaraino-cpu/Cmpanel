// Texturas de fondo generadas como SVG: partículas, malla o granulado sobre el
// color de marca, para que los fondos planos o con degradado no se vean vacíos.
// Se dibujan con la opacidad ya incorporada al color (Satori no compone capas).

export type TextureKind = "none" | "puntos" | "malla" | "granulado";

export const TEXTURES: { value: TextureKind; label: string; hint: string }[] = [
  { value: "none", label: "Sin textura", hint: "Fondo limpio." },
  { value: "puntos", label: "Partículas", hint: "Puntos dispersos, como polvo de luz." },
  { value: "malla", label: "Malla", hint: "Rejilla fina de líneas, aire técnico." },
  { value: "granulado", label: "Granulado", hint: "Grano muy fino, textura de papel." },
];

function rgba(hex: string, a: number): string {
  const c = hex.replace("#", "");
  const n = c.length === 6 ? c : "888888";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

/** Generador determinista: la misma marca y medida producen siempre el mismo fondo. */
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
  seed = 7
): string | null {
  if (kind === "none") return null;
  const parts: string[] = [];

  if (kind === "puntos") {
    const rand = rng(seed);
    // Rejilla de puntos tenues + partículas sueltas más marcadas.
    const step = Math.round(Math.min(w, h) / 22);
    for (let y = step; y < h; y += step) {
      for (let x = step; x < w; x += step) {
        parts.push(`<circle cx="${x}" cy="${y}" r="2.2" fill="${rgba(color, 0.16)}"/>`);
      }
    }
    for (let i = 0; i < 90; i++) {
      const x = Math.round(rand() * w);
      const y = Math.round(rand() * h);
      const r = 3 + rand() * 6;
      parts.push(`<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${rgba(color, 0.22 + rand() * 0.38)}"/>`);
    }
  }

  if (kind === "malla") {
    const step = Math.round(Math.min(w, h) / 12);
    for (let x = step; x < w; x += step) {
      parts.push(`<rect x="${x}" y="0" width="1" height="${h}" fill="${rgba(color, 0.14)}"/>`);
    }
    for (let y = step; y < h; y += step) {
      parts.push(`<rect x="0" y="${y}" width="${w}" height="1" fill="${rgba(color, 0.14)}"/>`);
    }
    const rand = rng(seed);
    for (let i = 0; i < 14; i++) {
      const x = Math.round((rand() * w) / step) * step;
      const y = Math.round((rand() * h) / step) * step;
      parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${rgba(color, 0.5)}"/>`);
    }
  }

  if (kind === "granulado") {
    const rand = rng(seed);
    const count = Math.round((w * h) / 2600);
    for (let i = 0; i < count; i++) {
      const x = Math.round(rand() * w);
      const y = Math.round(rand() * h);
      parts.push(`<rect x="${x}" y="${y}" width="2" height="2" fill="${rgba(color, 0.1 + rand() * 0.22)}"/>`);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
