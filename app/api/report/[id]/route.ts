import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { guardClient, fail } from "@/lib/api";
import { getSql, ReportRow } from "@/lib/db";

/** PATCH {action:"share"} — enlace público del informe para enviar al cliente. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (body.action !== "share") return fail(new Error("Acción inválida"), 400);

    const sql = getSql();
    const rows = await sql<ReportRow[]>`
      SELECT * FROM reports WHERE client_id = ${auth.clientId} AND id = ${Number(id)}
    `;
    const report = rows[0];
    if (!report) return fail(new Error("Informe no encontrado"), 404);

    let token = report.share_token;
    if (!token) {
      token = randomUUID();
      await sql`
        UPDATE reports SET share_token = ${token}
        WHERE client_id = ${auth.clientId} AND id = ${Number(id)}
      `;
    }
    return NextResponse.json({ ok: true, token, path: `/informe/${token}` });
  } catch (e) {
    return fail(e);
  }
}
