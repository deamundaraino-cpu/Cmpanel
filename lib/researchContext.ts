// Contexto y guardado de la búsqueda de ideas, compartidos por el botón del
// panel (/api/research, que genera con la IA interna) y por el MCP (donde
// escribe Claude). Así las reglas de una buena idea viven en un solo sitio.

import { getSql, CommentRow, PostRow, ReferentePiezaRow } from "./db";
import { buildReferentesContext } from "./referentes";
import { getSettings } from "./settings";
import { buildBrandBrief } from "./brand";
import { getTavilyKey } from "./appSettings";
import { toPilar, type Pilar } from "./pilares";
import {
  ETAPAS,
  ETAPA_META,
  toEtapa,
  findDuplicate,
  seasonalContext,
  coverageMatrix,
  gaps,
  describeCoverage,
  type CoverageCell,
} from "./ideaSearch";

export type ResearchModo = "web" | "comentarios" | "huecos" | "variantes" | "referentes";

export const RESEARCH_MODOS: ResearchModo[] = ["web", "comentarios", "huecos", "variantes", "referentes"];

export function toModo(v: unknown): ResearchModo {
  return RESEARCH_MODOS.includes(v as ResearchModo) ? (v as ResearchModo) : "web";
}

export type Idea = {
  tema: string;
  tesis?: string;
  angulo?: string;
  ganchos?: string[];
  formato?: string;
  razon?: string;
  pilar?: string;
  etapa?: string;
  evidencia?: { tipo: string; detalle: string };
};

export type PrevIdea = { id: number; tema: string; tesis: string | null; descartada: boolean };

type ParentIdea = PrevIdea & { angulo: string | null; pilar: string | null; etapa: string | null; ganadora: boolean };

/** Error con el código HTTP que debe devolver la ruta. */
export class ResearchError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const PILAR_GUIDE: Record<Pilar, string> = {
  crecimiento:
    "CRECIMIENTO (visibilidad y alcance): opiniones e ideas contrarias sobre la industria, timing/tendencias del momento, polémica sana sobre prácticas del nicho (nunca contra personas), formatos virales, romper creencias y mitos. Objetivo: que gente nueva te descubra y te siga.",
  adoctrinamiento:
    "ADOCTRINAMIENTO (autoridad y comunidad): resultados propios y de clientes, casos de éxito, storytelling personal, contenido de vacío de conocimiento (mostrar lo que no saben que no saben), lives. Objetivo: que quien ya te sigue confíe en ti como referente.",
  conversion:
    "CONVERSIÓN (leads y ventas): piezas con UN CTA claro — captar leads con lead magnets, plantillas, invitaciones a eventos; o vender. Objetivo: convertir atención en datos o ventas, respetando la fase actual de la marca.",
};

// "formato" ya no vale como evidencia: justificaba el formato, no la idea.
export const VALID_EVIDENCE = new Set(["ganador", "comentarios", "audiencia", "conversacion", "tendencia", "momento", "referente"]);

type TavilyOpts = { includeDomains?: string[]; topic?: "general" | "news"; days?: number };

async function tavilySearch(
  key: string,
  query: string,
  opts: TavilyOpts = {}
): Promise<{ context: string; sources: string[] }> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: 6,
        include_answer: false,
        ...(opts.includeDomains ? { include_domains: opts.includeDomains } : {}),
        ...(opts.topic ? { topic: opts.topic } : {}),
        ...(opts.days ? { days: opts.days } : {}),
      }),
      // Una búsqueda colgada no puede frenar toda la generación.
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { context: "", sources: [] };
    const json = await res.json();
    const items = (json.results || []) as { title: string; url: string; content: string }[];
    return {
      context: items.map((r) => `- ${r.title}: ${r.content?.slice(0, 300)}`).join("\n"),
      sources: items.map((r) => r.url),
    };
  } catch {
    return { context: "", sources: [] };
  }
}

/**
 * Búsqueda web en dos frentes: conversaciones reales (foros, Reddit, YouTube),
 * donde está el lenguaje del cliente, y novedades del último mes para el timing.
 */
