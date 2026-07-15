import Link from "next/link";
import { getSql, PostRow } from "@/lib/db";
import { statsSummary } from "@/lib/scoring";
import { getSetting } from "@/lib/settings";
import ActionButton from "@/components/ActionButton";
import Sparkline from "@/components/Sparkline";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("es-ES");
const pct = (v: number) => (v * 100).toFixed(2).replace(".", ",") + "%";

type Analysis = {
  resumen: string;
  fortalezas: string[];
  mejoras: string[];
  acciones: string[];
  mejores_horas: string;
  formatos: string;
};

export default async function Dashboard() {
  const sql = getSql();
  const { posts, totalReach, avgEr } = await statsSummary();
  const winners = posts.filter((p) => p.is_winner);
  const snapshots = await sql<{ date: string; followers_count: number }[]>`
    SELECT * FROM account_snapshots ORDER BY date ASC
  `;
  const followers = snapshots.at(-1)?.followers_count || 0;
  const username = await getSetting("ig_username");
  const recs = await sql<{ created_at: string; content: string }[]>`
    SELECT * FROM recommendations ORDER BY id DESC LIMIT 1
  `;
  const lastRec = recs[0];
  const analysis: Analysis | null = lastRec ? JSON.parse(lastRec.content) : null;
  const top = [...posts].sort((a, b) => b.er - a.er).slice(0, 5);

  const tiles = [
    { label: "Seguidores", value: nf.format(followers) },
    { label: "Posts analizados", value: nf.format(posts.length) },
    { label: "Alcance acumulado", value: nf.format(totalReach) },
    { label: "Engagement medio", value: pct(avgEr) },
    { label: "Posts ganadores", value: nf.format(winners.length) },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Dashboard"
        subtitle={
          username
            ? `Cuenta conectada: @${username}`
            : "Sin cuenta conectada — ve a Ajustes o carga datos de demostración"
        }
        actions={
          <>
            <ActionButton
              label="Sincronizar Instagram"
              url="/api/sync"
              doneMessage="{synced} posts sincronizados"
            />
            <ActionButton label="Analizar con IA" url="/api/analyze" variant="ghost" />
          </>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">{t.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{t.value}</p>
          </div>
        ))}
      </div>

      {snapshots.length >= 2 && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm font-medium">Evolución de seguidores</p>
          <div className="mt-2">
            <Sparkline
              points={snapshots.map((s) => ({ date: s.date, value: s.followers_count }))}
            />
          </div>
        </div>
      )}

      {analysis && (
        <div className="mt-6 rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-indigo-300">
              Diagnóstico de tu CM con IA
            </p>
            <p className="text-xs text-zinc-500">
              {new Date(lastRec!.created_at).toLocaleString("es-ES")}
            </p>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{analysis.resumen}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-emerald-400">Fortalezas</p>
              <ul className="mt-1 list-disc pl-4 text-sm text-zinc-300">
                {analysis.fortalezas?.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-amber-400">A mejorar</p>
              <ul className="mt-1 list-disc pl-4 text-sm text-zinc-300">
                {analysis.mejoras?.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-indigo-300">Próximas acciones</p>
            <ul className="mt-1 list-disc pl-4 text-sm text-zinc-300">
              {analysis.acciones?.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
          <p className="mt-3 text-xs text-zinc-400">
            🕐 {analysis.mejores_horas} · 🧩 {analysis.formatos}
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Top 5 por engagement</p>
          <Link href="/posts" className="text-xs text-indigo-400 hover:text-indigo-300">
            Ver todos →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-zinc-800">
          {top.map((p: PostRow) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="w-12 shrink-0 rounded-md bg-indigo-600/15 px-1.5 py-0.5 text-center text-xs font-semibold text-indigo-300 tabular-nums">
                {p.score?.toFixed(1)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                {p.is_winner ? "⭐ " : ""}
                {p.caption || "(sin caption)"}
              </span>
              <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
                {pct(p.er)} ER
              </span>
            </li>
          ))}
          {!top.length && (
            <li className="py-4 text-sm text-zinc-500">
              Aún no hay posts. Sincroniza tu Instagram o carga datos demo en Ajustes.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
