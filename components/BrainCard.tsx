import Link from "next/link";

type Props = {
  clientNombre: string;
  postsCount: number;
  winnersCount: number;
  commentsCount: number;
  bestFormat: { label: string; mult: number } | null;
  bestDay: string | null;
  brief: { filled: number; total: number };
};

/**
 * La diferencia visible contra un chat genérico: qué contexto real de ESTE
 * cliente usa la IA en cada idea, guion e informe.
 */
export default function BrainCard({
  clientNombre,
  postsCount,
  winnersCount,
  commentsCount,
  bestFormat,
  bestDay,
  brief,
}: Props) {
  const chips: string[] = [];
  if (postsCount > 0) chips.push(`${postsCount} posts analizados`);
  if (winnersCount > 0) chips.push(`${winnersCount} ganadores ⭐`);
  if (bestFormat && bestFormat.mult > 1.05)
    chips.push(`mejor formato: ${bestFormat.label} (${bestFormat.mult.toFixed(1)}× tu ER)`);
  if (bestDay) chips.push(`mejor día: ${bestDay}`);
  if (commentsCount > 0) chips.push(`${commentsCount} comentarios minados`);
  chips.push(`ficha de marca ${brief.filled}/${brief.total}`);

  return (
    <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-indigo-300">
          🧠 Lo que tu IA sabe de {clientNombre}
        </p>
        {brief.filled < brief.total && (
          <Link
            href="/marca"
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Completa la ficha para mejorar las ideas →
          </Link>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((c) => (
          <span
            key={c}
            className="rounded-md bg-indigo-600/15 px-2.5 py-1 text-xs text-indigo-200"
          >
            {c}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        Cada idea, guion e informe se genera con este contexto — esto no lo
        puede hacer un chat genérico.
        {postsCount === 0 &&
          " Sincroniza el Instagram del cliente (o carga datos demo en Ajustes) para darle memoria a la IA."}
      </p>
    </div>
  );
}
