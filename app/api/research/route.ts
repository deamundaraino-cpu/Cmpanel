import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, CommentRow, PostRow } from "@/lib/db";
import { chatJson } from "@/lib/llm";
import { getSetting } from "@/lib/settings";
import { buildBrandBrief } from "@/lib/brand";
import { consumeQuota, quotaExceeded } from "@/lib/quota";
import { getTavilyKey } from "@/lib/appSettings";
import { formatBreakdown, dayOfWeekBreakdown } from "@/lib/metrics";

export const maxDuration = 120;

type Idea = {
  tema: string;
  angulo: string;
  formato: string;
  razon: string;
  pilar: string;
  evidencia?: { tipo: string; detalle: string };
};

const PILARES = ["crecimiento", "adoctrinamiento", "conversion"] as const;
type Pilar = (typeof PILARES)[number];

const PILAR_GUIDE: Record<Pilar, string> = {
  crecimiento:
    "CRECIMIENTO (visibilidad y alcance): opiniones e ideas contrarias sobre la industria, timing/tendencias del momento, polémica sana sobre prácticas del nicho (nunca contra personas), formatos virales, romper creencias y mitos. Objetivo: que gente nueva te descubra y te siga.",
  adoctrinamiento:
    "ADOCTRINAMIENTO (autoridad y comunidad): resultados propios y de clientes, casos de éxito, storytelling personal, contenido de vacío de conocimiento (mostrar lo que no saben que no saben), lives. Objetivo: que quien ya te sigue confíe en ti como referente.",
  conversion:
    "CONVERSIÓN (leads y ventas): piezas con UN CTA claro — captar leads con lead magnets, plantillas, invitaciones a eventos; o vender. Objetivo: convertir atención en datos o ventas, respetando la fase actual de la marca.",
};

async function tavilySearch(query: string): Promise<{ context: string; sources: string[] }> {
  const key = await getTavilyKey();
  if (!key) return { context: "", sources: [] };
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: 6,
      include_answer: true,
    }),
  });
  if (!res.ok) return { context: "", sources: [] };
  const json = await res.json();
  const items = (json.results || []) as { title: string; url: string; content: string }[];
  const context =
    (json.answer ? `Resumen: ${json.answer}\n\n` : "") +
    items.map((r) => `- ${r.title}: ${r.content?.slice(0, 250)}`).join("\n");
  return { context, sources: items.map((r) => r.url) };
}

