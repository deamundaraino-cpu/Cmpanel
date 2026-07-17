import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, CommentRow } from "@/lib/db";
import { chatJson } from "@/lib/llm";
import { getSetting } from "@/lib/settings";
import { buildBrandBrief } from "@/lib/brand";
import { consumeQuota, quotaExceeded } from "@/lib/quota";
import { getTavilyKey } from "@/lib/appSettings";

export const maxDuration = 120;

type Idea = { tema: string; angulo: string; formato: string; razon: string; pilar: string };

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

    const quota = await consumeQuota(userId, "research");
    if (!quota.ok) return quotaExceeded(quota);

    const pilarInstructions = targetPilar
      ? `Genera 6 ideas SOLO del pilar ${targetPilar.toUpperCase()}. Definición del pilar:\n${PILAR_GUIDE[targetPilar]}\nTodas las ideas deben cumplir el objetivo de ese pilar, sin mezclarse con los otros.`
      : `Genera 6 ideas repartidas EXACTAMENTE así: 2 del pilar CRECIMIENTO, 2 del pilar ADOCTRINAMIENTO y 2 del pilar CONVERSION. Definiciones:\n- ${PILAR_GUIDE.crecimiento}\n- ${PILAR_GUIDE.adoctrinamiento}\n- ${PILAR_GUIDE.conversion}`;

    const ideas = await chatJson<Idea[]>(
      `Eres un estratega de contenido para Instagram. Propones ideas de posts con alto potencial, en español, alineadas con la identidad, el cliente ideal y las líneas de contenido de la marca. Cada idea pertenece a UN pilar concreto de la estrategia y debe cumplir el objetivo de ese pilar.${fromComments ? " Las ideas deben nacer de los dolores, objeciones y preguntas LITERALES de los comentarios: usa su lenguaje." : ""}\n\nFicha de marca:\n${brief}`,
      (context
        ? `Contexto:\n${context}\n\n`
        : "No hay búsqueda web disponible; usa tu conocimiento del nicho.\n\n") +
        pilarInstructions +
        `\n\nDevuelve un array JSON:\n[{"tema": "título de la idea", "angulo": "el enfoque o gancho concreto", "formato": "carrusel|reel|imagen|historia", "razon": "por qué funcionaría ahora", "pilar": "crecimiento|adoctrinamiento|conversion"}]`
    );

    const now = new Date().toISOString();
    for (const idea of ideas) {
      const ideaPilar = PILARES.includes(idea.pilar as Pilar)
        ? idea.pilar
        : targetPilar || "crecimiento";
      await sql`
        INSERT INTO ideas (client_id, created_at, tema, angulo, formato, razon, fuentes, pilar)
        VALUES (${clientId}, ${now}, ${idea.tema}, ${idea.angulo}, ${idea.formato}, ${idea.razon},
          ${fromComments ? '["comentarios"]' : JSON.stringify(sources)}, ${ideaPilar})
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
