import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEmphasis, stripEmphasis } from "./emphasis";
import { BrandDesign, COVER_LAYOUTS, DEFAULT_DESIGN, FONT_PAIRS, type CoverLayout, type VisualStyle } from "./brandDesign";
import { BOX_PAD, fitLines, LINE_HEIGHT, metricsFor, tokens } from "./typeset";
import { textureDataUri } from "./texture";

export { COVER_LAYOUTS, VISUAL_STYLES } from "./brandDesign";
export type { CoverLayout, VisualStyle } from "./brandDesign";

type FontDef = { name: string; data: Buffer; weight: 400 | 500 | 700 | 800 | 900; style: "normal" };
const fontCache = new Map<string, FontDef[]>();

/** Solo las fuentes de la pareja elegida por la marca: cada una que se pasa, Satori la parsea. */
export function fonts(design: BrandDesign): FontDef[] {
  const cached = fontCache.get(design.fontPair);
  if (cached) return cached;
  const f = (file: string) => readFileSync(join(process.cwd(), "assets/fonts", file));
  const pair = FONT_PAIRS[design.fontPair] || FONT_PAIRS[DEFAULT_DESIGN.fontPair];
  const defs: FontDef[] = [
    { name: pair.display.family, data: f(pair.display.file), weight: 400, style: "normal" },
    ...pair.body.files.map((b) => ({ name: pair.body.family, data: f(b.file), weight: b.weight, style: "normal" as const })),
  ];
  fontCache.set(design.fontPair, defs);
  return defs;
}

/** Perillas de marca resueltas, listas para el render. */
export function designOf(style: BrandStyle): BrandDesign {
  return style.design || DEFAULT_DESIGN;
}

export function pairOf(style: BrandStyle) {
  const d = designOf(style);
  return FONT_PAIRS[d.fontPair] || FONT_PAIRS[DEFAULT_DESIGN.fontPair];
}

/** Mayúsculas o frase normal, según el ADN de la marca. */
function cased(text: string, style: BrandStyle): string {
  return designOf(style).textCase === "upper" ? text.toUpperCase() : text;
}

function radius(style: BrandStyle, soft: number): number {
  return designOf(style).shape === "sharp" ? 0 : soft;
}

/** Grafismo de fondo (partículas, malla, granulado) según el ADN de la marca. */
function Texture({ style, theme, w = W, h = H }: { style: BrandStyle; theme: Theme; w?: number; h?: number }) {
  const uri = textureDataUri(designOf(style).texture, theme.accent, w, h, hashString(style.brandName));
  if (!uri) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={uri} width={w} height={h} style={{ position: "absolute", left: 0, top: 0, width: w, height: h, display: "flex" }} />
  );
}

/** Fondo base del lienzo según el ADN: plano, halo tras la figura o degradado. */
function canvasBg(style: BrandStyle, theme: Theme, at = "50% 62%"): string {
  const d = designOf(style);
  if (d.background === "flat") return theme.dark;
  if (d.background === "degradado") return `linear-gradient(160deg, ${mix(theme.dark, theme.accent, 0.35)} 0%, ${theme.dark} 55%)`;
  return `radial-gradient(circle at ${at}, ${mix(theme.dark, theme.accent, 0.26)} 0%, ${theme.dark} 60%)`;
}

export { parseEmphasis, stripEmphasis };

export type Slide = { titulo: string; cuerpo: string; layout?: CoverLayout; foto?: string };

export type Cutout = { src: string; w: number; h: number };
export type BrandPhoto = { src: string; cutout?: Cutout | null };

export type BrandStyle = {
  brandName: string;
  brandHandle: string;
  primary: string;
  secondary: string;
  extra?: string[]; // colores adicionales de la paleta, en orden de preferencia
  coverPhoto?: BrandPhoto | null; // foto elegida para la portada de este carrusel (con recorte si existe)
  backgroundPhoto?: BrandPhoto | null; // imagen de fondo de marca (textura, espacio) para las composiciones
  avatar?: string | null; // foto para el avatar de los slides interiores
  visualStyle: VisualStyle;
  design?: BrandDesign; // esquema visual de la marca (tipografía, resaltados, formas)
  logo?: string | null; // data URI, opcional
};

const W = 1080;
const H = 1350;

/**
 * Las portadas son privadas de cada cliente y cambian al tocar el esquema o las
 * fotos: no deben quedarse cacheadas (@vercel/og las marca inmutables por un año).
 */
export const PRIVATE_IMAGE_HEADERS = { "Cache-Control": "private, no-store, max-age=0, must-revalidate" };

