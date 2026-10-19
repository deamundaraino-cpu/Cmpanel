import { getSql, PostRow, StructureRow, StructureBeat } from "./db";
import { chatJson, TEMP } from "./llm";
import { buildBrandBrief, getBrandBanned, getBrandDesign } from "./brand";
import { enforceBrandRules, checkPiece, isBlocking, parseBannedRules, violationsNote, type BannedRule, type Violation } from "./brandRules";
import { buildExamplesBlock } from "./brandExamples";
import { brandCoverLayouts, type CoverLayout } from "./brandDesign";
import { buildScriptPrompts, sanitizeGuide, sectionRange, sectionCountViolations } from "./scriptPrompt";
import { buildCarouselPrompts } from "./carouselPrompt";
import { recentPieces, buildAvoidBlock, repetitionViolations, type PreviousPiece } from "./diversity";
import { pickHookFamilies, hookFamilyInstruction, familyById, type HookFamily } from "./angles";
import { buildIdeaContext, type IdeaSource } from "./ideaContext";
import { toPilar } from "./pilares";
import {
  CarouselGen,
  ScriptGen,
  clampQuality,
  applyCoverLayout,
  applyCoverTexts,
  normalizeBeats,
} from "./proposalGen";
import { consumeQuota } from "./quota";

/** Error con el código HTTP que debe devolver la ruta. */
export class GenError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

/** Todo lo que necesita la generación, ya validado por la ruta que llama. */
export type GenCtx = {
  userId: string;
  clientId: number;
  /** Materia prima: post ganador, idea del panel o tema suelto (ver describeSource). */
  context: string;
  sourcePostId: string | null;
  pilarRef: string | null;
  ideaRef: number | null;
  /** 'exprimir' cuando la pieza nace de exprimir un ganador; null en el flujo normal. */
  origen?: string | null;
};

export type Created = { id: number; familia?: string; slides?: number; bloqueada: boolean; avisos: unknown };

// ————— Punto de partida de una pieza —————

/**
 * De dónde sale la pieza: un post ganador, una idea del panel o un tema suelto.
 * La idea y el post se leen de la BD del cliente (nunca se confía en el texto
 * que manda quien llama): ahí están el ángulo y la evidencia.
 */
export async function resolvePieceSource(
  clientId: number,
  opts: { postId?: unknown; tema?: unknown; ideaId?: unknown; pilar?: unknown }
): Promise<{ context: string; sourcePostId: string | null; ideaRef: number | null; pilarRef: string | null }> {
  const sql = getSql();
  let ideaRef: number | null = null;
  let pilarRef: string | null = null;
  let idea: IdeaSource | null = null;
  if (opts.ideaId) {
    const [row] = await sql<(IdeaSource & { id: number; pilar: string | null })[]>`
      SELECT id, pilar, tema, tesis, angulo, razon, evidencia, ganchos FROM ideas
      WHERE client_id = ${clientId} AND id = ${Number(opts.ideaId)}
    `;
    if (!row) throw new GenError("Idea no encontrada", 404);
    ideaRef = row.id;
    pilarRef = toPilar(row.pilar);
    idea = row;
  }
  if (!pilarRef) pilarRef = toPilar(opts.pilar);

  if (opts.postId) {
    const [post] = await sql<PostRow[]>`
      SELECT * FROM posts WHERE client_id = ${clientId} AND id = ${String(opts.postId)}
    `;
    if (!post) throw new GenError("Post no encontrado", 404);
    return {
      sourcePostId: post.id,
      ideaRef,
      pilarRef,
      context: `Este post fue un GANADOR en Instagram (nota ${post.score}/10, alcance ${post.reach}, ${post.saved} guardados, ${post.shares} compartidos):\n\nCaption original:\n"""${(post.caption || "").slice(0, 800)}"""\n\nParte de esta misma idea/tema, pero elévala con un ángulo fresco (no copies el caption).`,
    };
  }
  if (idea) return { sourcePostId: null, ideaRef, pilarRef, context: buildIdeaContext(idea) };
  if (typeof opts.tema === "string" && opts.tema.trim()) {
    return {
      sourcePostId: null,
      ideaRef,
      pilarRef,
      context: `Este es el tema/idea de partida:\n"""${opts.tema.slice(0, 1200)}"""`,
    };
  }
  throw new GenError("Falta postId, ideaId o tema", 400);
}

