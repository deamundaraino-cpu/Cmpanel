import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql, StructureRow, StructureBeat } from "@/lib/db";

export async function GET() {
  const g = await guard();
  if (g) return g;
  const sql = getSql();
  const rows = await sql<StructureRow[]>`
    SELECT * FROM structures ORDER BY is_builtin DESC, id ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  try {
    const { nombre, descripcion, beats } = await req.json();
    if (typeof nombre !== "string" || !nombre.trim()) {
      return fail(new Error("Falta el nombre de la estructura"), 400);
    }
    if (!Array.isArray(beats) || beats.length < 2) {
      return fail(new Error("La estructura necesita al menos 2 secciones"), 400);
    }
    const clean: StructureBeat[] = beats
      .map((b: { nombre?: unknown; guia?: unknown }) => ({
        nombre: String(b?.nombre || "").trim(),
        guia: String(b?.guia || "").trim(),
      }))
      .filter((b) => b.nombre);
    if (clean.length < 2) {
      return fail(new Error("La estructura necesita al menos 2 secciones con nombre"), 400);
    }

    const sql = getSql();
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO structures (created_at, nombre, descripcion, beats, is_builtin)
      VALUES (${new Date().toISOString()}, ${nombre.trim()}, ${descripcion || ""},
        ${JSON.stringify(clean)}, 0)
      ON CONFLICT (nombre) DO NOTHING
      RETURNING id
    `;
    if (!row) return fail(new Error("Ya existe una estructura con ese nombre"), 400);
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return fail(e);
  }
}
