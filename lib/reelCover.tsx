import { ImageResponse } from "next/og";
import { parseEmphasis, stripEmphasis } from "./emphasis";
import {
  alpha,
  clamp,
  contrastText,
  DISPLAY,
  figureBox,
  fonts,
  mix,
  resolveTheme,
  type BrandPhoto,
  type BrandStyle,
  type Cutout,
  type Theme,
} from "./slide";

// Portadas de reel 9:16. El grid de Instagram recorta la portada al centro 3:4
// (franja y≈240–1680), así que el texto importante vive en esa zona.

export type ReelTemplate = "centro" | "arriba" | "circulo" | "cintas" | "cita" | "split" | "detras";

export const REEL_TEMPLATES: { value: ReelTemplate; label: string; needsCutout?: boolean }[] = [
  { value: "centro", label: "Bloque central" },
  { value: "arriba", label: "Titular arriba" },
  { value: "circulo", label: "Círculo" },
  { value: "cintas", label: "Cintas" },
  { value: "cita", label: "Cita" },
  { value: "split", label: "Bloque de color", needsCutout: true },
  { value: "detras", label: "Texto detrás", needsCutout: true },
];

const W = 1080;
const H = 1920;
const ANTON_CHAR = 0.5;

type Line = { text: string; strong: boolean; size: number };

/**
 * Jerarquía tipográfica automática: la frase clave va en su propia línea y cada
 * línea se escala para llenar el ancho — las cortas quedan enormes y las largas
 * más pequeñas, que es lo que da ritmo a una portada.
 */
function hierarchy(text: string, width: number, maxSize: number, minSize: number, strongPad = 0): Line[] {
  const segments = parseEmphasis(text.toUpperCase())
    .map((s) => ({ text: s.text.trim(), strong: s.strong }))
    .filter((s) => s.text);
  const raw: { text: string; strong: boolean }[] = [];
  for (const seg of segments) {
    if (/^[,.;:!?)»”]+$/.test(seg.text) && raw.length) {
      raw[raw.length - 1].text += seg.text;
      continue;
    }
    const words = seg.text.split(/\s+/);
    const lines = Math.max(1, Math.round(seg.text.length / (seg.strong ? 15 : 11)));
    const target = seg.text.length / lines;
    let cur = "";
    let made = 0;
    for (const w of words) {
      if (cur && cur.length + 1 + w.length > target * 1.2 && made < lines - 1) {
        raw.push({ text: cur, strong: seg.strong });
        made++;
        cur = w;
      } else {
        cur = cur ? `${cur} ${w}` : w;
      }
    }
    if (cur) raw.push({ text: cur, strong: seg.strong });
  }
  return raw.map((l) => ({
    ...l,
    size: Math.floor(clamp((width - (l.strong ? strongPad : 0)) / (Math.max(l.text.length, 3) * ANTON_CHAR), minSize, maxSize)),
  }));
}

function Lines({
  lines,
  align,
  theme,
  mode,
  color = "#ffffff",
  gap = 10,
}: {
  lines: Line[];
  align: "center" | "flex-start";
  theme: Theme;
  mode: "box" | "color";
  color?: string;
  gap?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            fontFamily: DISPLAY,
            fontSize: l.size,
            lineHeight: 1.02,
            color: l.strong ? (mode === "box" ? contrastText(theme.accent) : theme.accent) : color,
            background: l.strong && mode === "box" ? theme.accent : "transparent",
            padding: l.strong && mode === "box" ? "4px 22px 0" : 0,
            borderRadius: l.strong && mode === "box" ? 12 : 0,
          }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}

function Root({ children, bg }: { children: React.ReactNode; bg: string }) {
  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
        background: bg,
      }}
    >
      {children}
    </div>
  );
}

function Abs({ top, height, left = 0, width = W, style, children }: {
  top: number;
  height: number;
  left?: number;
  width?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return <div style={{ position: "absolute", top, left, width, height, display: "flex", ...style }}>{children}</div>;
}

function PhotoBg({ photo }: { photo: BrandPhoto | null }) {
  if (!photo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      width={W}
      height={H}
      style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover", display: "flex" }}
    />
  );
}

function Figure({ cutout, maxH, maxW = W }: { cutout: Cutout; maxH: number; maxW?: number }) {
  const box = figureBox(cutout, maxH, maxW);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cutout.src}
      width={box.w}
      height={box.h}
      style={{ position: "absolute", left: Math.round((W - box.w) / 2), top: H - box.h, width: box.w, height: box.h, display: "flex" }}
    />
  );
}

function Handle({ style, top, color = "#ffffff" }: { style: BrandStyle; top: number; color?: string }) {
  return (
    <Abs top={top} height={50} style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: alpha(color, 0.9) }}>{style.brandHandle}</div>
    </Abs>
  );
}

const gradient = (theme: Theme, stops: [number, number][]) =>
  `linear-gradient(180deg, ${stops.map(([pos, a]) => `${alpha(theme.dark, a)} ${pos}%`).join(", ")})`;