export function hashString(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ————— Color —————

const HEX_RE = /^#[0-9a-f]{6}$/i;

function rgb(hex: string): [number, number, number] {
  const c = HEX_RE.test(hex) ? hex.slice(1) : "000000";
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
}

/** Luminancia relativa WCAG. */
function relLum(hex: string): number {
  const lin = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function saturation(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return (max - min) / (l > 0.5 ? 2 - max - min : max + min);
}

function hue(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export function mix(hex: string, target: string, amount: number): string {
  const a = rgb(hex);
  const b = rgb(target);
  return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as [number, number, number]);
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Blanco o negro, el que más contraste tenga sobre el color dado. */
export function contrastText(hex: string): string {
  return contrast(hex, "#ffffff") >= contrast(hex, "#0a0a0a") ? "#ffffff" : "#0a0a0a";
}

/** Paleta completa de marca: primario, secundario y extras válidos, sin duplicados. */
function getPalette(style: BrandStyle): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of [style.primary, style.secondary, ...(style.extra || [])]) {
    const v = (c || "").toLowerCase();
    if (HEX_RE.test(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out.length ? out : ["#e8590c"];
}

export type Theme = { dark: string; light: string; accent: string; accent2: string; vivid: string[] };

/**
 * Interpreta la paleta por su función, no por su orden: el primario de una
 * marca puede ser casi negro, y usarlo como acento sobre fondo negro lo vuelve
 * invisible. Oscuro/claro salen de la luminancia; los acentos, de los colores
 * saturados que contrastan con el fondo oscuro.
 */
export function resolveTheme(style: BrandStyle): Theme {
  const palette = getPalette(style);
  const byLum = [...palette].sort((a, b) => relLum(a) - relLum(b));
  const dark = relLum(byLum[0]) < 0.03 ? byLum[0] : "#0b0b0f";
  const lightest = byLum[byLum.length - 1];
  const light = relLum(lightest) > 0.72 ? lightest : "#f6f4ef";
  const vivid = palette
    .filter((c) => c !== dark && c !== light && saturation(c) >= 0.3 && contrast(c, dark) >= 3)
    .sort((a, b) => saturation(b) * Math.min(contrast(b, dark), 8) - saturation(a) * Math.min(contrast(a, dark), 8));
  const accent = vivid[0] || "#ff5a1f";
  const accent2 = vivid.find((c) => c !== accent && Math.abs(hue(c) - hue(accent)) > 40) || light;
  return { dark, light, accent, accent2, vivid: vivid.length ? vivid : [accent] };
}

/** Elige un elemento de forma determinística según una semilla (para variar sin ser aleatorio). */
function pickFrom<T>(list: T[], seed: string | number, offset = 0): T {
  const base = typeof seed === "number" ? seed : hashString(seed);
  return list[(((base + offset) % list.length) + list.length) % list.length];
}

// ————— Piezas comunes —————

function BrandMark({ style, color, size = 18 }: { style: BrandStyle; color: string; size?: number }) {
  if (style.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={style.logo}
        width={size * 1.7}
        height={size * 1.7}
        style={{ borderRadius: 7, objectFit: "cover", display: "flex" }}
      />
    );
  }
  return <div style={{ width: size, height: size, borderRadius: size / 2, background: color, display: "flex" }} />;
}

type Word = { text: string; strong: boolean };

function toWords(segments: { text: string; strong: boolean }[]): Word[] {
  const words: Word[] = [];
  for (const seg of segments) {
    for (const w of seg.text.split(/\s+/).filter(Boolean)) {
      const prev = words[words.length - 1];
      // Puntuación suelta tras la frase clave ("**Meta Ads**, haz") va pegada a la palabra anterior.
      if (prev && /^[,.;:!?)»”]+$/.test(w)) prev.text += w;
      else words.push({ text: w, strong: seg.strong });
    }
  }
  return words;
}

/** Une palabras resaltadas consecutivas en un solo bloque (una caja para "META ADS", no dos). */
function toChunks(words: Word[]): Word[] {
  const chunks: Word[] = [];
  for (const w of words) {
    const prev = chunks[chunks.length - 1];
    if (prev && prev.strong && w.strong) prev.text += " " + w.text;
    else chunks.push({ ...w });
  }
  return chunks;
}

/** Titular con la frase clave coloreada (sin los ** del marcado). */
function EmphasisText({
  text,
  size,
  color,
  strongColor,
  weight = 800,
  lineHeight = 1.1,
  upper = false,
  family,
}: {
  text: string;
  size: number;
  color: string;
  strongColor: string;
  weight?: number;
  lineHeight?: number;
  upper?: boolean;
  family?: string;
}) {
  const words = toWords(parseEmphasis(upper ? text.toUpperCase() : text));
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        columnGap: size * (family ? 0.2 : 0.26),
        fontSize: size,
        fontWeight: family ? 400 : weight,
        lineHeight,
        ...(family ? { fontFamily: family } : {}),
      }}
    >
      {words.map((w, i) => (
        <div key={i} style={{ display: "flex", color: w.strong ? strongColor : color }}>
          {w.text}
        </div>
      ))}
    </div>
  );
}

/** Tamaño de titular según su largo: los cortos se agrandan, los largos no desbordan. */
function titleSize(text: string, base: number, min: number, max: number): number {
  const len = Math.max(stripEmphasis(text).length, 10);
  return Math.round(clamp(base * Math.sqrt(30 / len), min, max));
}

type CoverVariant = "banda" | "insignia" | "subrayado" | "cita";

/** Elige un tratamiento de portada distinto según el contenido, para que los carruseles no se vean repetitivos. */
function pickCoverVariant(titulo: string): CoverVariant {
  const variants: CoverVariant[] = ["banda", "insignia", "subrayado", "cita"];
  const variant = variants[hashString(titulo) % variants.length];
  const tieneNumeroInicial = /^\*{0,2}\d+/.test(titulo.trim());
  return variant === "insignia" && !tieneNumeroInicial ? "banda" : variant;
}

