import { StructureBeat } from "./db";
import { findViolations, type BannedRule, type Violation } from "./brandRules";
import { QUALITY_BAR, EDIT_NOTES_INSTRUCTION, COVER_TEXTS_INSTRUCTION } from "./proposalGen";

// El prompt del guion vivía dentro del route handler, así que no había forma de
// comprobarlo sin levantar la DB y la red. Aquí se compone como función pura:
// los tests pasan la ficha y la estructura y comparan el string resultante.

export type ScriptPromptInput = {
  /** Ficha de marca ya montada (incluye el manual de redacción). */
  brief: string;
  /** Bloque de piezas aprobadas; cadena vacía si la marca aún no aprobó ninguna. */
  ejemplos: string;
  /** Post ganador o tema de partida, ya descrito. */
  contexto: string;
  beats: StructureBeat[];
  /** Familia de gancho asignada a esta pieza (lib/angles.ts). Vacío si no se rota. */
  angulo?: string;
  /** Aperturas y cierres ya usados por la marca (lib/diversity.ts). Vacío si no hay histórico. */
  evitar?: string;
};

/** Las secciones de la estructura, numeradas, tal como las lee el modelo. */
export function buildBeatsGuide(beats: StructureBeat[]): string {
  return beats.map((b, i) => `${i + 1}. ${b.nombre}${b.guia ? `: ${b.guia}` : ""}`).join("\n");
}

/**
 * Una estructura del usuario puede contener frases que la propia marca prohíbe
 * (las base las traían). Si la guía infringe, se le quitan los ejemplos
 * literales y, si aún infringe, se conservan solo las frases que cumplen: antes
 * el modelo obedecía a la plantilla y luego el filtro castigaba la pieza.
 */
export function sanitizeGuide(beats: StructureBeat[], rules: BannedRule[]): StructureBeat[] {
  if (!rules.length) return beats;
  return beats.map((b) => {
    const guia = b.guia || "";
    if (!findViolations(guia, rules).length) return b;

    const sinEjemplos = guia.replace(/\s*(ej\.?|ejemplo|por ejemplo)\s*:[\s\S]*$/i, "").trim();
    if (sinEjemplos && !findViolations(sinEjemplos, rules).length) return { ...b, guia: sinEjemplos };

    const limpio = sinEjemplos
      .split(/(?<=[.!?])\s+/)
      .filter((f) => f.trim() && !findViolations(f, rules).length)
      .join(" ")
      .trim();
    return { ...b, guia: limpio };
  });
}

/**
 * Cuántas secciones se admiten. El número es orientativo —obligar a rellenar N
 * casillas sobre un tema corto produce relleno—, pero el mínimo se comprueba:
 * sin él, el modelo entrega cuatro bloques y deja la pieza sin cierre.
 */
export function sectionRange(beats: StructureBeat[]): { min: number; max: number } {
  return { min: Math.max(3, beats.length - 1), max: beats.length + 1 };
}

/** Se comprueba después de generar, porque pedirlo en el prompt no basta. */
export function sectionCountViolations(gen: unknown, rango: { min: number; max: number }): Violation[] {
  const g = gen as { beats?: unknown[] };
  if (!Array.isArray(g?.beats) || !g.beats.length) return [];
  const n = g.beats.length;
  if (n >= rango.min && n <= rango.max) return [];
  return [
    n < rango.min
      ? {
          label: `Guion incompleto (${n} secciones)`,
          level: "estilo",
          explain: `El guion se queda en ${n} secciones y el plan admite entre ${rango.min} y ${rango.max}. La última sección tiene que CERRAR la pieza: si termina en un bloque de transición, el video queda a medias.`,
        }
      : {
          label: `Guion sobrado (${n} secciones)`,
          level: "estilo",
          explain: `El guion tiene ${n} secciones y el plan admite hasta ${rango.max}. Funde las que estén diciendo lo mismo.`,
        },
  ];
}

