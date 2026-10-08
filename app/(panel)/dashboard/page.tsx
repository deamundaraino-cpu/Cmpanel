import Link from "next/link";
import { getSql, PostRow } from "@/lib/db";
import { statsSummary } from "@/lib/scoring";
import { getSetting } from "@/lib/settings";
import { briefCompleteness } from "@/lib/brand";
import { getHealthScore } from "@/lib/health";
import { formatBreakdown, dayOfWeekBreakdown, periodDelta } from "@/lib/metrics";
import { ANALYSIS_PERIODS, parseAnalysisPeriod, periodBounds } from "@/lib/periods";
import { requireClient } from "@/lib/auth";
import { redirect } from "next/navigation";
import ActionButton from "@/components/ActionButton";
import ExprimirButton from "@/components/ExprimirButton";
import BrainCard from "@/components/BrainCard";
import HealthScoreCard from "@/components/HealthScoreCard";
import PilarMixCard from "@/components/PilarMixCard";
import Sparkline from "@/components/Sparkline";
import PageHeader from "@/components/PageHeader";
import PeriodSelector from "@/components/PeriodSelector";
import DeltaTile from "@/components/charts/DeltaTile";

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
  // Ausentes en diagnósticos antiguos, que analizaban todo el histórico.
  periodo_dias?: number;
  posts_analizados?: number;
};

const sumReach = (ps: PostRow[]) => ps.reduce((a, p) => a + p.reach, 0);
const meanEr = (ps: PostRow[]) => (ps.length ? ps.reduce((a, p) => a + p.er, 0) / ps.length : 0);

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { clientId, clientNombre, onboarded } = await requireClient();
  if (!onboarded) redirect("/onboarding");
  const days = parseAnalysisPeriod((await searchParams).days);
  const sql = getSql();
  // La BrainCard describe todo lo que la IA conoce del cliente: histórico completo.
  const { posts, avgEr } = await statsSummary(clientId);
  const winners = posts.filter((p) => p.is_winner);

  // Cifras, top y diagnóstico: solo la ventana elegida, comparada con la anterior.
  const { since, previousSince } = periodBounds(days);
  const periodPosts = posts.filter((p) => p.timestamp && p.timestamp >= since);
  const previousPosts = posts.filter(
    (p) => p.timestamp && p.timestamp >= previousSince && p.timestamp < since
  );
  const periodWinners = periodPosts.filter((p) => p.is_winner).length;
  const previousWinners = previousPosts.filter((p) => p.is_winner).length;

  // Contexto que la IA usa para este cliente (los "recibos" de la BrainCard).
  const [commentsRow] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM comments WHERE client_id = ${clientId}
  `;
  const brief = await briefCompleteness(clientId);
  const health = await getHealthScore(clientId);
  const formats = formatBreakdown(posts).sort((a, b) => b.value - a.value);
  const bestFormat =
    formats[0] && avgEr > 0
      ? { label: formats[0].label, mult: formats[0].value / avgEr }
      : null;
  const bestDay =
    dayOfWeekBreakdown(posts)
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)[0]?.label || null;
  const snapshots = await sql<{ date: string; followers_count: number }[]>`
    SELECT * FROM account_snapshots WHERE client_id = ${clientId} ORDER BY date ASC
  `;
  const followers = snapshots.at(-1)?.followers_count || 0;
  const username = await getSetting(clientId, "ig_username");
  const recs = await sql<{ created_at: string; content: string }[]>`
    SELECT * FROM recommendations WHERE client_id = ${clientId} ORDER BY id DESC LIMIT 1
  `;
  const lastRec = recs[0];
  const analysis: Analysis | null = lastRec ? JSON.parse(lastRec.content) : null;
  const top = [...periodPosts].sort((a, b) => b.er - a.er).slice(0, 5);

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
            <ActionButton
              label={`Analizar ${days} días con IA`}
              url="/api/analyze"
              body={{ days }}
              variant="ghost"
              doneMessage="Analizados {posts} posts"
            />
          </>
        }
      />

      <div className="mt-6">
        <HealthScoreCard health={health} />
      </div>

      <div className="mt-6">
        <PilarMixCard
          mix={health.mix}
          titulo="Mezcla de pilares"
          contexto="Piezas del calendario · últimos 30 días"
        />
      </div>

      <div className="mt-6">
        <BrainCard
          clientNombre={clientNombre}
          postsCount={posts.length}
          winnersCount={winners.length}
          commentsCount={commentsRow.n}
          bestFormat={bestFormat}
          bestDay={bestDay}
          brief={brief}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Rendimiento del periodo</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Últimos {days} días · comparado con los {days} días anteriores. El análisis con IA usa este mismo periodo.
          </p>
        </div>
        <PeriodSelector basePath="/dashboard" periods={ANALYSIS_PERIODS} current={days} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Seguidores</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{nf.format(followers)}</p>
          <p className="mt-1 text-xs text-zinc-600">total actual</p>
        </div>
        <DeltaTile
          label="Posts publicados"
          value={nf.format(periodPosts.length)}
          deltaPct={periodDelta(periodPosts.length, previousPosts.length)}
        />
        <DeltaTile
          label="Alcance"
          value={nf.format(sumReach(periodPosts))}
          deltaPct={periodDelta(sumReach(periodPosts), sumReach(previousPosts))}
        />
        <DeltaTile
          label="Engagement medio"
          value={pct(meanEr(periodPosts))}
          deltaPct={periodDelta(meanEr(periodPosts), meanEr(previousPosts))}
        />
        <DeltaTile
          label="Posts ganadores"
          value={nf.format(periodWinners)}
          deltaPct={periodDelta(periodWinners, previousWinners)}
        />
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
              {analysis.periodo_dias
                ? `Últimos ${analysis.periodo_dias} días · ${analysis.posts_analizados} posts · `
                : "Todo el histórico · "}
              {new Date(lastRec!.created_at).toLocaleString("es-ES")}
            </p>
          </div>
          {analysis.periodo_dias !== days && (
            <p className="mt-2 text-xs text-amber-400/80">
              Este diagnóstico es de {analysis.periodo_dias ? `otro periodo (${analysis.periodo_dias} días)` : "todo el histórico"}.
              Pulsa «Analizar {days} días con IA» para el periodo que estás viendo.
            </p>
          )}
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
          <p className="text-sm font-medium">Top 5 por engagement · últimos {days} días</p>
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
              {p.is_winner ? <ExprimirButton postId={p.id} compact /> : null}
            </li>
          ))}
          {!top.length && (
            <li className="py-4 text-sm text-zinc-500">
              {posts.length
                ? `No hay posts en los últimos ${days} días. Prueba con un periodo más largo.`
                : "Aún no hay posts. Sincroniza tu Instagram o carga datos demo en Ajustes."}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
