import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSql, PostRow, CommentRow, StructureRow } from "../../db";
import { buildBrandBrief, briefCompleteness, getBrandBanned, getBrandDesign } from "../../brand";
import { brandCoverLayouts } from "../../brandDesign";
import { getSettings, setSetting } from "../../settings";
import { recomputeScores } from "../../scoring";
import { formatBreakdown, dayOfWeekBreakdown, periodDelta } from "../../metrics";
import { periodBounds } from "../../periods";
import { getPostingCadence, getPilarMix } from "../../health";
import { getLeadWeeks } from "../../leads";
import { extractWinningHooks, type HookRow } from "../../hooks";
import { EXECUTION_FORMATS } from "../../executionFormats";
import { HOOK_FAMILIES } from "../../angles";
import { toPilar } from "../../pilares";
import { addTool, clienteArg, listUserClients, ok, pct, parseJson, resolveClient, tipoPost, READ_ONLY, WRITES, type McpUser } from "../helpers";

const dias = z.number().int().min(7).max(365).default(30).describe("Periodo en días (7-365). Por defecto 30.");

function describePost(p: PostRow) {
  return {
    id: p.id,
    fecha: p.timestamp?.slice(0, 10),
    tipo: tipoPost(p),
    nota: p.score,
    er: pct(p.er),
    sobre_media: p.perf_ratio ? `×${p.perf_ratio.toFixed(1)}` : null,
    ganador: Boolean(p.is_winner),
    alcance: p.reach,
    vistas: p.views,
    likes: p.like_count,
    comentarios: p.comments_count,
    guardados: p.saved,
    compartidos: p.shares,
    caption: (p.caption || "").slice(0, 220),
    url: p.permalink,
  };
}

function totals(posts: PostRow[]) {
  const n = posts.length;
  return {
    posts: n,
    alcance_total: posts.reduce((a, p) => a + p.reach, 0),
    er_medio: n ? posts.reduce((a, p) => a + p.er, 0) / n : 0,
    guardados: posts.reduce((a, p) => a + p.saved, 0),
    compartidos: posts.reduce((a, p) => a + p.shares, 0),
    ganadores: posts.filter((p) => p.is_winner).length,
  };
}

