import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, RecordingSessionRow } from "@/lib/db";
import { assignToSession } from "@/lib/recording";

export async function GET() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const rows = await getSql()<RecordingSessionRow[]>`
    SELECT * FROM recording_sessions WHERE client_id = ${auth.clientId} ORDER BY fecha DESC
  `;
  return NextResponse.json(rows);
}

/** body: { fecha: "YYYY-MM-DD", notas?, itemIds?: number[] } */
export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    const fecha = String(body.fecha || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fail(new Error("Fecha inválida"), 400);
    const sql = getSql();
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO recording_sessions (client_id, created_at, fecha, notas, estado)
      VALUES (${auth.clientId}, ${new Date().toISOString()}, ${fecha}, ${String(body.notas || "").slice(0, 2000) || null}, 'planificada')
      RETURNING id
    `;
    const asignadas = Array.isArray(body.itemIds)
      ? await assignToSession(auth.clientId, row.id, body.itemIds)
      : 0;
    return NextResponse.json({ ok: true, id: row.id, asignadas });
  } catch (e) {
    return fail(e);
  }
}
