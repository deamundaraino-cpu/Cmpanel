import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

const EDITABLE = ["fecha", "titulo", "formato", "estado", "campaign_id", "notas"] as const;
const VALID_STATES = new Set(["idea", "en_diseno", "listo", "publicado"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard();
  if (g) return g;
  try {
    const { id } = await params;
    const body = await req.json();
    if ("estado" in body && !VALID_STATES.has(body.estado)) {
      return fail(new Error("Estado inválido"), 400);
    }
    const patch: Record<string, string | number | null> = {};
    for (const key of EDITABLE) {
      if (key in body) patch[key] = body[key] ?? null;
    }
    const keys = Object.keys(patch);
    if (!keys.length) return fail(new Error("Nada que actualizar"), 400);
    const sql = getSql();
    await sql`UPDATE calendar_items SET ${sql(patch, ...keys)} WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard();
  if (g) return g;
  const { id } = await params;
  await getSql()`DELETE FROM calendar_items WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
