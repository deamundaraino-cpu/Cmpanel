import Link from "next/link";
import type { HealthScore } from "@/lib/health";

const LEVEL_TEXT = {
  ok: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
} as const;

const LEVEL_BAR = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
} as const;

function scoreLevel(score: number): keyof typeof LEVEL_TEXT {
  return score >= 70 ? "ok" : score >= 40 ? "warning" : "critical";
}

function Meter({ pct, level }: { pct: number; level: keyof typeof LEVEL_BAR }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        className={`h-full rounded-full ${LEVEL_BAR[level]}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/**
 * Resumen único de "cómo va la cuenta". Reúne en una vista lo que antes
 * estaba repartido entre Dashboard (ficha), Métricas (alertas) y el histórico
 * de posts (ritmo). La ponderación se muestra para que el número no sea magia.
 */
export default function HealthScoreCard({ health }: { health: HealthScore }) {
  const { brand, cadence, alerts, score } = health;
  const level = scoreLevel(score);

  const criticals = alerts.filter((a) => a.level === "critical").length;
  const warnings = alerts.filter((a) => a.level === "warning").length;
  const brandPct = brand.total > 0 ? (brand.filled / brand.total) * 100 : 0;

  const alertLevel = criticals > 0 ? "critical" : warnings > 0 ? "warning" : "ok";
  const alertLabel =
    criticals > 0
      ? `${criticals} crítica${criticals > 1 ? "s" : ""}`
      : warnings > 0
        ? `${warnings} aviso${warnings > 1 ? "s" : ""}`
        : "Sin alertas";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Estado de la cuenta</p>
        <p className="text-xs text-zinc-500">
          Ficha 30 · Ritmo 50 · Alertas 20
        </p>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-4xl font-semibold tabular-nums ${LEVEL_TEXT[level]}`}>
            {score}
          </span>
          <span className="text-sm text-zinc-500">/100</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-zinc-500">Ritmo de publicación</p>
            <p className={`mt-1 text-sm font-medium tabular-nums ${LEVEL_TEXT[cadence.level]}`}>
              {cadence.perWeek.toFixed(1)}/sem
              <span className="text-zinc-500"> · objetivo {cadence.target}</span>
            </p>
            <Meter pct={cadence.ratio * 100} level={cadence.level} />
            <p className="mt-1 text-[11px] text-zinc-600">
              {cadence.posts} posts en {cadence.days} días
            </p>
          </div>

          <div>
            <p className="text-xs text-zinc-500">Ficha de marca</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-zinc-200">
              {brand.filled}/{brand.total}
            </p>
            <Meter
              pct={brandPct}
              level={brandPct >= 80 ? "ok" : brandPct >= 40 ? "warning" : "critical"}
            />
            {brand.filled < brand.total && (
              <Link
                href="/marca"
                className="mt-1 block text-[11px] text-indigo-400 hover:text-indigo-300"
              >
                Completar →
              </Link>
            )}
          </div>

          <div>
            <p className="text-xs text-zinc-500">Alertas operativas</p>
            <p className={`mt-1 text-sm font-medium ${LEVEL_TEXT[alertLevel]}`}>{alertLabel}</p>
            <Meter
              pct={alerts.length ? 100 : 0}
              level={alertLevel}
            />
            {alerts.length > 0 && (
              <Link
                href="/metricas"
                className="mt-1 block text-[11px] text-indigo-400 hover:text-indigo-300"
              >
                Ver detalle →
              </Link>
            )}
          </div>
        </div>
      </div>

      {cadence.level === "critical" && (
        <p className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-400">
          El ritmo es lo que más pesa en esta nota. Ninguna mejora de ficha, ideas
          o diseño compensa una cuenta parada.
        </p>
      )}
    </div>
  );
}
