import { QUALITY_BAR, coverLayoutInstruction } from "./proposalGen";
import type { CoverLayout } from "./brandDesign";

// Mismo motivo que lib/scriptPrompt.ts: sacar la composición del prompt fuera
// del route handler para poder verificarla en un test.

export type CarouselPromptInput = {
  brief: string;
  ejemplos: string;
  contexto: string;
  /** Composiciones de portada habilitadas para esta marca. */
  coverLayouts: CoverLayout[];
  /** Portadas y cierres ya usados por la marca (lib/diversity.ts). Vacío si no hay histórico. */
  evitar?: string;
  /** Familia de gancho asignada a esta pieza (lib/angles.ts). Vacío si no se rota. */
  angulo?: string;
};

export function buildCarouselPrompts({ brief, ejemplos, contexto, coverLayouts, evitar = "", angulo = "" }: CarouselPromptInput): {
  system: string;
  user: string;
} {
  const system = `Eres un creador de carruseles virales de Instagram. Escribes en español, directo, con ganchos fuertes, en el tono de voz de la marca y pensando en su cliente ideal. Cada slide: titulo corto y potente (máx 60 caracteres) y cuerpo de apoyo (máx 220 caracteres). El primer slide es la portada-gancho (cuerpo breve o vacío). El último slide es el CTA (seguir, guardar, comentar). En el titulo de CADA slide, envuelve entre **dobles asteriscos** la palabra o frase corta (1-3 palabras) más impactante — es la que se resalta visualmente en el diseño del carrusel.\n\nFicha de marca:\n${brief}${ejemplos}`;

  const user = `${contexto}\n\nCrea un carrusel de 6-7 slides.${angulo}${evitar}\n\nDevuelve JSON:\n{"slides": [{"titulo": "...", "cuerpo": "..."}], "caption": "caption completo para el post con salto de líneas y CTA", "hashtags": ["#...", "#..."], "calidad": {"score": 0, "razon": "..."}, "portada_layout": "split"}\nEntre 6 y 7 slides, 15-20 hashtags mezclando volumen alto y nicho.\n${QUALITY_BAR}\n${coverLayoutInstruction(coverLayouts)}`;

  return { system, user };
}
