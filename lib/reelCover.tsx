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
  type Theme,
} from "./slide";

// Portadas de reel 9:16. El grid de Instagram recorta la portada al centro 3:4
// (franja y≈240–1680): todo el texto vive dentro de esa franja. La figura
// recortada va grande y apoyada abajo; el texto ocupa zonas que no tapan la cara.

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
const M = 80;

// ————— Tipografía medida —————

// Avance de cada glifo de Anton en em (extraído del archivo de la fuente).
const ANTON: Record<string, number> = {"0":0.494,"1":0.331,"2":0.494,"3":0.494,"4":0.494,"5":0.494,"6":0.494,"7":0.494,"8":0.494,"9":0.494,"A":0.485,"B":0.479,"C":0.474,"D":0.493,"E":0.412,"F":0.399,"G":0.485,"H":0.499,"I":0.227,"J":0.466,"K":0.472,"L":0.397,"M":0.746,"N":0.498,"O":0.486,"P":0.472,"Q":0.494,"R":0.477,"S":0.461,"T":0.396,"U":0.474,"V":0.469,"W":0.712,"X":0.484,"Y":0.446,"Z":0.41,"Á":0.485,"É":0.412,"Í":0.227,"Ó":0.486,"Ú":0.474,"Ü":0.474,"Ñ":0.498," ":0.234,".":0.229,",":0.236,":":0.242,";":0.245,"!":0.229,"?":0.492,"¿":0.493,"¡":0.227,"\"":0.429,"“":0.464,"”":0.463,"%":1.057,"$":0.462,"#":0.546,"&":0.52,"(":0.291,")":0.291,"-":0.311,"+":0.355,"/":0.405};
const SPACE = ANTON[" "];
const LINE_HEIGHT = 0.98;
const BOX_PAD = 0.14; // relleno horizontal de la caja resaltada, en em por lado

function emWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += ANTON[ch] ?? 0.49;
  return w;
}

function stripPunct(w: string) {
  return w.replace(/[^\p{L}\p{N}]/gu, "");
}

type Tok = { w: string; strong: boolean };

/** Palabras con su marca de énfasis, en mayúsculas y con la puntuación pegada. */
function tokens(text: string): Tok[] {
  const toks: Tok[] = [];
  for (const seg of parseEmphasis(text.toUpperCase())) {
    for (const w of seg.text.split(/\s+/).filter(Boolean)) {
      const prev = toks[toks.length - 1];
      if (prev && /^[,.;:!?)»”]+$/.test(w)) prev.w += w;
      else toks.push({ w, strong: seg.strong });
    }
  }
  // Si todo o nada va resaltado no hay jerarquía: se resalta solo la palabra más larga.
  const strongCount = toks.filter((t) => t.strong).length;
  if (toks.length > 1 && (strongCount === 0 || strongCount === toks.length)) {
    const longest = toks.reduce((a, b) => (stripPunct(b.w).length > stripPunct(a.w).length ? b : a));
    toks.forEach((t) => (t.strong = t === longest));
  }
  return toks;
}

type Chunk = { text: string; strong: boolean };
type Line = { chunks: Chunk[]; size: number };

function chunksOf(toks: Tok[]): Chunk[] {
  const out: Chunk[] = [];
  for (const t of toks) {
    const last = out[out.length - 1];
    if (last && last.strong === t.strong) last.text += ` ${t.w}`;
    else out.push({ text: t.w, strong: t.strong });
  }
  return out;
}

function lineEm(chunks: Chunk[], boxed: boolean): number {
  return (
    chunks.reduce((sum, c) => sum + emWidth(c.text) + (boxed && c.strong ? BOX_PAD * 2 : 0), 0) +
    SPACE * (chunks.length - 1)
  );
}

/**
 * Reparte las palabras en 1–4 líneas buscando la combinación con la letra más
 * grande que quepa en la zona. Cada línea se escala a lo ancho, pero ninguna
 * supera `ratio`× a la más pequeña: jerarquía sin desproporción.
 */
