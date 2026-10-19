import { z } from "zod";
import { randomUUID } from "crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSql, PostRow, ReferenteRow, ReferentePiezaRow } from "../../db";
import { recomputeScores } from "../../scoring";
import { formatBreakdown, dayOfWeekBreakdown } from "../../metrics";
import { periodBounds } from "../../periods";
import { getLeadWeeks } from "../../leads";
import { ANALISIS_SYSTEM, buildAnalisisPrompt, outlierRatios, parseAnalisis, readAnalisis } from "../../referentes";
import { buildBrandBrief } from "../../brand";
import { addTool, appUrl, clienteArg, ok, pct, resolveClient, tipoPost, McpToolError, READ_ONLY, WRITES, type McpUser } from "../helpers";

function postResumen(p: PostRow) {
  return {
    id: p.id,
    fecha: p.timestamp?.slice(0, 16),
    tipo: tipoPost(p),
    nota: p.score,
    er: pct(p.er),
    alcance: p.reach,
    likes: p.like_count,
    comentarios: p.comments_count,
    guardados: p.saved,
    compartidos: p.shares,
    caption: (p.caption || "").slice(0, 180),
  };
}

function periodTotals(posts: PostRow[]) {
  return {
    posts: posts.length,
    alcance_total: posts.reduce((a, p) => a + p.reach, 0),
    er_medio: pct(posts.length ? posts.reduce((a, p) => a + p.er, 0) / posts.length : 0),
    ganadores: posts.filter((p) => p.is_winner).length,
  };
}

const textos = z.array(z.string()).min(1).max(10);

