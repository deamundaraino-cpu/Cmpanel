import { PILARES, PILAR_META, type PilarMix } from "@/lib/pilares";

/**
 * Mezcla de pilares de un periodo. Un calendario lleno no dice nada si todo
 * es del mismo pilar: esto hace visible el desbalance de estrategia.
 */
export default function PilarMixCard({
  mix,
  titulo = "Mezcla de pilares",
  contexto,
}: {
  mix: PilarMix;
  titulo?: string;
  contexto?: string;
}) {
  const { counts, total, sinPilar, ausentes, dominante } = mix;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{titulo}</p>
        {contexto && <p className="text-xs text-zinc-500">{contexto}</p>}
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          Ninguna pieza con pilar asignado
          {sinPilar > 0 ? ` (${sinPilar} sin clasificar)` : ""}. Al crear contenido
          desde una idea el pilar se asigna solo.
        </p>
      ) : (
        <>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
            {PILARES.map((p) =>
              counts[p] > 0 ? (
                <div
                  key={p}
                  className={PILAR_META[p].bar}
                  style={{ width: `${(counts[p] / total) * 100}%` }}
                  title={`${PILAR_META[p].short}: ${counts[p]}`}
                />
              ) : null
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {PILARES.map((p) => (
              <span key={p} className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className={`h-2 w-2 rounded-full ${PILAR_META[p].dot}`} />
                {PILAR_META[p].short}
                <span className="tabular-nums text-zinc-300">
                  {counts[p]} ({Math.round((counts[p] / total) * 100)}%)
                </span>
              </span>
            ))}
            {sinPilar > 0 && (
              <span className="text-xs text-zinc-600">{sinPilar} sin pilar</span>
            )}
          </div>

          {(ausentes.length > 0 || dominante) && (
            <div className="mt-3 border-t border-zinc-800 pt-3 text-xs text-amber-400">
              {dominante && (
                <p>
                  ⚠️ {PILAR_META[dominante].short} acapara más del 70% de lo
                  planificado. Un solo pilar no construye marca.
                </p>
              )}
              {ausentes.length > 0 && (
                <p className={dominante ? "mt-1" : ""}>
                  ⚠️ Sin piezas de{" "}
                  {ausentes.map((p) => PILAR_META[p].short).join(" ni ")}.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
