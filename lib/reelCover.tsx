import { ImageResponse } from "next/og";
import { parseEmphasis, stripEmphasis } from "./emphasis";
import {
  alpha,
  clamp,
  contrastText,
  designOf,
  figureBox,
  fonts,
  mix,
  pairOf,
  PRIVATE_IMAGE_HEADERS,
  resolveTheme,
  type BrandPhoto,
  type BrandStyle,
  type Theme,
} from "./slide";
import { REEL_TEMPLATES, type BrandDesign, type ReelTemplate } from "./brandDesign";
import { BOX_PAD, fitLines, LINE_HEIGHT, metricsFor, stripPunct, tokens, type Line, type Metrics } from "./typeset";
import { textureDataUri } from "./texture";

export { REEL_TEMPLATES } from "./brandDesign";
export type { ReelTemplate } from "./brandDesign";

// Portadas de reel 9:16. El grid de Instagram recorta la portada al centro 3:4
// (franja y≈240–1680): todo el texto vive dentro de esa franja. La figura
// recortada va grande y apoyada abajo; el texto ocupa zonas que no tapan la cara.

const W = 1080;
const H = 1920;
const M = 80;

// ————— Tipografía medida —————

function TextLines({
  lines,
  align,
  theme,
  ctx,
  mode,
  color = "#ffffff",
  gap = 0.1,
  strongBg,
  strongColor,
}: {
  lines: Line[];
  align: "center" | "flex-start";
  theme: Theme;
  ctx: Ctx;
  mode?: "tape";
  color?: string;
  gap?: number;
  strongBg?: string;
  strongColor?: string;
}) {
  const minSize = Math.min(...lines.map((l) => l.size));
  const boxBg = strongBg || theme.accent;
  const tape = mode === "tape";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: Math.round(minSize * gap) }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            columnGap: Math.round(l.size * ctx.m.space),
            fontFamily: ctx.family,
            fontSize: l.size,
            lineHeight: LINE_HEIGHT,
            ...(tape
              ? {
                  background: "#ffffff",
                  padding: `${Math.round(l.size * 0.06)}px ${Math.round(l.size * 0.14)}px 0`,
                  borderRadius: ctx.radius(Math.round(l.size * 0.05)),
                  ...(ctx.tilt ? { transform: `rotate(${i % 2 ? 1.8 : -2.2}deg)` } : {}),
                  boxShadow: `0 12px 30px ${alpha(theme.dark, 0.4)}`,
                }
              : {}),
          }}
        >
          {l.chunks.map((c, j) => {
            const boxed = c.strong && ctx.emphasis === "box";
            const base = tape ? theme.dark : color;
            return (
              <div
                key={j}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  color: c.strong ? (boxed ? strongColor || contrastText(boxBg) : strongColor || theme.accent) : base,
                  background: boxed ? boxBg : "transparent",
                  padding: boxed ? `${Math.round(l.size * 0.05)}px ${Math.round(l.size * BOX_PAD)}px 0` : 0,
                  borderRadius: boxed ? ctx.radius(Math.round(l.size * 0.06)) : 0,
                }}
              >
                {c.text}
                {c.strong && ctx.emphasis === "underline" ? (
                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      height: Math.max(6, Math.round(l.size * 0.08)),
                      marginTop: Math.round(l.size * 0.04),
                      background: strongColor || theme.accent,
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

// ————— Escena —————

type Zone = { x: number; y: number; w: number; h: number };

/** Perillas de la marca ya resueltas para dibujar. */
type Ctx = {
  family: string;
  body: string;
  m: Metrics;
  upper: boolean;
  emphasis: BrandDesign["emphasis"];
  boxed: boolean;
  align: "center" | "flex-start";
  tilt: boolean;
  background: BrandDesign["background"];
  texture: BrandDesign["texture"];
  radius: (soft: number) => number;
};

function ctxOf(style: BrandStyle): Ctx {
  const d = designOf(style);
  const pair = pairOf(style);
  return {
    family: pair.display.family,
    body: pair.body.family,
    m: metricsFor(pair.display.family),
    upper: d.textCase === "upper",
    emphasis: d.emphasis,
    boxed: d.emphasis === "box",
    align: d.align === "center" ? "center" : "flex-start",
    tilt: d.tilt,
    background: d.background,
    texture: d.texture,
    radius: (soft: number) => (d.shape === "sharp" ? 0 : soft),
  };
}

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

function Zoned({ zone, justify, align, children }: {
  zone: Zone;
  justify: "flex-start" | "center" | "flex-end";
  align: "center" | "flex-start";
  children: React.ReactNode;
}) {
  return (
    <Abs x={zone.x} y={zone.y} w={zone.w} h={zone.h} style={{ flexDirection: "column", justifyContent: justify, alignItems: align }}>
      {children}
    </Abs>
  );
}

/** Fondo de marca con halo del acento; sin recorte, la foto a sangre (opcionalmente solo desde `photoTop`). */
function Backdrop({ theme, photo, ctx, anchorX = 0.5, glow, photoTop = 0 }: {
  theme: Theme;
  photo: BrandPhoto | null;
  ctx: Ctx;
  anchorX?: number;
  glow?: string;
  photoTop?: number;
}) {
  const tint = mix(theme.dark, glow || theme.accent, 0.28);
  const background =
    ctx.background === "flat"
      ? theme.dark
      : ctx.background === "degradado"
        ? `linear-gradient(165deg, ${tint} 0%, ${theme.dark} 60%)`
        : `radial-gradient(circle at ${Math.round(anchorX * 100)}% 62%, ${tint} 0%, ${theme.dark} 58%)`;
  const texture = textureDataUri(ctx.texture, theme.accent, W, H, W + H);
  return (
    <>
      <Abs h={H} style={{ background }} />
      {texture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={texture} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex" }} />
      ) : null}
      {photo && !photo.cutout ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.src}
          width={W}
          height={H - photoTop}
          style={{ position: "absolute", left: 0, top: photoTop, width: W, height: H - photoTop, objectFit: "cover", display: "flex" }}
        />
      ) : null}
    </>
  );
}

/** La persona recortada, grande y apoyada en el borde inferior. */
function Person({ photo, height, anchorX = 0.5 }: { photo: BrandPhoto | null; height: number; anchorX?: number }) {
  const cutout = photo?.cutout;
  if (!cutout) return null;
  const box = figureBox(cutout, height, W * 1.1);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cutout.src}
      width={box.w}
      height={box.h}
      style={{ position: "absolute", left: Math.round(W * anchorX - box.w / 2), top: H - box.h, width: box.w, height: box.h, display: "flex" }}
    />
  );
}