function renderTitleBanda(words: Word[], accent: string, size: number, style: BrandStyle, color = "#ffffff") {
  const emphasis = designOf(style).emphasis;
  const family = pairOf(style).display.family;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", rowGap: 14, columnGap: size * 0.2 }}>
      {toChunks(words).map((w, i) => {
        const boxed = w.strong && emphasis === "box";
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              fontFamily: family,
              fontSize: size,
              lineHeight: 1.05,
              color: boxed ? contrastText(accent) : w.strong ? accent : color,
              background: boxed ? accent : "transparent",
              padding: boxed ? `4px ${Math.round(size * 0.14)}px 0` : "4px 0",
              borderRadius: boxed ? radius(style, Math.round(size * 0.08)) : 0,
            }}
          >
            {w.text}
            {w.strong && emphasis === "underline" ? (
              <div style={{ display: "flex", width: "100%", height: Math.max(6, size * 0.09), marginTop: size * 0.04, background: accent }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function renderTitleInsignia(titulo: string, accent: string, size: number) {
  const match = titulo.match(/^(\*{0,2})(\d+)\1\s*/) || titulo.match(/^(\d+)\s*/);
  const numero = match ? match[match.length - 1] : "";
  const resto = titulo.slice(match ? match[0].length : 0);
  const words = toWords(parseEmphasis(resto));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
      <div
        style={{
          display: "flex",
          width: 150,
          height: 150,
          minWidth: 150,
          borderRadius: 75,
          background: accent,
          color: contrastText(accent),
          fontSize: 74,
          fontWeight: 900,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {numero}
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          minWidth: 0,
          flexWrap: "wrap",
          gap: 10,
          fontSize: size,
          fontWeight: 900,
          lineHeight: 1.08,
        }}
      >
        {words.map((w, i) => (
          <div key={i} style={{ display: "flex", color: w.strong ? accent : "#ffffff" }}>
            {w.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderTitleSubrayado(words: Word[], accent: string, size: number) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", rowGap: 18, columnGap: 14 }}>
      {words.map((w, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ display: "flex", fontSize: size, fontWeight: 900, lineHeight: 1.05, color: "#ffffff" }}>
            {w.text}
          </div>
          {w.strong && (
            <div
              style={{
                display: "flex",
                width: Math.round(w.text.length * size * 0.62),
                height: 10,
                background: accent,
                borderRadius: 6,
                marginTop: 6,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function renderTitleCita(words: Word[], accent: string, size: number) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", fontSize: 160, fontWeight: 900, lineHeight: 0.5, color: accent }}>
        {"“"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: size, fontWeight: 900, lineHeight: 1.08 }}>
        {words.map((w, i) => (
          <div key={i} style={{ display: "flex", color: w.strong ? accent : "#ffffff" }}>
            {w.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderCoverTitle(titulo: string, variant: CoverVariant, accent: string, size: number, style: BrandStyle) {
  const text = cased(titulo, style);
  const words = toWords(parseEmphasis(text));
  if (variant === "insignia") return renderTitleInsignia(text, accent, size);
  if (variant === "subrayado") return renderTitleSubrayado(words, accent, size);
  if (variant === "cita") return renderTitleCita(words, accent, size);
  return renderTitleBanda(words, accent, size, style);
}

// ————— Estilos de carrusel —————

function renderEditorialClaro(slide: Slide, index: number, total: number, style: BrandStyle) {
  const theme = resolveTheme(style);
  const isCover = index === 0;
  const isLast = index === total - 1;
  const accent = isCover ? theme.accent : pickFrom(theme.vivid, slide.titulo || index, index);
  const ink = theme.dark;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: theme.light, color: ink, fontFamily: "Inter" }}>
      <div style={{ display: "flex", height: 16, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 700, color: ink }}>
            <BrandMark style={style} color={theme.accent} />
            {style.brandName}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 800,
              color: contrastText(accent),
              background: accent,
              borderRadius: 999,
              padding: "6px 18px",
            }}
          >
            {index + 1}/{total}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ display: "flex", width: 110, height: 10, borderRadius: 5, background: accent }} />
          <EmphasisText
            text={slide.titulo}
            size={titleSize(slide.titulo, isCover ? 84 : 62, 48, isCover ? 104 : 72)}
            color={ink}
            strongColor={mix(accent, ink, contrast(accent, theme.light) < 3 ? 0.35 : 0)}
            weight={800}
            lineHeight={1.1}
          />
          {slide.cuerpo ? (
            <div style={{ display: "flex", fontSize: 36, lineHeight: 1.48, color: alpha(ink, 0.72) }}>{slide.cuerpo}</div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `2px solid ${alpha(ink, 0.14)}`,
            paddingTop: 32,
          }}
        >
          <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: ink }}>{style.brandHandle}</div>
          <div style={{ display: "flex", fontSize: 26, color: alpha(ink, 0.55) }}>
            {isLast ? "Guarda este post »" : "Desliza »"}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderBoldContraste(slide: Slide, index: number, total: number, style: BrandStyle) {
  const theme = resolveTheme(style);
  const isCover = index === 0;
  const isLast = index === total - 1;
  const bgFrom = isCover ? theme.accent : pickFrom(theme.vivid, slide.titulo || index, index);
  const bgTo = mix(bgFrom, theme.dark, 0.45);
  const text = contrast("#ffffff", bgFrom) >= 2.6 ? "#ffffff" : theme.dark;
  const isDark = text === "#ffffff";
  const strong = isDark ? theme.dark : "#ffffff";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: `linear-gradient(155deg, ${bgFrom} 0%, ${bgFrom} 45%, ${bgTo} 100%)`,
        color: text,
        fontFamily: pairOf(style).body.family,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 28,
            fontWeight: 800,
            color: "#ffffff",
            background: alpha(theme.dark, 0.85),
            borderRadius: 999,
            padding: "8px 18px 8px 12px",
          }}
        >
          <BrandMark style={style} color={bgFrom} />
          {style.brandName}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 800,
            color: "#ffffff",
            background: alpha(theme.dark, 0.85),
            borderRadius: 999,
            padding: "6px 16px",
          }}
        >
          {index + 1}/{total}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <EmphasisText
          text={slide.titulo}
          size={titleSize(slide.titulo, isCover ? 104 : 70, 54, isCover ? 124 : 84)}
          color={text}
          strongColor={strong}
          weight={900}
          lineHeight={1.02}
        />
        {slide.cuerpo ? (
          <div
            style={{
              display: "flex",
              fontSize: 36,
              lineHeight: 1.42,
              color: "#ffffff",
              background: alpha(theme.dark, 0.78),
              borderRadius: 18,
              padding: "26px 30px",
            }}
          >
            {slide.cuerpo}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `3px solid ${alpha(text, 0.35)}`,
          paddingTop: 32,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: text }}>{style.brandHandle}</div>
        <div style={{ display: "flex", fontSize: 28, color: alpha(text, 0.8) }}>
          {isLast ? "Guarda este post »" : "Desliza »"}
        </div>
      </div>
    </div>
  );
}

function renderBoldImpacto(slide: Slide, index: number, total: number, style: BrandStyle, avatar?: string) {
  const theme = resolveTheme(style);
  const isCover = index === 0;
  const isLast = index === total - 1;
  // La portada usa el acento principal; el resto rota por los colores vivos de la paleta.
  const accent = isCover ? theme.accent : pickFrom(theme.vivid, slide.titulo || index, index);
  const variant = isCover ? pickCoverVariant(slide.titulo) : "banda";
  const size = isCover ? titleSize(slide.titulo, 76, 58, 92) : titleSize(slide.titulo, 54, 42, 64);
  const words = toWords(parseEmphasis(cased(slide.titulo, style)));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: canvasBg(style, theme),
        color: "#ffffff",
        fontFamily: pairOf(style).body.family,
        position: "relative",
      }}
    >
      <Texture style={style} theme={theme} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 800, color: "#ffffff" }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              width={64}
              height={64}
              style={{ width: 64, height: 64, borderRadius: 32, objectFit: "cover", border: `3px solid ${accent}`, display: "flex" }}
            />
          ) : (
            <BrandMark style={style} color={theme.accent} />
          )}
          {style.brandName}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 800,
            color: contrastText(accent),
            background: accent,
            borderRadius: 999,
            padding: "6px 16px",
          }}
        >
          {index + 1}/{total}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {isCover ? renderCoverTitle(slide.titulo, variant, accent, size, style) : renderTitleBanda(words, accent, size, style)}
        {slide.cuerpo ? (
          <div style={{ display: "flex", fontSize: 36, lineHeight: 1.45, color: "rgba(255,255,255,0.78)" }}>
            {slide.cuerpo}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "3px solid rgba(255,255,255,0.15)",
          paddingTop: 32,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: theme.accent }}>{style.brandHandle}</div>
        <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.6)" }}>
          {isLast ? "Guarda este post »" : "Desliza »"}
        </div>
      </div>
    </div>
  );
}