function fitLines(
  toks: Tok[],
  zone: { w: number; h: number },
  opts: { maxSize: number; boxed?: boolean; gap?: number; ratio?: number; maxLines?: number; orphans?: boolean }
): Line[] {
  const { maxSize, boxed = false, gap = 0.1, ratio = 1.45, maxLines = 4, orphans = false } = opts;
  const n = toks.length;
  if (!n) return [];
  let best: { lines: Line[]; score: number } | null = null;

  const evaluate = (breaks: number[]) => {
    const groups: Tok[][] = [];
    let start = 0;
    for (const b of [...breaks, n]) {
      groups.push(toks.slice(start, b));
      start = b;
    }
    const chunked = groups.map(chunksOf);
    const fits = chunked.map((c) => Math.min(maxSize, zone.w / lineEm(c, boxed)));
    const minFit = Math.min(...fits);
    let sizes = fits.map((f) => Math.min(f, minFit * ratio));
    const height = sizes.reduce((s, x) => s + x * LINE_HEIGHT, 0) + gap * minFit * (sizes.length - 1);
    if (height > zone.h) sizes = sizes.map((s) => s * (zone.h / height));
    let score = Math.min(...sizes) * (1 - 0.04 * (groups.length - 1));
    for (const [i, g] of groups.entries()) {
      const last = stripPunct(g[g.length - 1].w);
      // Una palabra de 1–2 letras sola en su línea queda huérfana ("EL").
      if (!orphans && g.length === 1 && last.length <= 2) score *= 0.6;
      // Cortar tras un artículo o preposición ("CAMBIARON MI / VIDA") rompe la lectura.
      if (i < groups.length - 1 && last.length <= 3 && !/^\d+$/.test(last)) score *= 0.88;
      // La frase clave sola en su línea es la jerarquía más clara.
      if (chunked[i].length === 1 && chunked[i][0].strong) score *= 1.06;
    }
    if (!best || score > best.score) {
      best = { score, lines: chunked.map((chunks, i) => ({ chunks, size: Math.floor(sizes[i]) })) };
    }
  };

  const choose = (from: number, left: number, acc: number[]) => {
    if (left === 0) return evaluate(acc);
    for (let b = from; b <= n - left; b++) choose(b + 1, left - 1, [...acc, b]);
  };
  for (let lines = 1; lines <= Math.min(maxLines, n); lines++) choose(1, lines - 1, []);
  return (best as { lines: Line[] } | null)?.lines || [];
}

