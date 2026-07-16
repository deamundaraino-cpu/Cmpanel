import Link from "next/link";
import { getSql, CalendarItemRow, CampaignRow } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PipelineBoard from "@/components/PipelineBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { userId } = await requireUser();
  const sql = getSql();
  const items = await sql<CalendarItemRow[]>`
    SELECT * FROM calendar_items WHERE user_id = ${userId} ORDER BY fecha ASC
  `;
  const campaigns = await sql<CampaignRow[]>`
    SELECT * FROM campaigns WHERE user_id = ${userId} ORDER BY created_at DESC
  `;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">Pipeline de producción</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Las mismas piezas del{" "}
        <Link href="/calendario" className="text-indigo-400 hover:text-indigo-300">
          Calendario
        </Link>
        , vistas como tablero de trabajo: mueve cada pieza según avanza tu
        producción.
      </p>

      <div className="mt-6">
        <PipelineBoard
          items={items}
          campaigns={campaigns.map((c) => ({ id: c.id, nombre: c.nombre, color: c.color }))}
        />
      </div>
    </div>
  );
}
