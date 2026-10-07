import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

const num = (v: unknown) => {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Añade una pieza pegada a mano. body: { texto, url?, formato?, vistas?, likes?, comentarios? } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const referenteId = Number((await params).id);
    const body = await req.json().catch(() => ({}));
    const texto = String(body.texto || "").trim().slice(0, 8000);
    if (texto.length < 20) return fail(new Error("Pega el caption o la transcripción (mínimo 20 caracteres)"), 400);
    const sql = getSql();
    const [ref] = await sql`SELECT id FROM referentes WHERE client_id = ${auth.clientId} AND id = ${referenteId}`;
    if (!ref) return fail(new Error("Referente no encontrado"), 404);
    const url = String(body.url || "").trim().slice(0, 500);
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO referente_piezas (client_id, referente_id, created_at, url, formato, texto, vistas, likes, comentarios)
      VALUES (${auth.clientId}, ${referenteId}, ${new Date().toISOString()},
        ${/^https?:\/\//.test(url) ? url : null}, ${String(body.formato || "").slice(0, 40) || null}, ${texto},
        ${num(body.vistas)}, ${num(body.likes)}, ${num(body.comentarios)})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return fail(e);
  }
}

/** body: { nombre?, notas? } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const id = Number((await params).id);
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, string | null> = {};
    if (typeof body.nombre === "string") patch.nombre = body.nombre.slice(0, 120) || null;
    if (typeof body.notas === "string") patch.notas = body.notas.slice(0, 2000) || null;
    const keys = Object.keys(patch);
    if (!keys.length) return fail(new Error("Nada que actualizar"), 400);
    const sql = getSql();
    await sql`UPDATE referentes SET ${sql(patch, ...keys)} WHERE client_id = ${auth.clientId} AND id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const id = Number((await params).id);
  await getSql()`DELETE FROM referentes WHERE client_id = ${auth.clientId} AND id = ${id}`;
  return NextResponse.json({ ok: true });
}
