import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSql } from "../../db";
import { buildResearchContext, insertIdeas, lexicalFilter, ResearchError, type Idea, type PrevIdea } from "../../researchContext";
import { toPilar } from "../../pilares";
import { addTool, clienteArg, ok, parseJson, resolveClient, appUrl, READ_ONLY, WRITES, type McpUser } from "../helpers";

const pilarEnum = z.enum(["crecimiento", "adoctrinamiento", "conversion"]);
const etapaEnum = z.enum(["consciencia", "consideracion", "decision"]);

const ideaSchema = z.object({
  tema: z.string().min(3).describe("Título corto de la idea."),
  tesis: z.string().describe("La afirmación concreta y discutible que defiende (1 frase). No un tema."),
  angulo: z.string().optional().describe("Enfoque concreto: caso, error, mito, paso a paso, comparación…"),
  ganchos: z.array(z.string()).max(3).optional().describe("Hasta 3 primeras frases posibles, distintas entre sí."),
  formato: z.enum(["carrusel", "guion_video"]).describe("guion_video si pide cara/historia/opinión; carrusel si pide pasos/listas/datos para guardar."),
  razon: z.string().optional().describe("Por qué este formato y por qué ahora."),
  pilar: pilarEnum,
  etapa: etapaEnum,
  evidencia: z
    .object({
      tipo: z.enum(["audiencia", "comentarios", "conversacion", "ganador", "tendencia", "momento", "referente"]),
      detalle: z.string().describe("El dato concreto en el que se basa (1 frase): cita, post, fuente o momento."),
    })
    .optional(),
});

async function loadComparables(clientId: number, excludeId?: number | null): Promise<PrevIdea[]> {
  const rows = await getSql()<PrevIdea[]>`
    SELECT id, tema, tesis, descartada FROM ideas
    WHERE client_id = ${clientId} ORDER BY id DESC LIMIT 300
  `;
  return rows.filter((r) => r.id !== excludeId);
}

