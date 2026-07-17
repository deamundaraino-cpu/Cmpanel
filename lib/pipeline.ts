import { getSql, ProposalRow } from "./db";

/**
 * Al aprobar una propuesta (desde el panel o desde el enlace del cliente),
 * entra automáticamente al Pipeline como pieza en fase «idea»: ahí el editor
 * la selecciona y arranca su producción (idea → en diseño → listo → publicado).
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
      titulo = (parsed[0]?.titulo || proposal.caption || titulo).slice(0, 90);
    }
  } catch {
    // slides ilegibles: se queda el título genérico
  }

  const hoy = new Date().toISOString().slice(0, 10);
  await sql`
    INSERT INTO calendar_items (client_id, created_at, fecha, titulo, formato, estado, campaign_id, proposal_id, notas)
    VALUES (${proposal.client_id}, ${new Date().toISOString()}, ${hoy}, ${titulo},
      ${proposal.formato === "guion_video" ? "guion_video" : "carrusel"}, 'idea', NULL, ${proposal.id}, '')
  `;
}