// ————— Portadas compuestas con tu figura recortada —————

type Figure = { photo: BrandPhoto; cutout: Cutout };

export function figureBox(c: Cutout, maxH: number, maxW: number): { w: number; h: number } {
  let h = maxH;
  let w = Math.round((h * c.w) / c.h);
  if (w > maxW) {
    w = maxW;
    h = Math.round((w * c.h) / c.w);
  }
  return { w, h };
}

function FigureImg({ cutout, left, box }: { cutout: Cutout; left: number; box: { w: number; h: number } }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cutout.src}
      width={box.w}
      height={box.h}
      style={{ position: "absolute", left, top: H - box.h, width: box.w, height: box.h, display: "flex" }}
    />
  );
}

function leadingNumber(titulo: string): { numero: string; resto: string } | null {
  const m = titulo.trim().match(/^\*{0,2}(\d{1,2})\*{0,2}\s+(.+)$/);
  return m ? { numero: m[1], resto: m[2] } : null;
}

function keywordOf(titulo: string): string {
  const strong = parseEmphasis(titulo)
    .filter((s) => s.strong)
    .map((s) => s.text.trim())
    .join(" ");
  if (strong) return strong;
  return stripEmphasis(titulo)
    .split(/\s+/)
    .reduce((a, b) => (b.length > a.length ? b : a), "");
}

/**
 * Composición de la portada. Si viene elegida (a mano o por la IA) se respeta
 * siempre; solo se cambia cuando es imposible de dibujar (un número gigante sin
 * número en el título). El resto son sugerencias por el contenido.
 */
function resolveCoverLayout(slide: Slide, allowed: CoverLayout[]): CoverLayout {
  const chosen = COVER_LAYOUTS.some((l) => l.value === slide.layout) ? slide.layout! : null;
  if (chosen) return chosen === "numero" && !leadingNumber(slide.titulo) ? "texto_detras" : chosen;
  const num = leadingNumber(slide.titulo);
  const kw = keywordOf(slide.titulo);
  const pool = allowed.length ? allowed : COVER_LAYOUTS.map((l) => l.value);
  if (num && pool.includes("numero")) return "numero";
  if (kw.length <= 14 && pool.includes("texto_detras") && hashString(slide.titulo) % 2) return "texto_detras";
  return pool[hashString(slide.titulo) % pool.length];
}

function CoverFooter({ style, theme, total }: { style: BrandStyle; theme: Theme; total: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        top: H - 110,
        width: W - 144,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30, fontWeight: 800, color: "#ffffff" }}>
        <BrandMark style={style} color={theme.accent} />
        {style.brandHandle}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 26,
          fontWeight: 800,
          color: contrastText(theme.accent),
          background: theme.accent,
          borderRadius: 999,
          padding: "8px 20px",
        }}
      >
        {total > 1 ? "Desliza »" : "Guarda este post »"}
      </div>
    </div>
  );
}

type CoverArgs = { slide: Slide; total: number; style: BrandStyle; theme: Theme; photo: BrandPhoto | null };

