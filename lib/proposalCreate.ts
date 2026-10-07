import { getSql, StructureRow, StructureBeat } from "./db";
import { chatJson, TEMP } from "./llm";
import { buildBrandBrief, getBrandBanned, getBrandDesign } from "./brand";
import { enforceBrandRules, parseBannedRules, violationsNote } from "./brandRules";
import { buildExamplesBlock } from "./brandExamples";
import { brandCoverLayouts } from "./brandDesign";
import { buildScriptPrompts, sanitizeGuide, sectionRange, sectionCountViolations } from "./scriptPrompt";
import { buildCarouselPrompts } from "./carouselPrompt";
import { recentPieces, buildAvoidBlock, repetitionViolations } from "./diversity";
import { pickHookFamilies, hookFamilyInstruction } from "./angles";
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

/** Ficha, reglas y corrector de la marca: comunes a carrusel y guion. */
async function brandKit(clientId: number) {
  const brief = await buildBrandBrief(clientId);
  const coverLayouts = brandCoverLayouts(await getBrandDesign(clientId));
  const banned = parseBannedRules(await getBrandBanned(clientId));
  // El corrector trabaja con la misma ficha (que ya incluye el manual de la marca).
  const repairSystem = `Eres un editor que corrige textos para que cumplan las reglas inviolables de la marca, sin cambiar lo que ya funciona ni el idioma local.\n\nFicha de marca:\n${brief}`;
  return { brief, coverLayouts, banned, repairSystem };
}

/** Genera un carrusel. La cuota la consume quien llama. */
export async function createCarousel(ctx: GenCtx): Promise<Created> {
  const { clientId } = ctx;
  const sql = getSql();
  const { brief, coverLayouts, banned, repairSystem } = await brandKit(clientId);

  const ejemplos = await buildExamplesBlock(clientId, "carrusel");
  // Lo que la marca ya publicó: entra al prompt en negativo y se vuelve a
  // comprobar sobre la pieza generada, porque el modelo se salta el aviso.
  const previas = await recentPieces(clientId, "carrusel");
  const [familia] = pickHookFamilies(previas.map((p) => p.familia ?? null), 1);
  const prompts = buildCarouselPrompts({
    brief,
    ejemplos,
    contexto: ctx.context,
    coverLayouts,
    evitar: buildAvoidBlock(previas),
    angulo: hookFamilyInstruction(familia),
  });
  const gen = await chatJson<CarouselGen>(prompts.system, prompts.user, { temperature: TEMP.generacion });
  if (!gen.slides?.length) throw new GenError("La IA no devolvió slides");
  const checked = await enforceBrandRules(gen, banned, repairSystem, [(g) => repetitionViolations(g, previas)]);
  const q = clampQuality(checked.gen.calidad);
  const notes = [q.notes, violationsNote(checked.violations)].filter(Boolean).join(" · ") || null;
  // Un error factual o de compliance que sobrevive a la reparación no se
  // publica: queda bloqueado para revisión.
  const estado = checked.blocked ? "bloqueada" : "pendiente";

  const [row] = await sql<{ id: number }[]>`
    INSERT INTO proposals (client_id, post_id, created_at, status, formato, slides, caption, hashtags, structure_id, quality, quality_notes, pilar, idea_id, hook_family, origen)
    VALUES (${clientId}, ${ctx.sourcePostId}, ${new Date().toISOString()}, ${estado}, 'carrusel',
      ${JSON.stringify(applyCoverLayout(checked.gen, coverLayouts))}, ${checked.gen.caption || ""}, ${JSON.stringify(checked.gen.hashtags || [])},
      NULL, ${q.score}, ${notes}, ${ctx.pilarRef}, ${ctx.ideaRef}, ${familia.id}, ${ctx.origen ?? null})
    RETURNING id
  `;
  if (ctx.ideaRef) await sql`UPDATE ideas SET usado_carrusel = TRUE WHERE id = ${ctx.ideaRef} AND client_id = ${clientId}`;
  return { id: row.id, slides: checked.gen.slides.length, bloqueada: checked.blocked, avisos: checked.violations };
}

