import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { chatJson, TEMP } from "@/lib/llm";
import { consumeQuota, quotaExceeded } from "@/lib/quota";
import {
  buildResearchContext,
  insertIdeas,
  lexicalFilter,
  ResearchError,
  type Idea,
  type PrevIdea,
  type ResearchModo,
} from "@/lib/researchContext";

export const maxDuration = 300;

/** Clasificador por IA: qué candidatas repiten la tesis de una idea previa. */
async function judgeDuplicates(candidatas: Idea[], previas: PrevIdea[]): Promise<Set<number>> {
  if (!previas.length || !candidatas.length) return new Set();
  try {
    const res = await chatJson<{ i: number; repite: number | null }[]>(
      "Eres un editor de contenido que detecta ideas repetidas. Dos ideas son la MISMA si defienden la misma tesis o resuelven el mismo dolor con el mismo argumento, aunque cambien las palabras, el formato o el número de la lista. NO son la misma si comparten tema pero la afirmación central es distinta.",
      `IDEAS YA EXISTENTES:\n${previas.map((p, n) => `${n}. ${p.tema}${p.tesis ? ` — ${p.tesis}` : ""}`).join("\n")}\n\nCANDIDATAS NUEVAS:\n${candidatas.map((c, n) => `${n}. ${c.tema}${c.tesis ? ` — ${c.tesis}` : ""}`).join("\n")}\n\nPara cada candidata devuelve el número de la idea existente que repite, o null si es nueva de verdad. Array JSON: [{"i": 0, "repite": 12 | null}, ...]`,
      { temperature: 0, maxTokens: 10000 }
    );
    return new Set(res.filter((r) => r && typeof r.repite === "number").map((r) => r.i));
  } catch {
    // Sin juez seguimos con el filtro léxico: mejor alguna repetida que ninguna idea.
    return new Set();
  }
}

/**
 * Búsqueda de ideas con la IA interna (respaldo). La vía principal es el MCP:
 * Claude lee el mismo contexto (lib/researchContext.ts) y guarda las ideas.
 */
export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { userId, clientId } = auth;
  try {
    const { pilar, source, ideaId } = await req.json().catch(() => ({}));
    const modo: ResearchModo =
      source === "comentarios" || source === "huecos" || source === "variantes" || source === "referentes"
        ? source
        : "web";

    const ctx = await buildResearchContext(clientId, { modo, pilar, ideaId });

    const quota = await consumeQuota(userId, "research");
    if (!quota.ok) return quotaExceeded(quota);

    const user = `${ctx.user}\n\nDevuelve un array JSON:\n${ctx.jsonSpec}`;

    // ————— Generar + quitar repetidas (filtro léxico + juez de la IA) —————
    // Si casi todo sale repetido, una segunda ronda con las rechazadas a la
    // vista: en un nicho estrecho el modelo vuelve a los mismos temas.
    const finales: Idea[] = [];
    const rechazadas: Idea[] = [];
    let repetidas = 0;
    let recibidas = 0;
    for (let ronda = 0; ronda < 2 && finales.length < ctx.objetivo; ronda++) {
      const faltan = ctx.objetivo - finales.length;
      const userRonda =
        ronda === 0
          ? user
          : user +
            `\n\nSEGUNDA RONDA. Estas candidatas se rechazaron por repetir ideas que ya existen:\n${rechazadas.map((c) => `- ${c.tema}${c.tesis ? ` — ${c.tesis}` : ""}`).join("\n")}\n${finales.length ? `Ya aceptadas en esta búsqueda (tampoco las repitas):\n${finales.map((c) => `- ${c.tema}`).join("\n")}\n` : ""}Propón ${faltan + 3} ideas sobre dolores y situaciones del cliente CLARAMENTE distintos de todo lo anterior. Mismo formato JSON.`;

      const raw = await chatJson<Idea[] | Record<string, unknown>>(ctx.system, userRonda, {
        temperature: TEMP.generacion + ronda * TEMP.escalonVariante,
        // 6-9 ideas con tesis y 3 ganchos cada una + lo que el modelo piensa con
        // un contexto largo: con 6000 se cortaba ("se quedó sin espacio").
        maxTokens: 16000,
      });
      // Algunos modelos envuelven el array ({"ideas": [...]}).
      const lista = Array.isArray(raw) ? raw : (Object.values(raw || {}).find(Array.isArray) as Idea[] | undefined) || [];
      const candidatas = lista.filter((i) => typeof i?.tema === "string" && i.tema.trim());
      recibidas += candidatas.length;

      const lex = lexicalFilter(candidatas, ctx.comparables, finales);
      repetidas += lex.repetidas.length;
      rechazadas.push(...lex.repetidas.map((r) => r.idea));

      const yaAceptadas: PrevIdea[] = finales.map((f, n) => ({ id: -1 - n, tema: f.tema, tesis: f.tesis || null, descartada: false }));
      const juez = await judgeDuplicates(lex.nuevas, [...ctx.comparables.slice(0, 80), ...yaAceptadas]);
      lex.nuevas.forEach((c, n) => {
        if (juez.has(n)) {
          repetidas++;
          rechazadas.push(c);
        } else if (finales.length < ctx.objetivo) finales.push(c);
      });
    }
    if (!recibidas) return fail(new Error("La IA no devolvió ideas. Inténtalo de nuevo."), 502);

    await insertIdeas(clientId, finales, {
      sources: ctx.sources,
      targetPilar: ctx.targetPilar,
      parentId: ctx.parent?.id ?? null,
      parentPilar: ctx.parent?.pilar ?? null,
    });

    return NextResponse.json({
      ok: true,
      count: finales.length,
      repetidas,
      webSearch: ctx.sources.length > 0,
      modo,
    });
  } catch (e) {
    if (e instanceof ResearchError) return fail(e, e.status);
    return fail(e);
  }
}
