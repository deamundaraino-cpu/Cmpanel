import { HeatCell } from "@/lib/metrics";

const pct = (v: number) => (v * 100).toFixed(1).replace(".", ",") + "%";

export default function Heatmap({
  days,
  slots,
  grid,
}: {
  days: string[];
  slots: string[];
  grid: HeatCell[][];
}) {
  const hasData = grid.some((row) => row.some((c) => c.count > 0));
  if (!hasData) {
    return <p className="text-xs text-zinc-600">No hay datos suficientes todavía.</p>;
  }

  return (
    <div role="img" aria-label="Engagement medio por día y franja horaria">
      <div className="grid gap-1" style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-zinc-500">
            {d}
          </div>
        ))}
        {slots.map((slot, s) => (
          <div key={slot} className="contents">
            <div className="flex items-center text-[10px] text-zinc-500">{slot}</div>
            {days.map((d, i) => {
              const cell = grid[s][i];
              return (
                <div
                  key={`${slot}-${d}`}
                  className="flex min-h-[42px] items-center justify-center rounded-lg border border-zinc-800 text-[10px] font-semibold tabular-nums transition-transform duration-200 hover:scale-[1.04]"
                  style={{
                    background:
                      cell.count > 0
                        ? `rgba(99, 102, 241, ${0.14 + cell.intensity * 0.6})`
                        : "transparent",
                    color: cell.count > 0 ? "var(--color-zinc-100)" : "var(--color-zinc-600)",
                  }}
                  title={
                    cell.count > 0
                      ? `${d} ${slot}: ER medio ${pct(cell.value)} (${cell.count} posts)`
                      : `${d} ${slot}: sin posts`
                  }
                >
                  {cell.count > 0 ? pct(cell.value) : "·"}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-zinc-600">
        Intensidad = engagement medio de tus posts publicados en esa franja.
      </p>
    </div>
  );
}