/** Ficha, reglas y corrector de la marca: comunes a carrusel y guion. */
async function brandKit(clientId: number) {
  const [brief, design, bannedRaw] = await Promise.all([
    buildBrandBrief(clientId),
    getBrandDesign(clientId),
    getBrandBanned(clientId),
  ]);
  const coverLayouts = brandCoverLayouts(design);
  const banned = parseBannedRules(bannedRaw);
  // El corrector trabaja con la misma ficha (que ya incluye el manual de la marca).
  const repairSystem = `Eres un editor que corrige textos para que cumplan las reglas inviolables de la marca, sin cambiar lo que ya funciona ni el idioma local.\n\nFicha de marca:\n${brief}`;
  return { brief, coverLayouts, banned, repairSystem };
}

// ————— Kits: instrucciones + chequeos de una pieza —————

export type CarouselKit = {
  system: string;
  user: string;
  familia: HookFamily;
  previas: PreviousPiece[];
  coverLayouts: CoverLayout[];
  banned: BannedRule[];
  repairSystem: string;
};

/** Instrucciones del carrusel (las mismas que recibe la IA interna) y lo necesario para validarlo. */
export async function prepareCarousel(
  clientId: number,
  context: string,
  opts: { familiaId?: string | null; excludeId?: number } = {}
): Promise<CarouselKit> {
  const [{ brief, coverLayouts, banned, repairSystem }, ejemplos, previas] = await Promise.all([
    brandKit(clientId),
    buildExamplesBlock(clientId, "carrusel"),
    // Lo que la marca ya publicó: entra al prompt en negativo y se vuelve a
    // comprobar sobre la pieza generada, porque el modelo se salta el aviso.
    recentPieces(clientId, "carrusel", opts.excludeId),
  ]);
  const familia = familyById(opts.familiaId) ?? pickHookFamilies(previas.map((p) => p.familia ?? null), 1)[0];
  const { system, user } = buildCarouselPrompts({
    brief,
    ejemplos,
    contexto: context,
    coverLayouts,
    evitar: buildAvoidBlock(previas),
    angulo: hookFamilyInstruction(familia),
  });
  return { system, user, familia, previas, coverLayouts, banned, repairSystem };
}

export function carouselChecks(kit: Pick<CarouselKit, "previas">) {
  return [(g: unknown) => repetitionViolations(g, kit.previas)];
}

export type ScriptKit = {
  system: string;
  user: string;
  familias: HookFamily[];
  previas: PreviousPiece[];
  banned: BannedRule[];
  repairSystem: string;
  structure: StructureRow;
  fallbackNames: string[];
  rango: { min: number; max: number };
  /** Builder para pedir una variante con otra familia de gancho. */
  promptFor: (f: HookFamily) => { system: string; user: string };
};

