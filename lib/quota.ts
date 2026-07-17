import { NextResponse } from "next/server";
import { getSql } from "./db";

/**
 * Operaciones de IA por usuario y día (todas las kinds suman al mismo límite).
 * El cupo es del EDITOR, compartido entre todos sus clientes — por eso el
 * default es más alto que cuando la app era de una sola marca.
 */
export const DEFAULT_AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);

export type QuotaResult =
  | { ok: true; used: number; limit: number }
  | { ok: false; used: number; limit: number };

/**
 * Consume 1 operación de IA del cupo diario del usuario (atómico).
 * kinds: analyze | research | proposal | regenerate | report
 */
export async function consumeQuota(userId: string, kind: string): Promise<QuotaResult> {
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  await sql`
    INSERT INTO ai_usage (user_id, date, kind, count)
    VALUES (${userId}, ${today}, ${kind}, 1)
    ON CONFLICT (user_id, date, kind) DO UPDATE SET count = ai_usage.count + 1
  `;

  const [row] = await sql<{ used: number; user_limit: number | null }[]>`
    SELECT
      (SELECT COALESCE(SUM(count), 0)::int FROM ai_usage
       WHERE user_id = ${userId} AND date = ${today}) AS used,
      (SELECT ai_daily_limit FROM users WHERE id = ${userId}) AS user_limit
  `;
  const limit = row?.user_limit ?? DEFAULT_AI_DAILY_LIMIT;
  const used = row?.used ?? 1;
  return { ok: used <= limit, used, limit };
}

/** Respuesta 429 estándar cuando se agota el cupo. */
export function quotaExceeded(q: { used: number; limit: number }) {
  return NextResponse.json(
    {
      error: `Has alcanzado tu límite diario de IA (${q.limit} operaciones). Se reinicia mañana.`,
    },
    { status: 429 }
  );
}
