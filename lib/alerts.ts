import { getSql, PostRow, StoryRow } from "./db";
import { getSettings } from "./settings";

export type Alert = {
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

/** Alertas operativas calculadas sobre datos reales (sin IA, sin coste). */
export async function computeAlerts(clientId: number): Promise<Alert[]> {
  const sql = getSql();
  const alerts: Alert[] = [];
  const now = Date.now();

  // 1. Token de Instagram a punto de caducar (dura 60 días).
  const s = await getSettings(clientId, ["ig_token", "ig_token_fetched_at"]);
  if (s.ig_token) {
    if (s.ig_token_fetched_at) {
      const ageDays = (now - new Date(s.ig_token_fetched_at).getTime()) / 86400_000;
      if (ageDays > 55) {
        alerts.push({
          level: "critical",
          title: "Token de Instagram caduca en menos de 5 días",
          detail: "Ve a Ajustes → «Renovar token» ahora o la sincronización dejará de funcionar.",
        });
      } else if (ageDays > 45) {
        alerts.push({
          level: "warning",
          title: "Token de Instagram con más de 45 días",
          detail: "El cron diario lo renovará solo; si no, hazlo en Ajustes (caduca a los 60 días).",
        });
      }
    }
  } else {
    alerts.push({
      level: "critical",
      title: "Instagram no conectado",
      detail: "Sin token no hay métricas. Configúralo en Ajustes.",
    });
  }

  // 2. Días sin publicar.
  const lastPost = await sql<{ timestamp: string }[]>`
    SELECT timestamp FROM posts WHERE client_id = ${clientId} AND is_demo = 0
    ORDER BY timestamp DESC LIMIT 1
  `;
  if (lastPost[0]?.timestamp) {
    const idleDays = Math.floor((now - new Date(lastPost[0].timestamp).getTime()) / 86400_000);
    if (idleDays > 30) {
      alerts.push({
        level: "critical",
        title: `${idleDays} días sin publicar`,
        detail: "La cuenta está parada. Genera propuestas desde Ideas y retoma el ritmo.",
      });
    } else if (idleDays > 10) {
      alerts.push({
        level: "warning",
        title: `${idleDays} días sin publicar`,
        detail: "El algoritmo premia la constancia: agenda las próximas piezas en el Calendario.",
      });
    }
  }

  // 3. Engagement cayendo (últimos 30 días vs 30 anteriores).
  const since30 = new Date(now - 30 * 86400_000).toISOString();
  const since60 = new Date(now - 60 * 86400_000).toISOString();
  const cur = await sql<PostRow[]>`
    SELECT * FROM posts WHERE client_id = ${clientId} AND timestamp >= ${since30}
  `;
  const prev = await sql<PostRow[]>`
    SELECT * FROM posts
    WHERE client_id = ${clientId} AND timestamp >= ${since60} AND timestamp < ${since30}
  `;
  if (cur.length >= 3 && prev.length >= 3) {
    const avg = (rows: PostRow[]) => rows.reduce((a, p) => a + p.er, 0) / rows.length;
    const curEr = avg(cur);
    const prevEr = avg(prev);
    if (prevEr > 0 && curEr < prevEr * 0.75) {
      alerts.push({
        level: "warning",
        title: "Engagement cayendo",
        detail: `ER medio ${((curEr / prevEr - 1) * 100).toFixed(0)}% vs el mes anterior. Revisa qué cambió en formato o temas.`,
      });
    }
  }

  // 4. Tasa de salida alta en historias (últimos 30 días).
  const stories = await sql<StoryRow[]>`
    SELECT * FROM stories WHERE client_id = ${clientId} AND timestamp >= ${since30}
  `;
  const views = stories.reduce((a, st) => a + st.views, 0);
  const exits = stories.reduce((a, st) => a + st.exits, 0);
  if (views > 100 && exits / views > 0.25) {
    alerts.push({
      level: "warning",
      title: "Tasa de salida alta en historias",
      detail: `${((exits / views) * 100).toFixed(0)}% de salidas. Prueba historias más cortas o con más gancho en el primer frame.`,
    });
  }

  // 5. Propuestas esperando revisión.
  const [pendingRow] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM proposals WHERE client_id = ${clientId} AND status = 'pendiente'
  `;
  if (pendingRow.n > 0) {
    alerts.push({
      level: "info",
      title: `${pendingRow.n} propuesta${pendingRow.n > 1 ? "s" : ""} esperando tu revisión`,
      detail: "Apruébalas o recházalas en la sección Propuestas.",
    });
  }

  // 6. Piezas del calendario atrasadas (fecha pasada y no publicadas).
  const today = new Date().toISOString().slice(0, 10);
  const [overdueRow] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM calendar_items
    WHERE client_id = ${clientId} AND fecha < ${today} AND estado != 'publicado'
  `;
  if (overdueRow.n > 0) {
    const n = overdueRow.n;
    alerts.push({
      level: "warning",
      title: `${n} pieza${n > 1 ? "s" : ""} del calendario atrasada${n > 1 ? "s" : ""}`,
      detail: "Tienen fecha pasada y no están marcadas como publicadas. Actualízalas o reprográmalas.",
    });
  }

  return alerts;
}