/** Instrucciones del guion para una estructura (librería del editor + base globales). */
export async function prepareScript(
  userId: string,
  clientId: number,
  structureId: number,
  context: string,
  opts: { variantes?: number; familiaId?: string | null; excludeId?: number } = {}
): Promise<ScriptKit> {
  const sql = getSql();
  const [structures, { brief, banned, repairSystem }, ejemplos, previas] = await Promise.all([
    sql<StructureRow[]>`
      SELECT * FROM structures
      WHERE id = ${Number(structureId)} AND (user_id = ${userId} OR user_id IS NULL)
        AND (client_id IS NULL OR client_id = ${clientId})
    `,
    brandKit(clientId),
    buildExamplesBlock(clientId, "guion_video"),
    recentPieces(clientId, "guion_video", opts.excludeId),
  ]);
  const structure = structures[0];
  if (!structure) throw new GenError("Estructura no encontrada", 404);
  // Una estructura puede arrastrar frases que esta marca prohíbe: se limpian
  // antes de pedirle nada al modelo.
  const beats = sanitizeGuide(JSON.parse(structure.beats) as StructureBeat[], banned);
  const evitar = buildAvoidBlock(previas);
  const forzada = familyById(opts.familiaId);
  const familias = forzada
    ? [forzada]
    : pickHookFamilies(previas.map((p) => p.familia ?? null), Math.max(1, opts.variantes ?? 1));
  const promptFor = (f: HookFamily) =>
    buildScriptPrompts({ brief, ejemplos, contexto: context, beats, evitar, angulo: hookFamilyInstruction(f) });
  const first = promptFor(familias[0]);
  return {
    ...first,
    familias,
    previas,
    banned,
    repairSystem,
    structure,
    fallbackNames: beats.map((b) => b.nombre),
    rango: sectionRange(beats),
    promptFor,
  };
}

export function scriptChecks(kit: Pick<ScriptKit, "previas" | "rango">) {
  return [(g: unknown) => repetitionViolations(g, kit.previas), (g: unknown) => sectionCountViolations(g, kit.rango)];
}

// ————— Guardado —————

async function markIdeaUsed(clientId: number, ideaRef: number | null, formato: "carrusel" | "guion_video") {
  if (!ideaRef) return;
  const sql = getSql();
  if (formato === "carrusel") await sql`UPDATE ideas SET usado_carrusel = TRUE WHERE id = ${ideaRef} AND client_id = ${clientId}`;
  else await sql`UPDATE ideas SET usado_video = TRUE WHERE id = ${ideaRef} AND client_id = ${clientId}`;
}

/** Guarda un carrusel ya revisado. Un error crítico que sobrevive lo deja bloqueado. */
export async function saveCarousel(
  ctx: GenCtx,
  gen: CarouselGen,
  kit: Pick<CarouselKit, "coverLayouts">,
  familiaId: string | null,
  violations: Violation[]
): Promise<Created> {
  const sql = getSql();
  const q = clampQuality(gen.calidad);
  const notes = [q.notes, violationsNote(violations)].filter(Boolean).join(" · ") || null;
  const blocked = isBlocking(violations);
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO proposals (client_id, post_id, created_at, status, formato, slides, caption, hashtags, structure_id, quality, quality_notes, pilar, idea_id, hook_family, origen)
    VALUES (${ctx.clientId}, ${ctx.sourcePostId}, ${new Date().toISOString()}, ${blocked ? "bloqueada" : "pendiente"}, 'carrusel',
      ${JSON.stringify(applyCoverLayout(gen, kit.coverLayouts))}, ${gen.caption || ""}, ${JSON.stringify(gen.hashtags || [])},
      NULL, ${q.score}, ${notes}, ${ctx.pilarRef}, ${ctx.ideaRef}, ${familiaId}, ${ctx.origen ?? null})
    RETURNING id
  `;
  await markIdeaUsed(ctx.clientId, ctx.ideaRef, "carrusel");
  return { id: row.id, slides: gen.slides.length, bloqueada: blocked, avisos: violations };
}

/** Guarda un guion ya revisado. */
export async function saveScript(
  ctx: GenCtx,
  gen: ScriptGen,
  structureId: number,
  familiaId: string | null,
  violations: Violation[]
): Promise<Created> {
  const sql = getSql();
  const q = clampQuality(gen.calidad);
  const notes = [q.notes, violationsNote(violations)].filter(Boolean).join(" · ") || null;
  const blocked = isBlocking(violations);
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO proposals (client_id, post_id, created_at, status, formato, slides, caption, hashtags, structure_id, quality, quality_notes, pilar, idea_id, hook_family, origen)
    VALUES (${ctx.clientId}, ${ctx.sourcePostId}, ${new Date().toISOString()}, ${blocked ? "bloqueada" : "pendiente"}, 'guion_video',
      ${JSON.stringify(applyCoverTexts(gen))}, ${gen.caption || ""}, ${JSON.stringify(gen.hashtags || [])},
      ${structureId}, ${q.score}, ${notes}, ${ctx.pilarRef}, ${ctx.ideaRef}, ${familiaId}, ${ctx.origen ?? null})
    RETURNING id
  `;
  await markIdeaUsed(ctx.clientId, ctx.ideaRef, "guion_video");
  return { id: row.id, familia: familyById(familiaId)?.nombre, bloqueada: blocked, avisos: violations };
}

