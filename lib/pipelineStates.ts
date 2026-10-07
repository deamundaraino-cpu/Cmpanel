/**
 * Fases de producción de una pieza (fuente única para API, Pipeline y Calendario).
 * Un vídeo pasa por grabación; un carrusel salta directo a diseño (en_edicion).
 * Sin dependencias: se testea con scripts/test-pipeline-states.mjs.
 */

export const ESTADOS = [
  "idea",
  "por_grabar",
  "grabado",
  "en_edicion",
  "revision",
  "listo",
  "publicado",
] as const;

export type Estado = (typeof ESTADOS)[number];

const FLOW_VIDEO: readonly Estado[] = ESTADOS;
const FLOW_CARRUSEL: readonly Estado[] = ["idea", "en_edicion", "revision", "listo", "publicado"];

export const LABEL: Record<Estado, string> = {
  idea: "💡 Idea",
  por_grabar: "🎙️ Por grabar",
  grabado: "📼 Grabado",
  en_edicion: "✂️ En edición",
  revision: "👀 Revisión",
  listo: "✅ Listo",
  publicado: "🚀 Publicado",
};

/** Estados que se dieron de baja; se siguen aceptando mientras haya datos viejos. */
const LEGACY: Record<string, Estado> = { en_diseno: "en_edicion" };

export function normalizeState(estado: string | null | undefined): Estado | null {
  if (!estado) return null;
  if ((ESTADOS as readonly string[]).includes(estado)) return estado as Estado;
  return LEGACY[estado] ?? null;
}

export function isValidState(estado: unknown): boolean {
  return typeof estado === "string" && normalizeState(estado) !== null;
}

export function isVideo(formato: string | null | undefined): boolean {
  return formato === "guion_video" || formato === "reel" || formato === "video";
}

export function flowFor(formato: string | null | undefined): readonly Estado[] {
  return isVideo(formato) ? FLOW_VIDEO : FLOW_CARRUSEL;
}

/** Siguiente/anterior fase dentro del flujo de su formato (null si no hay). */
export function stepState(
  formato: string | null | undefined,
  estado: string,
  dir: 1 | -1
): Estado | null {
  const flow = flowFor(formato);
  const current = normalizeState(estado) ?? "idea";
  let idx = flow.indexOf(current);
  // Un estado que no existe en este flujo (p. ej. carrusel en «grabado») se
  // recoloca en la fase más cercana hacia delante.
  if (idx === -1) {
    const global = ESTADOS.indexOf(current);
    idx = flow.findIndex((s) => ESTADOS.indexOf(s) > global) - 1;
  }
  return flow[idx + dir] ?? null;
}

/** Estado con el que entra al Pipeline una propuesta recién aprobada. */
export function initialStateFor(formato: string | null | undefined): Estado {
  return isVideo(formato) ? "por_grabar" : "en_edicion";
}