function TextLines({
  lines,
  align,
  theme,
  mode,
  color = "#ffffff",
  gap = 0.1,
  strongBg,
  strongColor,
}: {
  lines: Line[];
  align: "center" | "flex-start";
  theme: Theme;
  mode: "box" | "color" | "tape";
  color?: string;
  gap?: number;
  strongBg?: string;
  strongColor?: string;
}) {
  const minSize = Math.min(...lines.map((l) => l.size));
  const boxBg = strongBg || theme.accent;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: Math.round(minSize * gap) }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            columnGap: Math.round(l.size * SPACE),
            fontFamily: DISPLAY,
            fontSize: l.size,
            lineHeight: LINE_HEIGHT,
            ...(mode === "tape"
              ? {
                  background: "#ffffff",
                  padding: `${Math.round(l.size * 0.06)}px ${Math.round(l.size * 0.14)}px 0`,
                  transform: `rotate(${i % 2 ? 1.8 : -2.2}deg)`,
                  boxShadow: `0 12px 30px ${alpha(theme.dark, 0.4)}`,
                }
              : {}),
          }}
        >
          {l.chunks.map((c, j) => {
            const boxed = c.strong && (mode === "box" || mode === "tape");
            return (
              <div
                key={j}
                style={{
                  display: "flex",
                  color: c.strong
                    ? boxed
                      ? strongColor || contrastText(boxBg)
                      : strongColor || theme.accent
                    : mode === "tape"
                      ? theme.dark
                      : color,
                  background: boxed ? boxBg : "transparent",
                  padding: boxed ? `${Math.round(l.size * 0.05)}px ${Math.round(l.size * BOX_PAD)}px 0` : 0,
                  borderRadius: boxed && mode === "box" ? Math.round(l.size * 0.06) : 0,
                }}
              >
                {c.text}
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
function Backdrop({ theme, photo, anchorX = 0.5, glow, photoTop = 0 }: {
  theme: Theme;
  photo: BrandPhoto | null;
  anchorX?: number;
  glow?: string;
  photoTop?: number;
}) {
  return (
    <>
      <Abs
        h={H}
        style={{
          background: `radial-gradient(circle at ${Math.round(anchorX * 100)}% 62%, ${mix(theme.dark, glow || theme.accent, 0.28)} 0%, ${theme.dark} 58%)`,
        }}
      />
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

function Root({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", fontFamily: "Inter", background: theme.dark }}>
      {children}
    </div>
  );
}

// ————— Plantillas —————

type Args = { text: string; style: BrandStyle; theme: Theme; photo: BrandPhoto | null };

function centro({ text, theme, photo }: Args) {
  const zone = { x: M, y: 1160, w: W - 2 * M, h: 480 };
  const lines = fitLines(tokens(text), zone, { maxSize: 250, boxed: true });
  return (
    <Root theme={theme}>
      <Backdrop theme={theme} photo={photo} />
      <Person photo={photo} height={1420} />
      <Shade theme={theme} where="bottom" />
      <Zoned zone={zone} justify="center" align="center">
        <TextLines lines={lines} align="center" theme={theme} mode="box" />
      </Zoned>
    </Root>
  );
}

function arriba({ text, theme, photo }: Args) {
  const zone = { x: M, y: 260, w: W - 2 * M, h: 420 };
  const lines = fitLines(tokens(text), zone, { maxSize: 230 });
  return (
    <Root theme={theme}>
      <Backdrop theme={theme} photo={photo} />
      <Person photo={photo} height={1230} />
      <Shade theme={theme} where="top" />
      <Abs x={M} y={214} w={120} h={12} style={{ background: theme.accent, borderRadius: 6 }} />
      <Zoned zone={zone} justify="flex-start" align="flex-start">
        <TextLines lines={lines} align="flex-start" theme={theme} mode="color" />
      </Zoned>
    </Root>
  );
}

function circulo({ text, theme, photo }: Args) {
  const toks = tokens(text);
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
    { maxSize: 250, ratio: 2.4, maxLines: 3, orphans: true, gap: 0.02 }
  );
  const restZone = { x: M, y: 260, w: W - 2 * M, h: 380 };
  const restLines = restToks.length ? fitLines(restToks, restZone, { maxSize: 200 }) : [];
  return (
    <Root theme={theme}>
      <Backdrop theme={theme} photo={photo} anchorX={0.6} />
      <Person photo={photo} height={1300} anchorX={0.6} />
      {restLines.length ? <Shade theme={theme} where="top" /> : null}
      {restLines.length ? (
        <Zoned zone={restZone} justify="flex-start" align="flex-start">
          <TextLines lines={restLines} align="flex-start" theme={theme} mode="color" />
        </Zoned>
      ) : null}
      <Abs x={50} y={1120} w={D} h={D} style={{ transform: "rotate(-8deg)" }}>
        <div
          style={{
            display: "flex",
            width: D,
            height: D,
            borderRadius: D / 2,
            background: theme.accent,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 24px 70px ${alpha(theme.dark, 0.55)}`,
          }}
        >
          <TextLines lines={badgeLines} align="center" theme={theme} mode="color" color={onAccent} gap={0.02} />
        </div>
      </Abs>
    </Root>
  );
}

function cintas({ text, theme, photo }: Args) {
  const zone = { x: M + 20, y: 1150, w: W - 2 * M - 40, h: 480 };
  const lines = fitLines(tokens(text), zone, { maxSize: 200, boxed: true, gap: 0.22, ratio: 1.3 });
  return (
    <Root theme={theme}>
      <Backdrop theme={theme} photo={photo} />
      <Person photo={photo} height={1420} />
      <Shade theme={theme} where="bottom" />
      <Zoned zone={zone} justify="center" align="center">
        <TextLines lines={lines} align="center" theme={theme} mode="tape" gap={0.22} />
      </Zoned>
    </Root>
  );
}

function cita({ text, style, theme, photo }: Args) {
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
    <Root theme={theme}>
      <Backdrop theme={theme} photo={photo} anchorX={anchorX} />
      <Person photo={photo} height={1480} anchorX={anchorX} />
      <Shade theme={theme} where="left" />
      <Abs x={M - 10} y={300} w={400} h={300}>
        <div style={{ display: "flex", fontFamily: DISPLAY, fontSize: 380, lineHeight: 1, color: theme.accent }}>{"“"}</div>
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
        <div style={{ display: "flex", marginTop: 40, width: 90, height: 8, borderRadius: 4, background: theme.accent }} />
        <div style={{ display: "flex", marginTop: 22, fontSize: 38, fontWeight: 800, color: alpha("#ffffff", 0.85) }}>
          {style.brandHandle}
        </div>
      </Zoned>
    </Root>
  );
}

function split({ text, theme, photo }: Args) {
  const panelH = 800;
  const zone = { x: M, y: 250, w: W - 2 * M, h: 400 };
  const onAccent = contrastText(theme.accent);
  const lines = fitLines(tokens(text), zone, { maxSize: 220, boxed: true });
  return (
    <Root theme={theme}>
      <Backdrop theme={theme} photo={photo} photoTop={panelH} glow={theme.accent2} />
      <Abs h={panelH} style={{ background: theme.accent }} />
      <Person photo={photo} height={1300} />
      <Zoned zone={zone} justify="flex-end" align="flex-start">
        <TextLines
          lines={lines}
          align="flex-start"
          theme={theme}
          mode="box"
          color={onAccent}
          strongBg={theme.dark}
          strongColor={theme.accent}
        />
      </Zoned>
    </Root>
  );
}

function detras(args: Args) {
  const { text, theme, photo } = args;
  if (!photo?.cutout) return centro(args);
  const toks = tokens(text);
  const keyword = toks.filter((t) => t.strong).map((t) => ({ ...t, strong: false }));
  const rest = toks.filter((t) => !t.strong);
  const kwZone = { x: 40, y: 240, w: W - 80, h: 560 };
  const kwLines = fitLines(keyword, kwZone, { maxSize: 520, maxLines: 1 });
  // La cabeza tapa solo el tercio inferior de la palabra clave: sigue legible.
  const kwSize = kwLines[0]?.size || 300;
  const figureH = Math.min(1500, H - (kwZone.y + Math.round(kwSize * 0.68)));
  const restZone = { x: M, y: 1400, w: W - 2 * M, h: 260 };
  const restLines = rest.length ? fitLines(rest, restZone, { maxSize: 170 }) : [];
  return (
    <Root theme={theme}>
      <Backdrop theme={theme} photo={photo} />
      <Zoned zone={kwZone} justify="flex-start" align="center">
        <TextLines lines={kwLines} align="center" theme={theme} mode="color" color={theme.accent} />
      </Zoned>
      <Person photo={photo} height={figureH} />
      <Shade theme={theme} where="bottom" />
      {restLines.length ? (
        <Zoned zone={restZone} justify="center" align="center">
          <TextLines lines={restLines} align="center" theme={theme} mode="color" />
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
    fonts: fonts(),
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
