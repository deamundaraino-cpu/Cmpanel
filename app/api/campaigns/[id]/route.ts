import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

const EDITABLE = ["nombre", "descripcion", "color", "fecha_inicio", "fecha_fin", "estado"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard();
  if (g) return g;
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: Record<string, string | number | null> = {};
    for (const key of EDITABLE) {
      if (key in body) patch[key] = body[key] ?? null;
    }
    const keys = Object.keys(patch);
    if (!keys.length) return fail(new Error("Nada que actualizar"), 400);
    const sql = getSql();
    await sql`UPDATE campaigns SET ${sql(patch, ...keys)} WHERE id = ${Number(id)}`;
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
  const sql = getSql();
  await sql`UPDATE posts SET campaign_id = NULL WHERE campaign_id = ${Number(id)}`;
  await sql`UPDATE calendar_items SET campaign_id = NULL WHERE campaign_id = ${Number(id)}`;
  await sql`DELETE FROM campaigns WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
