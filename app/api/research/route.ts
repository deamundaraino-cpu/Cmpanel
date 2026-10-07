import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import { getSql, CommentRow, PostRow, ReferentePiezaRow } from "@/lib/db";
import { buildReferentesContext } from "@/lib/referentes";
import { chatJson, TEMP } from "@/lib/llm";
import { getSettings } from "@/lib/settings";
import { buildBrandBrief } from "@/lib/brand";
import { consumeQuota, quotaExceeded } from "@/lib/quota";
import { getTavilyKey } from "@/lib/appSettings";
import { toPilar, type Pilar } from "@/lib/pilares";
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
} from "@/lib/ideaSearch";

export const maxDuration = 300;

type Idea = {
  tema: string;
  tesis?: string;
  angulo: string;
  ganchos?: string[];
  formato: string;
  razon: string;
  pilar: string;
  etapa?: string;
  evidencia?: { tipo: string; detalle: string };
};

type PrevIdea = { id: number; tema: string; tesis: string | null; descartada: boolean };

const PILAR_GUIDE: Record<Pilar, string> = {
  crecimiento:
    "CRECIMIENTO (visibilidad y alcance): opiniones e ideas contrarias sobre la industria, timing/tendencias del momento, polémica sana sobre prácticas del nicho (nunca contra personas), formatos virales, romper creencias y mitos. Objetivo: que gente nueva te descubra y te siga.",
  adoctrinamiento:
    "ADOCTRINAMIENTO (autoridad y comunidad): resultados propios y de clientes, casos de éxito, storytelling personal, contenido de vacío de conocimiento (mostrar lo que no saben que no saben), lives. Objetivo: que quien ya te sigue confíe en ti como referente.",
  conversion:
    "CONVERSIÓN (leads y ventas): piezas con UN CTA claro — captar leads con lead magnets, plantillas, invitaciones a eventos; o vender. Objetivo: convertir atención en datos o ventas, respetando la fase actual de la marca.",
};

// "formato" ya no vale como evidencia: justificaba el formato, no la idea.
const VALID_EVIDENCE = new Set(["ganador", "comentarios", "audiencia", "conversacion", "tendencia", "momento", "referente"]);

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
 * donde está el lenguaje del cliente, y novedades del último mes para el
 * timing. Antes era una sola consulta de "tendencias del nicho" que devolvía
 * blogs SEO que ya ha leído todo el sector.
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

