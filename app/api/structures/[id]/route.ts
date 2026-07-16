import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql, StructureRow } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const sql = getSql();
  // Solo estructuras propias: las builtin (user_id NULL) no se pueden borrar.
  const rows = await sql<StructureRow[]>`
    SELECT * FROM structures WHERE id = ${Number(id)} AND user_id = ${auth.userId}
  `;
  const row = rows[0];
  if (!row) return fail(new Error("Estructura no encontrada"), 404);
  if (row.is_builtin) {
    return fail(new Error("Las estructuras base no se pueden eliminar"), 400);
  }
  await sql`
    DELETE FROM structures WHERE id = ${Number(id)} AND user_id = ${auth.userId}
  `;
  return NextResponse.json({ ok: true });
}
