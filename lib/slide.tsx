import { ImageResponse } from "next/og";
import { parseEmphasis, stripEmphasis } from "./emphasis";

export { parseEmphasis, stripEmphasis };

export type Slide = { titulo: string; cuerpo: string };

export type VisualStyle = "minimal_oscuro" | "editorial_claro" | "bold_contraste" | "bold_impacto";

export type BrandStyle = {
  brandName: string;
  brandHandle: string;
  primary: string;
  secondary: string;
  extra?: string[]; // colores adicionales de la paleta, en orden de preferencia
  visualStyle: VisualStyle;
  logo?: string | null; // data URI, opcional
};

export const VISUAL_STYLES: { value: VisualStyle; label: string; hint: string }[] = [
  {
    value: "minimal_oscuro",
    label: "Minimal oscuro",
    hint: "Fondo oscuro, texto claro, tu color como acento. Discreto y profesional.",
  },
  {
    value: "editorial_claro",
    label: "Editorial claro",
    hint: "Fondo claro, texto oscuro, barra de color a modo de firma. Look de revista/blog.",
  },
  {
    value: "bold_contraste",
    label: "Bold contraste",
    hint: "Fondo a todo color con tu paleta, texto grande adaptado al contraste. Máximo impacto, ideal para hooks.",
  },
  {
    value: "bold_impacto",
    label: "Bold impacto",
    hint: "Fondo negro, tu color como acento en la frase clave, jerarquía tipográfica marcada. Portadas con variaciones de diseño automáticas.",
  },
];

function hashString(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Blanco o negro según cuál contraste mejor sobre el color dado. */
function contrastText(hex: string): string {
  return luminance(hex) > 0.6 ? "#0a0a0a" : "#ffffff";
}

/** Blanco o negro según cuál contraste mejor sobre un degradado de dos colores. */
function contrastTextForPair(a: string, b: string): string {
  return (luminance(a) + luminance(b)) / 2 > 0.6 ? "#0a0a0a" : "#ffffff";
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

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

/** Elige un color de la paleta de forma determinística según una semilla (para variar sin ser aleatorio). */
function pickFromPalette(palette: string[], seed: string | number, offset = 0): string {
  const base = typeof seed === "number" ? seed : hashString(seed);
  const idx = ((base + offset) % palette.length + palette.length) % palette.length;
  return palette[idx];
}

function BrandMark({ style, size = 18 }: { style: BrandStyle; size?: number }) {
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
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: style.primary,
        display: "flex",
      }}
    />
  );
}

function renderMinimalOscuro(slide: Slide, index: number, total: number, style: BrandStyle) {
  const isCover = index === 0;
  const isLast = index === total - 1;
  const palette = getPalette(style);
  const accent = isCover ? style.primary : pickFromPalette(palette, slide.titulo || index, index);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(160deg, #0d0f14 0%, #151a24 60%, #0d0f14 100%)",
        color: "#f5f6f8",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, color: "#9aa3b2" }}>
          <BrandMark style={style} />
          {style.brandName}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#5c6676" }}>
          {index + 1} / {total}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ display: "flex", width: 56, height: 6, borderRadius: 3, background: accent }} />
        <div
          style={{
            display: "flex",
            fontSize: isCover ? 84 : 60,
            fontWeight: 700,
            lineHeight: 1.15,
            color: isCover ? accent : "#f5f6f8",
          }}
        >
          {slide.titulo}
        </div>
        {slide.cuerpo ? (
          <div style={{ display: "flex", fontSize: 38, lineHeight: 1.45, color: "#c3cad6" }}>
            {slide.cuerpo}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "2px solid #232a37",
          paddingTop: 36,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: style.primary }}>{style.brandHandle}</div>
        <div style={{ display: "flex", fontSize: 28, color: "#5c6676" }}>
          {isLast ? "Guarda este post »" : "Desliza »"}
        </div>
      </div>
    </div>
  );
}