export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const { userId, clientId } = auth;
  try {
    const { pilar, source, ideaId } = await req.json().catch(() => ({}));
    const modo: "web" | "comentarios" | "huecos" | "variantes" | "referentes" =
      source === "comentarios" || source === "huecos" || source === "variantes" || source === "referentes"
        ? source
        : "web";
    const targetPilar: Pilar | null = modo === "web" ? toPilar(pilar) : null;
    const sql = getSql();
    const brief = await buildBrandBrief(clientId);
    const s = await getSettings(clientId, ["brand_niche", "brand_audience", "audience_voice"]);
    const niche = s.brand_niche || "marca personal y negocios digitales";
    const audienceVoice = (s.audience_voice || "").trim();

    // ————— Lo que ya existe: para no repetir —————
    const previas = await sql<PrevIdea[]>`
      SELECT id, tema, tesis, descartada FROM ideas
      WHERE client_id = ${clientId} ORDER BY id DESC LIMIT 120
    `;
    const publicados = await sql<{ caption: string | null }[]>`
      SELECT caption FROM posts WHERE client_id = ${clientId} AND is_demo = 0 AND caption IS NOT NULL
      ORDER BY timestamp DESC LIMIT 25
    `;
    const descartadas = previas.filter((p) => p.descartada).slice(0, 25);
    const vigentes = previas.filter((p) => !p.descartada).slice(0, 50);

    // ————— Mapa de huecos: pilar × etapa —————
    const coverageRows = await sql<{ pilar: string | null; etapa: string | null; usada: boolean }[]>`
      SELECT pilar, etapa, (usado_video OR usado_carrusel) AS usada FROM ideas
      WHERE client_id = ${clientId} AND NOT descartada AND etapa IS NOT NULL
    `;
    const cells = coverageMatrix(coverageRows);

    // ————— Fuentes —————
    const bloques: string[] = [];
    let sources: string[] = [];
    let parent: (PrevIdea & { angulo: string | null; pilar: string | null; etapa: string | null; ganadora: boolean }) | null = null;

    if (audienceVoice) {
      bloques.push(
        `VOZ DE LA AUDIENCIA (DMs, preguntas de llamadas de venta y objeciones que ha pegado el editor — lenguaje literal, la fuente más valiosa):\n${audienceVoice.slice(0, 4000)}`
      );
    }

    const comments = await sql<(CommentRow & { caption: string | null })[]>`
      SELECT c.*, p.caption FROM comments c
      LEFT JOIN posts p ON p.client_id = c.client_id AND p.id = c.post_id
      WHERE c.client_id = ${clientId}
      ORDER BY c.like_count DESC, c.timestamp DESC
      LIMIT ${modo === "comentarios" ? 60 : 20}
    `;
    if (comments.length) {
      bloques.push(
        "COMENTARIOS REALES de la audiencia en tus posts (dolores y preguntas literales):\n" +
          comments
            .map((c) => `- "${(c.text || "").slice(0, 200)}"${c.caption ? ` (en post: ${c.caption.slice(0, 60)}…)` : ""}`)
            .join("\n")
      );
    }

    if (modo === "comentarios" && !comments.length && !audienceVoice) {
      return fail(
        new Error(
          "No hay comentarios capturados ni voz de la audiencia. Pega DMs, preguntas de llamadas u objeciones en «🗣️ Voz de la audiencia» (Instagram no está entregando comentarios: revisa el modo de la app de Meta)."
        ),
        400
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
        return fail(
          new Error("Todavía no hay piezas de referentes analizadas. Pega sus mejores posts en Referentes y pulsa «Analizar con IA»."),
          400
        );
      }
      bloques.push(
        `PATRONES DE REFERENTES (cuentas que el editor sigue; ordenadas por cuánto superaron la media de su cuenta). Son PATRONES de gancho, estructura y formato — no temas para copiar:\n${ctx}`
      );
    }

    if (modo === "variantes") {
      const [row] = await sql<
        (PrevIdea & { angulo: string | null; pilar: string | null; etapa: string | null; ganadora: boolean })[]
      >`
        SELECT i.id, i.tema, i.tesis, i.descartada, i.angulo, i.pilar, i.etapa,
          EXISTS (
            SELECT 1 FROM proposals pr JOIN posts p ON p.client_id = pr.client_id AND p.id = pr.post_id
            WHERE pr.client_id = i.client_id AND pr.idea_id = i.id AND p.is_winner = 1
          ) AS ganadora
        FROM ideas i WHERE i.client_id = ${clientId} AND i.id = ${Number(ideaId)}
      `;
      if (!row) return fail(new Error("Idea no encontrada"), 404);
      parent = row;
    } else if (modo !== "comentarios" && modo !== "referentes") {
      const web = await webResearch(niche, s.brand_audience || "");
      if (web.context) bloques.push(web.context);
      sources = web.sources;
    }

    bloques.push(seasonalContext(new Date()));

    // ————— Datos reales de la cuenta: ganadores —————
    let winners = await sql<PostRow[]>`
      SELECT * FROM posts WHERE client_id = ${clientId} AND is_winner = 1
      ORDER BY er DESC LIMIT 5
    `;
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

    const quota = await consumeQuota(userId, "research");
    if (!quota.ok) return quotaExceeded(quota);

    // ————— Qué pedir —————
    const OBJETIVO = modo === "variantes" ? 4 : 6;
    const CANDIDATAS = modo === "variantes" ? 6 : 9;
    let pedido: string;
    if (parent) {
      pedido = `MÁS COMO ESTA. Esta idea ${parent.ganadora ? "se publicó y FUNCIONÓ (post ganador)" : "ya se convirtió en contenido"}:\n- ${parent.tema}${parent.tesis ? `\n- Tesis: ${parent.tesis}` : ""}${parent.angulo ? `\n- Ángulo: ${parent.angulo}` : ""}\n\nGenera ${CANDIDATAS} variantes que exploten el MISMO dolor de fondo con una tesis DISTINTA cada una. Varía al menos dos de estas cosas: el ángulo (caso propio / error / mito / paso a paso / comparación / predicción), la etapa del cliente (${ETAPAS.join(", ")}), el formato y el nivel de profundidad (introductorio vs avanzado). Ninguna puede ser la misma pieza reescrita.`;
    } else if (modo === "referentes") {
      pedido = `DESDE REFERENTES. Genera ${CANDIDATAS} ideas que apliquen a esta marca los PATRONES que mejor funcionaron en sus referentes (gancho, estructura, formato). Cada idea toma UN patrón y lo llena con una tesis PROPIA de la marca, nacida de su cliente ideal: nunca copies el tema, la tesis ni frases del referente. Reparte los 3 pilares y prioriza los huecos de la COBERTURA. En la evidencia usa tipo "referente" y nombra el @ y el patrón que adaptas.`;
    } else if (modo === "huecos") {
      const huecos = gaps(cells, 3);
      pedido = `LLENAR HUECOS. Genera ${CANDIDATAS} ideas repartidas entre estas combinaciones, que son las menos trabajadas:\n${huecos.map((c: CoverageCell) => `- Pilar ${c.pilar.toUpperCase()} · etapa ${c.etapa.toUpperCase()}. ${PILAR_GUIDE[c.pilar]} ${ETAPA_META[c.etapa].guia}`).join("\n")}`;
    } else if (targetPilar) {
      pedido = `Genera ${CANDIDATAS} ideas SOLO del pilar ${targetPilar.toUpperCase()}. Definición del pilar:\n${PILAR_GUIDE[targetPilar]}\nReparte las etapas del cliente y prioriza las menos cubiertas según la COBERTURA.`;
    } else {
      pedido = `Genera ${CANDIDATAS} ideas: 3 de CRECIMIENTO, 3 de ADOCTRINAMIENTO y 3 de CONVERSION. Prioriza las combinaciones pilar × etapa menos cubiertas según la COBERTURA. Definiciones:\n- ${PILAR_GUIDE.crecimiento}\n- ${PILAR_GUIDE.adoctrinamiento}\n- ${PILAR_GUIDE.conversion}`;
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

    const user =
      bloques.join("\n\n") +
      evitar +
      `\n\n${pedido}` +
      `\n\nDevuelve un array JSON:\n[{"tema": "título corto de la idea", "tesis": "la afirmación concreta y discutible, 1 frase", "angulo": "el enfoque concreto (caso, error, mito, paso a paso…)", "ganchos": ["3 primeras frases posibles, distintas entre sí"], "formato": "carrusel|guion_video", "razon": "por qué ESTE formato para esta idea y por qué ahora (no repitas la evidencia)", "pilar": "crecimiento|adoctrinamiento|conversion", "etapa": "consciencia|consideracion|decision", "evidencia": {"tipo": "audiencia|comentarios|conversacion|ganador|tendencia|momento${modo === "referentes" ? "|referente" : ""}", "detalle": "el dato concreto en el que se basa, 1 frase"}}]`;

    // ————— Generar + quitar repetidas (filtro léxico + juez de la IA) —————
    // Si casi todo sale repetido, una segunda ronda con las rechazadas a la
    // vista: en un nicho estrecho el modelo vuelve a los mismos temas.
    const comparables = previas.filter((p) => p.id !== parent?.id);
    const finales: Idea[] = [];
    const rechazadas: Idea[] = [];
    let repetidas = 0;
    let recibidas = 0;
    for (let ronda = 0; ronda < 2 && finales.length < OBJETIVO; ronda++) {
      const faltan = OBJETIVO - finales.length;
      const userRonda =
        ronda === 0
          ? user
          : user +
            `\n\nSEGUNDA RONDA. Estas candidatas se rechazaron por repetir ideas que ya existen:\n${rechazadas.map((c) => `- ${c.tema}${c.tesis ? ` — ${c.tesis}` : ""}`).join("\n")}\n${finales.length ? `Ya aceptadas en esta búsqueda (tampoco las repitas):\n${finales.map((c) => `- ${c.tema}`).join("\n")}\n` : ""}Propón ${faltan + 3} ideas sobre dolores y situaciones del cliente CLARAMENTE distintos de todo lo anterior. Mismo formato JSON.`;

      const raw = await chatJson<Idea[] | Record<string, unknown>>(system, userRonda, {
        temperature: TEMP.generacion + ronda * TEMP.escalonVariante,
        // 6-9 ideas con tesis y 3 ganchos cada una + lo que el modelo piensa con
        // un contexto largo: con 6000 se cortaba ("se quedó sin espacio").
        maxTokens: 16000,
      });
      // Algunos modelos envuelven el array ({"ideas": [...]}).
      const lista = Array.isArray(raw) ? raw : (Object.values(raw || {}).find(Array.isArray) as Idea[] | undefined) || [];
      const candidatas = lista.filter((i) => typeof i?.tema === "string" && i.tema.trim());
      recibidas += candidatas.length;

      const lexicas: Idea[] = [];
      for (const c of candidatas) {
        if (findDuplicate(c, comparables) || findDuplicate(c, [...finales, ...lexicas])) {
          repetidas++;
          rechazadas.push(c);
        } else lexicas.push(c);
      }
      const yaAceptadas: PrevIdea[] = finales.map((f, n) => ({ id: -1 - n, tema: f.tema, tesis: f.tesis || null, descartada: false }));
      const juez = await judgeDuplicates(lexicas, [...comparables.slice(0, 80), ...yaAceptadas]);
      lexicas.forEach((c, n) => {
        if (juez.has(n)) {
          repetidas++;
          rechazadas.push(c);
        } else if (finales.length < OBJETIVO) finales.push(c);
      });
    }
    if (!recibidas) return fail(new Error("La IA no devolvió ideas. Inténtalo de nuevo."), 502);

    const now = new Date().toISOString();
    for (const idea of finales) {
      const ideaPilar = toPilar(idea.pilar) || targetPilar || toPilar(parent?.pilar) || "crecimiento";
      let evidencia: { tipo: string; detalle: string } | null = null;
      if (idea.evidencia?.tipo && VALID_EVIDENCE.has(idea.evidencia.tipo)) {
        evidencia = { tipo: idea.evidencia.tipo, detalle: String(idea.evidencia.detalle || "").slice(0, 200) };
      }
      const formato = idea.formato === "guion_video" || idea.formato === "reel" ? "guion_video" : "carrusel";
      const ganchos = Array.isArray(idea.ganchos)
        ? idea.ganchos.filter((g) => typeof g === "string" && g.trim()).slice(0, 3)
        : [];
      await sql`
        INSERT INTO ideas (client_id, created_at, tema, tesis, angulo, ganchos, formato, razon, fuentes, pilar, etapa, evidencia, parent_id)
        VALUES (${clientId}, ${now}, ${idea.tema}, ${idea.tesis || null}, ${idea.angulo || null},
          ${ganchos.length ? JSON.stringify(ganchos) : null}, ${formato}, ${idea.razon || null},
          ${JSON.stringify(sources)}, ${ideaPilar}, ${toEtapa(idea.etapa)},
          ${evidencia ? JSON.stringify(evidencia) : null}, ${parent?.id ?? null})
      `;
    }

    return NextResponse.json({
      ok: true,
      count: finales.length,
      repetidas,
      webSearch: sources.length > 0,
      modo,
    });
  } catch (e) {
    return fail(e);
  }
}
