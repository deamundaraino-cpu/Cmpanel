import { NextRequest, NextResponse } from "next/server";
import { guardClient } from "@/lib/api";
import { getSql, ProposalRow } from "@/lib/db";
import { renderSlide, Slide } from "@/lib/slide";
import { buildBrandStyle } from "@/lib/brand";

export async function GET(req: NextRequest) {
  const pid = Number(req.nextUrl.searchParams.get("pid"));
  const index = Number(req.nextUrl.searchParams.get("i") || 0);
  const token = req.nextUrl.searchParams.get("token");
  const sql = getSql();

  let proposal: ProposalRow | undefined;
  if (token) {
    // Acceso público vía enlace de aprobación: el share_token es la credencial
    // de ESTA propuesta concreta (página /revisar/[token], sin sesión).
    const rows = await sql<ProposalRow[]>`
      SELECT * FROM proposals WHERE share_token = ${token} AND id = ${pid}
    `;
    proposal = rows[0];
  } else {
    const auth = await guardClient();
    if (auth instanceof NextResponse) return auth;
    const rows = await sql<ProposalRow[]>`
      SELECT * FROM proposals WHERE client_id = ${auth.clientId} AND id = ${pid}
    `;
    proposal = rows[0];
  }

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
    style: await buildBrandStyle(proposal.client_id),
  });
}