function renderEditorialClaro(slide: Slide, index: number, total: number, style: BrandStyle) {
  const isLast = index === total - 1;
  const palette = getPalette(style);
  const isCover = index === 0;
  const accent = isCover ? style.primary : pickFromPalette(palette, slide.titulo || index, index);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f7f5f0",
        color: "#16181d",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", height: 14, background: `linear-gradient(90deg, ${style.primary}, ${style.secondary})` }} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 700, color: "#16181d" }}>
            <BrandMark style={style} />
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
          <div
            style={{
              display: "flex",
              width: 88,
              height: 8,
              borderRadius: 4,
              background: accent,
            }}
          />
          <div style={{ display: "flex", fontSize: 62, fontWeight: 800, lineHeight: 1.12, color: "#16181d" }}>
            {slide.titulo}
          </div>
          {slide.cuerpo ? (
            <div style={{ display: "flex", fontSize: 36, lineHeight: 1.48, color: "#4b4e57" }}>
              {slide.cuerpo}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "2px solid rgba(0,0,0,0.12)",
            paddingTop: 32,
          }}
        >
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: style.primary }}>
            {style.brandHandle}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#7a7d85" }}>
            {isLast ? "Guarda este post »" : "Desliza »"}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderBoldContraste(slide: Slide, index: number, total: number, style: BrandStyle) {
  const isCover = index === 0;
  const isLast = index === total - 1;
  const palette = getPalette(style);
  // La portada siempre usa el par primario→secundario (la firma de marca);
  // el resto del carrusel rota por la paleta completa para dar variedad sin perder coherencia.
  const bgFrom = isCover || palette.length < 2 ? style.primary : pickFromPalette(palette, slide.titulo || index, index);
  const bgTo = isCover || palette.length < 2 ? style.secondary : pickFromPalette(palette, slide.titulo || index, index + 1);
  const text = contrastTextForPair(bgFrom, bgTo);
  const isDark = text === "#ffffff";
  const chipBg = isDark ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.55)";
  const chipText = isDark ? "#ffffff" : "#0a0a0a";
  const borderColor = isDark ? "rgba(255,255,255,0.35)" : "rgba(10,10,10,0.25)";
  const bodyColor = isDark ? "rgba(255,255,255,0.92)" : "rgba(10,10,10,0.78)";
  const footerColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(10,10,10,0.7)";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: `linear-gradient(150deg, ${bgFrom} 0%, ${bgTo} 100%)`,
        color: text,
        fontFamily: "sans-serif",
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
            color: chipText,
            background: chipBg,
            borderRadius: 999,
            padding: "8px 18px 8px 12px",
          }}
        >
          <BrandMark style={style} />
          {style.brandName}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 800,
            color: chipText,
            background: chipBg,
            borderRadius: 999,
            padding: "6px 16px",
          }}
        >
          {index + 1}/{total}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div
          style={{
            display: "flex",
            fontSize: isCover ? 96 : 66,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -1,
            color: text,
            textShadow: isDark ? "0 4px 24px rgba(0,0,0,0.25)" : "none",
          }}
        >
          {slide.titulo}
        </div>
        {slide.cuerpo ? (
          <div style={{ display: "flex", fontSize: 38, lineHeight: 1.4, color: bodyColor }}>
            {slide.cuerpo}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `3px solid ${borderColor}`,
          paddingTop: 32,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: text }}>
          {style.brandHandle}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: footerColor }}>
          {isLast ? "Guarda este post »" : "Desliza »"}
        </div>
      </div>
    </div>
  );
}

type Word = { text: string; strong: boolean };

function toWords(segments: { text: string; strong: boolean }[]): Word[] {
  const words: Word[] = [];
  for (const seg of segments) {
    for (const w of seg.text.split(/\s+/).filter(Boolean)) {
      words.push({ text: w, strong: seg.strong });
    }
  }
  return words;
}

export type CoverVariant = "banda" | "insignia" | "subrayado" | "cita";

export const COVER_VARIANTS: { value: CoverVariant; label: string }[] = [
  { value: "banda", label: "Banda" },
  { value: "insignia", label: "Insignia" },
  { value: "subrayado", label: "Subrayado" },
  { value: "cita", label: "Cita" },
];

