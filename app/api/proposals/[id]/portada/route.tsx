import { NextRequest, NextResponse } from "next/server";
import { guardClient } from "@/lib/api";
import { getSql, ProposalRow } from "@/lib/db";
import { renderVideoPortada, CoverVariant, COVER_VARIANTS } from "@/lib/slide";
import { buildBrandStyle } from "@/lib/brand";

type Beat = { seccion: string; texto: string; edicion?: string };

function firstWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  return words.length > n ? words.slice(0, n).join(" ") : text;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const sql = getSql();

  const rows = await sql<ProposalRow[]>`
    SELECT * FROM proposals WHERE client_id = ${auth.clientId} AND id = ${Number(id)}
  `;
  const proposal = rows[0];
  if (!proposal?.slides || proposal.formato !== "guion_video") {
    return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });
  }

  const beats = JSON.parse(proposal.slides) as Beat[];
  const titulo = firstWords(beats[0]?.texto || proposal.caption || "Mira esto", 12);

  const variantParam = req.nextUrl.searchParams.get("variant") as CoverVariant | null;
  const variant = COVER_VARIANTS.some((v) => v.value === variantParam) ? (variantParam as CoverVariant) : undefined;

  const style = await buildBrandStyle(proposal.client_id);
  style.visualStyle = "bold_impacto";

  return renderVideoPortada({ titulo, style, variant });
}