/** Normaliza y revisa un guion recibido (de la IA interna o de Claude por MCP). */
export function reviewScript(gen: ScriptGen, kit: Pick<ScriptKit, "banned" | "previas" | "rango" | "fallbackNames">) {
  const limpio: ScriptGen = { ...gen, beats: normalizeBeats(gen.beats, kit.fallbackNames) };
  return { gen: limpio, violations: checkPiece(limpio, kit.banned, scriptChecks(kit)) };
}

/** Revisa un carrusel recibido. */
export function reviewCarousel(gen: CarouselGen, kit: Pick<CarouselKit, "banned" | "previas">) {
  return { gen, violations: checkPiece(gen, kit.banned, carouselChecks(kit)) };
}

// ————— Generación con la IA interna (respaldo del panel) —————

/** Genera un carrusel. La cuota la consume quien llama. */
export async function createCarousel(ctx: GenCtx): Promise<Created> {
  const kit = await prepareCarousel(ctx.clientId, ctx.context);
  const gen = await chatJson<CarouselGen>(kit.system, kit.user, { temperature: TEMP.generacion });
  if (!gen.slides?.length) throw new GenError("La IA no devolvió slides");
  const checked = await enforceBrandRules(gen, kit.banned, kit.repairSystem, carouselChecks(kit));
  return saveCarousel(ctx, checked.gen, kit, kit.familia.id, checked.violations);
}

/**
 * Genera hasta `maxVariantes` guiones del mismo tema, cada uno con una familia
 * de gancho distinta. La primera operación de cuota la consume quien llama;
 * las variantes extra se cobran aquí y solo si la cuota da.
 */
export async function createScripts(
  ctx: GenCtx & { structureId: number; maxVariantes?: number }
): Promise<Created[]> {
  // Dos versiones del mismo tema, cada una por una familia de gancho distinta:
  // es la forma más directa de romper la convergencia. La segunda solo si la
  // cuota da — mejor entregar una pieza que devolver un error.
  let cuantas = 1;
  for (let i = 1; i < (ctx.maxVariantes ?? 2); i++) {
    if (!(await consumeQuota(ctx.userId, "proposal")).ok) break;
    cuantas++;
  }
  const kit = await prepareScript(ctx.userId, ctx.clientId, ctx.structureId, ctx.context, { variantes: cuantas });

  const variantes = await Promise.all(
    kit.familias.map(async (familia, i) => {
      const prompts = kit.promptFor(familia);
      const gen = await chatJson<ScriptGen>(prompts.system, prompts.user, {
        temperature: TEMP.generacion + i * TEMP.escalonVariante,
      });
      if (!gen.beats?.length) return null;
      gen.beats = normalizeBeats(gen.beats, kit.fallbackNames);
      if (!gen.beats.length) return null;
      const checked = await enforceBrandRules(gen, kit.banned, kit.repairSystem, scriptChecks(kit));
      return { familia, checked };
    })
  );

  const utiles = variantes.filter((v): v is NonNullable<typeof v> => !!v);
  if (!utiles.length) throw new GenError("La IA no devolvió el guion");

  const creadas: Created[] = [];
  for (const { familia, checked } of utiles) {
    creadas.push(await saveScript(ctx, checked.gen, kit.structure.id, familia.id, checked.violations));
  }
  return creadas;
}
