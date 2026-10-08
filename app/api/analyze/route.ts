import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, PostRow } from "@/lib/db";
import { recomputeScores } from "@/lib/scoring";
import { chatJson } from "@/lib/llm";
import { buildBrandBrief } from "@/lib/brand";
import { consumeQuota, quotaExceeded } from "@/lib/quota";
import { formatBreakdown, dayOfWeekBreakdown } from "@/lib/metrics";
import { parseAnalysisPeriod, periodBounds } from "@/lib/periods";

export const maxDuration = 120;

type Analysis = {
  resumen: string;
  fortalezas: string[];
  mejoras: string[];
  acciones: string[];
  mejores_horas: string;
  formatos: string;
};

const pctStr = (v: number) => Math.round(v * 10000) / 100 + "%";

function describePost(p: PostRow) {
  return {
    formato: p.media_product_type || p.media_type,
    fecha: p.timestamp?.slice(0, 16),
    nota: p.score,
    er: pctStr(p.er),
    alcance: p.reach,
    likes: p.like_count,
    comentarios: p.comments_count,
    guardados: p.saved,
    compartidos: p.shares,
    caption: (p.caption || "").slice(0, 180),
  };
}

function periodTotals(posts: PostRow[]) {
  return {
    posts: posts.length,
    alcance_total: posts.reduce((a, p) => a + p.reach, 0),
    er_medio: pctStr(posts.length ? posts.reduce((a, p) => a + p.er, 0) / posts.length : 0),
    ganadores: posts.filter((p) => p.is_winner).length,
  };
}

export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { userId, clientId } = auth;
  try {
    const body = await req.json().catch(() => ({}));
    const days = parseAnalysisPeriod(body.days);
    const { since, previousSince } = periodBounds(days);

    await recomputeScores(clientId);
    const sql = getSql();
    const posts = await sql<PostRow[]>`
      SELECT * FROM posts
      WHERE client_id = ${clientId} AND timestamp >= ${since} ORDER BY er DESC
    `;
    if (posts.length < 3) {
      return fail(
        new Error(
          `Solo hay ${posts.length} post(s) en los últimos ${days} días. Necesitas al menos 3 para analizar: elige un periodo más largo.`
        ),
        400
      );
    }
    const previous = await sql<PostRow[]>`
      SELECT * FROM posts
      WHERE client_id = ${clientId} AND timestamp >= ${previousSince} AND timestamp < ${since}
    `;

    const quota = await consumeQuota(userId, "analyze");
    if (!quota.ok) return quotaExceeded(quota);

    // Con pocos posts en la ventana, top y peores no deben solaparse.
    const half = Math.min(5, Math.ceil(posts.length / 2));
    const top = posts.slice(0, half).map(describePost);
    const bottom = posts.slice(half).slice(-5).map(describePost);
    const formatos = formatBreakdown(posts).map((f) => `${f.label}: ER medio ${pctStr(f.value)}`);
    const dias = dayOfWeekBreakdown(posts)
      .filter((d) => d.value > 0)
      .map((d) => `${d.label}: ER medio ${pctStr(d.value)}`);
    const brief = await buildBrandBrief(clientId);

    const desde = since.slice(0, 10);
    const hasta = new Date().toISOString().slice(0, 10);
    const comparativa = previous.length
      ? `Periodo anterior (los ${days} días previos), para comparar tendencia:\n${JSON.stringify(periodTotals(previous))}`
      : `No hay posts en los ${days} días previos, así que no hay periodo anterior con el que comparar: no inventes tendencias.`;

    const analysis = await chatJson<Analysis>(
      `Eres un community manager senior experto en Instagram para marcas personales. Analizas métricas y das recomendaciones concretas y accionables en español, coherentes con la identidad, el cliente ideal y los objetivos de la marca.\n\nFicha de marca:\n${brief}`,
      `PERIODO ANALIZADO: últimos ${days} días (del ${desde} al ${hasta}). Analiza SOLO este periodo: es el momento actual de la cuenta. No hables de etapas anteriores ni extrapoles datos que no estén aquí. La "nota" (1-10) de cada post compara su engagement con todo el histórico de la cuenta.\n\nResumen del periodo:\n${JSON.stringify(periodTotals(posts))}\n\n${comparativa}\n\nEngagement por formato en el periodo: ${formatos.join(" · ")}\nEngagement por día de la semana en el periodo: ${dias.join(" · ")}\n\nMejores posts del periodo por engagement ponderado:\n${JSON.stringify(top, null, 1)}\n\nPeores posts del periodo:\n${JSON.stringify(bottom, null, 1)}\n\nDevuelve un JSON con esta forma exacta:\n{"resumen": "diagnóstico del periodo en 2-3 frases, mencionando la tendencia frente al periodo anterior si existe", "fortalezas": ["...", "..."], "mejoras": ["...", "..."], "acciones": ["acción concreta 1", "..."], "mejores_horas": "qué días/horas parecen funcionar según las fechas del periodo", "formatos": "qué formatos están funcionando mejor en el periodo y cuál potenciar"}\nSé específico: cita datos reales de los posts (guardados, alcance, temas de los captions). Si el periodo tiene pocos posts, dilo y matiza las conclusiones.`
    );

    await sql`
      INSERT INTO recommendations (client_id, created_at, content)
      VALUES (${clientId}, ${new Date().toISOString()}, ${JSON.stringify({
        ...analysis,
        periodo_dias: days,
        posts_analizados: posts.length,
      })})
    `;

    return NextResponse.json({ ok: true, analysis, days, posts: posts.length });
  } catch (e) {
    return fail(e);
  }
}
