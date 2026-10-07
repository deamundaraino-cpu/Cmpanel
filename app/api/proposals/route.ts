import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, PostRow, ProposalRow } from "@/lib/db";
import { buildIdeaContext, type IdeaSource } from "@/lib/ideaContext";
import { createCarousel, createScripts, GenError } from "@/lib/proposalCreate";
import { consumeQuota, quotaExceeded } from "@/lib/quota";
import { toPilar } from "@/lib/pilares";
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

async function describeSource(
  clientId: number,
  postId: string | undefined,
  tema: string | undefined,
  /** Idea del panel: trae ángulo, razón y evidencia, mejor materia prima que el tema suelto. */
  idea: IdeaSource | null
): Promise<{ context: string; sourcePostId: string | null }> {
  if (postId) {
    const sql = getSql();
    const rows = await sql<PostRow[]>`
      SELECT * FROM posts WHERE client_id = ${clientId} AND id = ${postId}
    `;
    const post = rows[0];
    if (!post) throw new Error("Post no encontrado");
    return {
      sourcePostId: post.id,
      context: `Este post fue un GANADOR en Instagram (nota ${post.score}/10, alcance ${post.reach}, ${post.saved} guardados, ${post.shares} compartidos):\n\nCaption original:\n"""${(post.caption || "").slice(0, 800)}"""\n\nParte de esta misma idea/tema, pero elévala con un ángulo fresco (no copies el caption).`,
    };
  }
  // Cuando la pieza sale de una idea del panel se usa la fila real y no el texto
  // que manda el navegador: ahí están el ángulo y la evidencia, que es lo que
  // hace distinta cada pieza.
  if (idea) return { sourcePostId: null, context: buildIdeaContext(idea) };
  if (tema) {
    return {
      sourcePostId: null,
      context: `Este es el tema/idea de partida:\n"""${String(tema).slice(0, 1200)}"""`,
    };
  }
  throw new Error("Falta postId o tema");
}

export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { userId, clientId } = auth;
  try {
    const { postId, tema, formato, structureId, ideaId, pilar, formatoGrabacion } = await req
      .json()
      .catch(() => ({}));
    const sql = getSql();

    // Trazabilidad de pilar: se valida contra la idea real del cliente, no se
    // confía en lo que mande el navegador (y evita idea_id de otro cliente).
    let ideaRef: number | null = null;
    let pilarRef: string | null = null;
    let ideaSource: IdeaSource | null = null;
    if (ideaId) {
      const [idea] = await sql<(IdeaSource & { id: number; pilar: string | null })[]>`
        SELECT id, pilar, tema, tesis, angulo, razon, evidencia, ganchos FROM ideas
        WHERE client_id = ${clientId} AND id = ${Number(ideaId)}
      `;
      if (idea) {
        ideaRef = idea.id;
        pilarRef = toPilar(idea.pilar);
        ideaSource = idea;
      }
    }
    if (!pilarRef) pilarRef = toPilar(pilar);
    const kind = formato === "guion_video" ? "guion_video" : "carrusel";
    if (kind === "guion_video" && !structureId) return fail(new Error("Falta la estructura de guion"), 400);

    let source: { context: string; sourcePostId: string | null };
    try {
      source = await describeSource(clientId, postId, tema, ideaSource);
    } catch (e) {
      return fail(e, 400);
    }

    const quota = await consumeQuota(userId, "proposal");
    if (!quota.ok) return quotaExceeded(quota);

    const ctx = { userId, clientId, context: source.context, sourcePostId: source.sourcePostId, pilarRef, ideaRef };
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
