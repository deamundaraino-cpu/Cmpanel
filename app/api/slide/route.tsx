import { NextRequest, NextResponse } from "next/server";
import { guardClient } from "@/lib/api";
import { getSql, ProposalRow } from "@/lib/db";
import { renderSlide, Slide } from "@/lib/slide";
import { buildBrandStyle } from "@/lib/brand";
import { brandFingerprint, etagFor, matchesEtag, notModified } from "@/lib/renderVersion";

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
  // Identidad de esta imagen: el contenido de la pieza más el estado de la
  // marca. Si el navegador ya la tiene, se responde 304 ANTES de construir el
  // estilo, que es lo que lee las fotos de Postgres.
  const etag = etagFor(proposal.id, index, proposal.slides, await brandFingerprint(proposal.client_id));
  if (matchesEtag(req.headers.get("if-none-match"), etag)) return notModified(etag);

  return renderSlide({
    slide: slides[index],
    index,
    total: slides.length,
    etag,
    style: await buildBrandStyle(proposal.client_id, {
      coverSeed: slides[0].titulo,
      photoId: slides[0].foto,
      needCover: index === 0,
      needAvatar: index !== 0,
    }),
  });
}
