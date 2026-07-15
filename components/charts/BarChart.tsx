type Bar = { label: string; value: number; color?: string };

const DEFAULT_COLOR = "#818cf8";

export default function BarChart({
  bars,
  height = 150,
  formatValue = (v: number) => String(v),
  ariaLabel,
}: {
  bars: Bar[];
  height?: number;
  formatValue?: (v: number) => string;
  ariaLabel: string;
}) {
  if (!bars.length) {
    return <p className="text-xs text-zinc-500">No hay datos suficientes todavía.</p>;
  }
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="flex items-end gap-2.5" style={{ height }}>
        {bars.map((b) => {
          const color = b.color || DEFAULT_COLOR;
          return (
            <div
              key={b.label}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              title={`${b.label}: ${formatValue(b.value)}`}
            >
              <span className="text-[10px] tabular-nums text-zinc-500 transition-colors duration-200 group-hover:text-zinc-200">
                {formatValue(b.value)}
              </span>
              <div
                className="w-full rounded-t-md transition-all duration-200 group-hover:brightness-125"
                style={{
                  height: Math.max(3, (b.value / max) * (height - 36)),
                  background: `linear-gradient(180deg, ${color} 0%, ${color}55 100%)`,
                  boxShadow: `0 0 18px ${color}22`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2.5 border-t border-zinc-800 pt-2">
        {bars.map((b) => (
          <span
            key={b.label}
            className="min-w-0 flex-1 truncate text-center text-[10px] text-zinc-500"
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