function Abs({ x = 0, y = 0, w = W, h, style, children }: {
  x?: number;
  y?: number;
  w?: number;
  h: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return <div style={{ position: "absolute", left: x, top: y, width: w, height: h, display: "flex", ...style }}>{children}</div>;
}

/** Fondo de la portada: imagen de fondo de la marca con velo, o color/degradado del ADN. */
function CoverBg({ style, theme, tone }: { style: BrandStyle; theme: Theme; tone: "dark" | "light" }) {
  const base = tone === "light" ? theme.light : canvasBg(style, theme);
  const bg = style.backgroundPhoto;
  return (
    <>
      <Abs h={H} style={{ background: base }} />
      <Texture style={style} theme={theme} />
      {bg ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bg.src}
            width={W}
            height={H}
            style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover", display: "flex" }}
          />
          <Abs h={H} style={{ background: alpha(tone === "light" ? theme.light : theme.dark, tone === "light" ? 0.82 : 0.78) }} />
          <Texture style={style} theme={theme} />
        </>
      ) : null}
    </>
  );
}

/** Titular ajustado a una zona, con el resaltado que use la marca. */
function FitTitle({
  text,
  style,
  theme,
  zone,
  maxSize,
  color,
  align = "flex-start",
  maxLines = 4,
  strongColor,
  strongBg,
}: {
  text: string;
  style: BrandStyle;
  theme: Theme;
  zone: { w: number; h: number };
  maxSize: number;
  color: string;
  align?: "flex-start" | "center";
  maxLines?: number;
  strongColor?: string;
  strongBg?: string;
}) {
  // Sobre un fondo del color de acento, el resaltado no puede ser ese mismo color.
  const hiBg = strongBg || theme.accent;
  const hiColor = strongColor || theme.accent;
  const d = designOf(style);
  const family = pairOf(style).display.family;
  const m = metricsFor(family);
  const lines = fitLines(tokens(text, d.textCase === "upper"), zone, {
    m,
    maxSize,
    boxed: d.emphasis === "box",
    maxLines,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: Math.round(Math.min(...lines.map((l) => l.size)) * 0.1) }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            columnGap: Math.round(l.size * m.space),
            fontFamily: family,
            fontSize: l.size,
            lineHeight: LINE_HEIGHT,
          }}
        >
          {l.chunks.map((c, j) => {
            const boxed = c.strong && d.emphasis === "box";
            return (
              <div
                key={j}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  color: boxed ? contrastText(hiBg) : c.strong ? hiColor : color,
                  background: boxed ? hiBg : "transparent",
                  padding: boxed ? `${Math.round(l.size * 0.05)}px ${Math.round(l.size * BOX_PAD)}px 0` : 0,
                  borderRadius: boxed ? radius(style, Math.round(l.size * 0.06)) : 0,
                }}
              >
                {c.text}
                {c.strong && d.emphasis === "underline" ? (
                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      height: Math.max(5, Math.round(l.size * 0.08)),
                      marginTop: Math.round(l.size * 0.04),
                      background: hiColor,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Rule({ color, width = 2 }: { color: string; width?: number }) {
  return <div style={{ display: "flex", width: "100%", height: width, background: color }} />;
}

function Kicker({ text, color, size = 24 }: { text: string; color: string; size?: number }) {
  return (
    <div style={{ display: "flex", fontSize: size, fontWeight: 800, letterSpacing: size * 0.18, color }}>
      {text.toUpperCase()}
    </div>
  );
}

function coverTextoDetras(slide: Slide, total: number, style: BrandStyle, theme: Theme, fig: Figure) {
  const keyword = cased(keywordOf(slide.titulo), style);
  // Ancho medido con la tipografía real de la marca: una palabra larga baja de
  // tamaño en vez de salirse del lienzo.
  const kwMetrics = metricsFor(pairOf(style).display.family);
  const kwSize = Math.floor(clamp((W - 80) / Math.max(kwMetrics.width(keyword), 1), 120, 400));
  const box = figureBox(fig.cutout, 1040, 980);
  const size = titleSize(slide.titulo, 88, 66, 104);
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: pairOf(style).body.family,
        background: canvasBg(style, theme, "50% 55%"),
      }}
    >
      <Texture style={style} theme={theme} />
      <div style={{ position: "absolute", top: 64, left: 72, display: "flex", fontSize: 28, fontWeight: 800, color: alpha("#ffffff", 0.85) }}>
        {style.brandName}
      </div>
      <div style={{ position: "absolute", top: 150, left: 0, width: W, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", fontFamily: pairOf(style).display.family, fontSize: kwSize, lineHeight: 1, color: theme.accent }}>
          {keyword}
        </div>
      </div>
      <FigureImg cutout={fig.cutout} left={Math.round((W - box.w) / 2)} box={box} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: H - 620,
          width: W,
          height: 620,
          display: "flex",
          background: `linear-gradient(180deg, ${alpha(theme.dark, 0)} 0%, ${alpha(theme.dark, 0.88)} 45%, ${theme.dark} 100%)`,
        }}
      />
      <div style={{ position: "absolute", left: 72, top: H - 400, width: W - 144, height: 270, display: "flex", alignItems: "flex-end" }}>
        <EmphasisText text={cased(slide.titulo, style)} size={size} color="#ffffff" strongColor={theme.accent} lineHeight={1.02} family={pairOf(style).display.family} />
      </div>
      <CoverFooter style={style} theme={theme} total={total} />
    </div>
  );
}

function coverSplit(slide: Slide, total: number, style: BrandStyle, theme: Theme, fig: Figure) {
  const panelW = 600;
  const box = figureBox(fig.cutout, 1180, 760);
  const left = Math.max(panelW - 60, Math.round(840 - box.w / 2));
  const onAccent = contrastText(theme.accent);
  const words = toWords(parseEmphasis(cased(slide.titulo, style)));
  const size = titleSize(slide.titulo, 96, 70, 118);
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: pairOf(style).body.family,
        background: canvasBg(style, theme, "78% 45%"),
      }}
    >
      <Texture style={style} theme={theme} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: panelW,
          height: H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 64px",
          background: theme.accent,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, fontWeight: 800, color: onAccent }}>
          <BrandMark style={style} color={theme.dark} />
          {style.brandName}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", rowGap: 12, columnGap: 14 }}>
          {toChunks(words).map((w, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                fontFamily: pairOf(style).display.family,
                fontSize: size,
                lineHeight: 1.04,
                flexDirection: "column",
                alignItems: "flex-start",
                color: w.strong
                  ? designOf(style).emphasis === "box"
                    ? theme.accent
                    : theme.dark
                  : onAccent,
                background: w.strong && designOf(style).emphasis === "box" ? theme.dark : "transparent",
                padding: w.strong && designOf(style).emphasis === "box" ? `2px ${Math.round(size * 0.12)}px` : "2px 0",
                borderRadius: radius(style, 8),
              }}
            >
              {w.text}
              {w.strong && designOf(style).emphasis === "underline" ? (
                <div style={{ display: "flex", width: "100%", height: Math.max(5, size * 0.08), marginTop: size * 0.04, background: theme.dark }} />
              ) : null}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: onAccent }}>{style.brandHandle}</div>
      </div>
      <FigureImg cutout={fig.cutout} left={left} box={box} />
      <div
        style={{
          position: "absolute",
          left: W - 280,
          top: H - 120,
          display: "flex",
          fontSize: 26,
          fontWeight: 800,
          color: "#ffffff",
          background: alpha(theme.dark, 0.8),
          borderRadius: 999,
          padding: "8px 20px",
        }}
      >
        {total > 1 ? "Desliza »" : "Guarda este post »"}
      </div>
    </div>
  );
}