// ————— Plantillas —————

function centro(text: string, style: BrandStyle, theme: Theme, photo: BrandPhoto | null) {
  const lines = hierarchy(text, 900, 250, 84, 44);
  return (
    <Root bg={theme.dark}>
      <PhotoBg photo={photo} />
      <Abs top={0} height={H} style={{ background: gradient(theme, [[0, 0.15], [42, 0.1], [62, 0.7], [100, 0.95]]) }} />
      <Abs top={900} height={700} style={{ justifyContent: "center", alignItems: "center" }}>
        <Lines lines={lines} align="center" theme={theme} mode="box" gap={14} />
      </Abs>
      <Handle style={style} top={1630} />
    </Root>
  );
}

function arriba(text: string, style: BrandStyle, theme: Theme, photo: BrandPhoto | null) {
  const lines = hierarchy(text, 936, 230, 80);
  return (
    <Root bg={theme.dark}>
      <PhotoBg photo={photo} />
      <Abs top={0} height={H} style={{ background: gradient(theme, [[0, 0.95], [30, 0.8], [52, 0.1], [100, 0]]) }} />
      <Abs top={250} height={640} left={72} width={936} style={{ flexDirection: "column", justifyContent: "flex-start" }}>
        <Lines lines={lines} align="flex-start" theme={theme} mode="color" gap={6} />
      </Abs>
    </Root>
  );
}

