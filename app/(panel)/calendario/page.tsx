import Link from "next/link";
import { getSql, CalendarItemRow, CampaignRow } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import CalendarBoard from "@/components/CalendarBoard";

export const dynamic = "force-dynamic";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = /^\d{4}-\d{2}$/.test(sp.month || "") ? sp.month! : defaultMonth;

  const { clientId } = await requireClient();
  const sql = getSql();
  const items = await sql<CalendarItemRow[]>`
    SELECT * FROM calendar_items
    WHERE client_id = ${clientId} AND fecha LIKE ${month + "%"} ORDER BY fecha ASC
  `;
  const campaigns = await sql<CampaignRow[]>`
    SELECT * FROM campaigns
    WHERE client_id = ${clientId} AND estado = 'activa' ORDER BY created_at DESC
  `;

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const publicados = items.filter((i) => i.estado === "publicado").length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario de contenidos</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            Planifica y sigue el estado de cada pieza. {items.length} piezas este
            mes · {publicados} publicadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendario?month=${shiftMonth(month, -1)}`}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700"
          >
            ←
          </Link>
          <span className="min-w-[150px] text-center text-sm font-medium capitalize">
            {monthLabel}
          </span>
          <Link
            href={`/calendario?month=${shiftMonth(month, 1)}`}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700"
          >
            →
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <CalendarBoard
          month={month}
          items={items}
          campaigns={campaigns.map((c) => ({ id: c.id, nombre: c.nombre, color: c.color }))}
        />
      </div>
    </div>
  );
}
