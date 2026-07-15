export default function DeltaTile({
  label,
  value,
  deltaPct,
}: {
  label: string;
  value: string;
  deltaPct: number | null;
}) {
  const up = deltaPct !== null && deltaPct > 0.5;
  const down = deltaPct !== null && deltaPct < -0.5;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors duration-200 hover:border-zinc-700">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {deltaPct !== null ? (
        <p
          className={`mt-1 text-xs font-medium tabular-nums ${
            up ? "text-emerald-400" : down ? "text-red-400" : "text-zinc-500"
          }`}
        >
          {up ? "▲" : down ? "▼" : "–"} {Math.abs(deltaPct).toFixed(0)}% vs periodo anterior
        </p>
      ) : (
        <p className="mt-1 text-xs text-zinc-600">Sin periodo anterior para comparar</p>
      )}
    </div>
  );
}
