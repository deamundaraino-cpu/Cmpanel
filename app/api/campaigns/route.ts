import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

export async function GET() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const sql = getSql();
  const rows = await sql`
    SELECT
      c.*,
      COUNT(p.id)::int AS posts_count,
      COALESCE(SUM(p.reach), 0)::int AS total_reach,
      COALESCE(AVG(p.er), 0)::float AS avg_er
    FROM campaigns c
    LEFT JOIN posts p ON p.client_id = c.client_id AND p.campaign_id = c.id
    WHERE c.client_id = ${auth.clientId}
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const { nombre, descripcion, color, fecha_inicio, fecha_fin } = await req.json();
    if (typeof nombre !== "string" || !nombre.trim()) {
      return fail(new Error("Falta el nombre de la campaña"), 400);
    }
    const sql = getSql();
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO campaigns (client_id, created_at, nombre, descripcion, color, fecha_inicio, fecha_fin, estado)
      VALUES (${auth.clientId}, ${new Date().toISOString()}, ${nombre.trim()}, ${descripcion || ""},
        ${color || "#3987e5"}, ${fecha_inicio || null}, ${fecha_fin || null}, 'activa')
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return fail(e);
  }
}