async function webResearch(niche: string, audience: string): Promise<{ context: string; sources: string[] }> {
  const key = await getTavilyKey();
  if (!key) return { context: "", sources: [] };
  const quien = audience ? audience.slice(0, 120) : niche;
  const [conv, news] = await Promise.all([
    tavilySearch(key, `problemas, dudas y quejas reales de ${quien} sobre ${niche}`, {
      includeDomains: ["reddit.com", "quora.com", "youtube.com", "forocoches.com", "forobeta.com"],
    }),
    tavilySearch(key, `${niche} novedades cambios`, { topic: "news", days: 30 }),
  ]);
  const partes = [];
  if (conv.context) partes.push(`CONVERSACIONES REALES (foros, Reddit, YouTube — lenguaje del cliente):\n${conv.context}`);
  if (news.context) partes.push(`NOVEDADES DEL ÚLTIMO MES en el nicho (para el timing):\n${news.context}`);
  return { context: partes.join("\n\n"), sources: [...conv.sources, ...news.sources] };
}

export type ResearchContext = {
  modo: ResearchModo;
  targetPilar: Pilar | null;
  parent: ParentIdea | null;
  /** Ideas previas con las que comparar duplicados (sin la idea madre). */
  comparables: PrevIdea[];
  objetivo: number;
  candidatas: number;
  sources: string[];
  niche: string;
  system: string;
  /** Datos + lo que hay que evitar + el pedido (sin el formato JSON). */
  user: string;
  /** Formato JSON que se espera de vuelta. */
  jsonSpec: string;
};

/**
 * Arma el contexto completo de una búsqueda de ideas: ficha de marca, voz de
 * la audiencia, comentarios, ganadores, cobertura pilar×etapa, temporada, lo
 * ya existente (para no repetir) y el pedido según el modo.
 * `web`: búsqueda Tavily. El MCP la apaga porque Claude busca por su cuenta.
 */
