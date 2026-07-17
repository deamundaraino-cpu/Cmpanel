import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { runSync } from "@/lib/syncEngine";

export const maxDuration = 300;

// Margen de 60 s bajo maxDuration para terminar limpio la iteración en curso.
const TIME_BUDGET_MS = 240_000;
const POSTS_PER_CLIENT = 15;

/**
 * Cron diario multi-cliente (ver vercel.json): sincroniza todos los CLIENTES
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
  const clients = await sql<{ id: number }[]>`
    SELECT c.id FROM clients c
    JOIN settings s ON s.client_id = c.id AND s.key = 'ig_token'
    WHERE c.estado = 'activo'
    ORDER BY c.last_synced_at ASC NULLS FIRST
  `;

  let processed = 0;
  let skipped = 0;
  const errors: { clientId: number; error: string }[] = [];

  for (const c of clients) {
    if (Date.now() > deadline) {
      skipped = clients.length - processed - errors.length;
      break;
    }
    try {
      await runSync(c.id, POSTS_PER_CLIENT);
      processed++;
    } catch (e) {
      // Un cliente con token caducado no rompe el lote.
      errors.push({
        clientId: c.id,
        error: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    total: clients.length,
    processed,
    skipped,
    errors,
  });
}
