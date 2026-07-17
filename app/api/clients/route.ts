import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { CLIENT_COOKIE } from "@/lib/auth";
import { getSql, ClientRow } from "@/lib/db";

/** Lista de clientes del editor, con estado de conexión IG y último sync. */
export async function GET() {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const sql = getSql();
  const rows = await sql<(ClientRow & { ig_username: string | null })[]>`
    SELECT c.*,
      (SELECT value FROM settings s WHERE s.client_id = c.id AND s.key = 'ig_username') AS ig_username
    FROM clients c
    WHERE c.owner_user_id = ${auth.userId}
    ORDER BY c.created_at ASC, c.id ASC
  `;
  return NextResponse.json(rows);
}

/** Crea un cliente y lo deja como activo (cookie bp_client). */
export async function POST(req: NextRequest) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  try {
    const { nombre, color } = await req.json();
    if (typeof nombre !== "string" || !nombre.trim()) {
      return fail(new Error("Falta el nombre del cliente"), 400);
    }
    const sql = getSql();
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO clients (owner_user_id, created_at, nombre, color)
      VALUES (${auth.userId}, ${new Date().toISOString()}, ${nombre.trim().slice(0, 80)},
        ${typeof color === "string" && color ? color : "#3987e5"})
      RETURNING id
    `;
    const res = NextResponse.json({ ok: true, id: row.id });
    res.cookies.set(CLIENT_COOKIE, String(row.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (e) {
    return fail(e);
  }
}
