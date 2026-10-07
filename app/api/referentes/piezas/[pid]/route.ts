import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, ReferentePiezaRow } from "@/lib/db";
import { chatJson } from "@/lib/llm";
import { buildBrandBrief } from "@/lib/brand";
import { consumeQuota, quotaExceeded } from "@/lib/quota";
import { ANALISIS_SYSTEM, buildAnalisisPrompt, parseAnalisis, readAnalisis } from "@/lib/referentes";

export const maxDuration = 60;

/**
 * body:
 *   { action: "analizar" }        — la IA extrae gancho, estructura y patrón (1 op de cuota)
 *   { action: "guardar_gancho" }  — copia el gancho analizado al banco de ganchos
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pid: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const pid = Number((await params).pid);
    const body = await req.json().catch(() => ({}));
    const sql = getSql();
    const [pieza] = await sql<(ReferentePiezaRow & { handle: string })[]>`
      SELECT rp.*, r.handle FROM referente_piezas rp
      JOIN referentes r ON r.id = rp.referente_id
      WHERE rp.client_id = ${auth.clientId} AND rp.id = ${pid}
    `;
    if (!pieza) return fail(new Error("Pieza no encontrada"), 404);

    if (body.action === "analizar") {
      const quota = await consumeQuota(auth.userId, "referente");
      if (!quota.ok) return quotaExceeded(quota);
      const brief = await buildBrandBrief(auth.clientId);
      const raw = await chatJson<unknown>(ANALISIS_SYSTEM, buildAnalisisPrompt(pieza, pieza.handle, brief), {
        temperature: 0.4,
      });
      const analisis = parseAnalisis(raw);
      if (!analisis) return fail(new Error("La IA no devolvió un análisis útil. Inténtalo de nuevo."), 502);
      await sql`
        UPDATE referente_piezas SET analisis = ${JSON.stringify(analisis)}
        WHERE client_id = ${auth.clientId} AND id = ${pid}
      `;
      return NextResponse.json({ ok: true, analisis });
    }

    if (body.action === "guardar_gancho") {
      const analisis = readAnalisis(pieza.analisis);
      if (!analisis?.gancho) return fail(new Error("Analiza la pieza primero"), 400);
      const formato = /carrusel/i.test(pieza.formato || analisis.formato) ? "carrusel" : "guion_video";
      await sql`
        INSERT INTO hooks (client_id, created_at, texto, formato, source_post_id, source_proposal_id, er, origen)
        VALUES (${auth.clientId}, ${new Date().toISOString()}, ${analisis.gancho.slice(0, 300)}, ${formato},
          NULL, NULL, NULL, ${"@" + pieza.handle.replace(/^@/, "")})
      `;
      return NextResponse.json({ ok: true });
    }

    return fail(new Error("Acción inválida"), 400);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pid: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const pid = Number((await params).pid);
  await getSql()`DELETE FROM referente_piezas WHERE client_id = ${auth.clientId} AND id = ${pid}`;
  return NextResponse.json({ ok: true });
}