export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { userId, clientId } = auth;
  try {
    const { pilar, source } = await req.json().catch(() => ({}));
    const targetPilar: Pilar | null = PILARES.includes(pilar) ? pilar : null;
    const sql = getSql();
    const brief = await buildBrandBrief(clientId);

    let context = "";
    let sources: string[] = [];
    let fromComments = false;

    if (source === "comentarios") {
      // Minería de comentarios reales: dolores y preguntas literales de la audiencia.
      const comments = await sql<(CommentRow & { caption: string | null })[]>`
        SELECT c.*, p.caption FROM comments c
        LEFT JOIN posts p ON p.client_id = c.client_id AND p.id = c.post_id
        WHERE c.client_id = ${clientId}
        ORDER BY c.like_count DESC, c.timestamp DESC
        LIMIT 60
      `;
      if (!comments.length) {
        return fail(
          new Error(
            "Aún no hay comentarios capturados. Pulsa «Sincronizar Instagram» en el Dashboard y vuelve a intentarlo."
          ),
          400
        );
      }
      fromComments = true;
      context =
        "COMENTARIOS REALES de la audiencia en tus posts (lenguaje literal, dolores y preguntas):\n" +
        comments
          .map((c) => `- "${(c.text || "").slice(0, 200)}"${c.caption ? ` (en post: ${c.caption.slice(0, 60)}…)` : ""}`)
          .join("\n");
    } else {
      const niche =
        (await getSetting(clientId, "brand_niche")) || "marca personal y negocios digitales";
      const query = `temas y preguntas en tendencia en redes sociales sobre ${niche} ${new Date().getFullYear()}`;
      const web = await tavilySearch(query);
      context = web.context;
      sources = web.sources;
    }

    // ————— Los "recibos" de la IA: datos reales de la cuenta del cliente —————
    // Esto es lo que un chat genérico no puede hacer: anclar cada idea a los
    // ganadores, el mejor formato y el mejor día de ESTA cuenta.
    const since90 = new Date(Date.now() - 90 * 86400_000).toISOString();
    const accountPosts = await sql<PostRow[]>`
      SELECT * FROM posts WHERE client_id = ${clientId} AND timestamp >= ${since90}
    `;
    let winners = await sql<PostRow[]>`
      SELECT * FROM posts WHERE client_id = ${clientId} AND is_winner = 1
      ORDER BY er DESC LIMIT 5
    `;
    if (!winners.length) {
      winners = await sql<PostRow[]>`
        SELECT * FROM posts WHERE client_id = ${clientId} AND reach > 0
        ORDER BY er DESC LIMIT 3
      `;
    }

    let accountData = "";
    if (winners.length) {
      const avgEr = accountPosts.length
        ? accountPosts.reduce((a, p) => a + p.er, 0) / accountPosts.length
        : 0;
      const formats = formatBreakdown(accountPosts).sort((a, b) => b.value - a.value);
      const bestFormat = formats[0];
      const days = dayOfWeekBreakdown(accountPosts)
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);
      const bestDay = days[0];

      accountData =
        "DATOS REALES DE ESTA CUENTA (úsalos como evidencia):\n" +
        "Posts GANADORES (engagement muy por encima de su media):\n" +
        winners
          .map(
            (p) =>
              `- "${(p.caption || "").slice(0, 120)}" (${p.media_product_type === "REELS" ? "reel" : p.media_type === "CAROUSEL_ALBUM" ? "carrusel" : "imagen"}, ER ${(p.er * 100).toFixed(2)}%, nota ${p.score ?? "?"}/10)`
          )
          .join("\n") +
        (bestFormat && avgEr > 0
          ? `\nMejor formato: ${bestFormat.label} (ER ${(bestFormat.value * 100).toFixed(2)}% vs ${(avgEr * 100).toFixed(2)}% de media)`
          : "") +
        (bestDay ? `\nMejor día para publicar: ${bestDay.label}` : "");
    }

    const quota = await consumeQuota(userId, "research");
    if (!quota.ok) return quotaExceeded(quota);

    const pilarInstructions = targetPilar
      ? `Genera 6 ideas SOLO del pilar ${targetPilar.toUpperCase()}. Definición del pilar:\n${PILAR_GUIDE[targetPilar]}\nTodas las ideas deben cumplir el objetivo de ese pilar, sin mezclarse con los otros.`
      : `Genera 6 ideas repartidas EXACTAMENTE así: 2 del pilar CRECIMIENTO, 2 del pilar ADOCTRINAMIENTO y 2 del pilar CONVERSION. Definiciones:\n- ${PILAR_GUIDE.crecimiento}\n- ${PILAR_GUIDE.adoctrinamiento}\n- ${PILAR_GUIDE.conversion}`;

    const ideas = await chatJson<Idea[]>(
      `Eres un estratega de contenido para Instagram. Propones ideas de posts con alto potencial, en español, alineadas con la identidad, el cliente ideal y las líneas de contenido de la marca. Cada idea pertenece a UN pilar concreto de la estrategia y debe cumplir el objetivo de ese pilar.${fromComments ? " Las ideas deben nacer de los dolores, objeciones y preguntas LITERALES de los comentarios: usa su lenguaje." : ""}${accountData ? " Cuando una idea se apoye en un post ganador o en el mejor formato/día de la cuenta, dilo explícitamente en su evidencia." : ""}\n\nFicha de marca:\n${brief}`,
      (accountData ? `${accountData}\n\n` : "") +
        (context
          ? `Contexto:\n${context}\n\n`
          : "No hay búsqueda web disponible; usa tu conocimiento del nicho.\n\n") +
        pilarInstructions +
        `\n\nDevuelve un array JSON:\n[{"tema": "título de la idea", "angulo": "el enfoque o gancho concreto", "formato": "carrusel|reel|imagen|historia", "razon": "por qué funcionaría ahora", "pilar": "crecimiento|adoctrinamiento|conversion", "evidencia": {"tipo": "ganador|comentarios|tendencia|formato", "detalle": "el dato concreto de la cuenta o del contexto en el que se basa, en 1 frase"}}]`
    );

    const now = new Date().toISOString();
    const VALID_EVIDENCE = new Set(["ganador", "comentarios", "tendencia", "formato"]);
    for (const idea of ideas) {
      const ideaPilar = PILARES.includes(idea.pilar as Pilar)
        ? idea.pilar
        : targetPilar || "crecimiento";
      // Evidencia del LLM, o derivada del modo de investigación como fallback.
      let evidencia: { tipo: string; detalle: string } | null = null;
      if (idea.evidencia?.tipo && VALID_EVIDENCE.has(idea.evidencia.tipo)) {
        evidencia = {
          tipo: idea.evidencia.tipo,
          detalle: String(idea.evidencia.detalle || "").slice(0, 200),
        };
      } else if (fromComments) {
        evidencia = { tipo: "comentarios", detalle: "Nace de comentarios reales de la audiencia" };
      } else if (sources.length) {
        evidencia = { tipo: "tendencia", detalle: "Tendencia detectada en la búsqueda del nicho" };
      }
      await sql`
        INSERT INTO ideas (client_id, created_at, tema, angulo, formato, razon, fuentes, pilar, evidencia)
        VALUES (${clientId}, ${now}, ${idea.tema}, ${idea.angulo}, ${idea.formato}, ${idea.razon},
          ${fromComments ? '["comentarios"]' : JSON.stringify(sources)}, ${ideaPilar},
          ${evidencia ? JSON.stringify(evidencia) : null})
      `;
    }

    return NextResponse.json({
      ok: true,
      count: ideas.length,
      webSearch: !!context && !fromComments,
      fromComments,
    });
  } catch (e) {
    return fail(e);
  }
}