function coverNumero(slide: Slide, total: number, style: BrandStyle, theme: Theme, fig: Figure) {
  const num = leadingNumber(slide.titulo)!;
  const numSize = num.numero.length === 1 ? 1100 : 900;
  const box = figureBox(fig.cutout, 1080, 720);
  const size = titleSize(num.resto, 92, 68, 110);
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: pairOf(style).body.family,
        background: canvasBg(style, theme, "50% 45%"),
      }}
    >
      <Texture style={style} theme={theme} />
      <div
        style={{
          position: "absolute",
          left: 10,
          top: -90,
          display: "flex",
          fontFamily: pairOf(style).display.family,
          fontSize: numSize,
          lineHeight: 1,
          color: theme.accent,
        }}
      >
        {num.numero}
      </div>
      <div
        style={{
          position: "absolute",
          top: 64,
          left: W - 72 - 460,
          width: 460,
          display: "flex",
          justifyContent: "flex-end",
          fontSize: 28,
          fontWeight: 800,
          color: alpha("#ffffff", 0.85),
        }}
      >
        {style.brandName}
      </div>
      <FigureImg cutout={fig.cutout} left={W - box.w + 30} box={box} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: H - 560,
          width: W,
          height: 560,
          display: "flex",
          background: `linear-gradient(180deg, ${alpha(theme.dark, 0)} 0%, ${alpha(theme.dark, 0.9)} 50%, ${theme.dark} 100%)`,
        }}
      />
      <div style={{ position: "absolute", left: 72, top: H - 400, width: W - 144, height: 270, display: "flex", alignItems: "flex-end" }}>
        <EmphasisText text={cased(num.resto, style)} size={size} color="#ffffff" strongColor={theme.accent} lineHeight={1.02} family={pairOf(style).display.family} />
      </div>
      <CoverFooter style={style} theme={theme} total={total} />
    </div>
  );
}

/** Portada con foto completa de fondo, para fotos que aún no tienen recorte. */
function coverFotoFondo(slide: Slide, total: number, style: BrandStyle, theme: Theme, photo: BrandPhoto) {
  const size = titleSize(slide.titulo, 72, 54, 88);
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", fontFamily: pairOf(style).body.family, background: theme.dark }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        width={W}
        height={H}
        style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover", display: "flex" }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          display: "flex",
          background: `linear-gradient(180deg, ${alpha(theme.dark, 0.2)} 0%, ${alpha(theme.dark, 0.05)} 30%, ${alpha(theme.dark, 0.75)} 65%, ${theme.dark} 100%)`,
        }}
      />
      <div style={{ position: "absolute", top: 64, left: 72, display: "flex", fontSize: 28, fontWeight: 800, color: "#ffffff" }}>
        {style.brandName}
      </div>
      <div style={{ position: "absolute", left: 72, top: H - 520, width: W - 144, height: 390, display: "flex", alignItems: "flex-end" }}>
        {renderTitleBanda(toWords(parseEmphasis(cased(slide.titulo, style))), theme.accent, size, style)}
      </div>
      <CoverFooter style={style} theme={theme} total={total} />
    </div>
  );
}

// ————— Composiciones editoriales, corporativas y tipográficas —————