/** Elige un tratamiento de portada distinto según el contenido, para que los carruseles no se vean repetitivos. */
function pickCoverVariant(titulo: string): CoverVariant {
  const variants: CoverVariant[] = ["banda", "insignia", "subrayado", "cita"];
  const variant = variants[hashString(titulo) % variants.length];
  const tieneNumeroInicial = /^\*{0,2}\d+/.test(titulo.trim());
  return variant === "insignia" && !tieneNumeroInicial ? "banda" : variant;
}

function renderTitleBanda(words: Word[], accent: string, size: number) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", rowGap: 14, columnGap: 12 }}>
      {words.map((w, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            fontSize: size,
            fontWeight: 900,
            lineHeight: 1.05,
            color: w.strong ? contrastText(accent) : "#ffffff",
            background: w.strong ? accent : "transparent",
            padding: w.strong ? "4px 16px" : "4px 0",
            borderRadius: w.strong ? 10 : 0,
          }}
        >
          {w.text}
        </div>
      ))}
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

function renderCoverTitle(titulo: string, variant: CoverVariant, accent: string, size: number) {
  const upper = titulo.toUpperCase();
  const words = toWords(parseEmphasis(upper));
  if (variant === "insignia") return renderTitleInsignia(upper, accent, size);
  if (variant === "subrayado") return renderTitleSubrayado(words, accent, size);
  if (variant === "cita") return renderTitleCita(words, accent, size);
  return renderTitleBanda(words, accent, size);
}

function renderBoldImpacto(slide: Slide, index: number, total: number, style: BrandStyle) {
  const isCover = index === 0;
  const isLast = index === total - 1;
  const palette = getPalette(style);
  // La portada usa siempre el color primario (firma de marca); el resto del
  // carrusel rota por la paleta completa para que cada slide resalte distinto.
  const accent = isCover ? style.primary : pickFromPalette(palette, slide.titulo || index, index);
  const variant = isCover ? pickCoverVariant(slide.titulo) : "banda";
  const titleSize = isCover ? 76 : 54;
  const words = toWords(parseEmphasis(slide.titulo.toUpperCase()));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0a0a0a",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 800, color: "#ffffff" }}>
          <BrandMark style={style} />
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
        {isCover
          ? renderCoverTitle(slide.titulo, variant, accent, titleSize)
          : renderTitleBanda(words, accent, titleSize)}
        {slide.cuerpo ? (
          <div style={{ display: "flex", fontSize: 36, lineHeight: 1.45, color: "rgba(255,255,255,0.75)" }}>
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
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: style.primary }}>
          {style.brandHandle}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.6)" }}>
          {isLast ? "Guarda este post »" : "Desliza »"}
        </div>
      </div>
    </div>
  );
}

/** Portada de video (Reels/TikTok/Shorts), formato vertical 9:16, mismo tratamiento visual que "Bold impacto". */
export function renderVideoPortada(opts: { titulo: string; style: BrandStyle; variant?: CoverVariant }) {
  const { titulo, style } = opts;
  const accent = style.primary;
  const variant =
    opts.variant && COVER_VARIANTS.some((v) => v.value === opts.variant) ? opts.variant : pickCoverVariant(titulo);

  const tree = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#0a0a0a",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 800 }}>
        <BrandMark style={style} size={22} />
        {style.brandName}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>{renderCoverTitle(titulo, variant, accent, 92)}</div>

      <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: accent }}>{style.brandHandle}</div>
    </div>
  );

  return new ImageResponse(tree, { width: 1080, height: 1920 });
}

export function renderSlide(opts: {
  slide: Slide;
  index: number;
  total: number;
  style: BrandStyle;
}) {
  const { slide, index, total, style } = opts;
  const tree =
    style.visualStyle === "editorial_claro"
      ? renderEditorialClaro(slide, index, total, style)
      : style.visualStyle === "bold_contraste"
        ? renderBoldContraste(slide, index, total, style)
        : style.visualStyle === "bold_impacto"
          ? renderBoldImpacto(slide, index, total, style)
          : renderMinimalOscuro(slide, index, total, style);

  return new ImageResponse(tree, { width: 1080, height: 1350 });
}