export async function buildResearchContext(
  clientId: number,
  opts: { modo: ResearchModo; pilar?: unknown; ideaId?: unknown; web?: boolean }
): Promise<ResearchContext> {
  const modo = opts.modo;
  const targetPilar: Pilar | null = modo === "web" ? toPilar(opts.pilar) : null;
  const sql = getSql();

  // Todas las lecturas a la vez: antes iban en fila, una tras otra.
  const [brief, s, previas, publicados, coverageRows, comments, winnersTop] = await Promise.all([
    buildBrandBrief(clientId),
    getSettings(clientId, ["brand_niche", "brand_audience", "audience_voice"]),
    sql<PrevIdea[]>`
      SELECT id, tema, tesis, descartada FROM ideas
      WHERE client_id = ${clientId} ORDER BY id DESC LIMIT 120
    `,
    sql<{ caption: string | null }[]>`
      SELECT caption FROM posts WHERE client_id = ${clientId} AND is_demo = 0 AND caption IS NOT NULL
      ORDER BY timestamp DESC LIMIT 25
    `,
    sql<{ pilar: string | null; etapa: string | null; usada: boolean }[]>`
      SELECT pilar, etapa, (usado_video OR usado_carrusel) AS usada FROM ideas
      WHERE client_id = ${clientId} AND NOT descartada AND etapa IS NOT NULL
    `,
    sql<(CommentRow & { caption: string | null })[]>`
      SELECT c.*, p.caption FROM comments c
      LEFT JOIN posts p ON p.client_id = c.client_id AND p.id = c.post_id
      WHERE c.client_id = ${clientId}
      ORDER BY c.like_count DESC, c.timestamp DESC
      LIMIT ${modo === "comentarios" ? 60 : 20}
    `,
    sql<PostRow[]>`
      SELECT * FROM posts WHERE client_id = ${clientId} AND is_winner = 1
      ORDER BY er DESC LIMIT 5
    `,
  ]);
  const niche = s.brand_niche || "marca personal y negocios digitales";
  const audienceVoice = (s.audience_voice || "").trim();
  const descartadas = previas.filter((p) => p.descartada).slice(0, 25);
  const vigentes = previas.filter((p) => !p.descartada).slice(0, 50);
  const cells = coverageMatrix(coverageRows);

  const bloques: string[] = [];
  let sources: string[] = [];
  let parent: ParentIdea | null = null;

  if (audienceVoice) {
    bloques.push(
      `VOZ DE LA AUDIENCIA (DMs, preguntas de llamadas de venta y objeciones que ha pegado el editor — lenguaje literal, la fuente más valiosa):\n${audienceVoice.slice(0, 4000)}`
    );
  }

  if (comments.length) {
    bloques.push(
      "COMENTARIOS REALES de la audiencia en tus posts (dolores y preguntas literales):\n" +
        comments
          .map((c) => `- "${(c.text || "").slice(0, 200)}"${c.caption ? ` (en post: ${c.caption.slice(0, 60)}…)` : ""}`)
          .join("\n")
    );
  }

  if (modo === "comentarios" && !comments.length && !audienceVoice) {
    throw new ResearchError(
      "No hay comentarios capturados ni voz de la audiencia. Pega DMs, preguntas de llamadas u objeciones en «🗣️ Voz de la audiencia» (Instagram no está entregando comentarios: revisa el modo de la app de Meta)."
    );
  }

  if (modo === "referentes") {
    const piezas = await sql<(ReferentePiezaRow & { handle: string })[]>`
      SELECT rp.*, r.handle FROM referente_piezas rp
      JOIN referentes r ON r.id = rp.referente_id
      WHERE rp.client_id = ${clientId} AND rp.analisis IS NOT NULL
      ORDER BY rp.id DESC LIMIT 60
    `;
    const ctx = buildReferentesContext(piezas);
    if (!ctx) {
      throw new ResearchError(
        "Todavía no hay piezas de referentes analizadas. Pega sus mejores posts en Referentes y analízalos primero."
      );
    }
    bloques.push(
      `PATRONES DE REFERENTES (cuentas que el editor sigue; ordenadas por cuánto superaron la media de su cuenta). Son PATRONES de gancho, estructura y formato — no temas para copiar:\n${ctx}`
    );
  }

  if (modo === "variantes") {
    const [row] = await sql<ParentIdea[]>`
      SELECT i.id, i.tema, i.tesis, i.descartada, i.angulo, i.pilar, i.etapa,
        EXISTS (
          SELECT 1 FROM proposals pr JOIN posts p ON p.client_id = pr.client_id AND p.id = pr.post_id
          WHERE pr.client_id = i.client_id AND pr.idea_id = i.id AND p.is_winner = 1
        ) AS ganadora
      FROM ideas i WHERE i.client_id = ${clientId} AND i.id = ${Number(opts.ideaId)}
    `;
    if (!row) throw new ResearchError("Idea no encontrada", 404);
    parent = row;
  } else if (modo !== "comentarios" && modo !== "referentes" && opts.web !== false) {
    const web = await webResearch(niche, s.brand_audience || "");
    if (web.context) bloques.push(web.context);
    sources = web.sources;
  }

  bloques.push(seasonalContext(new Date()));

  // ————— Datos reales de la cuenta: ganadores —————
  let winners = winnersTop;
  if (!winners.length) {
    winners = await sql<PostRow[]>`
      SELECT * FROM posts WHERE client_id = ${clientId} AND reach > 0
      ORDER BY er DESC LIMIT 3
    `;
  }
  if (winners.length) {
    bloques.push(
      "POSTS GANADORES de esta cuenta (engagement muy por encima de su media) — qué tema y qué tesis conectaron:\n" +
        winners
          .map(
            (p) =>
              `- "${(p.caption || "").slice(0, 160)}" (${p.media_product_type === "REELS" ? "reel" : p.media_type === "CAROUSEL_ALBUM" ? "carrusel" : "imagen"}, ER ${(p.er * 100).toFixed(2)}%)`
          )
          .join("\n")
    );
  }

  bloques.push(describeCoverage(cells));

  // ————— Qué pedir —————
  const objetivo = modo === "variantes" ? 4 : 6;
  const candidatas = modo === "variantes" ? 6 : 9;
  let pedido: string;
  if (parent) {
    pedido = `MÁS COMO ESTA. Esta idea ${parent.ganadora ? "se publicó y FUNCIONÓ (post ganador)" : "ya se convirtió en contenido"}:\n- ${parent.tema}${parent.tesis ? `\n- Tesis: ${parent.tesis}` : ""}${parent.angulo ? `\n- Ángulo: ${parent.angulo}` : ""}\n\nGenera ${candidatas} variantes que exploten el MISMO dolor de fondo con una tesis DISTINTA cada una. Varía al menos dos de estas cosas: el ángulo (caso propio / error / mito / paso a paso / comparación / predicción), la etapa del cliente (${ETAPAS.join(", ")}), el formato y el nivel de profundidad (introductorio vs avanzado). Ninguna puede ser la misma pieza reescrita.`;
  } else if (modo === "referentes") {
    pedido = `DESDE REFERENTES. Genera ${candidatas} ideas que apliquen a esta marca los PATRONES que mejor funcionaron en sus referentes (gancho, estructura, formato). Cada idea toma UN patrón y lo llena con una tesis PROPIA de la marca, nacida de su cliente ideal: nunca copies el tema, la tesis ni frases del referente. Reparte los 3 pilares y prioriza los huecos de la COBERTURA. En la evidencia usa tipo "referente" y nombra el @ y el patrón que adaptas.`;
  } else if (modo === "huecos") {
    const huecos = gaps(cells, 3);
    pedido = `LLENAR HUECOS. Genera ${candidatas} ideas repartidas entre estas combinaciones, que son las menos trabajadas:\n${huecos.map((c: CoverageCell) => `- Pilar ${c.pilar.toUpperCase()} · etapa ${c.etapa.toUpperCase()}. ${PILAR_GUIDE[c.pilar]} ${ETAPA_META[c.etapa].guia}`).join("\n")}`;
  } else if (targetPilar) {
    pedido = `Genera ${candidatas} ideas SOLO del pilar ${targetPilar.toUpperCase()}. Definición del pilar:\n${PILAR_GUIDE[targetPilar]}\nReparte las etapas del cliente y prioriza las menos cubiertas según la COBERTURA.`;
  } else {
    pedido = `Genera ${candidatas} ideas: 3 de CRECIMIENTO, 3 de ADOCTRINAMIENTO y 3 de CONVERSION. Prioriza las combinaciones pilar × etapa menos cubiertas según la COBERTURA. Definiciones:\n- ${PILAR_GUIDE.crecimiento}\n- ${PILAR_GUIDE.adoctrinamiento}\n- ${PILAR_GUIDE.conversion}`;
  }

  const evitar =
    (vigentes.length
      ? `\n\nIDEAS QUE YA EXISTEN — no repitas su tesis aunque cambies las palabras:\n${vigentes.map((p) => `- ${p.tema}`).join("\n")}`
      : "") +
    (descartadas.length
      ? `\n\nIDEAS QUE EL EDITOR DESCARTÓ («no me sirve») — evita su enfoque y lo que tengan en común:\n${descartadas.map((p) => `- ${p.tema}`).join("\n")}`
      : "") +
    (publicados.length
      ? `\n\nYA PUBLICADO en la cuenta — no lo repitas:\n${publicados.map((p) => `- ${(p.caption || "").replace(/\s+/g, " ").slice(0, 80)}`).join("\n")}`
      : "");

  const system = `Eres un estratega de contenido para Instagram que propone ideas con alto potencial, en español, alineadas con la identidad y el cliente ideal de la marca.

Reglas de una buena idea:
1. TESIS, no tema. "Síntomas de que necesitas un diagnóstico" es un tema (caben 20 posts). Una tesis es UNA afirmación concreta y discutible, con la que alguien podría no estar de acuerdo: "Si tu CPA se duplica al pasar de 30 a 60 USD/día, el problema no es el anuncio: tu oferta solo convence a la audiencia tibia".
2. Nace de una fuente: el lenguaje literal de la audiencia, una conversación real, un post ganador o el momento del año. Dilo en la evidencia con el dato concreto, no con una generalidad.
3. El FORMATO lo decide la idea, no las métricas: guion_video si pide cara, historia, opinión o emoción; carrusel si pide pasos, listas, comparaciones o datos para guardar.
4. Cada idea pertenece a UN pilar y a UNA etapa del cliente:
   - ${ETAPA_META.consciencia.guia}
   - ${ETAPA_META.consideracion.guia}
   - ${ETAPA_META.decision.guia}
5. Nada genérico que podría publicar cualquier cuenta del nicho.
6. Cada idea ataca un dolor DISTINTO. Antes de escribir, piensa qué dolores, decisiones y situaciones del cliente NO aparecen todavía en la lista de ideas existentes (operación, equipo, precio, oferta, retención, mentalidad, herramientas, tiempo, casos concretos…) y ve ahí.

Ficha de marca:
${brief}`;

  const jsonSpec = `[{"tema": "título corto de la idea", "tesis": "la afirmación concreta y discutible, 1 frase", "angulo": "el enfoque concreto (caso, error, mito, paso a paso…)", "ganchos": ["3 primeras frases posibles, distintas entre sí"], "formato": "carrusel|guion_video", "razon": "por qué ESTE formato para esta idea y por qué ahora (no repitas la evidencia)", "pilar": "crecimiento|adoctrinamiento|conversion", "etapa": "consciencia|consideracion|decision", "evidencia": {"tipo": "audiencia|comentarios|conversacion|ganador|tendencia|momento${modo === "referentes" ? "|referente" : ""}", "detalle": "el dato concreto en el que se basa, 1 frase"}}]`;

  return {
    modo,
    targetPilar,
    parent,
    comparables: previas.filter((p) => p.id !== parent?.id),
    objetivo,
    candidatas,
    sources,
    niche,
    system,
    user: bloques.join("\n\n") + evitar + `\n\n${pedido}`,
    jsonSpec,
  };
}

