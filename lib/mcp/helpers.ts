import { z } from "zod";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSql } from "../db";

/** Quién está usando el conector (resuelto desde su token). */
export type McpUser = { userId: string; email: string };

export type McpClient = { id: number; nombre: string; estado: string };

/** Error que se devuelve a Claude tal cual, como mensaje útil. */
export class McpToolError extends Error {}

export async function listUserClients(userId: string): Promise<McpClient[]> {
  return getSql()<McpClient[]>`
    SELECT id, nombre, estado FROM clients
    WHERE owner_user_id = ${userId}
    ORDER BY (estado = 'activo') DESC, created_at ASC, id ASC
  `;
}

/**
 * Cliente sobre el que trabaja la herramienta: por id o por nombre (sin
 * distinguir mayúsculas). Sin indicar, solo vale si el editor tiene uno activo.
 * Siempre limitado a los clientes del propio editor.
 */
export async function resolveClient(userId: string, cliente: string | number | undefined): Promise<McpClient> {
  const clients = await listUserClients(userId);
  if (!clients.length) throw new McpToolError("No tienes clientes. Crea uno en la plataforma (sección Clientes).");
  const lista = () => clients.map((c) => `${c.id} = ${c.nombre}${c.estado !== "activo" ? " (archivado)" : ""}`).join(", ");
  if (cliente === undefined || cliente === null || cliente === "") {
    const activos = clients.filter((c) => c.estado === "activo");
    if (activos.length === 1) return activos[0];
    throw new McpToolError(`Indica el cliente (id o nombre). Tus clientes: ${lista()}.`);
  }
  const asNum = Number(cliente);
  const found = Number.isInteger(asNum)
    ? clients.find((c) => c.id === asNum)
    : clients.find((c) => c.nombre.toLowerCase() === String(cliente).trim().toLowerCase()) ??
      clients.find((c) => c.nombre.toLowerCase().includes(String(cliente).trim().toLowerCase()));
  if (!found) throw new McpToolError(`No encuentro el cliente "${cliente}". Tus clientes: ${lista()}.`);
  return found;
}

export const clienteArg = z
  .union([z.number().int(), z.string()])
  .optional()
  .describe("Cliente: id o nombre (ver listar_clientes). Puede omitirse si solo hay un cliente activo.");

export function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://cmpanel-liart.vercel.app").replace(/\/$/, "");
  return `${base}${path}`;
}

/** Respuesta de herramienta: texto (si es string) o JSON legible. */
export function ok(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 1);
  return { content: [{ type: "text", text }] };
}

export function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/**
 * Registra una herramienta con su esquema zod. Los errores vuelven a Claude
 * como mensaje (isError), no como fallo del servidor.
 */
export function addTool<S extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  config: { title: string; description: string; inputSchema: S; annotations?: ToolAnnotations },
  fn: (args: z.infer<z.ZodObject<S>>) => Promise<CallToolResult>
): void {
  const handler = async (args: z.infer<z.ZodObject<S>>): Promise<CallToolResult> => {
    try {
      return await fn(args);
    } catch (e) {
      const known = e instanceof McpToolError || (e instanceof Error && "status" in e);
      if (!known) console.error(`[mcp] ${name}`, e);
      return toolError(e instanceof Error ? e.message : "Error inesperado");
    }
  };
  // El SDK tipa el callback con su propia inferencia de zod; la nuestra es equivalente.
  (server.registerTool as unknown as (this: McpServer, n: string, c: unknown, cb: unknown) => void).call(server, name, config, handler);
}

/** Solo lectura: Claude puede llamarla sin pedir confirmación. */
export const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
/** Escribe en la plataforma, sin borrar nada. */
export const WRITES: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export const pct = (v: number) => `${Math.round(v * 10000) / 100}%`;

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function tipoPost(p: { media_product_type: string | null; media_type: string | null }): string {
  return p.media_product_type === "REELS" ? "reel" : p.media_type === "CAROUSEL_ALBUM" ? "carrusel" : "imagen";
}