export function registerAnalysisTools(server: McpServer, user: McpUser) {
  addTool(
    server,
    "datos_informe",
    {
      title: "Datos para diagnóstico o informe",
      description:
        "Datos del periodo para escribir (a) un diagnóstico con recomendaciones (lo que hace «Analizar con IA» en el Dashboard) o (b) un informe ejecutivo para el cliente final: totales del periodo y del anterior, mejores y peores posts, ER por formato y por día, y leads captados por semana. Incluye el rol y la forma JSON que espera guardar_diagnostico o guardar_informe.",
      inputSchema: {
        cliente: clienteArg,
        tipo: z.enum(["diagnostico", "informe"]),
        dias: z.number().int().min(7).max(365).default(30),
      },
      annotations: READ_ONLY,
    },
    async ({ cliente, tipo, dias }) => {
      const c = await resolveClient(user.userId, cliente);
      await recomputeScores(c.id);
      const sql = getSql();
      const { since, previousSince } = periodBounds(dias);
      const [posts, previous, leads, brief] = await Promise.all([
        sql<PostRow[]>`SELECT * FROM posts WHERE client_id = ${c.id} AND timestamp >= ${since} ORDER BY er DESC`,
        sql<PostRow[]>`SELECT * FROM posts WHERE client_id = ${c.id} AND timestamp >= ${previousSince} AND timestamp < ${since}`,
        getLeadWeeks(c.id, 8),
        buildBrandBrief(c.id),
      ]);
      if (posts.length < 2) throw new McpToolError(`Solo hay ${posts.length} post(s) en los últimos ${dias} días: elige un periodo más largo.`);
      const half = Math.min(5, Math.ceil(posts.length / 2));
      const datos = {
        cliente: c.nombre,
        periodo: { dias, desde: since.slice(0, 10), hasta: new Date().toISOString().slice(0, 10) },
        resumen_periodo: periodTotals(posts),
        periodo_anterior: previous.length ? periodTotals(previous) : "Sin posts en el periodo anterior: no inventes tendencias.",
        er_por_formato: formatBreakdown(posts).map((f) => `${f.label}: ${pct(f.value)}`),
        er_por_dia: dayOfWeekBreakdown(posts).filter((d) => d.value > 0).map((d) => `${d.label}: ${pct(d.value)}`),
        mejores_posts: posts.slice(0, half).map(postResumen),
        peores_posts: posts.slice(half).slice(-5).map(postResumen),
        leads_por_semana: leads.length ? leads : "El cliente no registra leads: señálalo como riesgo (sin ese dato solo se mide alcance y engagement).",
      };
      const guia =
        tipo === "diagnostico"
          ? `ROL: community manager senior experto en Instagram para marcas personales. Recomendaciones concretas y accionables, coherentes con la marca. Analiza SOLO este periodo; la "nota" (1-10) compara cada post con todo el histórico. Cita datos reales (guardados, alcance, temas de los captions). Si hay pocos posts, dilo y matiza.\nGUARDAR con guardar_diagnostico: {"resumen": "2-3 frases con la tendencia frente al periodo anterior", "fortalezas": [...], "mejoras": [...], "acciones": ["acción concreta", ...], "mejores_horas": "...", "formatos": "qué funciona y cuál potenciar"}`
          : `ROL: CM senior que entrega informes ejecutivos al cliente final, claros y accionables, sin relleno corporativo. Si hay leads, compara SIEMPRE su tendencia con la de alcance/engagement (si el alcance sube y los leads no, dilo claramente).\nGUARDAR con guardar_informe: {"resumen": "diagnóstico ejecutivo en 2-3 frases", "aciertos": ["qué funcionó y por qué, con datos"], "riesgos": ["qué vigilar"], "recomendaciones": ["acciones para el próximo periodo"]}`;
      return ok(`${guia}\n\nFICHA DE MARCA:\n${brief}\n\nDATOS:\n${JSON.stringify(datos, null, 1)}`);
    }
  );

  addTool(
    server,
    "guardar_diagnostico",
    {
      title: "Guardar diagnóstico",
      description: "Guarda el diagnóstico del periodo en el Dashboard del cliente (sustituye al último «Analizar con IA»).",
      inputSchema: {
        cliente: clienteArg,
        dias: z.number().int().min(7).max(365),
        resumen: z.string(),
        fortalezas: textos,
        mejoras: textos,
        acciones: textos,
        mejores_horas: z.string(),
        formatos: z.string(),
      },
      annotations: WRITES,
    },
    async ({ cliente, dias, ...analisis }) => {
      const c = await resolveClient(user.userId, cliente);
      const sql = getSql();
      const since = new Date(Date.now() - dias * 86400_000).toISOString();
      const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM posts WHERE client_id = ${c.id} AND timestamp >= ${since}`;
      await sql`
        INSERT INTO recommendations (client_id, created_at, content)
        VALUES (${c.id}, ${new Date().toISOString()}, ${JSON.stringify({ ...analisis, periodo_dias: dias, posts_analizados: n })})
      `;
      return ok({ ok: true, ver_en_panel: appUrl(`/dashboard?days=${dias}`) });
    }
  );

  addTool(
    server,
    "guardar_informe",
    {
      title: "Guardar informe",
      description: "Guarda el informe ejecutivo en Métricas y, si compartir=true, devuelve el enlace público para enviarlo al cliente final.",
      inputSchema: {
        cliente: clienteArg,
        dias: z.number().int().min(7).max(365),
        resumen: z.string(),
        aciertos: textos,
        riesgos: textos,
        recomendaciones: textos,
        compartir: z.boolean().default(false),
      },
      annotations: WRITES,
    },
    async ({ cliente, dias, compartir, ...informe }) => {
      const c = await resolveClient(user.userId, cliente);
      const token = compartir ? randomUUID() : null;
      const [row] = await getSql()<{ id: number }[]>`
        INSERT INTO reports (client_id, created_at, period_days, content, share_token)
        VALUES (${c.id}, ${new Date().toISOString()}, ${dias}, ${JSON.stringify(informe)}, ${token})
        RETURNING id
      `;
      return ok({ ok: true, informe_id: row.id, enlace_publico: token ? appUrl(`/informe/${token}`) : null, ver_en_panel: appUrl("/metricas") });
    }
  );

  // ————— Referentes —————

  addTool(
    server,
    "listar_referentes",
    {
      title: "Listar referentes",
      description:
        "Cuentas de referencia del cliente y sus piezas guardadas, con vistas, ×N sobre la mediana del referente y el análisis (gancho, estructura, patrón replicable) si ya se hizo. Las piezas sin análisis indican qué falta analizar.",
      inputSchema: { cliente: clienteArg },
      annotations: READ_ONLY,
    },
    async ({ cliente }) => {
      const c = await resolveClient(user.userId, cliente);
      const sql = getSql();
      const [refs, piezas] = await Promise.all([
        sql<ReferenteRow[]>`SELECT * FROM referentes WHERE client_id = ${c.id} ORDER BY id ASC`,
        sql<ReferentePiezaRow[]>`SELECT * FROM referente_piezas WHERE client_id = ${c.id} ORDER BY id DESC`,
      ]);
      const ratios = outlierRatios(piezas);
      return ok({
        cliente: c.nombre,
        referentes: refs.map((r) => ({
          id: r.id,
          handle: `@${r.handle}`,
          nombre: r.nombre,
          notas: r.notas,
          piezas: piezas
            .filter((p) => p.referente_id === r.id)
            .map((p) => ({
              id: p.id,
              url: p.url,
              formato: p.formato,
              vistas: p.vistas,
              sobre_media: ratios.has(p.id) ? `×${ratios.get(p.id)!.toFixed(1)}` : null,
              texto: p.texto.slice(0, 300),
              analisis: readAnalisis(p.analisis),
            })),
        })),
      });
    }
  );

  addTool(
    server,
    "agregar_referente",
    {
      title: "Añadir referente",
      description: "Añade una cuenta de referencia (competidor o creador a estudiar) al cliente.",
      inputSchema: {
        cliente: clienteArg,
        handle: z.string().min(2).describe("@ de la cuenta."),
        nombre: z.string().optional(),
        notas: z.string().max(2000).optional().describe("Por qué se sigue esta cuenta."),
      },
      annotations: WRITES,
    },
    async ({ cliente, handle, nombre, notas }) => {
      const c = await resolveClient(user.userId, cliente);
      const h = handle.trim().replace(/^@/, "").slice(0, 60);
      const sql = getSql();
      const [existe] = await sql<{ id: number }[]>`SELECT id FROM referentes WHERE client_id = ${c.id} AND lower(handle) = ${h.toLowerCase()}`;
      if (existe) return ok({ ok: true, referente_id: existe.id, nota: "Ya existía." });
      const [row] = await sql<{ id: number }[]>`
        INSERT INTO referentes (client_id, created_at, handle, nombre, notas)
        VALUES (${c.id}, ${new Date().toISOString()}, ${h}, ${nombre?.slice(0, 120) || null}, ${notas || null})
        RETURNING id
      `;
      return ok({ ok: true, referente_id: row.id });
    }
  );

  addTool(
    server,
    "agregar_pieza_referente",
    {
      title: "Añadir pieza de referente",
      description:
        "Guarda una pieza de un referente (caption o transcripción + números si se conocen) y devuelve las instrucciones para analizarla. Después de analizarla, guarda el resultado con guardar_analisis_referente.",
      inputSchema: {
        cliente: clienteArg,
        referente_id: z.number().int(),
        texto: z.string().min(20).max(8000).describe("Caption o transcripción literal."),
        url: z.string().url().optional(),
        formato: z.string().max(40).optional().describe("reel, carrusel, vídeo largo…"),
        vistas: z.number().int().min(0).optional(),
        likes: z.number().int().min(0).optional(),
        comentarios: z.number().int().min(0).optional(),
      },
      annotations: WRITES,
    },
    async (a) => {
      const c = await resolveClient(user.userId, a.cliente);
      const sql = getSql();
      const [ref] = await sql<ReferenteRow[]>`SELECT * FROM referentes WHERE client_id = ${c.id} AND id = ${a.referente_id}`;
      if (!ref) throw new McpToolError("Referente no encontrado.");
      const [row] = await sql<{ id: number }[]>`
        INSERT INTO referente_piezas (client_id, referente_id, created_at, url, formato, texto, vistas, likes, comentarios)
        VALUES (${c.id}, ${ref.id}, ${new Date().toISOString()}, ${a.url ?? null}, ${a.formato ?? null}, ${a.texto},
          ${a.vistas ?? null}, ${a.likes ?? null}, ${a.comentarios ?? null})
        RETURNING id
      `;
      const brief = await buildBrandBrief(c.id);
      const prompt = buildAnalisisPrompt(
        { texto: a.texto, formato: a.formato ?? null, vistas: a.vistas ?? null, likes: a.likes ?? null, comentarios: a.comentarios ?? null },
        ref.handle,
        brief
      );
      return ok(`Pieza guardada (id ${row.id}).\n\n===== ANÁLISIS: TU ROL =====\n${ANALISIS_SYSTEM}\n\n===== PEDIDO =====\n${prompt}\n\nGuarda el resultado con guardar_analisis_referente (pieza_id=${row.id}).`);
    }
  );

  addTool(
    server,
    "guardar_analisis_referente",
    {
      title: "Guardar análisis de referente",
      description:
        "Guarda el análisis de una pieza de referente (gancho, formato, estructura, patrón replicable, por qué funciona). Alimenta la búsqueda de ideas en modo referentes. Con guardar_gancho=true copia el gancho al banco de ganchos del cliente.",
      inputSchema: {
        cliente: clienteArg,
        pieza_id: z.number().int(),
        gancho: z.string(),
        formato: z.string(),
        estructura: z.array(z.object({ nombre: z.string(), guia: z.string() })).max(8),
        patron_replicable: z.string(),
        por_que_funciona: z.string(),
        guardar_gancho: z.boolean().default(false),
      },
      annotations: WRITES,
    },
    async ({ cliente, pieza_id, guardar_gancho, ...raw }) => {
      const c = await resolveClient(user.userId, cliente);
      const sql = getSql();
      const [pieza] = await sql<(ReferentePiezaRow & { handle: string })[]>`
        SELECT rp.*, r.handle FROM referente_piezas rp JOIN referentes r ON r.id = rp.referente_id
        WHERE rp.client_id = ${c.id} AND rp.id = ${pieza_id}
      `;
      if (!pieza) throw new McpToolError("Pieza no encontrada.");
      const analisis = parseAnalisis(raw);
      if (!analisis) throw new McpToolError("El análisis está vacío.");
      await sql`UPDATE referente_piezas SET analisis = ${JSON.stringify(analisis)} WHERE client_id = ${c.id} AND id = ${pieza_id}`;
      if (guardar_gancho && analisis.gancho) {
        const formato = /carrusel/i.test(pieza.formato || analisis.formato) ? "carrusel" : "guion_video";
        await sql`
          INSERT INTO hooks (client_id, created_at, texto, formato, source_post_id, source_proposal_id, er, origen)
          VALUES (${c.id}, ${new Date().toISOString()}, ${analisis.gancho.slice(0, 300)}, ${formato}, NULL, NULL, NULL, ${"@" + pieza.handle.replace(/^@/, "")})
        `;
      }
      return ok({ ok: true, pieza_id, gancho_en_banco: guardar_gancho });
    }
  );
}
