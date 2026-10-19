import { createHash, randomBytes } from "crypto";
import { getSql } from "../db";

/**
 * Tokens personales del conector MCP. El token en claro solo se muestra una
 * vez al crearlo; en la BD queda su hash SHA-256 y un prefijo para reconocerlo.
 */

const PREFIX = "bp_";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type McpTokenRow = {
  id: number;
  nombre: string | null;
  prefijo: string;
  created_at: string;
  last_used_at: string | null;
};

export async function createMcpToken(userId: string, nombre: string | null): Promise<{ id: number; token: string }> {
  const token = PREFIX + randomBytes(24).toString("base64url");
  const sql = getSql();
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO mcp_tokens (user_id, token_hash, nombre, prefijo, created_at)
    VALUES (${userId}, ${hashToken(token)}, ${nombre?.slice(0, 80) || null}, ${token.slice(0, 10)}, ${new Date().toISOString()})
    RETURNING id
  `;
  return { id: row.id, token };
}

export async function listMcpTokens(userId: string): Promise<McpTokenRow[]> {
  return getSql()<McpTokenRow[]>`
    SELECT id, nombre, prefijo, created_at, last_used_at FROM mcp_tokens
    WHERE user_id = ${userId} ORDER BY id DESC
  `;
}

export async function revokeMcpToken(userId: string, id: number): Promise<boolean> {
  const res = await getSql()`DELETE FROM mcp_tokens WHERE user_id = ${userId} AND id = ${id}`;
  return res.count > 0;
}

/** Usuario dueño del token, o null si no existe. Anota el último uso. */
export async function verifyMcpToken(token: string | null | undefined): Promise<{ userId: string; email: string } | null> {
  if (!token || !token.startsWith(PREFIX) || token.length < 20) return null;
  const sql = getSql();
  const [row] = await sql<{ user_id: string; email: string }[]>`
    UPDATE mcp_tokens t SET last_used_at = ${new Date().toISOString()}
    FROM users u
    WHERE t.token_hash = ${hashToken(token)} AND u.id = t.user_id
    RETURNING t.user_id, u.email
  `;
  return row ? { userId: row.user_id, email: row.email } : null;
}
