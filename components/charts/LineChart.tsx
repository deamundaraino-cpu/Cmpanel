type Point = { label: string; value: number };

let gradientCounter = 0;

export default function LineChart({
  points,
  height = 150,
  color = "#818cf8",
  formatValue = (v: number) => String(v),
  ariaLabel,
}: {
  points: Point[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  ariaLabel: string;
}) {
  if (points.length < 2) {
    return <p className="text-xs text-zinc-500">No hay datos suficientes todavía.</p>;
  }
  const w = 600;
  const padX = 14;
  const padY = 18;
  const values = points.map((p) => p.value);
  const min = 0; // anclado a cero para no exagerar la tendencia
  const max = Math.max(...values, 0.0001) * 1.15;
  const x = (i: number) => padX + (i / (points.length - 1)) * (w - padX * 2);
  const y = (v: number) => height - padY - ((v - min) / (max - min || 1)) * (height - padY * 2);
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const area =
    line +
    ` L${x(points.length - 1).toFixed(1)},${height - padY} L${x(0).toFixed(1)},${height - padY} Z`;
  const gid = `lc-grad-${gradientCounter++}`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={padX}
          y1={height - padY}
          x2={w - padX}
          y2={height - padY}
          stroke="var(--chart-grid)"
          strokeWidth="1"
        />
        <path d={area} fill={`url(#${gid})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={`${p.label}-hit`} cx={x(i)} cy={y(p.value)} r="10" fill="transparent">
            <title>{`${p.label}: ${formatValue(p.value)}`}</title>
          </circle>
        ))}
        {points.map((p, i) => (
          <circle
            key={`${p.label}-dot`}
            cx={x(i)}
            cy={y(p.value)}
            r="3.5"
            fill={color}
            stroke="var(--color-zinc-900)"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="mt-1 flex gap-1">
        {points.map((p) => (
          <span key={p.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-zinc-500">
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
