import { getSql } from "./db";
import { getSetting } from "./settings";
import { briefCompleteness } from "./brand";
import { computeAlerts, type Alert } from "./alerts";
import { pilarMix, type PilarMix } from "./pilares";

/** Ritmo de publicación por defecto si el cliente no fijó objetivo en 🧠 Marca. */
export const DEFAULT_TARGET_PER_WEEK = 3;

export type Cadence = {
  posts: number; // posts reales publicados en la ventana
  days: number; // tamaño de la ventana analizada
  perWeek: number; // ritmo real
  target: number; // objetivo semanal del cliente
  ratio: number; // perWeek / target (1 = al día)
  level: "ok" | "warning" | "critical";
};

/**
 * Ritmo real de publicación frente al objetivo del cliente.
 * Solo cuenta posts reales (is_demo = 0): los datos de demostración no
 * pueden inflar el ritmo de una cuenta que en realidad está parada.
 */
export async function getPostingCadence(clientId: number, days = 28): Promise<Cadence> {
  const sql = getSql();
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const [row] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM posts
    WHERE client_id = ${clientId} AND is_demo = 0 AND timestamp >= ${since}
  `;

  const raw = await getSetting(clientId, "content_target_per_week");
  const parsed = Number(raw);
  const target = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TARGET_PER_WEEK;

  const posts = row?.n ?? 0;
  const perWeek = (posts / days) * 7;
  const ratio = target > 0 ? perWeek / target : 0;

  return {
    posts,
    days,
    perWeek,
    target,
    ratio,
    level: ratio >= 0.8 ? "ok" : ratio >= 0.4 ? "warning" : "critical",
  };
}

/**
 * Mezcla de pilares de lo realmente planificado/producido (calendar_items),
 * no de las ideas generadas: una idea sin ejecutar no es contenido.
 */
export async function getPilarMix(clientId: number, days = 30): Promise<PilarMix> {
  const sql = getSql();
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const rows = await sql<{ pilar: string | null }[]>`
    SELECT pilar FROM calendar_items
    WHERE client_id = ${clientId} AND fecha >= ${since}
  `;
  return pilarMix(rows);
}

export type HealthScore = {
  brand: { filled: number; total: number };
  cadence: Cadence;
  alerts: Alert[];
  mix: PilarMix;
  score: number; // 0-100
};

/**
 * Ponderación explícita para que el número sea auditable:
 *   ficha de marca 30 · ritmo de publicación 50 · alertas operativas 20.
 * El ritmo pesa más que la ficha a propósito: una ficha perfecta en una
 * cuenta parada no vale nada. Pura (sin BD) para poder verificarla aparte.
 */
export function computeScore(input: {
  brand: { filled: number; total: number };
  cadence: Pick<Cadence, "ratio">;
  alerts: Pick<Alert, "level">[];
}): number {
  const { brand, cadence, alerts } = input;
  const brandPts = brand.total > 0 ? (brand.filled / brand.total) * 30 : 0;
  const cadencePts = Math.min(Math.max(cadence.ratio, 0), 1) * 50;
  const penalty = alerts.reduce(
    (acc, a) => acc + (a.level === "critical" ? 10 : a.level === "warning" ? 4 : 0),
    0
  );
  const alertPts = Math.max(0, 20 - penalty);
  return Math.round(brandPts + cadencePts + alertPts);
}

/**
 * Una sola cifra de "cómo va esta cuenta", hoy repartida entre Dashboard,
 * Métricas e Ideas.
 */
export async function getHealthScore(clientId: number): Promise<HealthScore> {
  const [brand, cadence, alerts, mix] = await Promise.all([
    briefCompleteness(clientId),
    getPostingCadence(clientId),
    computeAlerts(clientId),
    getPilarMix(clientId),
  ]);

  return { brand, cadence, alerts, mix, score: computeScore({ brand, cadence, alerts }) };
}
