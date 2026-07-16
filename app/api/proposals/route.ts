import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql, PostRow, ProposalRow, StructureRow, StructureBeat } from "@/lib/db";
import { chatJson } from "@/lib/llm";
import { buildBrandBrief } from "@/lib/brand";
import { CarouselGen, ScriptGen, QUALITY_BAR, clampQuality } from "@/lib/proposalGen";
import { consumeQuota, quotaExceeded } from "@/lib/quota";

export const maxDuration = 120;

export async function GET() {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const sql = getSql();
  const rows = await sql<ProposalRow[]>`
    SELECT * FROM proposals WHERE user_id = ${auth.userId} ORDER BY id DESC
  `;
  return NextResponse.json(rows);
}

async function describeSource(
  userId: string,
  postId: string | undefined,
  tema: string | undefined
): Promise<{ context: string; sourcePostId: string | null }> {
  if (postId) {
    const sql = getSql();
    const rows = await sql<PostRow[]>`
      SELECT * FROM posts WHERE user_id = ${userId} AND id = ${postId}
    `;
    const post = rows[0];
    if (!post) throw new Error("Post no encontrado");
    return {
      sourcePostId: post.id,
      context: `Este post fue un GANADOR en Instagram (nota ${post.score}/10, alcance ${post.reach}, ${post.saved} guardados, ${post.shares} compartidos):\n\nCaption original:\n"""${(post.caption || "").slice(0, 800)}"""\n\nParte de esta misma idea/tema, pero elévala con un ángulo fresco (no copies el caption).`,
    };
  }
  if (tema) {
    return {
      sourcePostId: null,
      context: `Este es el tema/idea de partida:\n"""${String(tema).slice(0, 500)}"""`,
    };
  }
  throw new Error("Falta postId o tema");
}

export async function POST(req: NextRequest) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  try {
    const { postId, tema, formato, structureId } = await req.json().catch(() => ({}));
    const sql = getSql();
    const brief = await buildBrandBrief(userId);
    const kind = formato === "guion_video" ? "guion_video" : "carrusel";

    let source: { context: string; sourcePostId: string | null };
    try {
      source = await describeSource(userId, postId, tema);
    } catch (e) {
      return fail(e, 400);
    }

    const quota = await consumeQuota(userId, "proposal");
    if (!quota.ok) return quotaExceeded(quota);

    if (kind === "carrusel") {
      const gen = await chatJson<CarouselGen>(
        `Eres un creador de carruseles virales de Instagram. Escribes en español, directo, con ganchos fuertes, en el tono de voz de la marca y pensando en su cliente ideal. Cada slide: titulo corto y potente (máx 60 caracteres) y cuerpo de apoyo (máx 220 caracteres). El primer slide es la portada-gancho (cuerpo breve o vacío). El último slide es el CTA (seguir, guardar, comentar).\n\nFicha de marca:\n${brief}`,
        `${source.context}\n\nCrea un carrusel de 6-7 slides.\n\nDevuelve JSON:\n{"slides": [{"titulo": "...", "cuerpo": "..."}], "caption": "caption completo para el post con salto de líneas y CTA", "hashtags": ["#...", "#..."], "calidad": {"score": 0, "razon": "..."}}\nEntre 6 y 7 slides, 15-20 hashtags mezclando volumen alto y nicho.\n${QUALITY_BAR}`
      );
      if (!gen.slides?.length) return fail(new Error("La IA no devolvió slides"), 500);
      const q = clampQuality(gen.calidad);

      const [row] = await sql<{ id: number }[]>`
        INSERT INTO proposals (user_id, post_id, created_at, status, formato, slides, caption, hashtags, structure_id, quality, quality_notes)
        VALUES (${userId}, ${source.sourcePostId}, ${new Date().toISOString()}, 'pendiente', 'carrusel',
          ${JSON.stringify(gen.slides)}, ${gen.caption || ""}, ${JSON.stringify(gen.hashtags || [])},
          NULL, ${q.score}, ${q.notes})
        RETURNING id
      `;
      return NextResponse.json({ ok: true, id: row.id, slides: gen.slides.length });
    }

    // --- guion_video ---
    if (!structureId) return fail(new Error("Falta la estructura de guion"), 400);
    const structures = await sql<StructureRow[]>`
      SELECT * FROM structures
      WHERE id = ${Number(structureId)} AND (user_id = ${userId} OR user_id IS NULL)
    `;
    const structure = structures[0];
    if (!structure) return fail(new Error("Estructura no encontrada"), 404);
    const beats = JSON.parse(structure.beats) as StructureBeat[];

    const beatsGuide = beats.map((b, i) => `${i + 1}. ${b.nombre}: ${b.guia}`).join("\n");
    const beatNames = beats.map((b) => b.nombre);

    const gen = await chatJson<ScriptGen>(
      `Eres un guionista experto en contenido de video corto (Reels, TikTok, Shorts) que domina estructuras probadas de retención. Escribes en español, en el tono de voz de la marca, pensando en su cliente ideal. Escribes el texto EXACTO que la persona debe decir a cámara en cada sección (no descripciones ni instrucciones, el guion real hablado).\n\nFicha de marca:\n${brief}`,
      `${source.context}\n\nEscribe un guion de video siguiendo EXACTAMENTE esta estructura, en este orden, respetando la intención de cada sección:\n${beatsGuide}\n\nDevuelve JSON:\n{"beats": [{"seccion": "${beatNames[0]}", "texto": "guion hablado de esta sección"}, ...], "caption": "descripción/copy corto para acompañar el video al publicarlo", "hashtags": ["#...", "#..."], "calidad": {"score": 0, "razon": "..."}}\nUsa exactamente estos nombres de sección en el mismo orden: ${beatNames.join(", ")}. 10-15 hashtags.\n${QUALITY_BAR}`
    );
    if (!gen.beats?.length) return fail(new Error("La IA no devolvió el guion"), 500);
    const q = clampQuality(gen.calidad);

    const [row] = await sql<{ id: number }[]>`
      INSERT INTO proposals (user_id, post_id, created_at, status, formato, slides, caption, hashtags, structure_id, quality, quality_notes)
      VALUES (${userId}, ${source.sourcePostId}, ${new Date().toISOString()}, 'pendiente', 'guion_video',
        ${JSON.stringify(gen.beats)}, ${gen.caption || ""}, ${JSON.stringify(gen.hashtags || [])},
        ${structure.id}, ${q.score}, ${q.notes})
      RETURNING id
    `;
    return NextResponse.json({ ok: true, id: row.id, beats: gen.beats.length });
  } catch (e) {
    return fail(e);
  }
}
