import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, ProposalRow } from "@/lib/db";
import { buildBrandBrief, buildBrandStyle } from "@/lib/brand";
import { listPhotoMeta, loadPhoto } from "@/lib/brandPhotos";
import { chatJson } from "@/lib/llm";
import { COVER_TEXTS_INSTRUCTION, sanitizeCoverTexts } from "@/lib/proposalGen";
import { consumeQuota, quotaExceeded } from "@/lib/quota";
import { REEL_TEMPLATES } from "@/lib/brandDesign";
import { fallbackCoverText, renderReelCover } from "@/lib/reelCover";

export const maxDuration = 60;

type Beat = { seccion: string; texto: string; edicion?: string; portadas?: string[] };

async function loadScript(clientId: number, id: string) {
  const sql = getSql();
  const rows = await sql<ProposalRow[]>`
    SELECT * FROM proposals WHERE client_id = ${clientId} AND id = ${Number(id)}
  `;
  const proposal = rows[0];
  if (!proposal?.slides || proposal.formato !== "guion_video") return null;
  return { proposal, beats: JSON.parse(proposal.slides) as Beat[] };
}

/** Render de una propuesta de portada: ?t=plantilla&k=índice de texto (&texto= para uno propio). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const script = await loadScript(auth.clientId, id);
  if (!script) return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const templateIndex = Math.max(0, REEL_TEMPLATES.findIndex((t) => t.value === sp.get("t")));
  const template = REEL_TEMPLATES[templateIndex];
  const k = Math.max(0, Number(sp.get("k")) || 0);
  const hook = script.beats[0];
  const texts = hook?.portadas?.length ? hook.portadas : [fallbackCoverText(hook?.texto || script.proposal.caption || "Mira esto")];
  const text = (sp.get("texto") || "").trim().slice(0, 90) || texts[k % texts.length];

  // Foto elegida a mano, o rotación entre las marcadas para portadas (las que
  // componen con recorte priorizan las recortadas).
  const meta = (await listPhotoMeta(auth.clientId)).filter((m) => m.cover);
  const requested = sp.get("photo");
  const withCutout = meta.filter((m) => m.hasCutout);
  const pool = template.needsCutout && withCutout.length ? withCutout : meta;
  const chosen = meta.find((m) => m.id === requested) || (pool.length ? pool[(templateIndex + k) % pool.length] : null);

  const [style, photo] = await Promise.all([
    buildBrandStyle(auth.clientId, { needCover: false, needAvatar: false }),
    chosen ? loadPhoto(auth.clientId, chosen.id) : null,
  ]);

  const image = renderReelCover({ template: template.value, text, style, photo });
  if (sp.get("download")) {
    return new NextResponse(image.body, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="portada-${id}-${template.value}.png"`,
      },
    });
  }
  return image;
}

/** Genera una tanda nueva de textos de portada con la IA y la guarda en el guion. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const script = await loadScript(auth.clientId, id);
    if (!script) return fail(new Error("Guion no encontrado"), 404);

    const quota = await consumeQuota(auth.userId, "portada");
    if (!quota.ok) return quotaExceeded(quota);

    const brief = await buildBrandBrief(auth.clientId);
    const previous = script.beats[0]?.portadas || [];
    const gen = await chatJson<{ portadas: string[] }>(
      `Eres un experto en miniaturas y portadas de Reels que paran el scroll. Escribes en español, en el tono de la marca.\n\nFicha de marca:\n${brief}`,
      `Guion del reel:\n${script.beats.map((b) => `[${b.seccion}] ${b.texto}`).join("\n")}\n\n${
        previous.length ? `Textos de portada anteriores (NO los repitas, busca ángulos nuevos):\n${previous.join("\n")}\n\n` : ""
      }${COVER_TEXTS_INSTRUCTION}\n\nDevuelve JSON: {"portadas": ["...", "...", "...", "...", "...", "..."]}`
    );
    const portadas = sanitizeCoverTexts(gen.portadas);
    if (!portadas.length) return fail(new Error("La IA no devolvió textos de portada válidos"), 500);

    const beats = script.beats.map((b, i) => (i === 0 ? { ...b, portadas } : b));
    const sql = getSql();
    await sql`
      UPDATE proposals SET slides = ${JSON.stringify(beats)}
      WHERE client_id = ${auth.clientId} AND id = ${Number(id)}
    `;
    return NextResponse.json({ ok: true, portadas });
  } catch (e) {
    return fail(e);
  }
}
