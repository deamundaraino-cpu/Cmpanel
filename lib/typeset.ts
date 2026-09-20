import { parseEmphasis } from "./emphasis";
import { GLYPH_WIDTHS } from "./fontMetrics";

// Ajuste tipográfico compartido por portadas de carrusel y de reel: mide con
// las métricas reales de la fuente y reparte el titular en líneas equilibradas.

export const LINE_HEIGHT = 0.98;
export const BOX_PAD = 0.14; // relleno horizontal de la caja resaltada, en em por lado

/** Anchos del titular de ESTA marca: cada tipografía mide distinto. */
export type Metrics = { width: (text: string) => number; space: number };

export function metricsFor(family: string): Metrics {
  const table = GLYPH_WIDTHS[family] || GLYPH_WIDTHS.Anton;
  return {
    space: table[" "] ?? 0.25,
    width: (text: string) => {
      let w = 0;
      for (const ch of text) w += table[ch] ?? 0.5;
      return w;
    },
  };
}

export function stripPunct(w: string) {
  return w.replace(/[^\p{L}\p{N}]/gu, "");
}

export type Tok = { w: string; strong: boolean };

/** Palabras con su marca de énfasis, en mayúsculas y con la puntuación pegada. */
export function tokens(text: string, upper: boolean): Tok[] {
  const toks: Tok[] = [];
  for (const seg of parseEmphasis(upper ? text.toUpperCase() : text)) {
    for (const w of seg.text.split(/\s+/).filter(Boolean)) {
      const prev = toks[toks.length - 1];
      if (prev && /^[,.;:!?)»”]+$/.test(w)) prev.w += w;
      else toks.push({ w, strong: seg.strong });
    }
  }
  // Si todo o nada va resaltado no hay jerarquía: se resalta solo la palabra más larga.
  const strongCount = toks.filter((t) => t.strong).length;
  if (toks.length > 1 && (strongCount === 0 || strongCount === toks.length)) {
    const longest = toks.reduce((a, b) => (stripPunct(b.w).length > stripPunct(a.w).length ? b : a));
    toks.forEach((t) => (t.strong = t === longest));
  }
  return toks;
}

export type Chunk = { text: string; strong: boolean };
export type Line = { chunks: Chunk[]; size: number };

function chunksOf(toks: Tok[]): Chunk[] {
  const out: Chunk[] = [];
  for (const t of toks) {
    const last = out[out.length - 1];
    if (last && last.strong === t.strong) last.text += ` ${t.w}`;
    else out.push({ text: t.w, strong: t.strong });
  }
  return out;
}

function lineEm(chunks: Chunk[], boxed: boolean, m: Metrics): number {
  return (
    chunks.reduce((sum, c) => sum + m.width(c.text) + (boxed && c.strong ? BOX_PAD * 2 : 0), 0) +
    m.space * (chunks.length - 1)
  );
}

/**
 * Reparte las palabras en 1–4 líneas buscando la combinación con la letra más
 * grande que quepa en la zona. Cada línea se escala a lo ancho, pero ninguna
 * supera `ratio`× a la más pequeña: jerarquía sin desproporción.
 */
export function fitLines(
  toks: Tok[],
  zone: { w: number; h: number },
  opts: { m: Metrics; maxSize: number; boxed?: boolean; gap?: number; ratio?: number; maxLines?: number; orphans?: boolean }
): Line[] {
  const { m, maxSize, boxed = false, gap = 0.1, ratio = 1.45, maxLines = 4, orphans = false } = opts;
  const n = toks.length;
  if (!n) return [];
  let best: { lines: Line[]; score: number } | null = null;

  const evaluate = (breaks: number[]) => {
    const groups: Tok[][] = [];
    let start = 0;
    for (const b of [...breaks, n]) {
      groups.push(toks.slice(start, b));
      start = b;
    }
    const chunked = groups.map(chunksOf);
    const fits = chunked.map((c) => Math.min(maxSize, zone.w / lineEm(c, boxed, m)));
    const minFit = Math.min(...fits);
    let sizes = fits.map((f) => Math.min(f, minFit * ratio));
    const height = sizes.reduce((s, x) => s + x * LINE_HEIGHT, 0) + gap * minFit * (sizes.length - 1);
    if (height > zone.h) sizes = sizes.map((s) => s * (zone.h / height));
    let score = Math.min(...sizes) * (1 - 0.04 * (groups.length - 1));
    for (const [i, g] of groups.entries()) {
      const last = stripPunct(g[g.length - 1].w);
      // Una palabra de 1–2 letras sola en su línea queda huérfana ("EL").
      if (!orphans && g.length === 1 && last.length <= 2) score *= 0.6;
      // Cortar tras un artículo o preposición ("CAMBIARON MI / VIDA") rompe la lectura.
      if (i < groups.length - 1 && last.length <= 3 && !/^\d+$/.test(last)) score *= 0.88;
      // La frase clave sola en su línea es la jerarquía más clara.
      if (chunked[i].length === 1 && chunked[i][0].strong) score *= 1.06;
    }
    if (!best || score > best.score) {
      best = { score, lines: chunked.map((chunks, i) => ({ chunks, size: Math.floor(sizes[i]) })) };
    }
  };

  const choose = (from: number, left: number, acc: number[]) => {
    if (left === 0) return evaluate(acc);
    for (let b = from; b <= n - left; b++) choose(b + 1, left - 1, [...acc, b]);
  };
  for (let lines = 1; lines <= Math.min(maxLines, n); lines++) choose(1, lines - 1, []);
  return (best as { lines: Line[] } | null)?.lines || [];
}

