import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, PostRow } from "@/lib/db";
import { consumeQuota } from "@/lib/quota";
import { createCarousel, createScripts, GenError, type Created } from "@/lib/proposalCreate";

export const maxDuration = 180;

const CORTO = "Hook-Lead-Body-Open Loop-CTA";
const LARGO = "Vídeo largo (5-8 min)";

type Pieza = "carrusel" | "corto" | "largo";
const ORDEN: Pieza[] = ["corto", "carrusel", "largo"];
const ENFOQUE: Record<Pieza, string> = {
  corto: "Versión REEL CORTO (30-60 s): la idea central con un gancho nuevo, directa al grano.",
  carrusel: "Versión CARRUSEL: la misma idea convertida en pasos, lista o comparación que den ganas de guardar.",
  largo: "Versión LARGA (5-8 min): profundiza donde el post solo apuntaba — método, casos, matices y errores comunes.",
};

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

    const builtins = await sql<{ id: number; nombre: string }[]>`
      SELECT id, nombre FROM structures
      WHERE user_id IS NULL AND client_id IS NULL AND nombre IN (${CORTO}, ${LARGO})
    `;
    const cortoId = Number(body.structureId) || builtins.find((s) => s.nombre === CORTO)?.id;
    const largoId = builtins.find((s) => s.nombre === LARGO)?.id;

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

    const ratio = post.perf_ratio ? `, ×${post.perf_ratio.toFixed(1)} sobre la media de la cuenta` : "";
    const tipo = post.media_product_type === "REELS" ? "reel" : post.media_type === "CAROUSEL_ALBUM" ? "carrusel" : "post";
    const base = `Este ${tipo} fue un GANADOR en Instagram (alcance ${post.reach}, ${post.saved} guardados, ${post.shares} compartidos${ratio}):\n\nCaption original:\n"""${(post.caption || "").slice(0, 800)}"""\n\nEXPRIMIR UN GANADOR: conserva la idea de fondo y la tesis que conectaron, pero adáptala a otro formato con un gancho distinto. No copies el caption.`;

    const results = await Promise.allSettled(
      plan.map(async (p): Promise<Created[]> => {
        const ctx = {
          userId,
          clientId,
          context: `${base}\n\n${ENFOQUE[p]}`,
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
