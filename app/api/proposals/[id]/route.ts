import { NextRequest, NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql, ProposalRow, StructureRow, StructureBeat } from "@/lib/db";
import { chatJson } from "@/lib/llm";
import { buildBrandBrief } from "@/lib/brand";
import { CarouselGen, ScriptGen, QUALITY_BAR, clampQuality } from "@/lib/proposalGen";
import { consumeQuota, quotaExceeded } from "@/lib/quota";

export const maxDuration = 120;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const sql = getSql();

    // ————— Regenerar con feedback del usuario —————
    if (body.action === "regenerate") {
      const feedback = String(body.feedback || "").trim();
      if (!feedback) return fail(new Error("Escribe qué quieres cambiar"), 400);

      const rows = await sql<ProposalRow[]>`
        SELECT * FROM proposals WHERE user_id = ${userId} AND id = ${Number(id)}
      `;
      const proposal = rows[0];
      if (!proposal?.slides) return fail(new Error("Propuesta no encontrada"), 404);

      const quota = await consumeQuota(userId, "regenerate");
      if (!quota.ok) return quotaExceeded(quota);

      const brief = await buildBrandBrief(userId);
      const isScript = proposal.formato === "guion_video";

      if (isScript) {
        let beatsGuide = "";
        if (proposal.structure_id) {
          const structures = await sql<StructureRow[]>`
            SELECT * FROM structures
            WHERE id = ${proposal.structure_id} AND (user_id = ${userId} OR user_id IS NULL)
          `;
          if (structures[0]) {
            const beats = JSON.parse(structures[0].beats) as StructureBeat[];
            beatsGuide =
              "\nRespeta EXACTAMENTE esta estructura y sus nombres de sección en orden:\n" +
              beats.map((b, i) => `${i + 1}. ${b.nombre}: ${b.guia}`).join("\n");
          }
        }
        const gen = await chatJson<ScriptGen>(
          `Eres un guionista experto en video corto. Revisas guiones aplicando el feedback del creador SIN perder lo que ya funciona. Escribes en español, en el tono de la marca.\n\nFicha de marca:\n${brief}`,
          `Guion actual:\n${proposal.slides}\n\nCaption actual:\n${proposal.caption || ""}\n\nFEEDBACK DEL CREADOR (aplícalo):\n"""${feedback.slice(0, 600)}"""${beatsGuide}\n\nDevuelve JSON:\n{"beats": [{"seccion": "...", "texto": "..."}], "caption": "...", "hashtags": ["#..."], "calidad": {"score": 0, "razon": "..."}}\n${QUALITY_BAR}`
        );
        if (!gen.beats?.length) return fail(new Error("La IA no devolvió el guion revisado"), 500);
        const q = clampQuality(gen.calidad);
        await sql`
          UPDATE proposals SET
            slides = ${JSON.stringify(gen.beats)},
            caption = ${gen.caption || proposal.caption || ""},
            hashtags = ${JSON.stringify(gen.hashtags || [])},
            quality = ${q.score},
            quality_notes = ${q.notes},
            status = 'pendiente'
          WHERE user_id = ${userId} AND id = ${Number(id)}
        `;
        return NextResponse.json({ ok: true, regenerated: true });
      }

      const gen = await chatJson<CarouselGen>(
        `Eres un creador de carruseles virales de Instagram. Revisas carruseles aplicando el feedback del creador SIN perder lo que ya funciona. Cada slide: titulo (máx 60 caracteres) y cuerpo (máx 220). Primer slide = portada-gancho; último = CTA. Español, tono de la marca.\n\nFicha de marca:\n${brief}`,
        `Carrusel actual:\n${proposal.slides}\n\nCaption actual:\n${proposal.caption || ""}\n\nFEEDBACK DEL CREADOR (aplícalo):\n"""${feedback.slice(0, 600)}"""\n\nDevuelve JSON:\n{"slides": [{"titulo": "...", "cuerpo": "..."}], "caption": "...", "hashtags": ["#..."], "calidad": {"score": 0, "razon": "..."}}\nEntre 6 y 7 slides, 15-20 hashtags.\n${QUALITY_BAR}`
      );
      if (!gen.slides?.length) return fail(new Error("La IA no devolvió el carrusel revisado"), 500);
      const q = clampQuality(gen.calidad);
      await sql`
        UPDATE proposals SET
          slides = ${JSON.stringify(gen.slides)},
          caption = ${gen.caption || proposal.caption || ""},
          hashtags = ${JSON.stringify(gen.hashtags || [])},
          quality = ${q.score},
          quality_notes = ${q.notes},
          status = 'pendiente'
        WHERE user_id = ${userId} AND id = ${Number(id)}
      `;
      return NextResponse.json({ ok: true, regenerated: true });
    }

    // ————— Cambio de estado —————
    const { status } = body;
    if (!["aprobada", "rechazada", "pendiente"].includes(status)) {
      return fail(new Error("Estado inválido"), 400);
    }
    await sql`
      UPDATE proposals SET status = ${status}
      WHERE user_id = ${userId} AND id = ${Number(id)}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await getSql()`
    DELETE FROM proposals WHERE user_id = ${auth.userId} AND id = ${Number(id)}
  `;
  return NextResponse.json({ ok: true });
}
