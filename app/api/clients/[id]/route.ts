import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

const EDITABLE = ["nombre", "color", "estado"] as const;
const VALID_STATES = new Set(["activo", "archivado"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    if ("estado" in body && !VALID_STATES.has(body.estado)) {
      return fail(new Error("Estado inválido"), 400);
    }
    if ("nombre" in body && !String(body.nombre || "").trim()) {
      return fail(new Error("El nombre no puede quedar vacío"), 400);
    }
    const patch: Record<string, string> = {};
    for (const key of EDITABLE) {
      if (key in body) patch[key] = String(body[key]).slice(0, 80);
    }
    const keys = Object.keys(patch);
    if (!keys.length) return fail(new Error("Nada que actualizar"), 400);
    const sql = getSql();
    await sql`
      UPDATE clients SET ${sql(patch, ...keys)}
      WHERE owner_user_id = ${auth.userId} AND id = ${Number(id)}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

/** Borra el cliente y TODO su contenido (cascada). Irreversible. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await getSql()`
    DELETE FROM clients WHERE owner_user_id = ${auth.userId} AND id = ${Number(id)}
  `;
  return NextResponse.json({ ok: true });
}