/** Sombreado que asegura contraste en la zona del texto. */
function Shade({ theme, where }: { theme: Theme; where: "top" | "bottom" | "left" }) {
  const v = (stops: [number, number][]) =>
    `linear-gradient(180deg, ${stops.map(([pos, a]) => `${alpha(theme.dark, a)} ${pos}%`).join(", ")})`;
  const background =
    where === "top"
      ? v([[0, 0.92], [22, 0.75], [42, 0.1], [70, 0], [100, 0.3]])
      : where === "bottom"
        ? v([[0, 0.3], [40, 0], [56, 0.2], [72, 0.85], [100, 0.97]])
        : `linear-gradient(90deg, ${alpha(theme.dark, 0.96)} 0%, ${alpha(theme.dark, 0.8)} 45%, ${alpha(theme.dark, 0)} 75%)`;
  return <Abs h={H} style={{ background }} />;
}

function Root({ theme, ctx, children }: { theme: Theme; ctx: Ctx; children: React.ReactNode }) {
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: ctx.body, background: theme.dark }}>
      {children}
    </div>
  );
}

// ————— Plantillas —————

type Args = { text: string; style: BrandStyle; theme: Theme; photo: BrandPhoto | null };

function centro({ text, style, theme, photo }: Args) {
  const ctx = ctxOf(style);
  const zone = { x: M, y: 1160, w: W - 2 * M, h: 480 };
  const lines = fitLines(tokens(text, ctx.upper), zone, { m: ctx.m, maxSize: 250, boxed: ctx.boxed });
  return (
    <Root theme={theme} ctx={ctx}>
      <Backdrop theme={theme} photo={photo} ctx={ctx} />
      <Person photo={photo} height={1420} />
      <Shade theme={theme} where="bottom" />
      <Zoned zone={zone} justify="center" align={ctx.align}>
        <TextLines lines={lines} align={ctx.align} theme={theme} ctx={ctx} />
      </Zoned>
    </Root>
  );
}

