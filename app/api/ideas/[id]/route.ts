import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

/**
 * Marcas manuales de una idea: si ya se usó en video o en carrusel, o si se
 * descartó («No me sirve» — se oculta y la IA la recibe como "esto no").
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { clientId } = auth;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const sql = getSql();
    const ideaId = Number(id);

    let rows: { id: number }[] = [];
    if (typeof body.usado_video === "boolean") {
      rows = await sql`UPDATE ideas SET usado_video = ${body.usado_video}
        WHERE id = ${ideaId} AND client_id = ${clientId} RETURNING id`;
    } else if (typeof body.usado_carrusel === "boolean") {
      rows = await sql`UPDATE ideas SET usado_carrusel = ${body.usado_carrusel}
        WHERE id = ${ideaId} AND client_id = ${clientId} RETURNING id`;
    } else if (typeof body.descartada === "boolean") {
      rows = await sql`UPDATE ideas SET descartada = ${body.descartada}
        WHERE id = ${ideaId} AND client_id = ${clientId} RETURNING id`;
    } else {
      return fail(new Error("Nada que actualizar"), 400);
    }
    if (!rows.length) return fail(new Error("Idea no encontrada"), 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
