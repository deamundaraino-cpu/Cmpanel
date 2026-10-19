import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, ProposalRow } from "@/lib/db";
import { createCarousel, createScripts, GenError, resolvePieceSource } from "@/lib/proposalCreate";
import { consumeQuota, quotaExceeded } from "@/lib/quota";
import { executionContext } from "@/lib/executionFormats";

export const maxDuration = 120;

export async function GET() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const sql = getSql();
  const rows = await sql<ProposalRow[]>`
    SELECT * FROM proposals WHERE client_id = ${auth.clientId} ORDER BY id DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { userId, clientId } = auth;
  try {
    const { postId, tema, formato, structureId, ideaId, pilar, formatoGrabacion } = await req
      .json()
      .catch(() => ({}));
    const kind = formato === "guion_video" ? "guion_video" : "carrusel";
    if (kind === "guion_video" && !structureId) return fail(new Error("Falta la estructura de guion"), 400);

    // Trazabilidad de pilar: se valida contra la idea real del cliente, no se
    // confía en lo que mande el navegador (y evita idea_id de otro cliente).
    let source: Awaited<ReturnType<typeof resolvePieceSource>>;
    try {
      source = await resolvePieceSource(clientId, { postId, tema, ideaId, pilar });
    } catch (e) {
      return fail(e, e instanceof GenError ? e.status : 400);
    }

    const quota = await consumeQuota(userId, "proposal");
    if (!quota.ok) return quotaExceeded(quota);

    const ctx = { userId, clientId, context: source.context, sourcePostId: source.sourcePostId, pilarRef: source.pilarRef, ideaRef: source.ideaRef };
    if (kind === "carrusel") {
      const c = await createCarousel(ctx);
      return NextResponse.json({ ok: true, id: c.id, slides: c.slides, bloqueada: c.bloqueada, avisos: c.avisos });
    }

    // El formato de grabación (pizarra, pantalla verde…) ajusta guion y notas de edición.
    const creadas = await createScripts({
      ...ctx,
      context: ctx.context + executionContext(typeof formatoGrabacion === "string" ? formatoGrabacion : null),
      structureId: Number(structureId),
    });
    return NextResponse.json({ ok: true, id: creadas[0].id, variantes: creadas });
  } catch (e) {
    return fail(e, e instanceof GenError ? e.status : 500);
  }
}
