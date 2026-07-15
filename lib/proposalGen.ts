export type QualityGen = { score: number; razon: string };

export type CarouselGen = {
  slides: { titulo: string; cuerpo: string }[];
  caption: string;
  hashtags: string[];
  calidad?: QualityGen;
};

export type ScriptGen = {
  beats: { seccion: string; texto: string }[];
  caption: string;
  hashtags: string[];
  calidad?: QualityGen;
};

export const QUALITY_BAR = `Al final, autoevalúa la pieza con este listón de calidad (0-100): gancho que rompe patrón (25), tensión/creencia que rompe (25), utilidad real para el cliente ideal (25), CTA claro y accionable (15), coherencia con el tono de marca (10). Sé duro: 90+ solo si de verdad para el scroll. Inclúyelo en el JSON como "calidad": {"score": número, "razon": "1 frase honesta de qué le falta o por qué destaca"}.`;

export function clampQuality(q?: QualityGen): { score: number | null; notes: string | null } {
  if (!q || typeof q.score !== "number") return { score: null, notes: null };
  return {
    score: Math.max(0, Math.min(100, Math.round(q.score))),
    notes: (q.razon || "").slice(0, 300) || null,
  };
}
