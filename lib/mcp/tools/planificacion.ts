import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSql, CalendarItemRow, CampaignRow, RecordingSessionRow } from "../../db";
import { ESTADOS, LABEL, normalizeState, stepState, flowFor } from "../../pipelineStates";
import { assignToSession } from "../../recording";
import { toPilar } from "../../pilares";
import { addTool, appUrl, clienteArg, ok, resolveClient, McpToolError, READ_ONLY, WRITES, type McpUser } from "../helpers";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD");

function describeItem(i: CalendarItemRow) {
  return {
    id: i.id,
    titulo: i.titulo,
    fecha: i.fecha,
    formato: i.formato,
    estado: normalizeState(i.estado) ?? i.estado,
    pilar: i.pilar,
    version: i.version,
    propuesta_id: i.proposal_id,
    campana_id: i.campaign_id,
    sesion_id: i.session_id,
    fecha_entrega: i.fecha_entrega,
    brief_edicion: i.brief_edicion,
    entrega_url: i.entrega_url,
    notas: i.notas || null,
    es_prueba: i.es_prueba,
  };
}

export function registerPlanningTools(server: McpServer, user: McpUser) {
  addTool(
    server,
    "pipeline",
    {
      title: "Ver Pipeline",
      description: `Piezas en producción del cliente por fase. Fases de vídeo: ${ESTADOS.join(" → ")}. Los carruseles se saltan la grabación (idea → en_edicion → revision → listo → publicado).`,
      inputSchema: {
        cliente: clienteArg,
        estado: z.enum(ESTADOS).optional(),
        desde: fecha.optional(),
        hasta: fecha.optional(),
        incluir_publicadas: z.boolean().default(false),
      },
      annotations: READ_ONLY,
    },
    async ({ cliente, estado, desde, hasta, incluir_publicadas }) => {
      const c = await resolveClient(user.userId, cliente);
      const rows = await getSql()<CalendarItemRow[]>`
        SELECT * FROM calendar_items WHERE client_id = ${c.id}
          AND (${desde ?? null}::text IS NULL OR fecha >= ${desde ?? null})
          AND (${hasta ?? null}::text IS NULL OR fecha <= ${hasta ?? null})
        ORDER BY fecha ASC, id ASC
      `;
      const items = rows
        .map(describeItem)
        .filter((i) => (estado ? i.estado === estado : incluir_publicadas || i.estado !== "publicado"));
      const porFase: Record<string, number> = {};
      for (const i of items) porFase[i.estado] = (porFase[i.estado] || 0) + 1;
      return ok({ cliente: c.nombre, por_fase: porFase, piezas: items, ver_en_panel: appUrl("/pipeline") });
    }
  );

  addTool(
    server,
    "crear_pieza_pipeline",
    {
      title: "Crear pieza en el Pipeline",
      description:
        "Crea una pieza en el calendario/Pipeline. Normalmente no hace falta: al aprobar una propuesta entra sola. Úsala para planificar piezas que aún no tienen guion.",
      inputSchema: {
        cliente: clienteArg,
        titulo: z.string().min(2).max(200),
        fecha: fecha.describe("Fecha prevista de publicación."),
        formato: z.enum(["guion_video", "carrusel"]).default("guion_video"),
        pilar: z.enum(["crecimiento", "adoctrinamiento", "conversion"]).optional(),
        campana_id: z.number().int().optional(),
        notas: z.string().max(5000).optional(),
      },
      annotations: WRITES,
    },
    async (a) => {
      const c = await resolveClient(user.userId, a.cliente);
      const [row] = await getSql()<{ id: number }[]>`
        INSERT INTO calendar_items (client_id, created_at, fecha, titulo, formato, estado, campaign_id, notas, pilar)
        VALUES (${c.id}, ${new Date().toISOString()}, ${a.fecha}, ${a.titulo}, ${a.formato}, 'idea',
          ${a.campana_id ?? null}, ${a.notas ?? ""}, ${toPilar(a.pilar)})
        RETURNING id
      `;
      return ok({ ok: true, pieza_id: row.id });
    }
  );

  addTool(
    server,
    "actualizar_pieza_pipeline",
    {
      title: "Actualizar pieza del Pipeline",
      description:
        "Mueve una pieza de fase (avanzar/retroceder o fase concreta) y edita sus datos: fecha, título, brief de edición para el editor de vídeo, fecha de entrega, enlace de la entrega (Drive, etc.), notas, pilar o campaña.",
      inputSchema: {
        cliente: clienteArg,
        pieza_id: z.number().int(),
        mover: z.enum(["avanzar", "retroceder"]).optional(),
        estado: z.enum(ESTADOS).optional(),
        fecha: fecha.optional(),
        titulo: z.string().max(200).optional(),
        brief_edicion: z.string().max(5000).optional(),
        fecha_entrega: fecha.optional(),
        entrega_url: z.string().url().optional(),
        notas: z.string().max(5000).optional(),
        pilar: z.enum(["crecimiento", "adoctrinamiento", "conversion"]).optional(),
        campana_id: z.number().int().nullable().optional(),
      },
      annotations: WRITES,
    },
    async (a) => {
      const c = await resolveClient(user.userId, a.cliente);
      const sql = getSql();
      const [item] = await sql<CalendarItemRow[]>`SELECT * FROM calendar_items WHERE client_id = ${c.id} AND id = ${a.pieza_id}`;
      if (!item) throw new McpToolError("Pieza no encontrada.");
      const patch: Record<string, string | number | null> = {};
      if (a.mover) {
        const next = stepState(item.formato, item.estado, a.mover === "avanzar" ? 1 : -1);
        if (!next) throw new McpToolError(`No hay fase ${a.mover === "avanzar" ? "siguiente" : "anterior"}.`);
        patch.estado = next;
      } else if (a.estado) {
        if (!flowFor(item.formato).includes(a.estado)) throw new McpToolError(`Un ${item.formato} no pasa por la fase ${a.estado}.`);
        patch.estado = a.estado;
      }
      if (a.fecha) patch.fecha = a.fecha;
      if (a.titulo) patch.titulo = a.titulo;
      if (a.brief_edicion !== undefined) patch.brief_edicion = a.brief_edicion || null;
      if (a.fecha_entrega) patch.fecha_entrega = a.fecha_entrega;
      if (a.entrega_url) patch.entrega_url = a.entrega_url;
      if (a.notas !== undefined) patch.notas = a.notas;
      if (a.pilar) patch.pilar = a.pilar;
      if (a.campana_id !== undefined) {
        if (a.campana_id !== null) {
          const [camp] = await sql`SELECT id FROM campaigns WHERE client_id = ${c.id} AND id = ${a.campana_id}`;
          if (!camp) throw new McpToolError("Campaña no encontrada.");
        }
        patch.campaign_id = a.campana_id;
      }
      const keys = Object.keys(patch);
      if (!keys.length) throw new McpToolError("Nada que actualizar.");
      await sql`UPDATE calendar_items SET ${sql(patch, ...keys)} WHERE client_id = ${c.id} AND id = ${item.id}`;
      return ok({ ok: true, pieza_id: item.id, ...patch, fase: patch.estado ? LABEL[patch.estado as keyof typeof LABEL] : undefined });
    }
  );

  addTool(
    server,
    "sesiones_grabacion",
    {
      title: "Sesiones de grabación",
      description:
        "Lista las sesiones de grabación por lotes del cliente, o crea una nueva (accion=crear, con fecha) y le asigna piezas de vídeo que aún no se grabaron (sus versiones gemelas corta/larga entran con ellas). Con accion=asignar añade piezas a una sesión existente.",
      inputSchema: {
        cliente: clienteArg,
        accion: z.enum(["listar", "crear", "asignar"]).default("listar"),
        fecha: fecha.optional(),
        notas: z.string().max(2000).optional(),
        sesion_id: z.number().int().optional(),
        pieza_ids: z.array(z.number().int()).max(50).optional(),
      },
      annotations: WRITES,
    },
    async ({ cliente, accion, fecha: f, notas, sesion_id, pieza_ids }) => {
      const c = await resolveClient(user.userId, cliente);
      const sql = getSql();
      if (accion === "listar") {
        const [sesiones, items] = await Promise.all([
          sql<RecordingSessionRow[]>`SELECT * FROM recording_sessions WHERE client_id = ${c.id} ORDER BY fecha DESC LIMIT 20`,
          sql<CalendarItemRow[]>`SELECT * FROM calendar_items WHERE client_id = ${c.id} AND session_id IS NOT NULL`,
        ]);
        const pendientes = await sql<CalendarItemRow[]>`
          SELECT * FROM calendar_items WHERE client_id = ${c.id} AND session_id IS NULL
            AND estado IN ('idea', 'por_grabar') AND formato IN ('guion_video', 'reel', 'video')
          ORDER BY fecha ASC
        `;
        return ok({
          sesiones: sesiones.map((s) => ({
            id: s.id,
            fecha: s.fecha,
            estado: s.estado,
            notas: s.notas,
            piezas: items.filter((i) => i.session_id === s.id).map((i) => ({ id: i.id, titulo: i.titulo, estado: i.estado })),
          })),
          videos_sin_sesion: pendientes.map((i) => ({ id: i.id, titulo: i.titulo, fecha: i.fecha, estado: i.estado })),
          teleprompter: appUrl("/grabacion"),
        });
      }
      let sid = sesion_id;
      if (accion === "crear") {
        if (!f) throw new McpToolError("Indica la fecha de la sesión.");
        const [row] = await sql<{ id: number }[]>`
          INSERT INTO recording_sessions (client_id, created_at, fecha, notas, estado)
          VALUES (${c.id}, ${new Date().toISOString()}, ${f}, ${notas || null}, 'planificada')
          RETURNING id
        `;
        sid = row.id;
      } else {
        if (!sid) throw new McpToolError("Indica sesion_id.");
        const [s] = await sql`SELECT id FROM recording_sessions WHERE client_id = ${c.id} AND id = ${sid}`;
        if (!s) throw new McpToolError("Sesión no encontrada.");
      }
      const asignadas = pieza_ids?.length ? await assignToSession(c.id, sid!, pieza_ids) : 0;
      return ok({ ok: true, sesion_id: sid, piezas_asignadas: asignadas });
    }
  );

  addTool(
    server,
    "campanas",
    {
      title: "Campañas",
      description: "Lista las campañas del cliente o crea una (accion=crear). Para meter una pieza del Pipeline en una campaña usa actualizar_pieza_pipeline con campana_id.",
      inputSchema: {
        cliente: clienteArg,
        accion: z.enum(["listar", "crear"]).default("listar"),
        nombre: z.string().max(120).optional(),
        descripcion: z.string().max(2000).optional(),
        fecha_inicio: fecha.optional(),
        fecha_fin: fecha.optional(),
      },
      annotations: WRITES,
    },
    async ({ cliente, accion, nombre, descripcion, fecha_inicio, fecha_fin }) => {
      const c = await resolveClient(user.userId, cliente);
      const sql = getSql();
      if (accion === "crear") {
        if (!nombre) throw new McpToolError("Indica el nombre de la campaña.");
        const [row] = await sql<{ id: number }[]>`
          INSERT INTO campaigns (client_id, created_at, nombre, descripcion, fecha_inicio, fecha_fin, estado)
          VALUES (${c.id}, ${new Date().toISOString()}, ${nombre}, ${descripcion ?? null}, ${fecha_inicio ?? null}, ${fecha_fin ?? null}, 'activa')
          RETURNING id
        `;
        return ok({ ok: true, campana_id: row.id });
      }
      const rows = await sql<(CampaignRow & { piezas: number })[]>`
        SELECT c.*, (SELECT count(*)::int FROM calendar_items i WHERE i.client_id = c.client_id AND i.campaign_id = c.id) AS piezas
        FROM campaigns c WHERE c.client_id = ${c.id} ORDER BY c.id DESC
      `;
      return ok({
        campanas: rows.map((r) => ({ id: r.id, nombre: r.nombre, descripcion: r.descripcion, estado: r.estado, inicio: r.fecha_inicio, fin: r.fecha_fin, piezas: r.piezas })),
      });
    }
  );
}
