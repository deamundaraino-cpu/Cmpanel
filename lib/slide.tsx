import { ImageResponse } from "next/og";

export type Slide = { titulo: string; cuerpo: string };

export type VisualStyle = "minimal_oscuro" | "editorial_claro" | "bold_contraste";

export type BrandStyle = {
  brandName: string;
  brandHandle: string;
  primary: string;
  secondary: string;
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
    hint: "Fondo a todo color con tu marca, texto grande en blanco. Máximo impacto, ideal para hooks.",
  },
];

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

      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        <div
          style={{
            display: "flex",
            fontSize: isCover ? 84 : 60,
            fontWeight: 700,
            lineHeight: 1.15,
            color: isCover ? style.primary : "#f5f6f8",
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
              color: "#ffffff",
              background: style.primary,
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
              background: style.secondary,
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
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: `linear-gradient(150deg, ${style.primary} 0%, ${style.secondary} 100%)`,
        color: "#ffffff",
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
            color: "#ffffff",
            background: "rgba(0,0,0,0.22)",
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
            color: "#ffffff",
            background: "rgba(0,0,0,0.22)",
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
            color: "#ffffff",
            textShadow: "0 4px 24px rgba(0,0,0,0.25)",
          }}
        >
          {slide.titulo}
        </div>
        {slide.cuerpo ? (
          <div style={{ display: "flex", fontSize: 38, lineHeight: 1.4, color: "rgba(255,255,255,0.92)" }}>
            {slide.cuerpo}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "3px solid rgba(255,255,255,0.35)",
          paddingTop: 32,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: "#ffffff" }}>
          {style.brandHandle}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.85)" }}>
          {isLast ? "Guarda este post »" : "Desliza »"}
        </div>
      </div>
    </div>
  );
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
        : renderMinimalOscuro(slide, index, total, style);

  return new ImageResponse(tree, { width: 1080, height: 1350 });
}
