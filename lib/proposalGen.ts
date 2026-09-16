export type QualityGen = { score: number; razon: string };

export type CarouselGen = {
  slides: { titulo: string; cuerpo: string; layout?: string }[];
  caption: string;
  hashtags: string[];
  calidad?: QualityGen;
  portada_layout?: string;
};

const COVER_LAYOUT_VALUES = ["split", "texto_detras", "numero"];

/** Pide a la IA la composición de portada (solo se usa con el estilo "Con tu foto"). */
export const COVER_LAYOUT_INSTRUCTION = `Elige además la composición visual de la PORTADA como "portada_layout", una de:
- "numero": SOLO si el titulo de la portada empieza con un número (ej: "3 errores que…"). El número se muestra gigante.
- "texto_detras": si la frase clave entre ** es 1-2 palabras cortas y potentes (máx 12 letras). Esa palabra va gigante detrás de la persona.
- "split": para ganchos más largos, preguntas o frases de autoridad. Titular en un bloque de color junto a la persona.
Varía la elección entre carruseles cuando el gancho lo permita.`;

/** Guarda la composición elegida en la portada; si la IA no eligió una válida, el render decide por el título. */
export function applyCoverLayout(gen: CarouselGen): CarouselGen["slides"] {
  const slides = gen.slides.map(({ titulo, cuerpo }) => ({ titulo, cuerpo }));
  if (slides[0] && COVER_LAYOUT_VALUES.includes(gen.portada_layout || "")) {
    return [{ ...slides[0], layout: gen.portada_layout }, ...slides.slice(1)];
  }
  return slides;
}

export type ScriptGen = {
  beats: { seccion: string; texto: string; edicion?: string }[];
  caption: string;
  hashtags: string[];
  calidad?: QualityGen;
};

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