/**
 * Filtro léxico: separa las candidatas que casi repiten una idea previa (o a
 * otra del mismo lote). Devuelve, para cada rechazada, con qué idea choca.
 */
export function lexicalFilter(
  candidatas: Idea[],
  comparables: PrevIdea[],
  yaAceptadas: Idea[] = []
): { nuevas: Idea[]; repetidas: { idea: Idea; repite: { id: number | null; tema: string } }[] } {
  const nuevas: Idea[] = [];
  const repetidas: { idea: Idea; repite: { id: number | null; tema: string } }[] = [];
  for (const c of candidatas) {
    const previa = findDuplicate(c, comparables);
    if (previa) {
      repetidas.push({ idea: c, repite: { id: previa.id, tema: previa.tema } });
      continue;
    }
    const delLote = findDuplicate(c, [...yaAceptadas, ...nuevas]);
    if (delLote) {
      repetidas.push({ idea: c, repite: { id: null, tema: delLote.tema } });
      continue;
    }
    nuevas.push(c);
  }
  return { nuevas, repetidas };
}

/** Guarda ideas ya filtradas. Devuelve los ids creados. */
export async function insertIdeas(
  clientId: number,
  ideas: Idea[],
  opts: { sources?: string[]; targetPilar?: Pilar | null; parentId?: number | null; parentPilar?: string | null } = {}
): Promise<number[]> {
  if (!ideas.length) return [];
  const sql = getSql();
  const now = new Date().toISOString();
  const rows = ideas.map((idea) => {
    const ideaPilar = toPilar(idea.pilar) || opts.targetPilar || toPilar(opts.parentPilar) || "crecimiento";
    let evidencia: { tipo: string; detalle: string } | null = null;
    if (idea.evidencia?.tipo && VALID_EVIDENCE.has(idea.evidencia.tipo)) {
      evidencia = { tipo: idea.evidencia.tipo, detalle: String(idea.evidencia.detalle || "").slice(0, 200) };
    }
    const formato = idea.formato === "guion_video" || idea.formato === "reel" ? "guion_video" : "carrusel";
    const ganchos = Array.isArray(idea.ganchos)
      ? idea.ganchos.filter((g) => typeof g === "string" && g.trim()).slice(0, 3)
      : [];
    return {
      client_id: clientId,
      created_at: now,
      tema: String(idea.tema).slice(0, 300),
      tesis: idea.tesis ? String(idea.tesis).slice(0, 600) : null,
      angulo: idea.angulo ? String(idea.angulo).slice(0, 600) : null,
      ganchos: ganchos.length ? JSON.stringify(ganchos) : null,
      formato,
      razon: idea.razon ? String(idea.razon).slice(0, 800) : null,
      fuentes: JSON.stringify(opts.sources || []),
      pilar: ideaPilar,
      etapa: toEtapa(idea.etapa),
      evidencia: evidencia ? JSON.stringify(evidencia) : null,
      parent_id: opts.parentId ?? null,
    };
  });
  // Un solo INSERT para todo el lote.
  const inserted = await sql<{ id: number }[]>`INSERT INTO ideas ${sql(rows)} RETURNING id`;
  return inserted.map((r) => r.id);
}
