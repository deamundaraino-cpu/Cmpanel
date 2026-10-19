import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpUser } from "./helpers";
import { registerContextTools } from "./tools/contexto";
import { registerIdeaTools } from "./tools/ideas";
import { registerPieceTools } from "./tools/piezas";
import { registerAnalysisTools } from "./tools/analisis";
import { registerPlanningTools } from "./tools/planificacion";

const INSTRUCTIONS = `Brandpanel es la plataforma de un gestor de contenido de Instagram que lleva varias marcas (clientes). Tú escribes el contenido; la plataforma pone los datos y las reglas, valida y guarda.

Flujo:
1. Si no sabes con qué cliente trabajar, llama a listar_clientes y pregunta.
2. Antes de escribir nada para un cliente, lee ficha_marca: tono, cliente ideal y reglas (lo marcado CRÍTICO bloquea la pieza).
3. Ideas: contexto_ideas → (busca en la web conversaciones reales y novedades del nicho si puedes) → escribe → guardar_ideas. Si te rechaza ideas por repetidas, sustitúyelas.
4. Guiones y carruseles: instrucciones_pieza (con idea_id siempre que se pueda) → escribe siguiendo las instrucciones al pie de la letra → guardar_guion / guardar_carrusel. Si devuelve infracciones críticas, corrige y vuelve a guardar.
5. Feedback sobre una pieza: ver_propuesta → reescribe → actualizar_propuesta accion=reemplazar.
6. Análisis: datos_informe → guardar_diagnostico o guardar_informe.

Reglas: escribe en el español y el tono de cada marca; no inventes cifras ni resultados de clientes; una idea es una TESIS concreta y discutible, no un tema; todo lo que guardas lo revisa y aprueba una persona en el panel.`;

/** Servidor MCP para un usuario concreto (ya autenticado por su token). */
export function buildMcpServer(user: McpUser): McpServer {
  const server = new McpServer({ name: "brandpanel", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  registerContextTools(server, user);
  registerIdeaTools(server, user);
  registerPieceTools(server, user);
  registerAnalysisTools(server, user);
  registerPlanningTools(server, user);

  const texto = (t: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: t } }] });

  server.registerPrompt(
    "buscar_ideas",
    {
      title: "Buscar ideas",
      description: "Busca ideas nuevas para un cliente con sus datos reales y las guarda en el panel.",
      argsSchema: {
        cliente: z.string().describe("Nombre o id del cliente"),
        modo: z.string().optional().describe("mix, pilar, huecos, audiencia, referentes"),
      },
    },
    ({ cliente, modo }) =>
      texto(
        `Busca ideas nuevas para el cliente «${cliente}» en modo ${modo || "mix"}. Lee ficha_marca y contexto_ideas; si puedes, busca en la web conversaciones reales (Reddit, foros, comentarios de YouTube) y novedades del último mes del nicho y cita las fuentes en la evidencia. Escribe las ideas siguiendo TODAS las reglas y guárdalas con guardar_ideas; si alguna se rechaza por repetida, sustitúyela. Al final enséñame una tabla con tema, tesis, pilar, etapa y formato.`
      )
  );

  server.registerPrompt(
    "escribir_pieza",
    {
      title: "Escribir guion o carrusel de una idea",
      description: "Convierte una idea del panel en un guion de vídeo o un carrusel listo para aprobar.",
      argsSchema: {
        cliente: z.string(),
        idea_id: z.string().describe("Id de la idea (ver listar_ideas)"),
        formato: z.string().optional().describe("guion_video o carrusel"),
      },
    },
    ({ cliente, idea_id, formato }) =>
      texto(
        `Para el cliente «${cliente}», convierte la idea #${idea_id} en ${formato === "carrusel" ? "un carrusel" : "un guion de vídeo"}. ${formato === "carrusel" ? "" : "Primero mira estructuras y elige la que mejor encaje con el pilar y la tesis de la idea (dime cuál y por qué). "}Pide instrucciones_pieza, escribe la pieza siguiéndolas al pie de la letra, valídala y guárdala. Enséñame el resultado final.`
      )
  );

  server.registerPrompt(
    "exprimir_ganador",
    {
      title: "Exprimir un post ganador",
      description: "Saca reel corto, carrusel y vídeo largo de un post que funcionó.",
      argsSchema: { cliente: z.string(), post_id: z.string().optional().describe("Si se omite, elige el mejor ganador reciente") },
    },
    ({ cliente, post_id }) =>
      texto(
        `Para el cliente «${cliente}», exprime ${post_id ? `el post ${post_id}` : "el mejor post ganador de los últimos 60 días (búscalo con listar_posts solo_ganadores)"}. Usa exprimir_ganador y sigue sus pasos: escribe y guarda las 3 piezas con origen=exprimir. Resume qué hiciste con cada una.`
      )
  );

  server.registerPrompt(
    "informe",
    {
      title: "Informe para el cliente",
      description: "Informe ejecutivo del periodo, guardado y con enlace para compartir.",
      argsSchema: { cliente: z.string(), dias: z.string().optional().describe("Periodo en días (por defecto 30)") },
    },
    ({ cliente, dias }) =>
      texto(
        `Prepara el informe ejecutivo de los últimos ${dias || "30"} días del cliente «${cliente}»: usa datos_informe (tipo informe), escríbelo y guárdalo con guardar_informe y compartir=true. Dame el enlace y un resumen de 3 líneas para enviárselo.`
      )
  );

  return server;
}