function arriba({ text, style, theme, photo }: Args) {
  const ctx = ctxOf(style);
  const zone = { x: M, y: 260, w: W - 2 * M, h: 420 };
  const lines = fitLines(tokens(text, ctx.upper), zone, { m: ctx.m, maxSize: 230, boxed: ctx.boxed });
  return (
    <Root theme={theme} ctx={ctx}>
      <Backdrop theme={theme} photo={photo} ctx={ctx} />
      <Person photo={photo} height={1230} />
      <Shade theme={theme} where="top" />
      <Abs x={M} y={214} w={120} h={12} style={{ background: theme.accent, borderRadius: ctx.radius(6) }} />
      <Zoned zone={zone} justify="flex-start" align="flex-start">
        <TextLines lines={lines} align="flex-start" theme={theme} ctx={ctx} />
      </Zoned>
    </Root>
  );
}

function circulo({ text, style, theme, photo }: Args) {
  const ctx = ctxOf(style);
  const toks = tokens(text, ctx.upper);
  const strongToks = toks.filter((t) => t.strong);
  const first = toks[0];
  // Un número inicial entra al círculo junto a la palabra resaltada ("3 HÁBITOS").
  const badgeToks =
    first && /^\d+$/.test(first.w) && !first.strong ? [first, ...strongToks] : strongToks.length ? strongToks : toks.slice(0, 1);
  const restToks = toks.filter((t) => !badgeToks.includes(t)).map((t) => ({ ...t, strong: false }));
  const onAccent = contrastText(theme.accent);
  const D = 500;
  const badgeLines = fitLines(
    badgeToks.map((t) => ({ ...t, strong: false })),
    { w: 360, h: 330 },
    { m: ctx.m, maxSize: 250, ratio: 2.4, maxLines: 3, orphans: true, gap: 0.02 }
  );
  const restZone = { x: M, y: 260, w: W - 2 * M, h: 380 };
  const restLines = restToks.length ? fitLines(restToks, restZone, { m: ctx.m, maxSize: 200 }) : [];
  return (
    <Root theme={theme} ctx={ctx}>
      <Backdrop theme={theme} photo={photo} ctx={ctx} anchorX={0.6} />
      <Person photo={photo} height={1300} anchorX={0.6} />
      {restLines.length ? <Shade theme={theme} where="top" /> : null}
      {restLines.length ? (
        <Zoned zone={restZone} justify="flex-start" align="flex-start">
          <TextLines lines={restLines} align="flex-start" theme={theme} ctx={ctx} />
        </Zoned>
      ) : null}
      <Abs x={50} y={1120} w={D} h={D} style={ctx.tilt ? { transform: "rotate(-8deg)" } : {}}>
        <div
          style={{
            display: "flex",
            width: D,
            height: D,
            borderRadius: ctx.radius(D / 2) || 24,
            background: theme.accent,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 24px 70px ${alpha(theme.dark, 0.55)}`,
          }}
        >
          <TextLines lines={badgeLines} align="center" theme={theme} ctx={ctx} color={onAccent} strongColor={onAccent} gap={0.02} />
        </div>
      </Abs>
    </Root>
  );
}

function cintas({ text, style, theme, photo }: Args) {
  const ctx = ctxOf(style);
  const zone = { x: M + 20, y: 1150, w: W - 2 * M - 40, h: 480 };
  const lines = fitLines(tokens(text, ctx.upper), zone, { m: ctx.m, maxSize: 200, boxed: ctx.boxed, gap: 0.22, ratio: 1.3 });
  return (
    <Root theme={theme} ctx={ctx}>
      <Backdrop theme={theme} photo={photo} ctx={ctx} />
      <Person photo={photo} height={1420} />
      <Shade theme={theme} where="bottom" />
      <Zoned zone={zone} justify="center" align={ctx.align}>
        <TextLines lines={lines} align={ctx.align} theme={theme} ctx={ctx} mode="tape" gap={0.22} />
      </Zoned>
    </Root>
  );
}

function cita({ text, style, theme, photo }: Args) {
  const ctx = ctxOf(style);
  const words = parseEmphasis(text).flatMap((s) =>
    s.text.split(/\s+/).filter(Boolean).map((w) => ({ w, strong: s.strong }))
  );
  const strongCount = words.filter((x) => x.strong).length;
  if (words.length > 1 && (strongCount === 0 || strongCount === words.length)) {
    const longest = words.reduce((a, b) => (stripPunct(b.w).length > stripPunct(a.w).length ? b : a));
    words.forEach((x) => (x.strong = x === longest));
  }
  const plain = stripEmphasis(text);
  const size = Math.round(clamp(140 * Math.sqrt(18 / Math.max(plain.length, 8)), 88, 140));
  const anchorX = photo?.cutout ? 0.84 : 0.5;
  return (
    <Root theme={theme} ctx={ctx}>
      <Backdrop theme={theme} photo={photo} ctx={ctx} anchorX={anchorX} />
      <Person photo={photo} height={1480} anchorX={anchorX} />
      <Shade theme={theme} where="left" />
      <Abs x={M - 10} y={300} w={400} h={300}>
        <div style={{ display: "flex", fontFamily: ctx.family, fontSize: 380, lineHeight: 1, color: theme.accent }}>{"“"}</div>
      </Abs>
      <Zoned zone={{ x: M, y: 620, w: 600, h: 900 }} justify="flex-start" align="flex-start">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: Math.round(size * 0.26),
            fontSize: size,
            fontWeight: 900,
            lineHeight: 1.06,
            letterSpacing: -size * 0.02,
          }}
        >
          {words.map((x, i) => (
            <div key={i} style={{ display: "flex", color: x.strong ? theme.accent : "#ffffff" }}>
              {x.w}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 40, width: 90, height: 8, borderRadius: ctx.radius(4), background: theme.accent }} />
        <div style={{ display: "flex", marginTop: 22, fontSize: 38, fontWeight: 800, color: alpha("#ffffff", 0.85) }}>
          {style.brandHandle}
        </div>
      </Zoned>
    </Root>
  );
}

function split({ text, style, theme, photo }: Args) {
  const ctx = ctxOf(style);
  const panelH = 800;
  const zone = { x: M, y: 250, w: W - 2 * M, h: 400 };
  const onAccent = contrastText(theme.accent);
  const lines = fitLines(tokens(text, ctx.upper), zone, { m: ctx.m, maxSize: 220, boxed: ctx.boxed });
  return (
    <Root theme={theme} ctx={ctx}>
      <Backdrop theme={theme} photo={photo} ctx={ctx} photoTop={panelH} glow={theme.accent2} />
      <Abs h={panelH} style={{ background: theme.accent }} />
      <Person photo={photo} height={1300} />
      <Zoned zone={zone} justify="flex-end" align="flex-start">
        <TextLines
          lines={lines}
          align="flex-start"
          theme={theme}
          ctx={ctx}
          color={onAccent}
          strongBg={theme.dark}
          strongColor={theme.accent}
        />
      </Zoned>
    </Root>
  );
}

function detras(args: Args) {
  const { text, style, theme, photo } = args;
  if (!photo?.cutout) return centro(args);
  const ctx = ctxOf(style);
  const toks = tokens(text, ctx.upper);
  const keyword = toks.filter((t) => t.strong).map((t) => ({ ...t, strong: false }));
  const rest = toks.filter((t) => !t.strong);
  const kwZone = { x: 40, y: 240, w: W - 80, h: 560 };
  const kwLines = fitLines(keyword, kwZone, { m: ctx.m, maxSize: 520, maxLines: 1 });
  // La cabeza tapa solo el tercio inferior de la palabra clave: sigue legible.
  const kwSize = kwLines[0]?.size || 300;
  const figureH = Math.min(1500, H - (kwZone.y + Math.round(kwSize * 0.68)));
  const restZone = { x: M, y: 1400, w: W - 2 * M, h: 260 };
  const restLines = rest.length ? fitLines(rest, restZone, { m: ctx.m, maxSize: 170 }) : [];
  return (
    <Root theme={theme} ctx={ctx}>
      <Backdrop theme={theme} photo={photo} ctx={ctx} />
      <Zoned zone={kwZone} justify="flex-start" align="center">
        <TextLines lines={kwLines} align="center" theme={theme} ctx={ctx} color={theme.accent} />
      </Zoned>
      <Person photo={photo} height={figureH} />
      <Shade theme={theme} where="bottom" />
      {restLines.length ? (
        <Zoned zone={restZone} justify="center" align="center">
          <TextLines lines={restLines} align="center" theme={theme} ctx={ctx} />
        </Zoned>
      ) : null}
    </Root>
  );
}

const RENDERERS: Record<ReelTemplate, (a: Args) => React.ReactElement> = { centro, arriba, circulo, cintas, cita, split, detras };

export function renderReelCover(opts: { template: ReelTemplate; text: string; style: BrandStyle; photo: BrandPhoto | null }) {
  const theme = resolveTheme(opts.style);
  const render = RENDERERS[opts.template] || centro;
  return new ImageResponse(render({ text: opts.text, style: opts.style, theme, photo: opts.photo }), {
    width: W,
    height: H,
    fonts: fonts(designOf(opts.style)),
    headers: PRIVATE_IMAGE_HEADERS,
  });
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
