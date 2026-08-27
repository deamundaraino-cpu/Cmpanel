import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const sql = getSql();

  // El client_id va en el WHERE (no solo en un SELECT previo): un id de otro
  // cliente simplemente no borra nada.
  const rows = await sql<{ id: number }[]>`
    DELETE FROM hooks
    WHERE client_id = ${auth.clientId} AND id = ${Number(id)}
    RETURNING id
  `;
  if (!rows.length) return fail(new Error("Gancho no encontrado"), 404);
  return NextResponse.json({ ok: true });
}
