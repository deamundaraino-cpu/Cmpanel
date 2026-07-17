import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { CLIENT_COOKIE } from "@/lib/auth";
import { getSql } from "@/lib/db";

/** Cambia el cliente activo del editor (fija la cookie bp_client). */
export async function POST(req: NextRequest) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  try {
    const { clientId } = await req.json();
    const sql = getSql();
    const rows = await sql<{ id: number }[]>`
      SELECT id FROM clients
      WHERE owner_user_id = ${auth.userId} AND id = ${Number(clientId)} AND estado = 'activo'
    `;
    if (!rows.length) return fail(new Error("Cliente no encontrado"), 404);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(CLIENT_COOKIE, String(rows[0].id), {
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
