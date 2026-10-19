import { z } from "zod";
import { randomUUID } from "crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSql, PostRow, ProposalRow, StructureRow } from "../../db";
import {
  prepareCarousel,
  prepareScript,
  resolvePieceSource,
  reviewCarousel,
  reviewScript,
  saveCarousel,
  saveScript,
  type GenCtx,
} from "../../proposalCreate";
import { applyCoverLayout, applyCoverTexts, clampQuality, type CarouselGen, type ScriptGen } from "../../proposalGen";
import { executionContext, formatById } from "../../executionFormats";
import { exprimirContext, exprimirStructureIds, EXPRIMIR_ORDEN, type PiezaExprimir } from "../../exprimir";
import { isBlocking, violationsNote, type Violation } from "../../brandRules";
import { ensurePipelineItem } from "../../pipeline";
import { extractHook } from "../../hooks";
import { pieceToText } from "../../pastedPiece";
import { toPilar } from "../../pilares";
import { addTool, appUrl, clienteArg, ok, parseJson, resolveClient, McpToolError, READ_ONLY, WRITES, type McpUser } from "../helpers";

const calidadSchema = z
  .object({ score: z.number().min(0).max(100), razon: z.string() })
  .optional()
  .describe("Autoevaluación honesta 0-100 con el listón de calidad de las instrucciones.");

const guionSchema = z.object({
  beats: z
    .array(
      z.object({
        seccion: z.string().describe("Nombre corto de la sección (sin dos puntos ni comas)."),
        texto: z.string().describe("Guion hablado EXACTO de esta sección."),
        edicion: z.string().optional().describe("Notas para el editor: plano, texto en pantalla, ritmo, duración."),
      })
    )
    .min(2),
  caption: z.string(),
  hashtags: z.array(z.string()).max(30),
  portadas: z.array(z.string()).max(8).optional().describe("Textos de portada del reel (3-7 palabras, con **énfasis**)."),
  calidad: calidadSchema,
});

const carruselSchema = z.object({
  slides: z
    .array(z.object({ titulo: z.string().describe("Máx 60 caracteres, con **énfasis**."), cuerpo: z.string().describe("Máx 220 caracteres.") }))
    .min(3)
    .max(12),
  caption: z.string(),
  hashtags: z.array(z.string()).max(30),
  portada_layout: z.string().optional().describe("Composición de portada (una de las habilitadas en las instrucciones)."),
  calidad: calidadSchema,
});

const origenArgs = {
  idea_id: z.number().int().optional().describe("Idea de la que sale la pieza (recomendado: marca la idea como usada)."),
  post_id: z.string().optional().describe("Post ganador del que sale la pieza."),
  pilar: z.enum(["crecimiento", "adoctrinamiento", "conversion"]).optional(),
};

function describeViolations(vs: Violation[]) {
  return vs.map((v) => ({ nivel: v.level, regla: v.label, motivo: v.explain }));
}

/** Referencias de origen sin exigir contexto (para guardar). */
async function refsFor(clientId: number, a: { idea_id?: number; post_id?: string; pilar?: string }) {
  if (a.idea_id || a.post_id) {
    const s = await resolvePieceSource(clientId, { ideaId: a.idea_id, postId: a.post_id, pilar: a.pilar });
    return { sourcePostId: s.sourcePostId, ideaRef: s.ideaRef, pilarRef: s.pilarRef };
  }
  return { sourcePostId: null, ideaRef: null, pilarRef: toPilar(a.pilar) };
}

async function loadProposal(clientId: number, id: number): Promise<ProposalRow> {
  const [p] = await getSql()<ProposalRow[]>`SELECT * FROM proposals WHERE client_id = ${clientId} AND id = ${id}`;
  if (!p) throw new McpToolError("Propuesta no encontrada en este cliente.");
  return p;
}