/** Foto a un lado, titular al otro con filetes y firma: portada de revista. */
function coverEditorialLateral({ slide, total, style, theme, photo }: CoverArgs) {
  const panelW = 520;
  const ink = theme.dark;
  const col = { x: panelW + 70, w: W - panelW - 70 - 72 };
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: pairOf(style).body.family, background: theme.light }}>
      <Abs w={panelW} h={H} style={{ background: mix(theme.dark, theme.accent, 0.15) }} />
      {photo?.cutout ? (
        <FigureImg cutout={photo.cutout} left={0} box={figureBox(photo.cutout, H - 120, panelW + 60)} />
      ) : photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.src} width={panelW} height={H} style={{ position: "absolute", left: 0, top: 0, width: panelW, height: H, objectFit: "cover", display: "flex" }} />
      ) : null}

      <Abs x={col.x} y={150} w={col.w} h={H - 300} style={{ flexDirection: "column", justifyContent: "center", gap: 26 }}>
        <Kicker text={style.brandName} color={theme.accent} />
        <Rule color={alpha(ink, 0.25)} />
        <FitTitle text={slide.titulo} style={style} theme={theme} zone={{ w: col.w, h: 540 }} maxSize={96} color={ink} />
        <Rule color={alpha(ink, 0.25)} />
        <div style={{ display: "flex", fontSize: 26, color: alpha(ink, 0.6) }}>Por {style.brandHandle}</div>
      </Abs>
      <Abs x={col.x} y={H - 120} w={col.w} h={40} style={{ alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: theme.accent }}>{total > 1 ? "Desliza »" : "Guarda esto »"}</div>
      </Abs>
    </div>
  );
}

/** Foto enmarcada sobre fondo limpio y titular debajo. */
function coverMarco({ slide, total, style, theme, photo }: CoverArgs) {
  const ink = theme.dark;
  const frame = { x: 90, y: 130, w: W - 180, h: 700 };
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: pairOf(style).body.family, background: theme.light }}>
      <Abs x={frame.x - 14} y={frame.y - 14} w={frame.w + 28} h={frame.h + 28} style={{ border: `2px solid ${alpha(ink, 0.35)}`, borderRadius: radius(style, 8) }} />
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.src}
          width={frame.w}
          height={frame.h}
          style={{ position: "absolute", left: frame.x, top: frame.y, width: frame.w, height: frame.h, objectFit: "cover", borderRadius: radius(style, 4), display: "flex" }}
        />
      ) : (
        <Abs x={frame.x} y={frame.y} w={frame.w} h={frame.h} style={{ background: mix(theme.light, ink, 0.1) }} />
      )}
      <Abs x={90} y={frame.y + frame.h + 60} w={W - 180} h={300} style={{ flexDirection: "column", alignItems: "center", gap: 24 }}>
        <FitTitle text={slide.titulo} style={style} theme={theme} zone={{ w: W - 220, h: 230 }} maxSize={92} color={ink} align="center" maxLines={3} />
      </Abs>
      <Abs y={H - 110} h={40} style={{ justifyContent: "center", alignItems: "center", gap: 18 }}>
        <Kicker text={style.brandHandle} color={alpha(ink, 0.55)} size={22} />
      </Abs>
    </div>
  );
}

/** Foto arriba, franja de color abajo con el titular: orden corporativo. */
function coverBanda({ slide, total, style, theme, photo }: CoverArgs) {
  const bandY = 860;
  const onAccent = contrastText(theme.accent);
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: pairOf(style).body.family, background: theme.dark }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.src} width={W} height={bandY} style={{ position: "absolute", left: 0, top: 0, width: W, height: bandY, objectFit: "cover", display: "flex" }} />
      ) : (
        <Abs h={bandY} style={{ background: canvasBg(style, theme) }} />
      )}
      <Abs y={bandY} h={H - bandY} style={{ background: theme.accent, flexDirection: "column", justifyContent: "center", padding: "0 72px" }}>
        <FitTitle
          text={slide.titulo}
          style={style}
          theme={theme}
          zone={{ w: W - 144, h: 300 }}
          maxSize={88}
          color={onAccent}
          strongColor={theme.dark}
          strongBg={theme.dark}
          maxLines={3}
        />
      </Abs>
      <Abs x={72} y={H - 96} w={W - 144} h={40} style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: alpha(onAccent, 0.8) }}>{style.brandHandle}</div>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: alpha(onAccent, 0.8) }}>{total > 1 ? "Desliza »" : ""}</div>
      </Abs>
    </div>
  );
}

/** Foto a sangre y titular centrado abajo sobre degradado. */
function coverRetrato({ slide, total, style, theme, photo }: CoverArgs) {
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: pairOf(style).body.family, background: theme.dark }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.src} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover", display: "flex" }} />
      ) : (
        <CoverBg style={style} theme={theme} tone="dark" />
      )}
      <Abs h={H} style={{ background: `linear-gradient(180deg, ${alpha(theme.dark, 0.25)} 0%, ${alpha(theme.dark, 0)} 35%, ${alpha(theme.dark, 0.8)} 70%, ${theme.dark} 100%)` }} />
      <Abs x={72} y={820} w={W - 144} h={340} style={{ flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 20 }}>
        <FitTitle text={slide.titulo} style={style} theme={theme} zone={{ w: W - 160, h: 280 }} maxSize={110} color="#ffffff" align="center" maxLines={3} />
        {slide.cuerpo ? (
          <div style={{ display: "flex", fontSize: 32, color: alpha("#ffffff", 0.82), textAlign: "center" }}>{slide.cuerpo}</div>
        ) : null}
      </Abs>
      <Abs y={H - 120} h={44} style={{ justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 800,
            color: "#ffffff",
            background: alpha(theme.dark, 0.55),
            borderRadius: radius(style, 999) || 4,
            padding: "8px 20px",
          }}
        >
          {style.brandHandle}
        </div>
      </Abs>
    </div>
  );
}

