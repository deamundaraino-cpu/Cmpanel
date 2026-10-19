import { getSql, PostRow } from "./db";

/**
 * Exprimir un ganador: de un post que rindió por encima de la media salen sus
 * versiones en otros formatos. Compartido por /api/exprimir (IA interna) y el MCP.
 */

export const EXPRIMIR_CORTO = "Hook-Lead-Body-Open Loop-CTA";
export const EXPRIMIR_LARGO = "Vídeo largo (5-8 min)";

export type PiezaExprimir = "carrusel" | "corto" | "largo";
export const EXPRIMIR_ORDEN: PiezaExprimir[] = ["corto", "carrusel", "largo"];

const ENFOQUE: Record<PiezaExprimir, string> = {
  corto: "Versión REEL CORTO (30-60 s): la idea central con un gancho nuevo, directa al grano.",
  carrusel: "Versión CARRUSEL: la misma idea convertida en pasos, lista o comparación que den ganas de guardar.",
  largo: "Versión LARGA (5-8 min): profundiza donde el post solo apuntaba — método, casos, matices y errores comunes.",
};

/** Contexto de partida de una pieza exprimida. */
export function exprimirContext(post: PostRow, pieza: PiezaExprimir): string {
  const ratio = post.perf_ratio ? `, ×${post.perf_ratio.toFixed(1)} sobre la media de la cuenta` : "";
  const tipo = post.media_product_type === "REELS" ? "reel" : post.media_type === "CAROUSEL_ALBUM" ? "carrusel" : "post";
  return `Este ${tipo} fue un GANADOR en Instagram (alcance ${post.reach}, ${post.saved} guardados, ${post.shares} compartidos${ratio}):\n\nCaption original:\n"""${(post.caption || "").slice(0, 800)}"""\n\nEXPRIMIR UN GANADOR: conserva la idea de fondo y la tesis que conectaron, pero adáptala a otro formato con un gancho distinto. No copies el caption.\n\n${ENFOQUE[pieza]}`;
}

/** Ids de las estructuras base del reel corto y del vídeo largo. */
export async function exprimirStructureIds(): Promise<{ corto?: number; largo?: number }> {
  const builtins = await getSql()<{ id: number; nombre: string }[]>`
    SELECT id, nombre FROM structures
    WHERE user_id IS NULL AND client_id IS NULL AND nombre IN (${EXPRIMIR_CORTO}, ${EXPRIMIR_LARGO})
  `;
  return {
    corto: builtins.find((s) => s.nombre === EXPRIMIR_CORTO)?.id,
    largo: builtins.find((s) => s.nombre === EXPRIMIR_LARGO)?.id,
  };
}
