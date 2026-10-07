import { getSql, ProposalRow } from "./db";
import { stripEmphasis } from "./emphasis";
import { initialStateFor } from "./pipelineStates";

/**
 * Al aprobar una propuesta (desde el panel o desde el enlace del cliente),
 * entra automáticamente al Pipeline: un guion en «por grabar» y un carrusel
 * en «en edición» (diseño). Las fases viven en lib/pipelineStates.ts.
 * Idempotente: si la propuesta ya tiene su pieza en el pipeline, no duplica.
 */
export async function ensurePipelineItem(proposal: ProposalRow): Promise<void> {
  const sql = getSql();
  const existing = await sql`
    SELECT id FROM calendar_items
    WHERE client_id = ${proposal.client_id} AND proposal_id = ${proposal.id}
  `;
  if (existing.length) return;

  let titulo = "Propuesta aprobada";
  try {
    const parsed = JSON.parse(proposal.slides || "[]") as {
      titulo?: string;
      texto?: string;
    }[];
    if (proposal.formato === "guion_video") {
      titulo = (parsed[0]?.texto || proposal.caption || titulo).slice(0, 90);
    } else {
      titulo = stripEmphasis(parsed[0]?.titulo || proposal.caption || titulo).slice(0, 90);
    }
  } catch {
    // slides ilegibles: se queda el título genérico
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const formato = proposal.formato === "guion_video" ? "guion_video" : "carrusel";
  await sql`
    INSERT INTO calendar_items (client_id, created_at, fecha, titulo, formato, estado, campaign_id, proposal_id, notas, pilar)
    VALUES (${proposal.client_id}, ${new Date().toISOString()}, ${hoy}, ${titulo},
      ${formato}, ${initialStateFor(formato)}, NULL, ${proposal.id}, '',
      ${proposal.pilar ?? null})
  `;
}
