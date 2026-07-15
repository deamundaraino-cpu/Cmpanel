type Point = { date: string; value: number };

export default function Sparkline({ points }: { points: Point[] }) {
  if (points.length < 2) return null;
  const w = 560;
  const h = 120;
  const pad = 8;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const area =
    line + ` L${x(points.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-28 w-full"
      role="img"
      aria-label="Evolución de seguidores"
    >
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-grad)" />
      <path d={line} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.value)} r="8" fill="transparent">
          <title>{`${p.date}: ${p.value.toLocaleString("es-ES")} seguidores`}</title>
        </circle>
      ))}
      <circle
        cx={x(points.length - 1)}
        cy={y(points[points.length - 1].value)}
        r="3.5"
        fill="#818cf8"
        stroke="var(--color-zinc-900)"
        strokeWidth="2"
      />
    </svg>
  );
}
