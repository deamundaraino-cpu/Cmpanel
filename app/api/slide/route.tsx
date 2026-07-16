import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { getSql, ProposalRow } from "@/lib/db";
import { renderSlide, Slide } from "@/lib/slide";
import { buildBrandStyle } from "@/lib/brand";

export async function GET(req: NextRequest) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const pid = Number(req.nextUrl.searchParams.get("pid"));
  const index = Number(req.nextUrl.searchParams.get("i") || 0);
  const sql = getSql();
  const rows = await sql<ProposalRow[]>`
    SELECT * FROM proposals WHERE user_id = ${auth.userId} AND id = ${pid}
  `;
  const proposal = rows[0];
  if (!proposal?.slides) {
    return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
  }
  const slides = JSON.parse(proposal.slides) as Slide[];
  if (!slides[index]) {
    return NextResponse.json({ error: "Slide fuera de rango" }, { status: 404 });
  }
  return renderSlide({
    slide: slides[index],
    index,
    total: slides.length,
    style: await buildBrandStyle(auth.userId),
  });
}
