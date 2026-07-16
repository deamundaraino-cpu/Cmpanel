import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { runSync } from "@/lib/syncEngine";

export const maxDuration = 300;

// Margen de 60 s bajo maxDuration para terminar limpio la iteración en curso.
const TIME_BUDGET_MS = 240_000;
const POSTS_PER_USER = 15;

/**
 * Cron diario multi-tenant (ver vercel.json): sincroniza a todos los usuarios
 * con Instagram conectado, los más "olvidados" primero (staleness-first).
 * Si no caben todos en el presupuesto de tiempo, los pendientes encabezan la
 * cola de mañana (round-robin natural). Escalado futuro: disparar este mismo
 * endpoint varias veces al día desde GitHub Actions con el mismo Bearer.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const sql = getSql();
  const users = await sql<{ id: string }[]>`
    SELECT u.id FROM users u
    JOIN settings s ON s.user_id = u.id AND s.key = 'ig_token'
    ORDER BY u.last_synced_at ASC NULLS FIRST
  `;

  let processed = 0;
  let skipped = 0;
  const errors: { userId: string; error: string }[] = [];

  for (const u of users) {
    if (Date.now() > deadline) {
      skipped = users.length - processed - errors.length;
      break;
    }
    try {
      await runSync(u.id, POSTS_PER_USER);
      processed++;
    } catch (e) {
      // Un tenant con token caducado no rompe el lote.
      errors.push({
        userId: u.id,
        error: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    total: users.length,
    processed,
    skipped,
    errors,
  });
}
