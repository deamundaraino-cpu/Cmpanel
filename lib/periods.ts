/**
 * Ventanas de análisis del Dashboard y del diagnóstico con IA. Analizar todo el
 * histórico mezcla momentos de la cuenta que ya no existen (otra audiencia,
 * otro tipo de contenido) y distorsiona la lectura de lo que pasa hoy.
 */
export const ANALYSIS_PERIODS = [7, 14, 21, 30, 60] as const;
export const DEFAULT_ANALYSIS_PERIOD = 30;

/** Métricas e informes también permiten mirar más atrás. */
export const METRICS_PERIODS = [...ANALYSIS_PERIODS, 90, 365] as const;

export function parseMetricsPeriod(raw: unknown): number {
  const n = Number(raw);
  return (METRICS_PERIODS as readonly number[]).includes(n) ? n : DEFAULT_ANALYSIS_PERIOD;
}

export function parseAnalysisPeriod(raw: unknown): number {
  const n = Number(raw);
  return (ANALYSIS_PERIODS as readonly number[]).includes(n) ? n : DEFAULT_ANALYSIS_PERIOD;
}

/** Inicio de la ventana actual y de la anterior del mismo tamaño (para comparar). */
export function periodBounds(days: number, now = Date.now()) {
  return {
    since: new Date(now - days * 86400_000).toISOString(),
    previousSince: new Date(now - days * 2 * 86400_000).toISOString(),
  };
}
