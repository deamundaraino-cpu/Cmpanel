import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const patch: Record<string, string | number | null> = {};
    if ("is_lead" in body) patch.is_lead = body.is_lead ? 1 : 0;
    if ("nota" in body) patch.nota = String(body.nota ?? "").slice(0, 500) || null;

    const keys = Object.keys(patch);
    if (!keys.length) return fail(new Error("Nada que actualizar"), 400);

    const sql = getSql();
    const rows = await sql<{ id: string }[]>`
      UPDATE comments SET ${sql(patch, ...keys)}
      WHERE client_id = ${auth.clientId} AND id = ${id}
      RETURNING id
    `;
    if (!rows.length) return fail(new Error("Comentario no encontrado"), 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