/** Solo tipografía: el titular ocupa la portada. */
function coverTipografico({ slide, total, style, theme }: CoverArgs) {
  const d = designOf(style);
  const align = d.align === "center" ? "center" : "flex-start";
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: pairOf(style).body.family, background: theme.dark }}>
      <CoverBg style={style} theme={theme} tone="dark" />
      <Abs x={72} y={70} w={W - 144} h={40} style={{ alignItems: "center", justifyContent: "space-between" }}>
        <Kicker text={style.brandName} color={alpha("#ffffff", 0.7)} size={22} />
        <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: alpha("#ffffff", 0.5) }}>1/{total}</div>
      </Abs>
      <Abs x={72} y={230} w={W - 144} h={760} style={{ flexDirection: "column", justifyContent: "center", alignItems: align }}>
        <FitTitle text={slide.titulo} style={style} theme={theme} zone={{ w: W - 144, h: 720 }} maxSize={240} color="#ffffff" align={align} />
      </Abs>
      <Abs x={72} y={H - 190} w={W - 144} h={120} style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: alpha("#ffffff", 0.75) }}>{style.brandHandle}</div>
        <div
          style={{
            display: "flex",
            width: 120,
            height: 120,
            borderRadius: radius(style, 60) || 10,
            background: theme.accent,
            color: contrastText(theme.accent),
            fontSize: 22,
            fontWeight: 800,
            alignItems: "center",
            justifyContent: "center",
            ...(d.tilt ? { transform: "rotate(-8deg)" } : {}),
          }}
        >
          {total > 1 ? "desliza" : "guarda"}
        </div>
      </Abs>
    </div>
  );
}

/** Una sola frase centrada con mucho aire: minimalismo de alto estatus. */
function coverDeclaracion({ slide, style, theme }: CoverArgs) {
  const ink = theme.dark;
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: pairOf(style).body.family, background: theme.light }}>
      <CoverBg style={style} theme={theme} tone="light" />
      <Abs y={300} h={40} style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", width: 90, height: 4, background: theme.accent }} />
      </Abs>
      <Abs x={140} y={400} w={W - 280} h={520} style={{ flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <FitTitle text={slide.titulo} style={style} theme={theme} zone={{ w: W - 300, h: 480 }} maxSize={120} color={ink} align="center" maxLines={4} />
      </Abs>
      <Abs y={H - 220} h={40} style={{ justifyContent: "center", alignItems: "center" }}>
        <Kicker text={style.brandHandle} color={alpha(ink, 0.55)} size={22} />
      </Abs>
    </div>
  );
}

/** La frase como cita, con comillas grandes y firma. */
function coverCita({ slide, style, theme, photo }: CoverArgs) {
  const family = pairOf(style).display.family;
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: pairOf(style).body.family, background: theme.dark }}>
      <CoverBg style={style} theme={theme} tone="dark" />
      <Abs x={72} y={190} w={400} h={260}>
        <div style={{ display: "flex", fontFamily: family, fontSize: 300, lineHeight: 1, color: theme.accent }}>{"“"}</div>
      </Abs>
      <Abs x={72} y={430} w={W - 144} h={560} style={{ flexDirection: "column", justifyContent: "flex-start" }}>
        <FitTitle text={slide.titulo} style={style} theme={theme} zone={{ w: W - 144, h: 520 }} maxSize={110} color="#ffffff" maxLines={4} />
      </Abs>
      <Abs x={72} y={H - 220} w={W - 144} h={120} style={{ flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", width: 90, height: 4, background: theme.accent }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.src}
              width={72}
              height={72}
              style={{ width: 72, height: 72, borderRadius: radius(style, 36) || 6, objectFit: "cover", display: "flex" }}
            />
          ) : null}
          <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: alpha("#ffffff", 0.85) }}>{style.brandHandle}</div>
        </div>
      </Abs>
    </div>
  );
}

function renderFotoPersonal(slide: Slide, index: number, total: number, style: BrandStyle) {
  if (index !== 0) return renderBoldImpacto(slide, index, total, style, style.avatar || undefined);
  const theme = resolveTheme(style);
  const photo = style.coverPhoto || null;
  const layout = resolveCoverLayout(slide, designOf(style).coverLayouts);
  const args: CoverArgs = { slide, total, style, theme, photo };

  // Las composiciones con figura necesitan recorte; sin él se cae a una que
  // funcione con la foto tal cual.
  if (photo?.cutout) {
    const fig = { photo, cutout: photo.cutout };
    if (layout === "numero") return coverNumero(slide, total, style, theme, fig);
    if (layout === "texto_detras") return coverTextoDetras(slide, total, style, theme, fig);
    if (layout === "split") return coverSplit(slide, total, style, theme, fig);
  } else if (layout === "numero" || layout === "texto_detras" || layout === "split") {
    return photo ? coverFotoFondo(slide, total, style, theme, photo) : coverTipografico(args);
  }

  if (layout === "editorial_lateral") return coverEditorialLateral(args);
  if (layout === "marco") return coverMarco(args);
  if (layout === "banda") return coverBanda(args);
  if (layout === "retrato") return coverRetrato(args);
  if (layout === "declaracion") return coverDeclaracion(args);
  if (layout === "cita") return coverCita(args);
  return coverTipografico(args);
}

export function renderSlide(opts: { slide: Slide; index: number; total: number; style: BrandStyle }) {
  const { slide, index, total, style } = opts;
  const tree =
    style.visualStyle === "foto_personal"
      ? renderFotoPersonal(slide, index, total, style)
      : style.visualStyle === "editorial_claro"
        ? renderEditorialClaro(slide, index, total, style)
        : style.visualStyle === "bold_contraste"
          ? renderBoldContraste(slide, index, total, style)
          : renderBoldImpacto(slide, index, total, style);

  return new ImageResponse(tree, { width: W, height: H, fonts: fonts(designOf(style)), headers: PRIVATE_IMAGE_HEADERS });
}
