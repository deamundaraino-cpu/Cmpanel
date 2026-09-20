// ADN de diseño por marca: las perillas que hacen que dos marcas con la misma
// plataforma no produzcan la misma imagen. La IA las propone leyendo la ficha
// de marca y el usuario puede corregirlas a mano. Módulo de datos puro (sin
// next/og ni fs), para poder usarlo también desde el navegador.

export type FontPairKey = "impacto" | "pesado" | "condensado" | "moderno" | "editorial" | "serio";

type FontFile = { weight: 400 | 500 | 700 | 800 | 900; file: string };

export const FONT_PAIRS: Record<
  FontPairKey,
  { label: string; vibe: string; display: { family: string; file: string }; body: { family: string; files: FontFile[] } }
> = {
  impacto: {
    label: "Impacto",
    vibe: "Condensada y ruidosa. Para marcas directas, de ataque, que gritan el gancho.",
    display: { family: "Anton", file: "anton-latin-400-normal.woff" },
    body: {
      family: "Inter",
      files: [
        { weight: 500, file: "inter-latin-500-normal.woff" },
        { weight: 800, file: "inter-latin-800-normal.woff" },
        { weight: 900, file: "inter-latin-900-normal.woff" },
      ],
    },
  },
  pesado: {
    label: "Pesado",
    vibe: "Gruesa y ancha, neutra. Contundente sin ser agresiva.",
    display: { family: "Archivo Black", file: "archivo-black-latin-400-normal.woff" },
    body: {
      family: "Inter",
      files: [
        { weight: 500, file: "inter-latin-500-normal.woff" },
        { weight: 800, file: "inter-latin-800-normal.woff" },
        { weight: 900, file: "inter-latin-900-normal.woff" },
      ],
    },
  },
  condensado: {
    label: "Condensado",
    vibe: "Estrecha y deportiva. Aguanta titulares largos sin encoger la letra.",
    display: { family: "Bebas Neue", file: "bebas-neue-latin-400-normal.woff" },
    body: {
      family: "DM Sans",
      files: [
        { weight: 500, file: "dm-sans-latin-500-normal.woff" },
        { weight: 700, file: "dm-sans-latin-700-normal.woff" },
      ],
    },
  },
  moderno: {
    label: "Moderno",
    vibe: "Geométrica y limpia, aire de producto tecnológico.",
    display: { family: "Space Grotesk", file: "space-grotesk-latin-700-normal.woff" },
    body: {
      family: "Inter",
      files: [
        { weight: 500, file: "inter-latin-500-normal.woff" },
        { weight: 800, file: "inter-latin-800-normal.woff" },
        { weight: 900, file: "inter-latin-900-normal.woff" },
      ],
    },
  },
  editorial: {
    label: "Editorial",
    vibe: "Serif de alto contraste. Autoridad, criterio, revista.",
    display: { family: "Playfair Display", file: "playfair-display-latin-900-normal.woff" },
    body: {
      family: "Lora",
      files: [
        { weight: 500, file: "lora-latin-500-normal.woff" },
        { weight: 700, file: "lora-latin-700-normal.woff" },
      ],
    },
  },
  serio: {
    label: "Serio",
    vibe: "Serif sobria e institucional. Confianza y trato profesional.",
    display: { family: "DM Serif Display", file: "dm-serif-display-latin-400-normal.woff" },
    body: {
      family: "DM Sans",
      files: [
        { weight: 500, file: "dm-sans-latin-500-normal.woff" },
        { weight: 700, file: "dm-sans-latin-700-normal.woff" },
      ],
    },
  },
};

import { TEXTURES, TEXTURE_INTENSITIES, type TextureIntensity, type TextureKind } from "./texture";

export type VisualStyle = "editorial_claro" | "bold_contraste" | "bold_impacto" | "foto_personal";

