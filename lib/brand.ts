import { getSettings } from "./settings";
import { BrandStyle } from "./slide";
import { DEFAULT_DESIGN, validateDesign, type BrandDesign, type VisualStyle } from "./brandDesign";
import { chooseAvatarPhoto, chooseBackgroundPhoto, chooseCoverPhoto, listPhotoMeta, loadPhoto } from "./brandPhotos";

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

const VALID_STYLES: VisualStyle[] = ["editorial_claro", "bold_contraste", "bold_impacto", "foto_personal"];

/** ADN de diseño guardado; si la marca aún no lo tiene, el esquema por defecto. */
export function parseDesign(raw: string | null | undefined): BrandDesign {
  if (!raw) return DEFAULT_DESIGN;
  try {
    return validateDesign(JSON.parse(raw));
  } catch {
    return DEFAULT_DESIGN;
  }
}

/** ADN de una marca, para las rutas que no necesitan el estilo completo. */
export async function getBrandDesign(clientId: number): Promise<BrandDesign> {
  const s = await getSettings(clientId, ["brand_design"]);
  return parseDesign(s.brand_design);
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Identidad visual lista para pasar a renderSlide(): color, estilo, logo y fotos.
 * Las fotos solo se cargan con el estilo "Con tu foto" (o si se fuerzan), y solo
 * las necesarias: la portada se elige por `coverSeed` (el título de portada).
 */
export async function buildBrandStyle(
  clientId: number,
  opts: { coverSeed?: string; photoId?: string; needCover?: boolean; needAvatar?: boolean; forcePhotos?: boolean } = {}
): Promise<BrandStyle> {
  const s = await getSettings(clientId, [
    "brand_name",
    "brand_handle",
    "brand_color",
    "brand_color_secondary",
    "brand_colors_extra",
    "brand_visual_style",
    "brand_design",
    "brand_logo",
  ]);
  const design = parseDesign(s.brand_design);
  // "minimal_oscuro" ya no existe: quien lo tenía pasa a "Negro + acento".
  const visualStyle = VALID_STYLES.includes(s.brand_visual_style as VisualStyle)
    ? (s.brand_visual_style as VisualStyle)
    : "bold_impacto";
  return {
    brandName: s.brand_name || "Tu Marca",
    brandHandle: s.brand_handle || "@tumarca",
    primary: s.brand_color || "#e8590c",
    secondary: s.brand_color_secondary || "#3987e5",
    extra: parseJsonStringArray(s.brand_colors_extra),
    visualStyle,
    design,
    logo: s.brand_logo || null,
    ...(visualStyle === "foto_personal" || opts.forcePhotos ? await loadStylePhotos(clientId, opts) : {}),
  };
}

async function loadStylePhotos(
  clientId: number,
  {
    coverSeed = "",
    photoId,
    needCover = true,
    needAvatar = true,
  }: { coverSeed?: string; photoId?: string; needCover?: boolean; needAvatar?: boolean }
): Promise<Pick<BrandStyle, "coverPhoto" | "avatar" | "backgroundPhoto">> {
  const meta = await listPhotoMeta(clientId);
  if (!meta.length) return {};
  // Foto elegida a mano para esta pieza; si no, la que toque por el título.
  const picked = photoId && meta.some((m) => m.id === photoId) ? photoId : null;
  const chosen = needCover ? picked || chooseCoverPhoto(meta, coverSeed)?.id || null : null;
  const avatar = needAvatar ? chooseAvatarPhoto(meta) : null;
  const background = needCover ? chooseBackgroundPhoto(meta, coverSeed) : null;
  const [coverPhoto, avatarPhoto, backgroundPhoto] = await Promise.all([
    chosen ? loadPhoto(clientId, chosen) : null,
    avatar ? loadPhoto(clientId, avatar.id) : null,
    background ? loadPhoto(clientId, background.id) : null,
  ]);
  return { coverPhoto, avatar: avatarPhoto?.src || null, backgroundPhoto };
}
