import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, PostRow } from "@/lib/db";
import { consumeQuota } from "@/lib/quota";
import { createCarousel, createScripts, GenError, type Created } from "@/lib/proposalCreate";
import { exprimirContext, exprimirStructureIds, EXPRIMIR_ORDEN as ORDEN, type PiezaExprimir as Pieza } from "@/lib/exprimir";

export const maxDuration = 180;

/**
 * Exprimir un ganador: de un post que rindió por encima de la media, genera de
 * una vez las versiones en otros formatos (reel corto, carrusel y vídeo largo).
 * body: { postId, structureId? } — structureId = estructura del reel corto.
 * Cada pieza cuesta 1 operación de IA; si la cuota no da, genera las que quepan.
 */
export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { userId, clientId } = auth;
  try {
    const body = await req.json().catch(() => ({}));
    const sql = getSql();
    const [post] = await sql<PostRow[]>`
      SELECT * FROM posts WHERE client_id = ${clientId} AND id = ${String(body.postId || "")}
    `;
    if (!post) return fail(new Error("Post no encontrado"), 404);

    const ids = await exprimirStructureIds();
    const cortoId = Number(body.structureId) || ids.corto;
    const largoId = ids.largo;

    // Se reserva la cuota pieza a pieza ANTES de generar: si se acaba a mitad,
    // se entregan las que caben en vez de fallar todo.
    const plan: Pieza[] = [];
    for (const p of ORDEN) {
      if (p === "corto" && !cortoId) continue;
      if (p === "largo" && !largoId) continue;
      if (!(await consumeQuota(userId, "proposal")).ok) break;
      plan.push(p);
    }
    if (!plan.length) {
      return fail(new Error("Sin cuota de IA para hoy. Vuelve mañana o pide más límite al administrador."), 429);
    }

    const results = await Promise.allSettled(
      plan.map(async (p): Promise<Created[]> => {
        const ctx = {
          userId,
          clientId,
          context: exprimirContext(post, p),
          sourcePostId: post.id,
          pilarRef: null,
          ideaRef: null,
          origen: "exprimir",
        };
        if (p === "carrusel") return [await createCarousel(ctx)];
        return createScripts({ ...ctx, structureId: (p === "corto" ? cortoId : largoId) as number, maxVariantes: 1 });
      })
    );

    const creadas = results.flatMap((r, i) =>
      r.status === "fulfilled" ? r.value.map((c) => ({ ...c, pieza: plan[i] })) : []
    );
    const fallidas = results
      .map((r, i) => (r.status === "rejected" ? { pieza: plan[i], error: r.reason instanceof Error ? r.reason.message : "Error" } : null))
      .filter(Boolean);
    if (!creadas.length) {
      const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      const e = first?.reason;
      return fail(e instanceof Error ? e : new Error("No se pudo generar nada"), e instanceof GenError ? e.status : 500);
    }
    const omitidas = ORDEN.filter((p) => !plan.includes(p));
    return NextResponse.json({ ok: true, creadas, fallidas, omitidas });
  } catch (e) {
    return fail(e);
  }
}