export const VISUAL_STYLES: { value: VisualStyle; label: string; hint: string }[] = [
  {
    value: "foto_personal",
    label: "Con tu foto",
    hint: "Portadas compuestas con tu figura recortada. La IA elige la composición de cada carrusel.",
  },
  {
    value: "bold_impacto",
    label: "Fondo oscuro",
    hint: "Fondo oscuro, titular grande y la frase clave en tu color más vivo.",
  },
  {
    value: "bold_contraste",
    label: "Bloque de color",
    hint: "Fondo a todo color con tu paleta y texto con contraste automático. Ideal para hooks.",
  },
  {
    value: "editorial_claro",
    label: "Editorial claro",
    hint: "Fondo claro, texto oscuro y barra de color como firma. Look de revista.",
  },
];

export type CoverLayout =
  | "split"
  | "texto_detras"
  | "numero"
  | "editorial_lateral"
  | "marco"
  | "banda"
  | "retrato"
  | "tipografico"
  | "declaracion"
  | "cita";

export const COVER_LAYOUTS: {
  value: CoverLayout;
  label: string;
  hint: string;
  /** Necesita la figura recortada (sin fondo). */
  needsCutout?: boolean;
  /** Funciona sin ninguna foto: solo tipografía (y fondo, si lo hay). */
  textOnly?: boolean;
  /** Registro visual, para que la IA elija con criterio. */
  vibe: "impacto" | "elegante" | "corporativo" | "editorial";
}[] = [
  { value: "split", label: "Split", hint: "Bloque de color con el titular y tu figura saliendo del borde.", needsCutout: true, vibe: "impacto" },
  { value: "texto_detras", label: "Texto detrás", hint: "La palabra clave gigante y tu figura delante.", needsCutout: true, vibe: "impacto" },
  { value: "numero", label: "Número protagonista", hint: "Un número enorme con tu figura encima. Para títulos tipo lista.", needsCutout: true, vibe: "impacto" },
  {
    value: "editorial_lateral",
    label: "Editorial lateral",
    hint: "Tu foto a un lado y el titular al otro, con filetes finos y firma. Aire de portada de revista.",
    vibe: "editorial",
  },
  { value: "marco", label: "Marco", hint: "Tu foto enmarcada sobre fondo limpio y el titular debajo. Sobrio y premium.", vibe: "elegante" },
  { value: "banda", label: "Banda inferior", hint: "Foto arriba y franja de color abajo con el titular. Orden corporativo.", vibe: "corporativo" },
  { value: "retrato", label: "Retrato", hint: "Tu foto a sangre con el titular centrado abajo sobre degradado.", vibe: "elegante" },
  { value: "tipografico", label: "Tipográfico", hint: "Sin foto: titular gigante ocupando la portada, con insignia de deslizar.", textOnly: true, vibe: "impacto" },
  {
    value: "declaracion",
    label: "Declaración",
    hint: "Sin foto: una sola frase centrada con mucho aire. Minimalismo de alto estatus.",
    textOnly: true,
    vibe: "elegante",
  },
  { value: "cita", label: "Cita", hint: "Comillas grandes, la frase como cita y tu firma. Autoridad tranquila.", textOnly: true, vibe: "editorial" },
];

export type ReelTemplate =
  | "centro"
  | "arriba"
  | "circulo"
  | "cintas"
  | "cita"
  | "split"
  | "detras"
  | "editorial"
  | "marco"
  | "banda"
  | "declaracion";

