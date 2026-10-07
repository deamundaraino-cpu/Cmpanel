import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, CalendarItemRow } from "@/lib/db";
import { toPilar } from "@/lib/pilares";
import { isValidState, normalizeState } from "@/lib/pipelineStates";

const EDITABLE = [
  "fecha",
  "titulo",
  "formato",
  "estado",
  "campaign_id",
  "notas",
  "pilar",
  "version",
  "fecha_entrega",
  "brief_edicion",
  "entrega_url",
  "es_prueba",
  "post_id",
] as const;
const VERSIONES = new Set(["corto", "largo"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    if ("estado" in body && !isValidState(body.estado)) {
      return fail(new Error("Estado inválido"), 400);
    }
    const sql = getSql();
    const patch: Record<string, string | number | boolean | null> = {};
    for (const key of EDITABLE) {
      if (!(key in body)) continue;
      const v = body[key];
      if (key === "pilar") {
        // El pilar se normaliza: vacío o valor inventado queda en NULL en vez de
        // ensuciar la mezcla con etiquetas que no existen.
        patch.pilar = toPilar(v);
      } else if (key === "estado") {
        patch.estado = normalizeState(v);
      } else if (key === "version") {
        patch.version = VERSIONES.has(v) ? v : null;
      } else if (key === "es_prueba") {
        patch.es_prueba = Boolean(v);
      } else if (key === "post_id") {
        // Solo posts de este cliente: el id lo manda el navegador.
        if (v) {
          const [post] = await sql`SELECT id FROM posts WHERE client_id = ${auth.clientId} AND id = ${String(v)}`;
          if (!post) return fail(new Error("Post no encontrado"), 400);
        }
        patch.post_id = v ? String(v) : null;
      } else if (typeof v === "string") {
        patch[key] = v.trim() === "" && key !== "titulo" ? null : v.slice(0, 5000);
      } else {
        patch[key] = v ?? null;
      }
    }
    const keys = Object.keys(patch);
    if (!keys.length) return fail(new Error("Nada que actualizar"), 400);
    await sql`
      UPDATE calendar_items SET ${sql(patch, ...keys)}
      WHERE client_id = ${auth.clientId} AND id = ${Number(id)}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

/**
 * body: { action: "duplicar" } — crea la pieza gemela en la otra versión
 * (corta ↔ larga) con el mismo guion: dos formatos por cada grabación.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (body.action !== "duplicar") return fail(new Error("Acción inválida"), 400);
    const sql = getSql();
    const [item] = await sql<CalendarItemRow[]>`
      SELECT * FROM calendar_items WHERE client_id = ${auth.clientId} AND id = ${Number(id)}
    `;
    if (!item) return fail(new Error("Pieza no encontrada"), 404);

    const twinOf = item.parent_item_id ?? item.id;
    const [twin] = await sql`
      SELECT id FROM calendar_items
      WHERE client_id = ${auth.clientId} AND id != ${item.id}
        AND (parent_item_id = ${twinOf} OR id = ${twinOf})
    `;
    if (twin) return fail(new Error("Esta pieza ya tiene su versión gemela"), 409);

    const original = item.version === "largo" ? "largo" : "corto";
    const otra = original === "largo" ? "corto" : "largo";
    await sql.begin(async (tx) => {
      if (!item.version) {
        await tx`UPDATE calendar_items SET version = ${original} WHERE id = ${item.id} AND client_id = ${auth.clientId}`;
      }
      await tx`
        INSERT INTO calendar_items (client_id, created_at, fecha, titulo, formato, estado, campaign_id, proposal_id, notas, pilar, version, parent_item_id, session_id)
        VALUES (${auth.clientId}, ${new Date().toISOString()}, ${item.fecha}, ${item.titulo}, ${item.formato},
          ${item.estado}, ${item.campaign_id}, ${item.proposal_id}, '', ${item.pilar}, ${otra}, ${item.id}, ${item.session_id})
      `;
    });
    return NextResponse.json({ ok: true, version: otra });
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
  const { id } = await params;
  await getSql()`
    DELETE FROM calendar_items WHERE client_id = ${auth.clientId} AND id = ${Number(id)}
  `;
  return NextResponse.json({ ok: true });
}
