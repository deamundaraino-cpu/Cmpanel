import { NextRequest, NextResponse } from "next/server";
import { guardClient } from "@/lib/api";
import { renderSlide, VisualStyle } from "@/lib/slide";
import { buildBrandStyle } from "@/lib/brand";

const DEMO_SLIDE = {
  titulo: "Así se ve tu carrusel",
  cuerpo: "Este es un ejemplo con tu color, tu logo y el estilo que elijas.",
};

export async function GET(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const style = await buildBrandStyle(auth.clientId);
  const override = req.nextUrl.searchParams.get("style");
  if (override) style.visualStyle = override as VisualStyle;

  return renderSlide({ slide: DEMO_SLIDE, index: 0, total: 4, style });
}
