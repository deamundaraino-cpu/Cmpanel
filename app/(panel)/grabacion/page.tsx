import Link from "next/link";
import { getSql, CalendarItemRow, ProposalRow, RecordingSessionRow } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { stripEmphasis } from "@/lib/emphasis";
import PageHeader from "@/components/PageHeader";
import RecordingBoard, { type RecItem } from "@/components/RecordingBoard";

export const dynamic = "force-dynamic";

export default async function GrabacionPage() {
  const { clientId } = await requireClient();
  const sql = getSql();

  const sessions = await sql<RecordingSessionRow[]>`
    SELECT * FROM recording_sessions WHERE client_id = ${clientId} ORDER BY fecha ASC
  `;
  // Vídeos esperando grabación + todo lo que ya cuelga de una sesión.
  const items = await sql<CalendarItemRow[]>`
    SELECT * FROM calendar_items
    WHERE client_id = ${clientId}
      AND formato IN ('guion_video', 'reel', 'video')
      AND (estado = 'por_grabar' OR session_id IS NOT NULL)
    ORDER BY fecha ASC
  `;

  const proposalIds = [...new Set(items.map((i) => i.proposal_id).filter((id): id is number => id != null))];
  const proposals = proposalIds.length
    ? await sql<Pick<ProposalRow, "id" | "slides">[]>`
        SELECT id, slides FROM proposals WHERE client_id = ${clientId} AND id IN ${sql(proposalIds)}
      `
    : [];
  // Para el teleprompter solo interesa lo que se dice, sin notas de edición.
  const spoken = new Map<number, string[]>();
  for (const p of proposals) {
    try {
      const beats = JSON.parse(p.slides || "[]") as { texto?: string }[];
      spoken.set(p.id, beats.map((b) => stripEmphasis(b.texto || "").trim()).filter(Boolean));
    } catch {
      spoken.set(p.id, []);
    }
  }

  const recItems: RecItem[] = items.map((i) => ({
    id: i.id,
    titulo: i.titulo,
    fecha: i.fecha,
    estado: i.estado,
    version: i.version,
    parent_item_id: i.parent_item_id,
    session_id: i.session_id,
    bloques: i.proposal_id ? spoken.get(i.proposal_id) || [] : [],
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Grabación"
        subtitle={
          <>
            Graba por lotes: un día a la semana, todos los guiones juntos y con teleprompter. Al marcar una
            pieza como grabada pasa a «Grabado» en el{" "}
            <Link href="/pipeline" className="text-indigo-400 hover:text-indigo-300">
              Pipeline
            </Link>{" "}
            (junto con su versión corta o larga, si la duplicaste).
          </>
        }
      />
      <div className="mt-6">
        <RecordingBoard
          sessions={sessions.map((s) => ({ id: s.id, fecha: s.fecha, notas: s.notas, estado: s.estado }))}
          items={recItems}
        />
      </div>
    </div>
  );
}
