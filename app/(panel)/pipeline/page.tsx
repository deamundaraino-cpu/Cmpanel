import Link from "next/link";
import { getSql, CalendarItemRow, CampaignRow, ProposalRow } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import PipelineBoard, { type PieceContent, type PostOption } from "@/components/PipelineBoard";
import { stripEmphasis } from "@/lib/emphasis";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { clientId } = await requireClient();
  const sql = getSql();
  const items = await sql<CalendarItemRow[]>`
    SELECT * FROM calendar_items WHERE client_id = ${clientId} ORDER BY fecha ASC
  `;
  const campaigns = await sql<CampaignRow[]>`
    SELECT * FROM campaigns WHERE client_id = ${clientId} ORDER BY created_at DESC
  `;

  // Posts recientes para enlazar cada pieza con su publicación real.
  const recent = await sql<{ id: string; caption: string | null; timestamp: string | null; perf_ratio: number | null }[]>`
    SELECT id, caption, timestamp, perf_ratio FROM posts
    WHERE client_id = ${clientId} ORDER BY timestamp DESC NULLS LAST LIMIT 40
  `;
  const posts: PostOption[] = recent.map((p) => ({
    id: p.id,
    perf_ratio: p.perf_ratio,
    label: `${p.timestamp ? p.timestamp.slice(0, 10) : "s/f"} · ${stripEmphasis(p.caption || "(sin texto)").slice(0, 50)}`,
  }));

  // Contenido de cada pieza (guion o slides + copy) para verlo sin salir del tablero.
  const proposalIds = items.map((i) => i.proposal_id).filter((id): id is number => id != null);
  const proposals = proposalIds.length
    ? await sql<ProposalRow[]>`
        SELECT id, formato, slides, caption, hashtags FROM proposals
        WHERE client_id = ${clientId} AND id IN ${sql(proposalIds)}
      `
    : [];
  const content: Record<number, PieceContent> = {};
  for (const p of proposals) {
    let slides: PieceContent["slides"] = [];
    let hashtags: string[] = [];
    try {
      slides = JSON.parse(p.slides || "[]");
    } catch {}
    try {
      hashtags = JSON.parse(p.hashtags || "[]");
    } catch {}
    content[p.id] = { formato: p.formato, slides, caption: p.caption || "", hashtags };
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <h1 className="text-2xl font-semibold tracking-tight">Pipeline de producción</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Las mismas piezas del{" "}
        <Link href="/calendario" className="text-indigo-400 hover:text-indigo-300">
          Calendario
        </Link>
, vistas como tablero de producción: guion → grabación → edición →
        revisión → publicación. Abre una pieza para fijar la entrega de edición
        y copiar el brief para tu editor.
      </p>

      <div className="mt-6">
        <PipelineBoard
          items={items}
          content={content}
          posts={posts}
          campaigns={campaigns.map((c) => ({ id: c.id, nombre: c.nombre, color: c.color }))}
        />
      </div>
    </div>
  );
}