function circulo(text: string, style: BrandStyle, theme: Theme, photo: BrandPhoto | null) {
  const plain = stripEmphasis(text);
  const strong = parseEmphasis(text).find((s) => s.strong)?.text.trim();
  const num = plain.trim().match(/^(\d{1,3})\s+/)?.[1];
  let badge = strong || plain.split(/\s+/)[0];
  if (num && strong && !strong.startsWith(num) && plain.trim().startsWith(`${num} ${strong}`)) badge = `${num} ${strong}`;
  const rest = plain.replace(badge, "").replace(/\s+/g, " ").replace(/^[\s,.:;]+/, "").trim();
  // Dentro del círculo, una palabra por línea (máx. 3) para que cada una sea grande.
  const badgeWords = badge.toUpperCase().split(/\s+/);
  const perLine = Math.ceil(badgeWords.length / 3);
  const badgeLines: Line[] = [];
  for (let i = 0; i < badgeWords.length; i += perLine) {
    const t = badgeWords.slice(i, i + perLine).join(" ");
    badgeLines.push({ text: t, strong: true, size: Math.floor(clamp(370 / (Math.max(t.length, 2) * ANTON_CHAR), 70, 230)) });
  }
  const restLines = hierarchy(rest, 936, 130, 64);
  const onAccent = contrastText(theme.accent);
  return (
    <Root bg={theme.dark}>
      <PhotoBg photo={photo} />
      <Abs top={0} height={H} style={{ background: gradient(theme, [[0, 0.1], [45, 0.05], [65, 0.65], [100, 0.95]]) }} />
      <Abs top={940} height={500} left={60} width={500} style={{ transform: "rotate(-8deg)" }}>
        <div
          style={{
            display: "flex",
            width: 500,
            height: 500,
            borderRadius: 250,
            background: theme.accent,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 20px 60px ${alpha(theme.dark, 0.5)}`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {badgeLines.map((l, i) => (
              <div key={i} style={{ display: "flex", fontFamily: DISPLAY, fontSize: l.size, lineHeight: 1, color: onAccent }}>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      </Abs>
      {rest ? (
        <Abs top={1440} height={260} left={72} width={936} style={{ flexDirection: "column" }}>
          <Lines lines={restLines.map((l) => ({ ...l, strong: false }))} align="flex-start" theme={theme} mode="color" gap={4} />
        </Abs>
      ) : null}
    </Root>
  );
}

function cintas(text: string, style: BrandStyle, theme: Theme, photo: BrandPhoto | null) {
  const lines = hierarchy(text, 860, 190, 76, 40);
  return (
    <Root bg={theme.dark}>
      <PhotoBg photo={photo} />
      <Abs top={0} height={H} style={{ background: gradient(theme, [[0, 0.05], [55, 0.05], [100, 0.55]]) }} />
      <Abs top={960} height={660} style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              fontFamily: DISPLAY,
              fontSize: l.size,
              lineHeight: 1.02,
              padding: "6px 26px 0",
              color: l.strong ? contrastText(theme.accent) : theme.dark,
              background: l.strong ? theme.accent : "#ffffff",
              transform: `rotate(${i % 2 ? 2 : -2.5}deg)`,
              boxShadow: `0 10px 30px ${alpha(theme.dark, 0.35)}`,
            }}
          >
            {l.text}
          </div>
        ))}
      </Abs>
    </Root>
  );
}

function cita(text: string, style: BrandStyle, theme: Theme, photo: BrandPhoto | null) {
  const plain = stripEmphasis(text);
  const size = Math.round(clamp(118 * Math.sqrt(26 / Math.max(plain.length, 10)), 74, 132));
  const words = parseEmphasis(text).flatMap((s) =>
    s.text.split(/\s+/).filter(Boolean).map((w) => ({ w, strong: s.strong }))
  );
  return (
    <Root bg={theme.dark}>
      <PhotoBg photo={photo} />
      <Abs top={0} height={H} style={{ background: gradient(theme, [[0, 0.35], [40, 0.35], [62, 0.85], [100, 0.97]]) }} />
      <Abs top={740} height={330} left={60} width={400}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 420, lineHeight: 1, color: theme.accent }}>{"“"}</div>
      </Abs>
      <Abs top={1040} height={520} left={72} width={936} style={{ flexDirection: "column", justifyContent: "flex-start", gap: 34 }}>
        <div style={{ display: "flex", flexWrap: "wrap", columnGap: size * 0.26, fontSize: size, fontWeight: 900, lineHeight: 1.08 }}>
          {words.map((x, i) => (
            <div key={i} style={{ display: "flex", color: x.strong ? theme.accent : "#ffffff" }}>
              {x.w}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: alpha("#ffffff", 0.8) }}>— {style.brandHandle}</div>
      </Abs>
    </Root>
  );
}

function split(text: string, style: BrandStyle, theme: Theme, photo: BrandPhoto | null) {
  const lines = hierarchy(text, 920, 220, 80, 44);
  const onAccent = contrastText(theme.accent);
  const cutout = photo?.cutout;
  return (
    <Root bg={theme.dark}>
      {cutout ? (
        <Abs
          top={0}
          height={H}
          style={{ background: `radial-gradient(circle at 50% 75%, ${mix(theme.dark, theme.accent2, 0.3)} 0%, ${theme.dark} 60%)` }}
        />
      ) : photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.src}
          width={W}
          height={1100}
          style={{ position: "absolute", top: 820, left: 0, width: W, height: 1100, objectFit: "cover", display: "flex" }}
        />
      ) : null}
      <Abs top={0} height={900} style={{ background: theme.accent, flexDirection: "column", justifyContent: "flex-end", padding: "0 80px 110px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                fontFamily: DISPLAY,
                fontSize: l.size,
                lineHeight: 1.02,
                color: l.strong ? theme.accent : onAccent,
                background: l.strong ? theme.dark : "transparent",
                padding: l.strong ? "4px 22px 0" : 0,
                borderRadius: l.strong ? 12 : 0,
              }}
            >
              {l.text}
            </div>
          ))}
        </div>
      </Abs>
      {cutout ? <Figure cutout={cutout} maxH={1160} /> : null}
    </Root>
  );
}

function detras(text: string, style: BrandStyle, theme: Theme, photo: BrandPhoto | null) {
  const cutout = photo?.cutout;
  if (!cutout) return centro(text, style, theme, photo);
  const strong = parseEmphasis(text).filter((s) => s.strong).map((s) => s.text.trim()).join(" ");
  const keyword = (strong || stripEmphasis(text).split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), "")).toUpperCase();
  const kwSize = Math.floor(clamp(1000 / (Math.max(keyword.length, 3) * ANTON_CHAR), 180, 520));
  const lines = hierarchy(text, 936, 130, 70).map((l) => ({ ...l, size: Math.min(l.size, 130) }));
  return (
    <Root bg={`radial-gradient(circle at 50% 50%, ${mix(theme.dark, theme.accent, 0.3)} 0%, ${theme.dark} 60%)`}>
      <Abs top={330} height={kwSize * 1.1} style={{ justifyContent: "center" }}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: kwSize, lineHeight: 1, color: theme.accent }}>{keyword}</div>
      </Abs>
      <Figure cutout={cutout} maxH={1450} />
      <Abs top={1000} height={920} style={{ background: gradient(theme, [[0, 0], [35, 0.75], [100, 0.98]]) }} />
      <Abs top={1300} height={380} style={{ justifyContent: "center", alignItems: "flex-end" }}>
        <Lines lines={lines} align="center" theme={theme} mode="color" gap={4} />
      </Abs>
    </Root>
  );
}

const RENDERERS: Record<ReelTemplate, typeof centro> = { centro, arriba, circulo, cintas, cita, split, detras };

export function renderReelCover(opts: { template: ReelTemplate; text: string; style: BrandStyle; photo: BrandPhoto | null }) {
  const theme = resolveTheme(opts.style);
  const render = RENDERERS[opts.template] || centro;
  return new ImageResponse(render(opts.text, opts.style, theme, opts.photo), { width: W, height: H, fonts: fonts() });
}

/** Texto de portada de respaldo para guiones antiguos: la primera frase del gancho, corta. */
export function fallbackCoverText(hook: string): string {
  const first = (hook.split(/(?<=[.?!])\s/)[0] || hook).trim();
  const strong = parseEmphasis(first).find((s) => s.strong)?.text.trim();
  const words = stripEmphasis(first).split(/\s+/);
  if (words.length <= 8) return first;
  if (strong) return `**${strong}**`;
  return words.slice(0, 7).join(" ");
}
