import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, PostRow } from "@/lib/db";
import { chatJson } from "@/lib/llm";
import { buildBrandBrief } from "@/lib/brand";
import { consumeQuota, quotaExceeded } from "@/lib/quota";

export const maxDuration = 120;

type ReportContent = {
  resumen: string;
  aciertos: string[];
  riesgos: string[];
  recomendaciones: string[];
};

export async function GET() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const rows = await getSql()`
    SELECT * FROM reports WHERE client_id = ${auth.clientId} ORDER BY id DESC LIMIT 10
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { userId, clientId } = auth;
  try {
    const { days } = await req.json().catch(() => ({ days: 30 }));
    const periodDays = [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30;
    const sql = getSql();
    const since = new Date(Date.now() - periodDays * 86400_000).toISOString();

    const posts = await sql<PostRow[]>`
      SELECT * FROM posts WHERE client_id = ${clientId} AND timestamp >= ${since} ORDER BY er DESC
    `;

    if (posts.length < 2) {
      return fail(
        new Error("Necesitas al menos 2 posts sincronizados en este periodo para generar un informe."),
        400
      );
    }

    const totalReach = posts.reduce((a, p) => a + p.reach, 0);
    const avgEr = posts.reduce((a, p) => a + p.er, 0) / posts.length;
    const winners = posts.filter((p) => p.is_winner).length;
    const top = posts.slice(0, 3).map((p) => ({
      caption: (p.caption || "").slice(0, 140),
      er: Math.round(p.er * 10000) / 100 + "%",
      reach: p.reach,
      score: p.score,
    }));
    const bottom = posts.slice(-3).map((p) => ({
      caption: (p.caption || "").slice(0, 140),
      er: Math.round(p.er * 10000) / 100 + "%",
      reach: p.reach,
      score: p.score,
    }));

    const quota = await consumeQuota(userId, "report");
    if (!quota.ok) return quotaExceeded(quota);

    const brief = await buildBrandBrief(clientId);
    const report = await chatJson<ReportContent>(
      `Eres un CM senior que entrega informes de rendimiento ejecutivos, claros y accionables en español. Nada de relleno corporativo.\n\nFicha de marca:\n${brief}`,
      `Informe de los últimos ${periodDays} días:\n- Posts publicados: ${posts.length}\n- Alcance total: ${totalReach}\n- Engagement medio: ${(avgEr * 100).toFixed(2)}%\n- Posts ganadores: ${winners}\n\nTop 3 posts:\n${JSON.stringify(top, null, 1)}\n\nPosts más flojos:\n${JSON.stringify(bottom, null, 1)}\n\nDevuelve JSON:\n{"resumen": "diagnóstico ejecutivo en 2-3 frases", "aciertos": ["qué funcionó y por qué, con datos"], "riesgos": ["qué vigilar o corregir"], "recomendaciones": ["acciones concretas para el próximo periodo"]}`
    );

    const [row] = await sql<{ id: number }[]>`
      INSERT INTO reports (client_id, created_at, period_days, content)
      VALUES (${clientId}, ${new Date().toISOString()}, ${periodDays}, ${JSON.stringify(report)})
      RETURNING id
    `;

    return NextResponse.json({ ok: true, id: row.id, report });
  } catch (e) {
    return fail(e);
  }
}
