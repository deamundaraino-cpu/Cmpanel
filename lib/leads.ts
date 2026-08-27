import { getSql } from "./db";

export type LeadWeek = { week_start: string; count: number };

/**
 * Lunes de la semana de una fecha, en YYYY-MM-DD (lunes = inicio, como el
 * calendario). Todo el cálculo va en hora local y se formatea a mano: mezclar
 * getters locales con aritmética UTC (o pasar por toISOString) desplaza el día
 * en cualquier servidor que no esté en UTC.
 */
export function weekStart(d = new Date()): string {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (base.getDay() + 6) % 7; // lunes = 0
  base.setDate(base.getDate() - dow);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function setLeadCount(
  clientId: number,
  week: string,
  count: number
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO lead_counts (client_id, week_start, count, updated_at)
    VALUES (${clientId}, ${week}, ${count}, ${new Date().toISOString()})
    ON CONFLICT (client_id, week_start) DO UPDATE
      SET count = EXCLUDED.count, updated_at = EXCLUDED.updated_at
  `;
}

/** Últimas N semanas registradas, de la más antigua a la más reciente. */
export async function getLeadWeeks(clientId: number, weeks = 8): Promise<LeadWeek[]> {
  const sql = getSql();
  const rows = await sql<LeadWeek[]>`
    SELECT week_start, count FROM lead_counts
    WHERE client_id = ${clientId}
    ORDER BY week_start DESC
    LIMIT ${weeks}
  `;
  return rows.reverse();
}