export const REEL_TEMPLATES: {
  value: ReelTemplate;
  label: string;
  hint: string;
  needsCutout?: boolean;
  tilted?: boolean;
  vibe: "impacto" | "elegante" | "corporativo" | "editorial";
}[] = [
  { value: "centro", label: "Bloque central", hint: "Titular sobre el pecho, centrado.", vibe: "impacto" },
  { value: "arriba", label: "Titular arriba", hint: "Titular grande sobre la cabeza.", vibe: "impacto" },
  { value: "circulo", label: "Círculo", hint: "Palabra clave o número dentro de un círculo.", tilted: true, vibe: "impacto" },
  { value: "cintas", label: "Cintas", hint: "Cada línea como una etiqueta.", tilted: true, vibe: "impacto" },
  { value: "cita", label: "Cita", hint: "Comillas grandes y la frase a un lado.", vibe: "editorial" },
  { value: "split", label: "Bloque de color", hint: "Panel de color arriba y figura debajo.", needsCutout: true, vibe: "impacto" },
  { value: "detras", label: "Texto detrás", hint: "Palabra clave gigante detrás de la figura.", needsCutout: true, vibe: "impacto" },
  {
    value: "editorial",
    label: "Editorial",
    hint: "Fondo claro, kicker y filetes finos, titular sobrio y tu figura abajo. Portada de revista.",
    vibe: "editorial",
  },
  { value: "marco", label: "Marco", hint: "Tu foto enmarcada sobre fondo limpio y el titular debajo. Premium.", vibe: "elegante" },
  { value: "banda", label: "Banda inferior", hint: "Foto arriba y franja de color abajo con el titular. Orden corporativo.", vibe: "corporativo" },
  {
    value: "declaracion",
    label: "Declaración",
    hint: "Sin foto: una frase centrada con mucho aire. Minimalismo de alto estatus.",
    vibe: "elegante",
  },
];

export type BrandDesign = {
  fontPair: FontPairKey;
  textCase: "upper" | "sentence";
  emphasis: "box" | "color" | "underline";
  shape: "sharp" | "soft";
  background: "flat" | "halo" | "degradado";
  texture: TextureKind;
  textureIntensity: TextureIntensity;
  textureColor: "acento" | "secundario" | "claro";
  align: "left" | "center";
  tilt: boolean;
  visualStyle: VisualStyle;
  reelTemplates: ReelTemplate[];
  coverLayouts: CoverLayout[];
  notes?: string;
};

export const DEFAULT_DESIGN: BrandDesign = {
  fontPair: "impacto",
  textCase: "upper",
  emphasis: "box",
  shape: "soft",
  background: "halo",
  texture: "puntos",
  textureIntensity: "medio",
  textureColor: "acento",
  align: "center",
  tilt: true,
  visualStyle: "foto_personal",
  reelTemplates: REEL_TEMPLATES.map((t) => t.value),
  coverLayouts: COVER_LAYOUTS.map((l) => l.value),
};

export const DESIGN_OPTIONS = {
  fontPair: Object.keys(FONT_PAIRS) as FontPairKey[],
  textCase: ["upper", "sentence"] as const,
  emphasis: ["box", "color", "underline"] as const,
  shape: ["sharp", "soft"] as const,
  background: ["flat", "halo", "degradado"] as const,
  texture: TEXTURES.map((t) => t.value),
  textureIntensity: TEXTURE_INTENSITIES.map((t) => t.value),
  textureColor: ["acento", "secundario", "claro"] as const,
  align: ["left", "center"] as const,
};

export const DESIGN_LABELS: Record<string, Record<string, string>> = {
  textCase: { upper: "MAYÚSCULAS", sentence: "Frase normal" },
  emphasis: { box: "Caja de color", color: "Solo color", underline: "Subrayado" },
  shape: { sharp: "Esquinas rectas", soft: "Esquinas redondeadas" },
  background: { flat: "Plano", halo: "Halo de color", degradado: "Degradado" },
  texture: Object.fromEntries(TEXTURES.map((t) => [t.value, t.label])),
  textureIntensity: Object.fromEntries(TEXTURE_INTENSITIES.map((t) => [t.value, t.label])),
  textureColor: { acento: "Color de acento", secundario: "Color secundario", claro: "Neutro claro" },
  align: { left: "Izquierda", center: "Centrado" },
};

/**
 * Si la IA no devolvió listas válidas, no se activan todas: se deduce un juego
 * coherente con el resto del esquema (una marca sin elementos girados no
 * estrena cintas ni círculos; una sobria no estrena composiciones de ataque).
 */