export function buildScriptPrompts({ brief, ejemplos, contexto, beats, evitar = "", angulo = "" }: ScriptPromptInput): {
  system: string;
  user: string;
} {
  const beatsGuide = buildBeatsGuide(beats);
  const { min, max } = sectionRange(beats);

  const system = `Eres un guionista experto en contenido de video corto (Reels, TikTok, Shorts) que domina estructuras probadas de retención y trabaja mano a mano con editores de video. Escribes en español, en el tono de voz de la marca, pensando en su cliente ideal. Escribes el texto EXACTO que la persona debe decir a cámara en cada sección (no descripciones ni instrucciones, el guion real hablado).\n\nFicha de marca:\n${brief}${ejemplos}`;

  const user = `${contexto}\n\nPLAN DE INTENCIÓN — lo que tiene que CONSEGUIR cada bloque, no lo que tiene que decir. Cúmplelo como objetivo, no como plantilla: si dos bloques distintos te salen con la misma forma, el plan está mal ejecutado.\n${beatsGuide}\n\nLos nombres de los bloques son etiquetas internas: renómbralos para que describan lo que de verdad pasa en ESTA pieza. Puedes fusionar dos bloques, o partir uno, si el tema lo pide. Respeta el orden de la intención y entrega entre ${min} y ${max} secciones. La última tiene que cerrar la pieza: nunca termines en un bloque de transición.\n\n${EDIT_NOTES_INSTRUCTION}\n\nEn el texto de la PRIMERA sección (el gancho inicial), envuelve entre **dobles asteriscos** la frase corta (2-5 palabras) más potente — se usa para generar la portada/miniatura del video.${angulo}${evitar}\n\nDevuelve JSON:\n{"beats": [{"seccion": "nombre corto de la sección", "texto": "guion hablado de esta sección", "edicion": "indicaciones de edición de esta sección"}, ...], "caption": "descripción/copy corto para acompañar el video al publicarlo", "hashtags": ["#...", "#..."], "calidad": {"score": 0, "razon": "..."}, "portadas": ["...", "..."]}\nNombres de sección cortos, sin dos puntos ni comas. 10-15 hashtags.\n${QUALITY_BAR}\n${COVER_TEXTS_INSTRUCTION}`;

  return { system, user };
}

/**
 * ¿El feedback pide un cambio de fondo o solo un retoque?
 *
 * Importa porque el prompt de revisión hacía las dos cosas a la vez: el rol
 * autorizaba reescribir el bloque completo y el mensaje siguiente reimponía la
 * estructura y sus nombres. Ganaba el ancla, así que "dame otro gancho" devolvía
 * el mismo gancho maquillado.
 */
const PIDE_REESCRITURA =
  /\b(otro|otra|nuevo|nueva)\s+(gancho|apertura|[áa]ngulo|enfoque|inicio|comienzo|entrada|cierre)\b|\bempie(za|ce)\s+(distinto|diferente|de otra)|\bcambia(r)?\s+(el|la)\s+([áa]ngulo|enfoque|orden|estructura|gancho|apertura)|\bse parece\b|\b(demasiado|muy)\s+parecid|\brepetid|\breescrib|\bdesde cero\b|\bno me gusta\b|\bsuena igual\b|\bes el mismo\b/i;

export function feedbackWantsRewrite(feedback: string): boolean {
  return PIDE_REESCRITURA.test(feedback || "");
}

export type ScriptRevisionInput = {
  brief: string;
  ejemplos: string;
  feedback: string;
  /** Guion actual en texto plano (pieceToText), nunca el JSON crudo. */
  actual: string;
  caption: string;
  /** Estructura de origen, si la propuesta la tiene. */
  beats: StructureBeat[] | null;
  evitar?: string;
  angulo?: string;
};

export function buildScriptRevisionPrompts({
  brief,
  ejemplos,
  feedback,
  actual,
  caption,
  beats,
  evitar = "",
  angulo = "",
}: ScriptRevisionInput): { system: string; user: string; reescribe: boolean } {
  const reescribe = feedbackWantsRewrite(feedback);

  const estructura = !beats?.length
    ? ""
    : reescribe
      ? `\n\nPlan de intención de referencia (puedes cambiarlo, fusionar bloques o renombrarlos si el feedback lo pide):\n${buildBeatsGuide(beats)}`
      : `\n\nPlan de intención de la pieza — mantén este recorrido, el feedback es un ajuste dentro de él:\n${buildBeatsGuide(beats)}`;

  // El guion previo entra como texto plano: pasarlo como JSON, con sus claves
  // "seccion", "edicion" y "portadas", anclaba al modelo al fraseo anterior.
  const previo = reescribe
    ? `Versión anterior — sirve como referencia de CONTENIDO, no de fraseo. No la retoques: reescríbela.\n${actual}`
    : `Versión anterior:\n${actual}`;

  const system = `Eres un guionista experto en video corto. Revisas guiones aplicando el feedback del creador${
    reescribe ? " reescribiendo de raíz lo que el feedback cuestiona" : " sin perder lo que ya funciona"
  }. Escribes en español, en el tono de la marca.\n\nFicha de marca:\n${brief}${ejemplos}`;

  const user = `${previo}\n\nCaption actual:\n${caption}\n\nFEEDBACK (aplícalo):\n"""${feedback.slice(0, 600)}"""${estructura}${angulo}${evitar}\n\n${EDIT_NOTES_INSTRUCTION}\n\nEn el texto de la PRIMERA sección (el gancho inicial), envuelve entre **dobles asteriscos** la frase corta (2-5 palabras) más potente — se usa para generar la portada/miniatura del video.\n\nDevuelve JSON:\n{"beats": [{"seccion": "nombre corto de la sección", "texto": "...", "edicion": "..."}], "caption": "...", "hashtags": ["#..."], "calidad": {"score": 0, "razon": "..."}, "portadas": ["...", "..."]}\nNombres de sección cortos, sin dos puntos ni comas.\n${QUALITY_BAR}\n${COVER_TEXTS_INSTRUCTION}`;

  return { system, user, reescribe };
}