function bloqueoMsg(vs: Violation[]) {
  return {
    guardado: false,
    motivo: "La pieza incumple reglas CRÍTICAS de la marca. Corrígela y vuelve a guardarla (o pasa forzar=true para guardarla bloqueada y corregirla luego en el panel).",
    infracciones: describeViolations(vs),
  };
}

export function registerPieceTools(server: McpServer, user: McpUser) {
  addTool(
    server,
    "instrucciones_pieza",
    {
      title: "Instrucciones para escribir una pieza",
      description:
        "Devuelve las instrucciones exactas con las que la plataforma escribe un guion de vídeo o un carrusel para este cliente: rol, ficha de marca, ejemplos aprobados, punto de partida (idea, post ganador o tema), plan de la estructura, familia de gancho asignada, lo que la marca ya publicó y no debe repetirse, notas de edición y formato JSON de salida. Síguelas al pie de la letra y guarda el resultado con guardar_guion o guardar_carrusel.",
      inputSchema: {
        cliente: clienteArg,
        formato: z.enum(["guion_video", "carrusel"]),
        idea_id: z.number().int().optional().describe("Idea del panel (la mejor materia prima: trae tesis, ángulo y evidencia)."),
        post_id: z.string().optional().describe("Post ganador del que partir."),
        tema: z.string().optional().describe("Tema suelto, si no hay idea ni post."),
        estructura_id: z.number().int().optional().describe("Obligatoria para guion_video (ver herramienta estructuras)."),
        formato_grabacion: z.string().optional().describe("Id del formato de grabación (ver estructuras), solo guion."),
        exprimir: z.enum(["corto", "carrusel", "largo"]).optional().describe("Solo con post_id: versión de exprimir_ganador."),
      },
      annotations: READ_ONLY,
    },
    async (a) => {
      const c = await resolveClient(user.userId, a.cliente);
      let context: string;
      let refs: { sourcePostId: string | null; ideaRef: number | null; pilarRef: string | null };
      if (a.exprimir) {
        if (!a.post_id) throw new McpToolError("exprimir necesita post_id.");
        const [post] = await getSql()<PostRow[]>`SELECT * FROM posts WHERE client_id = ${c.id} AND id = ${a.post_id}`;
        if (!post) throw new McpToolError("Post no encontrado.");
        context = exprimirContext(post, a.exprimir);
        refs = { sourcePostId: post.id, ideaRef: null, pilarRef: null };
      } else {
        const s = await resolvePieceSource(c.id, { ideaId: a.idea_id, postId: a.post_id, tema: a.tema });
        context = s.context;
        refs = s;
      }

      const guardar = (tool: string, extra: string) =>
        `\n\n===== CÓMO GUARDAR =====\nLlama a ${tool} con cliente=${c.id}${refs.ideaRef ? `, idea_id=${refs.ideaRef}` : ""}${refs.sourcePostId ? `, post_id="${refs.sourcePostId}"` : ""}${a.exprimir ? `, origen="exprimir"` : ""}${extra} y en "${tool === "guardar_guion" ? "guion" : "carrusel"}" el JSON que piden las instrucciones. Si quieres comprobarla antes, usa validar_pieza.`;

      if (a.formato === "carrusel") {
        const kit = await prepareCarousel(c.id, context);
        return ok(
          `CLIENTE: ${c.nombre} · CARRUSEL · familia de gancho: ${kit.familia.nombre}\n\n===== TU ROL =====\n${kit.system}\n\n===== PEDIDO =====\n${kit.user}` +
            guardar("guardar_carrusel", `, familia_gancho="${kit.familia.id}"`)
        );
      }

      if (!a.estructura_id) {
        if (a.exprimir) {
          const ids = await exprimirStructureIds();
          a.estructura_id = a.exprimir === "largo" ? ids.largo : ids.corto;
        }
        if (!a.estructura_id) throw new McpToolError("Para un guion indica estructura_id (usa la herramienta estructuras para elegir).");
      }
      if (a.formato_grabacion && !formatById(a.formato_grabacion)) throw new McpToolError("Formato de grabación desconocido (ver estructuras).");
      const kit = await prepareScript(user.userId, c.id, a.estructura_id, context + executionContext(a.formato_grabacion));
      const familia = kit.familias[0];
      return ok(
        `CLIENTE: ${c.nombre} · GUION DE VÍDEO · estructura: ${kit.structure.nombre} · familia de gancho: ${familia.nombre}\n\n===== TU ROL =====\n${kit.system}\n\n===== PEDIDO =====\n${kit.user}` +
          guardar("guardar_guion", `, estructura_id=${kit.structure.id}, familia_gancho="${familia.id}"`)
      );
    }
  );

  addTool(
    server,
    "validar_pieza",
    {
      title: "Validar pieza",
      description:
        "Revisa un guion o carrusel SIN guardarlo: términos prohibidos de la marca (críticos y de estilo), fallos de estructura (promete N y entrega otro número, varios CTA), repetición de gancho o cierre con lo ya publicado y número de secciones del guion.",
      inputSchema: {
        cliente: clienteArg,
        guion: guionSchema.optional(),
        carrusel: carruselSchema.optional(),
        estructura_id: z.number().int().optional().describe("Para guion: valida el número de secciones de esa estructura."),
      },
      annotations: READ_ONLY,
    },
    async ({ cliente, guion, carrusel, estructura_id }) => {
      const c = await resolveClient(user.userId, cliente);
      if (!guion && !carrusel) throw new McpToolError("Pasa guion o carrusel.");
      let violations: Violation[];
      if (guion) {
        if (!estructura_id) throw new McpToolError("Para validar un guion indica estructura_id.");
        const kit = await prepareScript(user.userId, c.id, estructura_id, "");
        violations = reviewScript(guion as ScriptGen, kit).violations;
      } else {
        const kit = await prepareCarousel(c.id, "");
        violations = reviewCarousel(carrusel as CarouselGen, kit).violations;
      }
      return ok({
        valida: !violations.length,
        bloquearia: isBlocking(violations),
        infracciones: describeViolations(violations),
      });
    }
  );

  addTool(
    server,
    "guardar_guion",
    {
      title: "Guardar guion",
      description:
        "Guarda un guion de vídeo como propuesta pendiente de aprobación en el panel. Revisa las reglas de la marca: si hay infracciones críticas NO lo guarda (devuelve qué corregir) salvo forzar=true. Marca la idea como usada en vídeo.",
      inputSchema: {
        cliente: clienteArg,
        estructura_id: z.number().int(),
        guion: guionSchema,
        familia_gancho: z.string().optional().describe("Id de la familia de gancho que dieron las instrucciones."),
        origen: z.enum(["exprimir"]).optional(),
        forzar: z.boolean().default(false),
        ...origenArgs,
      },
      annotations: WRITES,
    },
    async (a) => {
      const c = await resolveClient(user.userId, a.cliente);
      const refs = await refsFor(c.id, a);
      const kit = await prepareScript(user.userId, c.id, a.estructura_id, "");
      const { gen, violations } = reviewScript(a.guion as ScriptGen, kit);
      if (!gen.beats.length) throw new McpToolError("El guion no tiene secciones con texto.");
      if (isBlocking(violations) && !a.forzar) return ok(bloqueoMsg(violations));
      const ctx: GenCtx = { userId: user.userId, clientId: c.id, context: "", ...refs, origen: a.origen ?? null };
      const created = await saveScript(ctx, gen, kit.structure.id, a.familia_gancho ?? null, violations);
      return ok({
        guardado: true,
        propuesta_id: created.id,
        estado: created.bloqueada ? "bloqueada" : "pendiente",
        avisos: describeViolations(violations),
        ver_en_panel: appUrl("/propuestas"),
        nota: `En el panel, el cliente activo debe ser ${c.nombre}.`,
      });
    }
  );

  addTool(
    server,
    "guardar_carrusel",
    {
      title: "Guardar carrusel",
      description:
        "Guarda un carrusel como propuesta pendiente de aprobación; la plataforma renderiza las imágenes con la identidad visual del cliente. Revisa las reglas de la marca: con infracciones críticas NO lo guarda salvo forzar=true. Marca la idea como usada en carrusel.",
      inputSchema: {
        cliente: clienteArg,
        carrusel: carruselSchema,
        familia_gancho: z.string().optional(),
        origen: z.enum(["exprimir"]).optional(),
        forzar: z.boolean().default(false),
        ...origenArgs,
      },
      annotations: WRITES,
    },
    async (a) => {
      const c = await resolveClient(user.userId, a.cliente);
      const refs = await refsFor(c.id, a);
      const kit = await prepareCarousel(c.id, "");
      const { gen, violations } = reviewCarousel(a.carrusel as CarouselGen, kit);
      if (isBlocking(violations) && !a.forzar) return ok(bloqueoMsg(violations));
      const ctx: GenCtx = { userId: user.userId, clientId: c.id, context: "", ...refs, origen: a.origen ?? null };
      const created = await saveCarousel(ctx, gen, kit, a.familia_gancho ?? null, violations);
      return ok({
        guardado: true,
        propuesta_id: created.id,
        slides: created.slides,
        estado: created.bloqueada ? "bloqueada" : "pendiente",
        avisos: describeViolations(violations),
        ver_en_panel: appUrl("/propuestas"),
        nota: `Las imágenes se ven en el panel (cliente activo: ${c.nombre}). Para enseñarlas fuera, usa actualizar_propuesta con accion=compartir.`,
      });
    }
  );

  addTool(
    server,
    "exprimir_ganador",
    {
      title: "Exprimir un post ganador",
      description:
        "Plan para sacar 3 piezas de un post que rindió por encima de la media: reel corto, carrusel y vídeo largo (5-8 min). Devuelve los pasos: para cada pieza, llama a instrucciones_pieza con los argumentos indicados, escríbela y guárdala con origen=exprimir.",
      inputSchema: { cliente: clienteArg, post_id: z.string() },
      annotations: READ_ONLY,
    },
    async ({ cliente, post_id }) => {
      const c = await resolveClient(user.userId, cliente);
      const [post] = await getSql()<PostRow[]>`SELECT * FROM posts WHERE client_id = ${c.id} AND id = ${post_id}`;
      if (!post) throw new McpToolError("Post no encontrado.");
      const ids = await exprimirStructureIds();
      const pasos = EXPRIMIR_ORDEN.map((p: PiezaExprimir) => ({
        pieza: p,
        instrucciones_pieza: {
          cliente: c.id,
          formato: p === "carrusel" ? "carrusel" : "guion_video",
          post_id,
          exprimir: p,
          ...(p === "carrusel" ? {} : { estructura_id: p === "corto" ? ids.corto : ids.largo }),
        },
      }));
      return ok({
        post: { id: post.id, caption: (post.caption || "").slice(0, 300), er: post.er, sobre_media: post.perf_ratio, ganador: Boolean(post.is_winner) },
        aviso: post.is_winner ? undefined : "Este post no está marcado como ganador: confirma con el usuario que merece exprimirse.",
        pasos,
      });
    }
  );

  addTool(
    server,
    "listar_propuestas",
    {
      title: "Listar propuestas",
      description: "Guiones y carruseles del cliente con su estado (pendiente, aprobada, rechazada, bloqueada), calidad, gancho y si el cliente final dejó feedback en el enlace de aprobación.",
      inputSchema: {
        cliente: clienteArg,
        estado: z.enum(["pendiente", "aprobada", "rechazada", "bloqueada", "todas"]).default("todas"),
        formato: z.enum(["guion_video", "carrusel"]).optional(),
        con_feedback: z.boolean().optional().describe("Solo las que tienen feedback del cliente final."),
        limite: z.number().int().min(1).max(100).default(25),
      },
      annotations: READ_ONLY,
    },
    async ({ cliente, estado, formato, con_feedback, limite }) => {
      const c = await resolveClient(user.userId, cliente);
      const rows = await getSql()<ProposalRow[]>`
        SELECT * FROM proposals WHERE client_id = ${c.id}
          AND (${estado} = 'todas' OR status = ${estado})
          AND (${formato ?? null}::text IS NULL OR formato = ${formato ?? null})
          AND (${con_feedback ? 1 : 0} = 0 OR client_feedback IS NOT NULL)
        ORDER BY id DESC LIMIT ${limite}
      `;
      return ok({
        cliente: c.nombre,
        propuestas: rows.map((p) => ({
          id: p.id,
          fecha: p.created_at.slice(0, 10),
          formato: p.formato,
          estado: p.status,
          pilar: p.pilar,
          calidad: p.quality,
          gancho: extractHook(p.slides, p.formato),
          idea_id: p.idea_id,
          origen: p.origen,
          ejemplo_para_ia: p.is_exemplar,
          feedback_cliente: p.client_feedback,
        })),
      });
    }
  );

  addTool(
    server,
    "ver_propuesta",
    {
      title: "Ver propuesta",
      description: "Contenido completo de una propuesta (guion por secciones con notas de edición, o slides), caption, hashtags, calidad, avisos de reglas y feedback del cliente final.",
      inputSchema: { cliente: clienteArg, propuesta_id: z.number().int() },
      annotations: READ_ONLY,
    },
    async ({ cliente, propuesta_id }) => {
      const c = await resolveClient(user.userId, cliente);
      const p = await loadProposal(c.id, propuesta_id);
      let estructura: string | null = null;
      if (p.structure_id) {
        const [s] = await getSql()<StructureRow[]>`SELECT * FROM structures WHERE id = ${p.structure_id}`;
        estructura = s ? `${s.nombre} (id ${s.id})` : null;
      }
      const items = parseJson<Record<string, unknown>[]>(p.slides, []);
      return ok({
        id: p.id,
        formato: p.formato,
        estado: p.status,
        estructura,
        pilar: p.pilar,
        idea_id: p.idea_id,
        familia_gancho: p.hook_family,
        calidad: p.quality,
        notas_calidad: p.quality_notes,
        contenido: items,
        texto_plano: pieceToText(p.formato || "carrusel", items),
        caption: p.caption,
        hashtags: parseJson<string[]>(p.hashtags, []),
        feedback_cliente: p.client_feedback,
        enlace_aprobacion: p.share_token ? appUrl(`/revisar/${p.share_token}`) : null,
      });
    }
  );

  addTool(
    server,
    "actualizar_propuesta",
    {
      title: "Actualizar propuesta",
      description:
        "Acciones sobre una propuesta: reemplazar (sustituye el contenido por uno nuevo — así se aplica feedback del editor o del cliente; pasa guion o carrusel completo), aprobar (entra al Pipeline de producción), rechazar, pendiente, compartir (enlace público para que el cliente final apruebe o pida cambios) y ejemplo / quitar_ejemplo (las aprobadas marcadas como ejemplo se usan como referencia de estilo).",
      inputSchema: {
        cliente: clienteArg,
        propuesta_id: z.number().int(),
        accion: z.enum(["reemplazar", "aprobar", "rechazar", "pendiente", "compartir", "ejemplo", "quitar_ejemplo"]),
        guion: guionSchema.optional(),
        carrusel: carruselSchema.optional(),
        forzar: z.boolean().default(false),
      },
      annotations: WRITES,
    },
    async (a) => {
      const c = await resolveClient(user.userId, a.cliente);
      const p = await loadProposal(c.id, a.propuesta_id);
      const sql = getSql();

      if (a.accion === "compartir") {
        let token = p.share_token;
        if (!token) {
          token = randomUUID();
          await sql`UPDATE proposals SET share_token = ${token} WHERE client_id = ${c.id} AND id = ${p.id}`;
        }
        return ok({ enlace: appUrl(`/revisar/${token}`), nota: "El cliente final puede aprobar o pedir cambios sin cuenta." });
      }

      if (a.accion === "ejemplo" || a.accion === "quitar_ejemplo") {
        const res = await sql`
          UPDATE proposals SET is_exemplar = ${a.accion === "ejemplo"}
          WHERE client_id = ${c.id} AND id = ${p.id} AND status = 'aprobada'
        `;
        if (!res.count) throw new McpToolError("Solo las propuestas aprobadas pueden usarse como ejemplo.");
        return ok({ ok: true, ejemplo: a.accion === "ejemplo" });
      }

      if (a.accion === "reemplazar") {
        let slides: unknown;
        let caption: string;
        let hashtags: string[];
        let violations: Violation[];
        let quality: { score: number | null; notes: string | null };
        if (p.formato === "guion_video") {
          if (!a.guion) throw new McpToolError("Esta propuesta es un guion: pasa el campo guion.");
          if (!p.structure_id) throw new McpToolError("La propuesta no tiene estructura asociada.");
          // No se compara con su propia versión anterior: reemplazarla no es repetirse.
          const kit = await prepareScript(user.userId, c.id, p.structure_id, "", { excludeId: p.id });
          const r = reviewScript(a.guion as ScriptGen, kit);
          slides = applyCoverTexts(r.gen);
          caption = r.gen.caption;
          hashtags = r.gen.hashtags;
          violations = r.violations;
          quality = clampQuality(r.gen.calidad);
        } else {
          if (!a.carrusel) throw new McpToolError("Esta propuesta es un carrusel: pasa el campo carrusel.");
          const kit = await prepareCarousel(c.id, "", { excludeId: p.id });
          const r = reviewCarousel(a.carrusel as CarouselGen, kit);
          const nuevas = applyCoverLayout(r.gen, kit.coverLayouts);
          // Se conserva la foto de portada elegida a mano en el panel.
          const previa = parseJson<{ foto?: string; layout?: string }[]>(p.slides, [])[0];
          if (previa?.foto && nuevas[0]) (nuevas[0] as { foto?: string }).foto = previa.foto;
          slides = nuevas;
          caption = r.gen.caption;
          hashtags = r.gen.hashtags;
          violations = r.violations;
          quality = clampQuality(r.gen.calidad);
        }
        const blocked = isBlocking(violations);
        if (blocked && !a.forzar) return ok(bloqueoMsg(violations));
        const notes = [quality.notes, violationsNote(violations)].filter(Boolean).join(" · ") || null;
        await sql`
          UPDATE proposals SET
            slides = ${JSON.stringify(slides)}, caption = ${caption}, hashtags = ${JSON.stringify(hashtags)},
            quality = ${quality.score ?? p.quality}, quality_notes = ${notes},
            status = ${blocked ? "bloqueada" : p.status === "bloqueada" || p.status === "rechazada" ? "pendiente" : p.status},
            client_feedback = NULL
          WHERE client_id = ${c.id} AND id = ${p.id}
        `;
        return ok({ ok: true, reemplazada: p.id, estado: blocked ? "bloqueada" : "pendiente", avisos: describeViolations(violations) });
      }

      const status = a.accion === "aprobar" ? "aprobada" : a.accion === "rechazar" ? "rechazada" : "pendiente";
      if (status === "aprobada" && p.status === "bloqueada") {
        throw new McpToolError("Está bloqueada por incumplir reglas críticas: corrígela (reemplazar) antes de aprobarla.");
      }
      const [updated] = await sql<ProposalRow[]>`
        UPDATE proposals SET status = ${status} WHERE client_id = ${c.id} AND id = ${p.id} RETURNING *
      `;
      if (status === "aprobada") await ensurePipelineItem(updated);
      return ok({ ok: true, estado: status, nota: status === "aprobada" ? "Entró al Pipeline de producción." : undefined });
    }
  );
}

