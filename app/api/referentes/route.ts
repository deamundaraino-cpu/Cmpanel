import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, ReferenteRow, ReferentePiezaRow } from "@/lib/db";

export async function GET() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const sql = getSql();
  const referentes = await sql<ReferenteRow[]>`
    SELECT * FROM referentes WHERE client_id = ${auth.clientId} ORDER BY id ASC
  `;
  const piezas = await sql<ReferentePiezaRow[]>`
    SELECT * FROM referente_piezas WHERE client_id = ${auth.clientId} ORDER BY id DESC
  `;
  return NextResponse.json({ referentes, piezas });
}

/** body: { handle, nombre?, notas? } */
export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    const handle = String(body.handle || "").trim().replace(/^@/, "").slice(0, 60);
    if (!handle) return fail(new Error("Falta el @ de la cuenta"), 400);
    const [row] = await getSql()<{ id: number }[]>`
      INSERT INTO referentes (client_id, created_at, handle, nombre, notas)
      VALUES (${auth.clientId}, ${new Date().toISOString()}, ${handle},
        ${String(body.nombre || "").slice(0, 120) || null}, ${String(body.notas || "").slice(0, 2000) || null})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return fail(e);
  }
}
