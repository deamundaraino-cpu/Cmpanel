import { getSql } from "./db";
import { stripEmphasis } from "./emphasis";

export type HookRow = {
  id: number;
  client_id: number;
  created_at: string;
  texto: string;
  formato: string | null;
  source_post_id: string | null;
  source_proposal_id: number | null;
  er: number | null;
};

/**
 * Saca el gancho de una propuesta: la primera diapositiva de un carrusel o
 * el primer beat de un guion. Misma forma de `slides` que usa lib/pipeline.ts.
 */
export function extractHook(slides: string | null, formato: string | null): string | null {
  try {
    const parsed = JSON.parse(slides || "[]") as { titulo?: string; texto?: string }[];
    const raw = formato === "guion_video" ? parsed[0]?.texto : parsed[0]?.titulo;
    const limpio = stripEmphasis(raw || "").trim();
    return limpio || null;
  } catch {
    return null;
  }
}

/**
 * Archiva los ganchos que YA funcionaron: posts marcados como ganadores que
 * salieron de una propuesta aprobada. Idempotente (UNIQUE por propuesta), así
 * que puede correr en cada recálculo de scores sin duplicar nada.
 * Excluye posts demo: no deben ensuciar la librería con datos falsos.
 */
export async function extractWinningHooks(clientId: number): Promise<number> {
  const sql = getSql();

  const rows = await sql<
    { proposal_id: number; slides: string | null; formato: string | null; post_id: string; er: number }[]
  >`
    SELECT pr.id AS proposal_id, pr.slides, pr.formato, p.id AS post_id, p.er
    FROM posts p
    JOIN proposals pr
      ON pr.client_id = p.client_id AND pr.post_id = p.id
    WHERE p.client_id = ${clientId}
      AND p.is_winner = 1
      AND p.is_demo = 0
      AND pr.status = 'aprobada'
      AND NOT EXISTS (
        SELECT 1 FROM hooks h
        WHERE h.client_id = ${clientId} AND h.source_proposal_id = pr.id
      )
  `;

  let guardados = 0;
  for (const r of rows) {
    const texto = extractHook(r.slides, r.formato);
    if (!texto) continue;
    await sql`
      INSERT INTO hooks (client_id, created_at, texto, formato, source_post_id, source_proposal_id, er)
      VALUES (${clientId}, ${new Date().toISOString()}, ${texto.slice(0, 300)}, ${r.formato},
        ${r.post_id}, ${r.proposal_id}, ${r.er})
      ON CONFLICT ON CONSTRAINT hooks_client_proposal_uni DO NOTHING
    `;
    guardados++;
  }
  return guardados;
}
