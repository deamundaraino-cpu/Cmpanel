import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { guardClient, fail } from "@/lib/api";
import { getSql, ProposalRow, StructureRow, StructureBeat } from "@/lib/db";
import { chatJson } from "@/lib/llm";
import { buildBrandBrief } from "@/lib/brand";
import {
  CarouselGen,
  ScriptGen,
  QUALITY_BAR,
  EDIT_NOTES_INSTRUCTION,
  clampQuality,
  applyCoverLayout,
  COVER_LAYOUT_INSTRUCTION,
  applyCoverTexts,
  COVER_TEXTS_INSTRUCTION,
} from "@/lib/proposalGen";
import { consumeQuota, quotaExceeded } from "@/lib/quota";
import { listPhotoMeta } from "@/lib/brandPhotos";
import { COVER_LAYOUTS } from "@/lib/brandDesign";
import { ensurePipelineItem } from "@/lib/pipeline";

export const maxDuration = 120;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { userId, clientId } = auth;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const sql = getSql();

    // ————— Compartir con el cliente (enlace público de aprobación) —————
    if (body.action === "share") {
      const rows = await sql<ProposalRow[]>`
        SELECT * FROM proposals WHERE client_id = ${clientId} AND id = ${Number(id)}
      `;
      const proposal = rows[0];
      if (!proposal) return fail(new Error("Propuesta no encontrada"), 404);
      let token = proposal.share_token;
      if (!token) {
        token = randomUUID();
        await sql`
          UPDATE proposals SET share_token = ${token}
          WHERE client_id = ${clientId} AND id = ${Number(id)}
        `;
      }
      return NextResponse.json({ ok: true, token, path: `/revisar/${token}` });
    }

    // ————— Elegir la foto y la composición de la portada del carrusel —————
    if (body.action === "cover") {
      const rows = await sql<ProposalRow[]>`
        SELECT * FROM proposals WHERE client_id = ${clientId} AND id = ${Number(id)}
      `;
      const proposal = rows[0];
      if (!proposal?.slides || proposal.formato === "guion_video") return fail(new Error("Carrusel no encontrado"), 404);
      const slides = JSON.parse(proposal.slides) as { titulo: string; cuerpo: string; layout?: string; foto?: string }[];
      if (!slides[0]) return fail(new Error("El carrusel no tiene portada"), 400);

      if (typeof body.foto === "string") {
        const meta = await listPhotoMeta(clientId);
        if (!meta.some((m) => m.id === body.foto)) return fail(new Error("Foto no encontrada"), 400);
        slides[0].foto = body.foto;
      }
      if (COVER_LAYOUTS.some((l) => l.value === body.layout)) slides[0].layout = body.layout;

      await sql`
        UPDATE proposals SET slides = ${JSON.stringify(slides)}
        WHERE client_id = ${clientId} AND id = ${Number(id)}
      `;
      return NextResponse.json({ ok: true });
    }

    // ————— Regenerar con feedback (del editor o del cliente) —————
    if (body.action === "regenerate") {
      const feedback = String(body.feedback || "").trim();
      if (!feedback) return fail(new Error("Escribe qué quieres cambiar"), 400);

      const rows = await sql<ProposalRow[]>`
        SELECT * FROM proposals WHERE client_id = ${clientId} AND id = ${Number(id)}
      `;
      const proposal = rows[0];
      if (!proposal?.slides) return fail(new Error("Propuesta no encontrada"), 404);

      const quota = await consumeQuota(userId, "regenerate");
      if (!quota.ok) return quotaExceeded(quota);

      const brief = await buildBrandBrief(clientId);
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
          `Guion actual:\n${proposal.slides}\n\nCaption actual:\n${proposal.caption || ""}\n\nFEEDBACK (aplícalo):\n"""${feedback.slice(0, 600)}"""${beatsGuide}\n\n${EDIT_NOTES_INSTRUCTION}\n\nEn el texto de la PRIMERA sección (el gancho inicial), envuelve entre **dobles asteriscos** la frase corta (2-5 palabras) más potente — se usa para generar la portada/miniatura del video.\n\nDevuelve JSON:\n{"beats": [{"seccion": "...", "texto": "...", "edicion": "..."}], "caption": "...", "hashtags": ["#..."], "calidad": {"score": 0, "razon": "..."}, "portadas": ["...", "..."]}\n${QUALITY_BAR}\n${COVER_TEXTS_INSTRUCTION}`
        );
        if (!gen.beats?.length) return fail(new Error("La IA no devolvió el guion revisado"), 500);
        const q = clampQuality(gen.calidad);
        await sql`
          UPDATE proposals SET
            slides = ${JSON.stringify(applyCoverTexts(gen))},
            caption = ${gen.caption || proposal.caption || ""},
            hashtags = ${JSON.stringify(gen.hashtags || [])},
            quality = ${q.score},
            quality_notes = ${q.notes},
            status = 'pendiente',
            client_feedback = NULL
          WHERE client_id = ${clientId} AND id = ${Number(id)}
        `;
        return NextResponse.json({ ok: true, regenerated: true });
      }

      const gen = await chatJson<CarouselGen>(
        `Eres un creador de carruseles virales de Instagram. Revisas carruseles aplicando el feedback del creador SIN perder lo que ya funciona. Cada slide: titulo (máx 60 caracteres) y cuerpo (máx 220). Primer slide = portada-gancho; último = CTA. Español, tono de la marca. En el titulo de CADA slide, envuelve entre **dobles asteriscos** la palabra o frase corta (1-3 palabras) más impactante — es la que se resalta visualmente en el diseño del carrusel.\n\nFicha de marca:\n${brief}`,
        `Carrusel actual:\n${proposal.slides}\n\nCaption actual:\n${proposal.caption || ""}\n\nFEEDBACK (aplícalo):\n"""${feedback.slice(0, 600)}"""\n\nDevuelve JSON:\n{"slides": [{"titulo": "...", "cuerpo": "..."}], "caption": "...", "hashtags": ["#..."], "calidad": {"score": 0, "razon": "..."}, "portada_layout": "split"}\nEntre 6 y 7 slides, 15-20 hashtags.\n${QUALITY_BAR}\n${COVER_LAYOUT_INSTRUCTION}`
      );
      if (!gen.slides?.length) return fail(new Error("La IA no devolvió el carrusel revisado"), 500);
      const q = clampQuality(gen.calidad);
      await sql`
        UPDATE proposals SET
          slides = ${JSON.stringify(applyCoverLayout(gen))},
          caption = ${gen.caption || proposal.caption || ""},
          hashtags = ${JSON.stringify(gen.hashtags || [])},
          quality = ${q.score},
          quality_notes = ${q.notes},
          status = 'pendiente',
          client_feedback = NULL
        WHERE client_id = ${clientId} AND id = ${Number(id)}
      `;
      return NextResponse.json({ ok: true, regenerated: true });
    }

    // ————— Cambio de estado —————
    const { status } = body;
    if (!["aprobada", "rechazada", "pendiente"].includes(status)) {
      return fail(new Error("Estado inválido"), 400);
    }
    const updated = await sql<ProposalRow[]>`
      UPDATE proposals SET status = ${status}
      WHERE client_id = ${clientId} AND id = ${Number(id)}
      RETURNING *
    `;
    if (status === "aprobada" && updated[0]) {
      await ensurePipelineItem(updated[0]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await getSql()`
    DELETE FROM proposals WHERE client_id = ${auth.clientId} AND id = ${Number(id)}
  `;
  return NextResponse.json({ ok: true });
}
