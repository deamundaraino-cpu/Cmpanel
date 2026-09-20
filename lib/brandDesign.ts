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

export type ReelTemplate = "centro" | "arriba" | "circulo" | "cintas" | "cita" | "split" | "detras";

export const REEL_TEMPLATES: { value: ReelTemplate; label: string; hint: string; needsCutout?: boolean; tilted?: boolean }[] = [
  { value: "centro", label: "Bloque central", hint: "Titular sobre el pecho, centrado." },
  { value: "arriba", label: "Titular arriba", hint: "Titular grande sobre la cabeza." },
  { value: "circulo", label: "Círculo", hint: "Palabra clave o número dentro de un círculo.", tilted: true },
  { value: "cintas", label: "Cintas", hint: "Cada línea como una etiqueta.", tilted: true },
  { value: "cita", label: "Cita", hint: "Comillas grandes y la frase a un lado." },
  { value: "split", label: "Bloque de color", hint: "Panel de color arriba y figura debajo.", needsCutout: true },
  { value: "detras", label: "Texto detrás", hint: "Palabra clave gigante detrás de la figura.", needsCutout: true },
];

export type BrandDesign = {
  fontPair: FontPairKey;
  textCase: "upper" | "sentence";
  emphasis: "box" | "color" | "underline";
  shape: "sharp" | "soft";
  background: "flat" | "halo" | "degradado";
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
  align: ["left", "center"] as const,
};

export const DESIGN_LABELS: Record<string, Record<string, string>> = {
  textCase: { upper: "MAYÚSCULAS", sentence: "Frase normal" },
  emphasis: { box: "Caja de color", color: "Solo color", underline: "Subrayado" },
  shape: { sharp: "Esquinas rectas", soft: "Esquinas redondeadas" },
  background: { flat: "Plano", halo: "Halo de color", degradado: "Degradado" },
  align: { left: "Izquierda", center: "Centrado" },
};

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
  return {
    fontPair: pick(d.fontPair, DESIGN_OPTIONS.fontPair, DEFAULT_DESIGN.fontPair),
    textCase: pick(d.textCase, DESIGN_OPTIONS.textCase, DEFAULT_DESIGN.textCase),
    emphasis: pick(d.emphasis, DESIGN_OPTIONS.emphasis, DEFAULT_DESIGN.emphasis),
    shape: pick(d.shape, DESIGN_OPTIONS.shape, DEFAULT_DESIGN.shape),
    background: pick(d.background, DESIGN_OPTIONS.background, DEFAULT_DESIGN.background),
    align: pick(d.align, DESIGN_OPTIONS.align, DEFAULT_DESIGN.align),
    tilt: typeof d.tilt === "boolean" ? d.tilt : DEFAULT_DESIGN.tilt,
    visualStyle: pick(d.visualStyle, VISUAL_STYLES.map((v) => v.value), DEFAULT_DESIGN.visualStyle),
    // Sin selección válida se mantienen todas: mejor variedad que una lista vacía.
    reelTemplates: templates.length >= 3 ? templates : DEFAULT_DESIGN.reelTemplates,
    coverLayouts: covers.length >= 2 ? covers : DEFAULT_DESIGN.coverLayouts,
    notes: typeof d.notes === "string" ? d.notes.slice(0, 300) : undefined,
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
{"fontPair": "...", "textCase": "...", "emphasis": "...", "shape": "...", "background": "...", "align": "...", "tilt": true, "visualStyle": "...", "reelTemplates": ["...", "..."], "coverLayouts": ["...", "..."], "notes": "..."}

- fontPair (pareja tipográfica): ${Object.entries(FONT_PAIRS)
  .map(([k, v]) => `"${k}" = ${v.vibe}`)
  .join(" | ")}
- textCase: "upper" (MAYÚSCULAS, urgencia y ruido) o "sentence" (Frase normal, cercanía y criterio).
- emphasis, cómo se destaca la frase clave: "box" (caja de color, máximo grito), "color" (solo el color del acento, sobrio), "underline" (subrayado, discreto y editorial).
- shape: "sharp" (esquinas rectas, técnico/serio) o "soft" (redondeadas, cercano).
- background: "flat" (color plano, austero), "halo" (halo de color tras la persona, dramático), "degradado" (degradado de marca, comercial).
- align: "left" (editorial, lectura pausada) o "center" (impacto, redes).
- tilt: true solo si a la marca le encaja lo desenfadado (elementos girados, cintas); false para marcas serias.
- visualStyle, el estilo base del carrusel: "foto_personal" (portadas con la figura recortada), "bold_impacto" (fondo oscuro), "bold_contraste" (bloque de color), "editorial_claro" (fondo claro tipo revista).
- reelTemplates: entre 4 y 7 de estas, ordenadas de más a menos propia de la marca: ${REEL_TEMPLATES.map((t) => `"${t.value}" (${t.hint})`).join(", ")}. Si tilt es false, no incluyas "circulo" ni "cintas" entre las primeras.
- coverLayouts: entre 3 y 6 composiciones de portada de carrusel, de más a menos propia de la marca: ${COVER_LAYOUTS.map((l) => `"${l.value}" (${l.vibe}: ${l.hint})`).join(", ")}. Mezcla registros: para marcas sobrias prioriza las elegantes, editoriales o corporativas; para marcas de ataque, las de impacto.
- notes: una frase explicando la decisión, en español.

Decide por el sector, el tono de voz y el cliente ideal: un asesor tributario no debe verse como un infoproductor de anuncios. Evita el default ruidoso si la marca es sobria.`;
