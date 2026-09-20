import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { setSetting } from "@/lib/settings";
import { buildBrandBrief, getBrandDesign } from "@/lib/brand";
import { capProposedDesign, DESIGN_INSTRUCTION, validateDesign } from "@/lib/brandDesign";
import { chatJson } from "@/lib/llm";
import { consumeQuota, quotaExceeded } from "@/lib/quota";

export const maxDuration = 60;

export async function GET() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await getBrandDesign(auth.clientId));
}

/** Propone el esquema visual leyendo la ficha de marca y lo guarda. */
export async function POST() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const quota = await consumeQuota(auth.userId, "diseno");
    if (!quota.ok) return quotaExceeded(quota);

    const brief = await buildBrandBrief(auth.clientId);
    const gen = await chatJson<Record<string, unknown>>(
      DESIGN_INSTRUCTION,
      `Ficha de marca:\n${brief}\n\nElige el esquema visual de ESTA marca.`
    );
    const design = capProposedDesign(validateDesign(gen));
    await setSetting(auth.clientId, "brand_design", JSON.stringify(design));
    await setSetting(auth.clientId, "brand_visual_style", design.visualStyle);
    return NextResponse.json({ ok: true, design });
  } catch (e) {
    return fail(e);
  }
}

/** Guarda los ajustes hechos a mano sobre el esquema. */
export async function PUT(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const design = validateDesign(await req.json());
    await setSetting(auth.clientId, "brand_design", JSON.stringify(design));
    return NextResponse.json({ ok: true, design });
  } catch (e) {
    return fail(e, 400);
  }
}
