import { COVER_LAYOUTS, type CoverLayout } from "./brandDesign";

export type QualityGen = { score: number; razon: string };

export type CarouselGen = {
  slides: { titulo: string; cuerpo: string; layout?: string }[];
  caption: string;
  hashtags: string[];
  calidad?: QualityGen;
  portada_layout?: string;
};

/** Pide a la IA la composición de portada, limitada a las que usa la marca. */
export function coverLayoutInstruction(allowed: CoverLayout[]): string {
  const pool = COVER_LAYOUTS.filter((l) => allowed.includes(l.value));
  const list = (pool.length ? pool : COVER_LAYOUTS)
    .map((l) => `- "${l.value}" (${l.vibe}): ${l.hint}`)
    .join("\n");
  return `Elige además la composición visual de la PORTADA como "portada_layout", una de estas:
${list}
Usa "numero" solo si el titulo de portada empieza con un número. Varía la elección entre carruseles cuando el gancho lo permita, y prioriza la que mejor sostenga el titular (los titulares largos piden composiciones con más espacio de texto).`;
}

/** Guarda la composición elegida en la portada; si la IA no eligió una válida, el render decide por el título. */
export function applyCoverLayout(gen: CarouselGen, allowed: CoverLayout[]): CarouselGen["slides"] {
  const slides = gen.slides.map(({ titulo, cuerpo }) => ({ titulo, cuerpo }));
  const chosen = COVER_LAYOUTS.find((l) => l.value === gen.portada_layout && allowed.includes(l.value));
  if (slides[0] && chosen) return [{ ...slides[0], layout: chosen.value }, ...slides.slice(1)];
  return slides;
}

export type ScriptGen = {
  beats: { seccion: string; texto: string; edicion?: string; portadas?: string[] }[];
  caption: string;
  hashtags: string[];
  calidad?: QualityGen;
  portadas?: string[];
};

/** Textos cortos para la portada del reel (no el guion hablado). */
export const COVER_TEXTS_INSTRUCTION = `Escribe además "portadas": 6 textos DISTINTOS para la portada/miniatura del reel. Reglas:
- 3 a 7 palabras cada uno, que se lean en 1 segundo en el grid de Instagram. Nada de frases largas.
- Cada uno con un ángulo diferente: número/lista ("3 errores que…"), pregunta que duele, contraste o mito ("X no es el problema"), resultado concreto, curiosidad ("nadie te dice esto…"), orden directa ("deja de…").
- En cada texto envuelve entre **dobles asteriscos** la palabra o frase corta (1-2 palabras) que se debe destacar visualmente.
- Mismo tono de la marca; sin emojis ni hashtags.`;

export function sanitizeCoverTexts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t && t.length <= 80 && (t.match(/\*\*/g) || []).length % 2 === 0)
    .slice(0, 8);
}

/** Guarda los textos de portada en la primera sección del guion (el gancho). */
export function applyCoverTexts(gen: ScriptGen): ScriptGen["beats"] {
  const portadas = sanitizeCoverTexts(gen.portadas);
  if (!portadas.length || !gen.beats[0]) return gen.beats;
  return [{ ...gen.beats[0], portadas }, ...gen.beats.slice(1)];
}

/** Instrucción compartida para que cada sección del guion traiga notas de edición. */
export const EDIT_NOTES_INSTRUCTION = `Además del texto hablado, cada sección lleva un campo "edicion" con indicaciones CONCRETAS para el editor de video: tipo de plano (a cámara, B-roll, pantalla), texto en pantalla si aplica, ritmo de corte y duración aproximada en segundos. Escríbelas como una sola línea compacta, ej: "A cámara, plano medio · texto en pantalla: EL MITO · corte rápido · ~4s".`;

export const QUALITY_BAR = `Al final, autoevalúa la pieza con este listón de calidad (0-100): gancho que rompe patrón (25), tensión/creencia que rompe (25), utilidad real para el cliente ideal (25), CTA claro y accionable (15), coherencia con el tono de marca (10). Sé duro: 90+ solo si de verdad para el scroll. Inclúyelo en el JSON como "calidad": {"score": número, "razon": "1 frase honesta de qué le falta o por qué destaca"}.`;

export function clampQuality(q?: QualityGen): { score: number | null; notes: string | null } {
  if (!q || typeof q.score !== "number") return { score: null, notes: null };
  return {
    score: Math.max(0, Math.min(100, Math.round(q.score))),
    notes: (q.razon || "").slice(0, 300) || null,
  };
}