export function registerIdeaTools(server: McpServer, user: McpUser) {
  addTool(
    server,
    "contexto_ideas",
    {
      title: "Contexto para buscar ideas",
      description:
        "Devuelve TODO lo necesario para proponer ideas nuevas para un cliente, con las mismas reglas que usa la plataforma: ficha de marca, voz de la audiencia, comentarios, posts ganadores, mapa de huecos pilar×etapa, momento del año, ideas existentes y descartadas (para no repetir) y el pedido según el modo. Después de leerlo: (1) si puedes buscar en la web, busca conversaciones reales (Reddit, foros, YouTube) y novedades del último mes del nicho; (2) escribe las ideas siguiendo las reglas; (3) guárdalas con guardar_ideas.",
      inputSchema: {
        cliente: clienteArg,
        modo: z
          .enum(["mix", "pilar", "huecos", "audiencia", "referentes", "variantes"])
          .default("mix")
          .describe(
            "mix: 3 de cada pilar · pilar: solo un pilar (indica pilar) · huecos: lo menos trabajado · audiencia: desde la voz de la audiencia y comentarios · referentes: patrones de cuentas de referencia · variantes: «más como esta» de una idea (indica idea_id)."
          ),
        pilar: pilarEnum.optional(),
        idea_id: z.number().int().optional().describe("Para modo variantes: la idea madre."),
      },
      annotations: READ_ONLY,
    },
    async ({ cliente, modo, pilar, idea_id }) => {
      const c = await resolveClient(user.userId, cliente);
      const internal = modo === "audiencia" ? "comentarios" : modo === "mix" || modo === "pilar" ? "web" : modo;
      if (modo === "pilar" && !pilar) throw new ResearchError("Indica el pilar.");
      if (modo === "variantes" && !idea_id) throw new ResearchError("Indica idea_id para el modo variantes.");
      const ctx = await buildResearchContext(c.id, {
        modo: internal,
        pilar: modo === "pilar" ? pilar : undefined,
        ideaId: idea_id,
        web: false, // Claude busca por su cuenta.
      });
      return ok(
        `CLIENTE: ${c.nombre} (id ${c.id}) · nicho: ${ctx.niche}\n` +
          `OBJETIVO: ${ctx.objetivo} ideas que pasen el filtro anti-repetición (propón ${ctx.candidatas} para tener margen).\n\n` +
          `===== TU ROL Y LAS REGLAS =====\n${ctx.system}\n\n` +
          `===== DATOS Y PEDIDO =====\n${ctx.user}\n\n` +
          `===== CÓMO GUARDAR =====\nLlama a guardar_ideas con cliente=${c.id}${ctx.parent ? ` e idea_madre_id=${ctx.parent.id}` : ""} y una lista con esta forma por idea:\n${ctx.jsonSpec}\n` +
          `Si añades fuentes web (URLs), pásalas en "fuentes". guardar_ideas te dirá cuáles rechazó por repetir una idea existente: sustitúyelas por otras de dolores distintos y vuelve a guardar.`
      );
    }
  );

  addTool(
    server,
    "guardar_ideas",
    {
      title: "Guardar ideas",
      description:
        "Guarda un lote de ideas en el panel de Ideas del cliente. Antes pasa el filtro anti-repetición contra todas las ideas existentes (y entre las del lote): las que casi repiten una existente NO se guardan y se devuelven con la idea con la que chocan, para que las sustituyas.",
      inputSchema: {
        cliente: clienteArg,
        ideas: z.array(ideaSchema).min(1).max(15),
        idea_madre_id: z.number().int().optional().describe("Si son variantes («más como esta») de una idea."),
        fuentes: z.array(z.string().url()).max(20).optional().describe("URLs consultadas en la búsqueda web."),
      },
      annotations: WRITES,
    },
    async ({ cliente, ideas, idea_madre_id, fuentes }) => {
      const c = await resolveClient(user.userId, cliente);
      let parentPilar: string | null = null;
      if (idea_madre_id) {
        const [p] = await getSql()<{ pilar: string | null }[]>`SELECT pilar FROM ideas WHERE client_id = ${c.id} AND id = ${idea_madre_id}`;
        if (!p) throw new ResearchError("La idea madre no existe en este cliente.", 404);
        parentPilar = p.pilar;
      }
      const comparables = await loadComparables(c.id, idea_madre_id);
      const { nuevas, repetidas } = lexicalFilter(ideas as Idea[], comparables);
      const ids = await insertIdeas(c.id, nuevas, { sources: fuentes || [], parentId: idea_madre_id ?? null, parentPilar });
      return ok({
        cliente: c.nombre,
        guardadas: nuevas.map((i, n) => ({ id: ids[n], tema: i.tema, pilar: i.pilar, etapa: i.etapa, formato: i.formato })),
        rechazadas_por_repetidas: repetidas.map((r) => ({
          tema: r.idea.tema,
          choca_con: r.repite.id ? `idea #${r.repite.id}: ${r.repite.tema}` : `otra del mismo lote: ${r.repite.tema}`,
        })),
        ver_en_panel: appUrl("/ideas"),
        siguiente: repetidas.length
          ? "Sustituye las rechazadas por ideas sobre dolores claramente distintos y vuelve a llamar a guardar_ideas solo con las nuevas."
          : "Listo. Para convertir una idea en pieza usa instrucciones_pieza con su idea_id.",
      });
    }
  );

  addTool(
    server,
    "listar_ideas",
    {
      title: "Listar ideas",
      description: "Ideas del cliente con su tesis, pilar, etapa, formato, evidencia y si ya se usaron (vídeo/carrusel) o se descartaron.",
      inputSchema: {
        cliente: clienteArg,
        estado: z.enum(["pendientes", "usadas", "descartadas", "todas"]).default("pendientes"),
        pilar: pilarEnum.optional(),
        etapa: etapaEnum.optional(),
        limite: z.number().int().min(1).max(200).default(40),
      },
      annotations: READ_ONLY,
    },
    async ({ cliente, estado, pilar, etapa, limite }) => {
      const c = await resolveClient(user.userId, cliente);
      const rows = await getSql()<
        {
          id: number;
          created_at: string;
          tema: string;
          tesis: string | null;
          angulo: string | null;
          formato: string | null;
          pilar: string | null;
          etapa: string | null;
          evidencia: string | null;
          ganchos: string | null;
          usado_video: boolean;
          usado_carrusel: boolean;
          descartada: boolean;
          parent_id: number | null;
        }[]
      >`
        SELECT id, created_at, tema, tesis, angulo, formato, pilar, etapa, evidencia, ganchos, usado_video, usado_carrusel, descartada, parent_id
        FROM ideas WHERE client_id = ${c.id}
          AND (${pilar ?? null}::text IS NULL OR pilar = ${pilar ?? null})
          AND (${etapa ?? null}::text IS NULL OR etapa = ${etapa ?? null})
          AND (
            ${estado} = 'todas'
            OR (${estado} = 'descartadas' AND descartada)
            OR (${estado} = 'usadas' AND NOT descartada AND (usado_video OR usado_carrusel))
            OR (${estado} = 'pendientes' AND NOT descartada AND NOT usado_video AND NOT usado_carrusel)
          )
        ORDER BY id DESC LIMIT ${limite}
      `;
      return ok({
        cliente: c.nombre,
        total: rows.length,
        ideas: rows.map((i) => ({
          id: i.id,
          fecha: i.created_at.slice(0, 10),
          tema: i.tema,
          tesis: i.tesis,
          angulo: i.angulo,
          formato: i.formato,
          pilar: toPilar(i.pilar),
          etapa: i.etapa,
          evidencia: parseJson(i.evidencia, null),
          ganchos: parseJson<string[]>(i.ganchos, []),
          usada_video: i.usado_video,
          usada_carrusel: i.usado_carrusel,
          descartada: i.descartada,
          variante_de: i.parent_id,
        })),
      });
    }
  );

  addTool(
    server,
    "actualizar_idea",
    {
      title: "Actualizar idea",
      description:
        "Marca una idea como descartada («no me sirve»: se oculta y la búsqueda la evita) o como usada en vídeo o carrusel (normalmente se marca sola al guardar la pieza).",
      inputSchema: {
        cliente: clienteArg,
        idea_id: z.number().int(),
        descartada: z.boolean().optional(),
        usado_video: z.boolean().optional(),
        usado_carrusel: z.boolean().optional(),
      },
      annotations: WRITES,
    },
    async ({ cliente, idea_id, descartada, usado_video, usado_carrusel }) => {
      const c = await resolveClient(user.userId, cliente);
      const patch: Record<string, boolean> = {};
      if (typeof descartada === "boolean") patch.descartada = descartada;
      if (typeof usado_video === "boolean") patch.usado_video = usado_video;
      if (typeof usado_carrusel === "boolean") patch.usado_carrusel = usado_carrusel;
      const keys = Object.keys(patch);
      if (!keys.length) throw new ResearchError("Nada que actualizar.");
      const sql = getSql();
      const res = await sql`UPDATE ideas SET ${sql(patch, ...keys)} WHERE client_id = ${c.id} AND id = ${idea_id}`;
      if (!res.count) throw new ResearchError("Idea no encontrada.", 404);
      return ok({ ok: true, idea_id, ...patch });
    }
  );
}
