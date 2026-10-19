import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer } from "./server";
import { verifyMcpToken } from "./tokens";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

/**
 * Atiende una petición MCP (Streamable HTTP, sin sesión: cada petición crea su
 * servidor). El token identifica al editor; todo lo demás va limitado a sus
 * propios clientes.
 */
export async function handleMcp(req: Request, token: string | null): Promise<Response> {
  if (req.method !== "POST") {
    // Sin sesiones no hay flujo SSE que abrir por GET ni sesión que cerrar por DELETE.
    return json(405, { jsonrpc: "2.0", error: { code: -32000, message: "Método no permitido" }, id: null }, { Allow: "POST" });
  }
  const user = await verifyMcpToken(token);
  if (!user) {
    return json(401, {
      jsonrpc: "2.0",
      error: { code: -32001, message: "Token inválido o revocado. Genera uno nuevo en Ajustes → Conectar con Claude." },
      id: null,
    });
  }
  const server = buildMcpServer(user);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // La respuesta JSON ya está completa: se libera el servidor de esta petición.
    void server.close();
  }
}

/** Token desde la cabecera Authorization: Bearer … */
export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
