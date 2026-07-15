import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM
  const sql = getSql();
  const rows = month
    ? await sql`SELECT * FROM calendar_items WHERE fecha LIKE ${month + "%"} ORDER BY fecha ASC`
    : await sql`SELECT * FROM calendar_items ORDER BY fecha ASC`;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  try {
    const { fecha, titulo, formato, campaign_id, notas } = await req.json();
    if (typeof fecha !== "string" || !fecha.trim()) {
      return fail(new Error("Falta la fecha"), 400);
    }
    if (typeof titulo !== "string" || !titulo.trim()) {
      return fail(new Error("Falta el título"), 400);
    }
    const sql = getSql();
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO calendar_items (created_at, fecha, titulo, formato, estado, campaign_id, notas)
      VALUES (${new Date().toISOString()}, ${fecha}, ${titulo.trim()}, ${formato || "carrusel"},
        'idea', ${campaign_id || null}, ${notas || ""})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return fail(e);
  }
}