export function registerContextTools(server: McpServer, user: McpUser) {
  addTool(
    server,
    "listar_clientes",
    {
      title: "Listar clientes",
      description:
        "Lista los clientes (marcas) que gestiona el usuario. Úsala primero si no sabes sobre qué cliente trabajar: todas las demás herramientas reciben el cliente por id o nombre.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const clients = await listUserClients(user.userId);
      const sql = getSql();
      const counts = await sql<{ client_id: number; posts: number; ideas: number; propuestas: number }[]>`
        SELECT c.id AS client_id,
          (SELECT count(*)::int FROM posts p WHERE p.client_id = c.id AND p.is_demo = 0) AS posts,
          (SELECT count(*)::int FROM ideas i WHERE i.client_id = c.id AND NOT i.descartada) AS ideas,
          (SELECT count(*)::int FROM proposals pr WHERE pr.client_id = c.id AND pr.status = 'pendiente') AS propuestas
        FROM clients c WHERE c.owner_user_id = ${user.userId}
      `;
      return ok({
        usuario: user.email,
        clientes: clients.map((c) => {
          const k = counts.find((x) => x.client_id === c.id);
          return { id: c.id, nombre: c.nombre, estado: c.estado, posts: k?.posts ?? 0, ideas_vigentes: k?.ideas ?? 0, propuestas_pendientes: k?.propuestas ?? 0 };
        }),
      });
    }
  );

  addTool(
    server,
    "ficha_marca",
    {
      title: "Ficha de marca",
      description:
        "Identidad completa del cliente: nicho, cliente ideal, propuesta de valor, tono de voz, pilares, objetivos, qué evitar y el manual de reglas de redacción, más las palabras/frases prohibidas (las marcadas como críticas bloquean la pieza) y el estilo visual. Léela SIEMPRE antes de escribir cualquier contenido para un cliente.",
      inputSchema: { cliente: clienteArg },
      annotations: READ_ONLY,
    },
    async ({ cliente }) => {
      const c = await resolveClient(user.userId, cliente);
      const [brief, banned, design, completitud] = await Promise.all([
        buildBrandBrief(c.id),
        getBrandBanned(c.id),
        getBrandDesign(c.id),
        briefCompleteness(c.id),
      ]);
      return ok(
        `CLIENTE: ${c.nombre} (id ${c.id})\nFicha completa: ${completitud.filled}/${completitud.total} campos\n\n` +
          `=== FICHA DE MARCA ===\n${brief || "(vacía: pide al usuario que la complete en la sección Marca)"}\n\n` +
          `=== TÉRMINOS PROHIBIDOS (los que van bajo [CRITICO] bloquean la pieza; bajo [ESTILO] solo avisan; /…/ es una expresión regular; tras | va el motivo) ===\n${banned?.trim() || "(ninguno)"}\n\n` +
          `=== ESTILO VISUAL ===\nEstilo: ${design.visualStyle} · composiciones de portada habilitadas: ${brandCoverLayouts(design).join(", ")}`
      );
    }
  );

  addTool(
    server,
    "resumen_cuenta",
    {
      title: "Resumen de la cuenta",
      description:
        "KPIs de Instagram del cliente en un periodo, comparados con el periodo anterior del mismo tamaño: posts, alcance, engagement medio, guardados, compartidos y ganadores; engagement por formato y por día de la semana; los mejores posts; ritmo de publicación frente a su objetivo y mezcla de pilares de lo planificado.",
      inputSchema: { cliente: clienteArg, dias },
      annotations: READ_ONLY,
    },
    async ({ cliente, dias }) => {
      const c = await resolveClient(user.userId, cliente);
      await recomputeScores(c.id);
      const sql = getSql();
      const { since, previousSince } = periodBounds(dias);
      const [posts, previos, cadencia, mezcla] = await Promise.all([
        sql<PostRow[]>`SELECT * FROM posts WHERE client_id = ${c.id} AND is_demo = 0 AND timestamp >= ${since} ORDER BY er DESC`,
        sql<PostRow[]>`SELECT * FROM posts WHERE client_id = ${c.id} AND is_demo = 0 AND timestamp >= ${previousSince} AND timestamp < ${since}`,
        getPostingCadence(c.id),
        getPilarMix(c.id),
      ]);
      const act = totals(posts);
      const ant = totals(previos);
      const delta = (k: keyof ReturnType<typeof totals>) => {
        const d = periodDelta(act[k], ant[k]);
        return d === null ? null : `${d > 0 ? "+" : ""}${Math.round(d * 10) / 10}%`;
      };
      return ok({
        cliente: c.nombre,
        periodo: `últimos ${dias} días`,
        actual: { ...act, er_medio: pct(act.er_medio) },
        anterior: { ...ant, er_medio: pct(ant.er_medio) },
        variacion: {
          posts: delta("posts"),
          alcance: delta("alcance_total"),
          er: delta("er_medio"),
          guardados: delta("guardados"),
          compartidos: delta("compartidos"),
        },
        er_por_formato: formatBreakdown(posts).map((f) => ({ formato: f.label, er_medio: pct(f.value) })),
        er_por_dia: dayOfWeekBreakdown(posts).filter((d) => d.value > 0).map((d) => ({ dia: d.label, er_medio: pct(d.value) })),
        mejores_posts: posts.slice(0, 5).map(describePost),
        ritmo: { posts_por_semana: cadencia.perWeek, objetivo_semana: cadencia.target, nivel: cadencia.level },
        mezcla_pilares_planificado: mezcla,
        nota: posts.length < 3 ? "Hay pocos posts en este periodo: prueba un periodo más largo antes de sacar conclusiones." : undefined,
      });
    }
  );

  addTool(
    server,
    "listar_posts",
    {
      title: "Listar posts",
      description:
        "Posts de Instagram del cliente con sus métricas (nota 1-10, ER, ×sobre la media, alcance, guardados, compartidos) y el inicio del caption. Filtra por periodo, formato o solo ganadores. Usa ver_post para el caption completo y sus comentarios.",
      inputSchema: {
        cliente: clienteArg,
        dias: z.number().int().min(1).max(3650).optional().describe("Solo posts de los últimos N días."),
        solo_ganadores: z.boolean().optional(),
        formato: z.enum(["reel", "carrusel", "imagen"]).optional(),
        orden: z.enum(["recientes", "mejores"]).default("recientes"),
        limite: z.number().int().min(1).max(100).default(20),
      },
      annotations: READ_ONLY,
    },
    async ({ cliente, dias, solo_ganadores, formato, orden, limite }) => {
      const c = await resolveClient(user.userId, cliente);
      const sql = getSql();
      const since = dias ? new Date(Date.now() - dias * 86400_000).toISOString() : null;
      const rows = await sql<PostRow[]>`
        SELECT * FROM posts
        WHERE client_id = ${c.id} AND is_demo = 0
          AND (${since}::text IS NULL OR timestamp >= ${since})
          AND (${solo_ganadores ? 1 : 0} = 0 OR is_winner = 1)
        ORDER BY ${orden === "mejores" ? sql`er DESC` : sql`timestamp DESC`}
        LIMIT 300
      `;
      const filtrados = (formato ? rows.filter((p) => tipoPost(p) === formato) : rows).slice(0, limite);
      return ok({ cliente: c.nombre, total: filtrados.length, posts: filtrados.map(describePost) });
    }
  );

  addTool(
    server,
    "ver_post",
    {
      title: "Ver post",
      description: "Un post concreto con su caption completo, todas sus métricas y los comentarios capturados.",
      inputSchema: { cliente: clienteArg, post_id: z.string().describe("Id del post (de listar_posts).") },
      annotations: READ_ONLY,
    },
    async ({ cliente, post_id }) => {
      const c = await resolveClient(user.userId, cliente);
      const sql = getSql();
      const [post] = await sql<PostRow[]>`SELECT * FROM posts WHERE client_id = ${c.id} AND id = ${post_id}`;
      if (!post) throw new Error("Post no encontrado");
      const comments = await sql<CommentRow[]>`
        SELECT * FROM comments WHERE client_id = ${c.id} AND post_id = ${post_id} ORDER BY like_count DESC LIMIT 50
      `;
      return ok({
        ...describePost(post),
        caption: post.caption,
        comentarios_capturados: comments.map((k) => ({ texto: k.text, likes: k.like_count, autor: k.username, lead: Boolean(k.is_lead) })),
      });
    }
  );

  addTool(
    server,
    "voz_audiencia",
    {
      title: "Voz de la audiencia",
      description:
        "Lenguaje literal del cliente ideal: DMs, preguntas de llamadas y objeciones que pegó el editor (la fuente más valiosa para ideas), comentarios reales en los posts (los más votados) y leads captados por semana.",
      inputSchema: { cliente: clienteArg },
      annotations: READ_ONLY,
    },
    async ({ cliente }) => {
      const c = await resolveClient(user.userId, cliente);
      const sql = getSql();
      const [s, comments, leads] = await Promise.all([
        getSettings(c.id, ["audience_voice"]),
        sql<(CommentRow & { caption: string | null })[]>`
          SELECT c.*, p.caption FROM comments c
          LEFT JOIN posts p ON p.client_id = c.client_id AND p.id = c.post_id
          WHERE c.client_id = ${c.id} ORDER BY c.like_count DESC, c.timestamp DESC LIMIT 60
        `,
        getLeadWeeks(c.id, 8),
      ]);
      return ok({
        cliente: c.nombre,
        voz_pegada_por_el_editor: s.audience_voice || "(vacía)",
        comentarios: comments.map((k) => ({
          texto: k.text,
          likes: k.like_count,
          lead: Boolean(k.is_lead),
          en_post: (k.caption || "").slice(0, 70),
        })),
        nota_comentarios: comments.length
          ? undefined
          : "No hay comentarios capturados (Instagram no los está entregando a la app). Usa la voz pegada por el editor.",
        leads_por_semana: leads,
      });
    }
  );

  addTool(
    server,
    "agregar_voz_audiencia",
    {
      title: "Añadir a la voz de la audiencia",
      description:
        "Añade texto literal de la audiencia (preguntas, quejas u objeciones encontradas en foros, Reddit, YouTube o pegadas por el usuario) al bloque «Voz de la audiencia» del cliente, que alimenta la búsqueda de ideas. Escribe frases literales, no resúmenes.",
      inputSchema: {
        cliente: clienteArg,
        texto: z.string().min(10).max(4000).describe("Frases literales, una por línea. Indica la fuente entre paréntesis si la hay."),
      },
      annotations: WRITES,
    },
    async ({ cliente, texto }) => {
      const c = await resolveClient(user.userId, cliente);
      const s = await getSettings(c.id, ["audience_voice"]);
      const actual = (s.audience_voice || "").trim();
      const nuevo = (actual ? `${actual}\n\n` : "") + texto.trim();
      // El bloque entra al prompt cortado a 4000: lo más nuevo se queda al final y puede cortarse.
      await setSetting(c.id, "audience_voice", nuevo.slice(-12000));
      return ok({ ok: true, cliente: c.nombre, caracteres: nuevo.length });
    }
  );

  addTool(
    server,
    "banco_ganchos",
    {
      title: "Banco de ganchos",
      description:
        "Ganchos que ya funcionaron para este cliente (de posts ganadores) o guardados desde referentes, con su ER. Sirven de referencia de tono y de lo que ya se usó (no los copies tal cual). Incluye el catálogo de familias de gancho que rota la plataforma.",
      inputSchema: { cliente: clienteArg },
      annotations: READ_ONLY,
    },
    async ({ cliente }) => {
      const c = await resolveClient(user.userId, cliente);
      try {
        await extractWinningHooks(c.id);
      } catch {
        // Si falla la extracción se devuelve lo ya archivado.
      }
      const rows = await getSql()<HookRow[]>`
        SELECT * FROM hooks WHERE client_id = ${c.id} ORDER BY er DESC NULLS LAST, id DESC LIMIT 60
      `;
      return ok({
        cliente: c.nombre,
        ganchos: rows.map((h) => ({ texto: h.texto, formato: h.formato, er: h.er != null ? pct(h.er) : null, origen: h.origen || "ganador propio" })),
        familias_de_gancho: HOOK_FAMILIES.map((f) => ({ id: f.id, nombre: f.nombre, objetivo: f.objetivo, debe_contener: f.debeContener })),
      });
    }
  );

  addTool(
    server,
    "estructuras",
    {
      title: "Estructuras de guion",
      description:
        "Galería de estructuras narrativas para guiones (por pilar), con sus secciones/beats y su ficha (cuándo usarla y cuándo no, señal que empuja, duración). Incluye los formatos de grabación disponibles (talking head, pizarra, pantalla verde…). Necesitas el id de una estructura para escribir un guion.",
      inputSchema: {
        cliente: clienteArg,
        pilar: z.enum(["crecimiento", "adoctrinamiento", "conversion"]).optional(),
        incluir_formatos_grabacion: z.boolean().default(true),
      },
      annotations: READ_ONLY,
    },
    async ({ cliente, pilar, incluir_formatos_grabacion }) => {
      const c = await resolveClient(user.userId, cliente);
      const rows = await getSql()<StructureRow[]>`
        SELECT * FROM structures
        WHERE (user_id = ${user.userId} OR user_id IS NULL) AND (client_id IS NULL OR client_id = ${c.id})
        ORDER BY is_builtin DESC, client_id NULLS FIRST, id ASC
      `;
      const lista = rows
        .filter((s) => !pilar || toPilar(s.pilar) === pilar)
        .map((s) => {
          const ficha = parseJson<Record<string, unknown> | null>(s.ficha, null);
          return {
            id: s.id,
            nombre: s.nombre,
            pilar: s.pilar,
            descripcion: s.descripcion,
            propia: s.user_id ? (s.client_id ? "solo esta marca" : "del editor") : "base",
            beats: parseJson<{ nombre: string; guia: string }[]>(s.beats, []).map((b) => b.nombre),
            cuando_usar: ficha?.cuandoUsar,
            cuando_no: ficha?.cuandoNo,
            duracion: ficha?.duracion,
          };
        });
      return ok({
        estructuras: lista,
        formatos_grabacion: incluir_formatos_grabacion
          ? EXECUTION_FORMATS.filter((f) => !pilar || f.pilares.includes(pilar)).map((f) => ({ id: f.id, nombre: f.nombre, como: f.como, coste: f.coste, pilares: f.pilares }))
          : undefined,
      });
    }
  );
}
