import { NextRequest, NextResponse } from "next/server";
import { guardClient } from "@/lib/api";
import { COVER_LAYOUTS, CoverLayout, renderSlide, VisualStyle } from "@/lib/slide";
import { buildBrandStyle } from "@/lib/brand";

const DEMO_SLIDE = {
  titulo: "Así se ve **tu carrusel**",
  cuerpo: "Este es un ejemplo con tus colores, tu logo y el estilo que elijas.",
};

const DEMO_TITLES: Record<CoverLayout, string> = {
  split: "Antes de invertir en **anuncios**, haz esto",
  texto_detras: "El **embudo** que nadie te explica",
  numero: "3 **hábitos** que cambiaron mi negocio",
  editorial_lateral: "Lo que nadie te cuenta del **primer millón**",
  marco: "La estrategia que **sí** funciona",
  banda: "Cómo ordenar tus **números** este mes",
  retrato: "Tips de **productividad** que necesitas",
  tipografico: "Cómo **destacar** en tu sector",
  declaracion: "Tu precio no es el **problema**",
  cita: "Nadie compra lo que no **entiende**",
};

export async function GET(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const override = req.nextUrl.searchParams.get("style");
  const layout = req.nextUrl.searchParams.get("layout") as CoverLayout | null;
  const slide = layout && COVER_LAYOUTS.some((l) => l.value === layout)
    ? { titulo: DEMO_TITLES[layout], cuerpo: "", layout }
    : DEMO_SLIDE;

  const style = await buildBrandStyle(auth.clientId, {
    coverSeed: slide.titulo,
    needAvatar: false,
    forcePhotos: override === "foto_personal",
  });
  if (override) style.visualStyle = override as VisualStyle;

  return renderSlide({ slide, index: 0, total: 7, style });
}
