import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { guard, fail } from "@/lib/api";
import { getSql, ProposalRow } from "@/lib/db";
import { renderSlide, Slide } from "@/lib/slide";
import { buildBrandStyle } from "@/lib/brand";

export const maxDuration = 120;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  try {
    const { id } = await params;
    const sql = getSql();
    const rows = await sql<ProposalRow[]>`
      SELECT * FROM proposals WHERE user_id = ${userId} AND id = ${Number(id)}
    `;
    const proposal = rows[0];
    if (!proposal?.slides) return fail(new Error("Propuesta no encontrada"), 404);

    if (proposal.formato === "guion_video") {
      const beats = JSON.parse(proposal.slides) as { seccion: string; texto: string }[];
      const hashtags = proposal.hashtags ? (JSON.parse(proposal.hashtags) as string[]) : [];
      const body =
        beats.map((b) => `[${b.seccion.toUpperCase()}]\n${b.texto}`).join("\n\n") +
        `\n\n---\nCopy para publicar:\n${proposal.caption || ""}\n\n${hashtags.join(" ")}`;
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="guion-${id}.txt"`,
        },
      });
    }

    const slides = JSON.parse(proposal.slides) as Slide[];
    const style = await buildBrandStyle(userId);

    const zip = new JSZip();
    for (let i = 0; i < slides.length; i++) {
      const img = renderSlide({
        slide: slides[i],
        index: i,
        total: slides.length,
        style,
      });
      const buf = await img.arrayBuffer();
      zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, buf);
    }

    const hashtags = proposal.hashtags ? (JSON.parse(proposal.hashtags) as string[]) : [];
    zip.file("caption.txt", (proposal.caption || "") + "\n\n" + hashtags.join(" "));

    const blob = await zip.generateAsync({ type: "nodebuffer" });
    return new NextResponse(new Uint8Array(blob), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="carrusel-${id}.zip"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
