import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql, StructureRow, StructureBeat } from "@/lib/db";

/** Secciones válidas: con nombre y al menos dos. */
function cleanBeats(beats: unknown): StructureBeat[] | null {
  if (!Array.isArray(beats)) return null;
  const clean = beats
    .map((b: { nombre?: unknown; guia?: unknown }) => ({
      nombre: String(b?.nombre || "").trim(),
      guia: String(b?.guia || "").trim(),
    }))
    .filter((b) => b.nombre);
  return clean.length >= 2 ? clean : null;
}

/**
 * Editar una estructura propia. Las base (user_id NULL) son compartidas por
 * todos los editores: no se tocan, se duplican desde el panel y se edita la copia.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const { nombre, descripcion, beats, soloEstaMarca } = await req.json();
    if (typeof nombre !== "string" || !nombre.trim()) {
      return fail(new Error("Falta el nombre de la estructura"), 400);
    }
    const clean = cleanBeats(beats);
    if (!clean) return fail(new Error("La estructura necesita al menos 2 secciones con nombre"), 400);

    const sql = getSql();
    const rows = await sql<StructureRow[]>`
      SELECT * FROM structures WHERE id = ${Number(id)} AND user_id = ${auth.userId}
    `;
    if (!rows[0]) {
      return fail(new Error("Esta estructura es una de las base: duplícala para poder editarla."), 404);
    }

    const clientScope = soloEstaMarca ? auth.clientId : null;
    if (soloEstaMarca && !clientScope) {
      return fail(new Error("No hay una marca activa a la que asociar la estructura"), 409);
    }

    const [updated] = await sql<{ id: number }[]>`
      UPDATE structures
      SET nombre = ${nombre.trim()}, descripcion = ${descripcion || ""},
          beats = ${JSON.stringify(clean)}, client_id = ${clientScope}
      WHERE id = ${Number(id)} AND user_id = ${auth.userId}
      RETURNING id
    `;
    if (!updated) return fail(new Error("Ya existe una estructura con ese nombre"), 400);
    return NextResponse.json({ ok: true, id: updated.id });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const sql = getSql();
  // Solo estructuras propias: las builtin (user_id NULL) no se pueden borrar.
  const rows = await sql<StructureRow[]>`
    SELECT * FROM structures WHERE id = ${Number(id)} AND user_id = ${auth.userId}
  `;
  const row = rows[0];
  if (!row) return fail(new Error("Estructura no encontrada"), 404);
  if (row.is_builtin) {
    return fail(new Error("Las estructuras base no se pueden eliminar"), 400);
  }
  await sql`
    DELETE FROM structures WHERE id = ${Number(id)} AND user_id = ${auth.userId}
  `;
  return NextResponse.json({ ok: true });
}
