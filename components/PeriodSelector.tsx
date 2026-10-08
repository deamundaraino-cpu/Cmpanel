import Link from "next/link";

export default function PeriodSelector({
  basePath,
  periods,
  current,
}: {
  basePath: string;
  periods: readonly number[];
  current: number;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
      {periods.map((d) => (
        <Link
          key={d}
          href={`${basePath}?days=${d}`}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            d === current ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {d === 365 ? "1 año" : `${d} días`}
        </Link>
      ))}
    </div>
  );
}