function inferredReelTemplates(tilt: boolean, loud: boolean): ReelTemplate[] {
  const wanted = loud ? ["impacto", "editorial"] : ["elegante", "editorial", "corporativo"];
  const pool = REEL_TEMPLATES.filter((t) => (tilt || !t.tilted) && wanted.includes(t.vibe));
  return (pool.length >= 4 ? pool : REEL_TEMPLATES.filter((t) => tilt || !t.tilted)).slice(0, 5).map((t) => t.value);
}

function inferredCoverLayouts(loud: boolean): CoverLayout[] {
  const wanted = loud
    ? ["impacto", "editorial", "corporativo"]
    : ["elegante", "editorial", "corporativo"];
  const pool = COVER_LAYOUTS.filter((l) => wanted.includes(l.vibe));
  return (pool.length >= 4 ? pool : COVER_LAYOUTS).slice(0, 6).map((l) => l.value);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Normaliza lo que venga de la IA o del formulario a un ADN válido. */
export function validateDesign(raw: unknown): BrandDesign {
  const d = (raw || {}) as Partial<BrandDesign>;
  const templates = Array.isArray(d.reelTemplates)
    ? d.reelTemplates.filter((t): t is ReelTemplate => REEL_TEMPLATES.some((r) => r.value === t))
    : [];
  const covers = Array.isArray(d.coverLayouts)
    ? d.coverLayouts.filter((l): l is CoverLayout => COVER_LAYOUTS.some((c) => c.value === l))
    : [];
  const tilt = typeof d.tilt === "boolean" ? d.tilt : DEFAULT_DESIGN.tilt;
  const textCase = pick(d.textCase, DESIGN_OPTIONS.textCase, DEFAULT_DESIGN.textCase);
  const emphasis = pick(d.emphasis, DESIGN_OPTIONS.emphasis, DEFAULT_DESIGN.emphasis);
  const loud = tilt || (textCase === "upper" && emphasis === "box");
  return {
    fontPair: pick(d.fontPair, DESIGN_OPTIONS.fontPair, DEFAULT_DESIGN.fontPair),
    textCase,
    emphasis,
    shape: pick(d.shape, DESIGN_OPTIONS.shape, DEFAULT_DESIGN.shape),
    background: pick(d.background, DESIGN_OPTIONS.background, DEFAULT_DESIGN.background),
    texture: pick(d.texture, DESIGN_OPTIONS.texture, DEFAULT_DESIGN.texture),
    textureIntensity: pick(d.textureIntensity, DESIGN_OPTIONS.textureIntensity, DEFAULT_DESIGN.textureIntensity),
    textureColor: pick(d.textureColor, DESIGN_OPTIONS.textureColor, DEFAULT_DESIGN.textureColor),
    align: pick(d.align, DESIGN_OPTIONS.align, DEFAULT_DESIGN.align),
    tilt,
    visualStyle: pick(d.visualStyle, VISUAL_STYLES.map((v) => v.value), DEFAULT_DESIGN.visualStyle),
    // Se respeta lo elegido a mano, sin tope: si no hay selección válida, se
    // deduce del resto del esquema (el tope solo aplica a lo que propone la IA).
    reelTemplates: templates.length >= 3 ? templates : inferredReelTemplates(tilt, loud),
    coverLayouts: covers.length >= 2 ? covers : inferredCoverLayouts(loud),
    notes: typeof d.notes === "string" ? d.notes.slice(0, 300) : undefined,
  };
}

/**
 * La propuesta de la IA se queda en una selección, no en el catálogo entero:
 * una marca con todo activo vuelve a verse igual que las demás.
 */
export function capProposedDesign(design: BrandDesign): BrandDesign {
  return {
    ...design,
    reelTemplates: design.reelTemplates.slice(0, 5),
    coverLayouts: design.coverLayouts.slice(0, 6),
  };
}

/** Composiciones de portada de carrusel que usa la marca (siempre alguna válida). */
export function brandCoverLayouts(design: BrandDesign): CoverLayout[] {
  return design.coverLayouts.length ? design.coverLayouts : DEFAULT_DESIGN.coverLayouts;
}

/** Portadas de reel que usa la marca, en su orden (las no elegidas no se ofrecen). */
export function brandReelTemplates(design: BrandDesign): ReelTemplate[] {
  const preferred = design.reelTemplates.filter((t) => REEL_TEMPLATES.some((r) => r.value === t));
  return preferred.length ? preferred : DEFAULT_DESIGN.reelTemplates;
}

export const DESIGN_INSTRUCTION = `Eres director de arte. A partir de la ficha de marca, elige el esquema visual con el que se generarán sus carruseles y portadas de reel. Devuelve SOLO JSON:
{"fontPair": "...", "textCase": "...", "emphasis": "...", "shape": "...", "background": "...", "texture": "...", "textureIntensity": "...", "textureColor": "...", "align": "...", "tilt": true, "visualStyle": "...", "reelTemplates": ["...", "..."], "coverLayouts": ["...", "..."], "notes": "..."}

- fontPair (pareja tipográfica): ${Object.entries(FONT_PAIRS)
  .map(([k, v]) => `"${k}" = ${v.vibe}`)
  .join(" | ")}
- textCase: "upper" (MAYÚSCULAS, urgencia y ruido) o "sentence" (Frase normal, cercanía y criterio).
- emphasis, cómo se destaca la frase clave: "box" (caja de color, máximo grito), "color" (solo el color del acento, sobrio), "underline" (subrayado, discreto y editorial).
- shape: "sharp" (esquinas rectas, técnico/serio) o "soft" (redondeadas, cercano).
- background: "flat" (color plano, austero), "halo" (halo de color tras la persona, dramático), "degradado" (degradado de marca, comercial).
- texture, el grafismo del fondo, elegido por lo que HACE la marca y no por gusto: ${TEXTURES.map((t) => `"${t.value}" (${t.hint})`).join(" | ")}. Ejemplos: una asesoría fiscal o legal encaja con "malla" o "cuadricula"; un negocio de datos o software, con "malla" o "lineas"; salud, bienestar o coaching, con "ondas"; marcas premium o de alto ticket, con "destellos"; formación y consultoría editorial, con "granulado"; marcas de energía y ataque, con "puntos". Usa "none" solo si la marca es de blanco absoluto.
- textureIntensity: ${TEXTURE_INTENSITIES.map((t) => `"${t.value}"`).join(" | ")}. Sobrias y premium en "sutil"; marcas de ataque pueden ir a "marcado".
- textureColor: "acento" (el color vivo), "secundario" (el otro color de la paleta) o "claro" (neutro). Si el acento ya está muy presente en la pieza, el neutro claro da más clase.
- align: "left" (editorial, lectura pausada) o "center" (impacto, redes).
- tilt: true solo si a la marca le encaja lo desenfadado (elementos girados, cintas); false para marcas serias.
- visualStyle, el estilo base del carrusel: "foto_personal" (portadas con la figura recortada), "bold_impacto" (fondo oscuro), "bold_contraste" (bloque de color), "editorial_claro" (fondo claro tipo revista).
- reelTemplates: EXACTAMENTE entre 4 y 5 de estas, ordenadas de más a menos propia de la marca: ${REEL_TEMPLATES.map((t) => `"${t.value}" (${t.vibe}: ${t.hint})`).join(", ")}. Mezcla registros igual que en coverLayouts: marcas sobrias con las elegantes/editoriales/corporativas, marcas de ataque con las de impacto. Si tilt es false, no incluyas "circulo" ni "cintas".
- coverLayouts: EXACTAMENTE entre 4 y 6 composiciones de portada de carrusel, de más a menos propia de la marca: ${COVER_LAYOUTS.map((l) => `"${l.value}" (${l.vibe}: ${l.hint})`).join(", ")}. Mezcla registros: para marcas sobrias prioriza las elegantes, editoriales o corporativas; para marcas de ataque, las de impacto.
- notes: una frase explicando la decisión, en español.

Decide por el sector, el tono de voz y el cliente ideal: un asesor tributario no debe verse como un infoproductor de anuncios. Evita el default ruidoso si la marca es sobria.`;
