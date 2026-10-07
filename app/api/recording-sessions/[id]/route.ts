import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql } from "@/lib/db";
import { assignToSession, markRecorded } from "@/lib/recording";

/**
 * body:
 *   { action: "asignar", itemIds: number[] }  — añade piezas a la sesión
 *   { action: "quitar", itemId }              — la saca de la sesión
 *   { action: "grabado", itemId }             — pieza (y gemela) → grabado
 *   { action: "cerrar" } / { action: "reabrir" }
 *   { fecha?, notas? }                        — edita la sesión
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const sessionId = Number((await params).id);
    const body = await req.json().catch(() => ({}));
    const sql = getSql();
    const [session] = await sql`
      SELECT id FROM recording_sessions WHERE client_id = ${auth.clientId} AND id = ${sessionId}
    `;
    if (!session) return fail(new Error("Sesión no encontrada"), 404);

    switch (body.action) {
      case "asignar": {
        const n = await assignToSession(auth.clientId, sessionId, Array.isArray(body.itemIds) ? body.itemIds : []);
        return NextResponse.json({ ok: true, asignadas: n });
      }
      case "quitar":
        await sql`
          UPDATE calendar_items SET session_id = NULL
          WHERE client_id = ${auth.clientId} AND session_id = ${sessionId} AND id = ${Number(body.itemId)}
        `;
        return NextResponse.json({ ok: true });
      case "grabado": {
        const n = await markRecorded(auth.clientId, Number(body.itemId));
        return NextResponse.json({ ok: true, grabadas: n });
      }
      case "cerrar":
      case "reabrir":
        await sql`
          UPDATE recording_sessions SET estado = ${body.action === "cerrar" ? "hecha" : "planificada"}
          WHERE client_id = ${auth.clientId} AND id = ${sessionId}
        `;
        return NextResponse.json({ ok: true });
    }

    const patch: Record<string, string | null> = {};
    if (typeof body.fecha === "string") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha)) return fail(new Error("Fecha inválida"), 400);
      patch.fecha = body.fecha;
    }
    if (typeof body.notas === "string") patch.notas = body.notas.slice(0, 2000) || null;
    const keys = Object.keys(patch);
    if (!keys.length) return fail(new Error("Nada que actualizar"), 400);
    await sql`
      UPDATE recording_sessions SET ${sql(patch, ...keys)}
      WHERE client_id = ${auth.clientId} AND id = ${sessionId}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

/** Borra la sesión; sus piezas vuelven a quedar sin sesión (FK ON DELETE SET NULL). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const sessionId = Number((await params).id);
  await getSql()`
    DELETE FROM recording_sessions WHERE client_id = ${auth.clientId} AND id = ${sessionId}
  `;
  return NextResponse.json({ ok: true });
}
