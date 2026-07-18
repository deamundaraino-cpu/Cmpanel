import { getSettings } from "./settings";
import { BrandStyle, VisualStyle } from "./slide";

const BRIEF_KEYS = [
  "brand_name",
  "brand_handle",
  "brand_niche",
  "brand_mission",
  "brand_audience",
  "brand_value_prop",
  "brand_tone",
  "brand_pillars",
  "brand_objectives",
  "brand_avoid",
] as const;

/** Ficha de marca completa, lista para inyectar en cualquier prompt de la IA. */
export async function buildBrandBrief(clientId: number): Promise<string> {
  const s = await getSettings(clientId, [...BRIEF_KEYS]);
  const lines: string[] = [];

  if (s.brand_name) lines.push(`Marca: ${s.brand_name}${s.brand_handle ? ` (${s.brand_handle})` : ""}`);
  if (s.brand_niche) lines.push(`Nicho / industria: ${s.brand_niche}`);
  if (s.brand_mission) lines.push(`Misión y propósito: ${s.brand_mission}`);
  if (s.brand_audience) lines.push(`Cliente ideal: ${s.brand_audience}`);
  if (s.brand_value_prop) lines.push(`Propuesta de valor y diferenciadores: ${s.brand_value_prop}`);
  if (s.brand_tone) lines.push(`Tono de voz: ${s.brand_tone}`);
  if (s.brand_pillars) lines.push(`Líneas de contenido (pilares):\n${s.brand_pillars}`);
  if (s.brand_objectives) lines.push(`Objetivos actuales: ${s.brand_objectives}`);
  if (s.brand_avoid) lines.push(`Evitar: ${s.brand_avoid}`);

  return lines.length
    ? lines.join("\n\n")
    : "Sin ficha de marca configurada todavía (ve a 🧠 Marca para completarla).";
}

export async function hasBrandBrief(clientId: number): Promise<boolean> {
  const s = await getSettings(clientId, [...BRIEF_KEYS]);
  return Object.values(s).some((v) => !!v);
}

/** Completitud de la ficha de marca (para la card "lo que tu IA sabe"). */
export async function briefCompleteness(
  clientId: number
): Promise<{ filled: number; total: number }> {
  const s = await getSettings(clientId, [...BRIEF_KEYS]);
  return {
    filled: Object.values(s).filter((v) => !!v).length,
    total: BRIEF_KEYS.length,
  };
}

const VALID_STYLES: VisualStyle[] = ["minimal_oscuro", "editorial_claro", "bold_contraste"];

/** Identidad visual lista para pasar a renderSlide(): color, estilo y logo. */
export async function buildBrandStyle(clientId: number): Promise<BrandStyle> {
  const s = await getSettings(clientId, [
    "brand_name",
    "brand_handle",
    "brand_color",
    "brand_color_secondary",
    "brand_visual_style",
    "brand_logo",
  ]);
  const visualStyle = VALID_STYLES.includes(s.brand_visual_style as VisualStyle)
    ? (s.brand_visual_style as VisualStyle)
    : "minimal_oscuro";
  return {
    brandName: s.brand_name || "Tu Marca",
    brandHandle: s.brand_handle || "@tumarca",
    primary: s.brand_color || "#e8590c",
    secondary: s.brand_color_secondary || "#3987e5",
    visualStyle,
    logo: s.brand_logo || null,
  };
}