/**
 * Genera hasta `maxVariantes` guiones del mismo tema, cada uno con una familia
 * de gancho distinta. La primera operación de cuota la consume quien llama;
 * las variantes extra se cobran aquí y solo si la cuota da.
 */
export async function createScripts(
  ctx: GenCtx & { structureId: number; maxVariantes?: number }
): Promise<Created[]> {
  const { clientId, userId } = ctx;
  const sql = getSql();
  // Las estructuras son la librería del EDITOR (compartida entre sus clientes).
  const structures = await sql<StructureRow[]>`
    SELECT * FROM structures
    WHERE id = ${Number(ctx.structureId)} AND (user_id = ${userId} OR user_id IS NULL)
      AND (client_id IS NULL OR client_id = ${clientId})
  `;
  const structure = structures[0];
  if (!structure) throw new GenError("Estructura no encontrada", 404);

  const { brief, banned, repairSystem } = await brandKit(clientId);
  // Una estructura puede arrastrar frases que esta marca prohíbe: se limpian
  // antes de pedirle nada al modelo.
  const beats = sanitizeGuide(JSON.parse(structure.beats) as StructureBeat[], banned);

  const ejemplos = await buildExamplesBlock(clientId, "guion_video");
  const previas = await recentPieces(clientId, "guion_video");
  const evitar = buildAvoidBlock(previas);
  const fallbackNames = beats.map((b) => b.nombre);
  const rango = sectionRange(beats);

  // Dos versiones del mismo tema, cada una por una familia de gancho distinta:
  // es la forma más directa de romper la convergencia. La segunda solo si la
  // cuota da — mejor entregar una pieza que devolver un error.
  let cuantas = 1;
  for (let i = 1; i < (ctx.maxVariantes ?? 2); i++) {
    if (!(await consumeQuota(userId, "proposal")).ok) break;
    cuantas++;
  }
  const familias = pickHookFamilies(previas.map((p) => p.familia ?? null), cuantas);

  const variantes = await Promise.all(
    familias.map(async (familia, i) => {
      const prompts = buildScriptPrompts({
        brief,
        ejemplos,
        contexto: ctx.context,
        beats,
        evitar,
        angulo: hookFamilyInstruction(familia),
      });
      const gen = await chatJson<ScriptGen>(prompts.system, prompts.user, {
        temperature: TEMP.generacion + i * TEMP.escalonVariante,
      });
      if (!gen.beats?.length) return null;
      gen.beats = normalizeBeats(gen.beats, fallbackNames);
      if (!gen.beats.length) return null;
      const checked = await enforceBrandRules(gen, banned, repairSystem, [
        (g) => repetitionViolations(g, previas),
        (g) => sectionCountViolations(g, rango),
      ]);
      return { familia, checked };
    })
  );

  const utiles = variantes.filter((v): v is NonNullable<typeof v> => !!v);
  if (!utiles.length) throw new GenError("La IA no devolvió el guion");

  const creadas: Created[] = [];
  for (const { familia, checked } of utiles) {
    const q = clampQuality(checked.gen.calidad);
    const notes = [q.notes, violationsNote(checked.violations)].filter(Boolean).join(" · ") || null;
    const estado = checked.blocked ? "bloqueada" : "pendiente";
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO proposals (client_id, post_id, created_at, status, formato, slides, caption, hashtags, structure_id, quality, quality_notes, pilar, idea_id, hook_family, origen)
      VALUES (${clientId}, ${ctx.sourcePostId}, ${new Date().toISOString()}, ${estado}, 'guion_video',
        ${JSON.stringify(applyCoverTexts(checked.gen))}, ${checked.gen.caption || ""}, ${JSON.stringify(checked.gen.hashtags || [])},
        ${structure.id}, ${q.score}, ${notes}, ${ctx.pilarRef}, ${ctx.ideaRef}, ${familia.id}, ${ctx.origen ?? null})
      RETURNING id
    `;
    creadas.push({ id: row.id, familia: familia.nombre, bloqueada: checked.blocked, avisos: checked.violations });
  }

  if (ctx.ideaRef) await sql`UPDATE ideas SET usado_video = TRUE WHERE id = ${ctx.ideaRef} AND client_id = ${clientId}`;
  return creadas;
}
