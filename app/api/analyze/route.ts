import { NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, PostRow } from "@/lib/db";
import { recomputeScores } from "@/lib/scoring";
import { chatJson } from "@/lib/llm";
import { buildBrandBrief } from "@/lib/brand";
import { consumeQuota, quotaExceeded } from "@/lib/quota";

export const maxDuration = 120;

type Analysis = {
  resumen: string;
  fortalezas: string[];
  mejoras: string[];
  acciones: string[];
  mejores_horas: string;
  formatos: string;
};

function describePost(p: PostRow) {
  return {
    formato: p.media_product_type || p.media_type,
    fecha: p.timestamp?.slice(0, 16),
    nota: p.score,
    er: Math.round(p.er * 10000) / 100 + "%",
    alcance: p.reach,
    likes: p.like_count,
    comentarios: p.comments_count,
    guardados: p.saved,
    compartidos: p.shares,
    caption: (p.caption || "").slice(0, 180),
  };
}

export async function POST() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { userId, clientId } = auth;
  try {
    await recomputeScores(clientId);
    const sql = getSql();
    const posts = await sql<PostRow[]>`
      SELECT * FROM posts WHERE client_id = ${clientId} ORDER BY er DESC
    `;
    if (posts.length < 3) {
      return fail(new Error("Necesitas al menos 3 posts sincronizados para analizar."), 400);
    }

    const quota = await consumeQuota(userId, "analyze");
    if (!quota.ok) return quotaExceeded(quota);

    const top = posts.slice(0, 5).map(describePost);
    const bottom = posts.slice(-5).map(describePost);
    const brief = await buildBrandBrief(clientId);

    const analysis = await chatJson<Analysis>(
      `Eres un community manager senior experto en Instagram para marcas personales. Analizas métricas y das recomendaciones concretas y accionables en español, coherentes con la identidad, el cliente ideal y los objetivos de la marca.\n\nFicha de marca:\n${brief}`,
      `Estos son los 5 mejores posts por engagement ponderado:\n${JSON.stringify(top, null, 1)}\n\nY los 5 peores:\n${JSON.stringify(bottom, null, 1)}\n\nTotal de posts analizados: ${posts.length}.\n\nDevuelve un JSON con esta forma exacta:\n{"resumen": "diagnóstico en 2-3 frases", "fortalezas": ["...", "..."], "mejoras": ["...", "..."], "acciones": ["acción concreta 1", "..."], "mejores_horas": "qué días/horas parecen funcionar según las fechas", "formatos": "qué formatos están funcionando mejor y cuál potenciar"}\nSé específico: cita datos reales de los posts (guardados, alcance, temas de los captions).`
    );

    await sql`
      INSERT INTO recommendations (client_id, created_at, content)
      VALUES (${clientId}, ${new Date().toISOString()}, ${JSON.stringify(analysis)})
    `;

    return NextResponse.json({ ok: true, analysis });
  } catch (e) {
    return fail(e);
  }
}
