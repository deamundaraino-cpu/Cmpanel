import Link from "next/link";
import { getSql, PostRow, CampaignRow, ReportRow, StoryRow } from "@/lib/db";
import {
  weeklyBuckets,
  formatBreakdown,
  dayOfWeekBreakdown,
  periodDelta,
  weeklyStories,
  postingHeatmap,
} from "@/lib/metrics";
import { computeAlerts } from "@/lib/alerts";
import BarChart from "@/components/charts/BarChart";
import LineChart from "@/components/charts/LineChart";
import DeltaTile from "@/components/charts/DeltaTile";
import Heatmap from "@/components/charts/Heatmap";
import ReportPanel from "@/components/ReportPanel";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("es-ES");
const pct = (v: number) => (v * 100).toFixed(2).replace(".", ",") + "%";

type CampaignRollup = CampaignRow & { posts_count: number; total_reach: number; avg_er: number };

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const sql = getSql();

  const now = Date.now();
  const sinceCurrent = new Date(now - days * 86400_000).toISOString();
  const sincePrevious = new Date(now - days * 2 * 86400_000).toISOString();

  const currentPosts = await sql<PostRow[]>`
    SELECT * FROM posts WHERE timestamp >= ${sinceCurrent} ORDER BY timestamp ASC
  `;
  const previousPosts = await sql<PostRow[]>`
    SELECT * FROM posts WHERE timestamp >= ${sincePrevious} AND timestamp < ${sinceCurrent}
  `;

  const curReach = currentPosts.reduce((a, p) => a + p.reach, 0);
  const prevReach = previousPosts.reduce((a, p) => a + p.reach, 0);
  const curAvgEr = currentPosts.length
    ? currentPosts.reduce((a, p) => a + p.er, 0) / currentPosts.length
    : 0;
  const prevAvgEr = previousPosts.length
    ? previousPosts.reduce((a, p) => a + p.er, 0) / previousPosts.length
    : 0;
  const curWinners = currentPosts.filter((p) => p.is_winner).length;
  const prevWinners = previousPosts.filter((p) => p.is_winner).length;

  const weekly = weeklyBuckets(currentPosts);
  const formats = formatBreakdown(currentPosts);
  const weekdays = dayOfWeekBreakdown(currentPosts);
  const heatmap = postingHeatmap(currentPosts);
  const alerts = await computeAlerts();

  const stories = await sql<StoryRow[]>`
    SELECT * FROM stories WHERE timestamp >= ${sinceCurrent} ORDER BY timestamp DESC
  `;
  const prevStories = await sql<StoryRow[]>`
    SELECT * FROM stories WHERE timestamp >= ${sincePrevious} AND timestamp < ${sinceCurrent}
  `;

  const storyViews = stories.reduce((a, s) => a + s.views, 0);
  const storyExits = stories.reduce((a, s) => a + s.exits, 0);
  const storyReplies = stories.reduce((a, s) => a + s.replies, 0);
  const avgStoryReach = stories.length
    ? stories.reduce((a, s) => a + s.reach, 0) / stories.length
    : 0;
  const prevAvgStoryReach = prevStories.length
    ? prevStories.reduce((a, s) => a + s.reach, 0) / prevStories.length
    : 0;
  const exitRate = storyViews > 0 ? storyExits / storyViews : 0;
  const storiesWeekly = weeklyStories(stories);

  const campaigns = (await sql`
    SELECT c.*, COUNT(p.id)::int AS posts_count, COALESCE(SUM(p.reach), 0)::int AS total_reach,
      COALESCE(AVG(p.er), 0)::float AS avg_er
    FROM campaigns c LEFT JOIN posts p ON p.campaign_id = c.id
    GROUP BY c.id ORDER BY c.created_at DESC
  `) as unknown as CampaignRollup[];

  const reports = await sql<ReportRow[]>`
    SELECT * FROM reports ORDER BY id DESC LIMIT 5
  `;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Métricas y tendencias</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            Panel de control y seguimiento de tu presencia en Instagram.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
          {[7, 30, 90, 365].map((d) => (
            <Link
              key={d}
              href={`/metricas?days=${d}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                d === days ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {d === 365 ? "1 año" : `${d} días`}
            </Link>
          ))}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm font-medium">🚨 Alertas operativas</p>
          <div className="mt-3 grid gap-2">
            {alerts.map((a, i) => (
              <div
                key={i}
                className={`rounded-lg border-l-2 bg-zinc-950 p-3 ${
                  a.level === "critical"
                    ? "border-red-500"
                    : a.level === "warning"
                      ? "border-amber-500"
                      : "border-zinc-600"
                }`}
              >
                <p className="text-sm font-medium">
                  {a.level === "critical" ? "🔴" : a.level === "warning" ? "🟠" : "ℹ️"}{" "}
                  {a.title}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">{a.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DeltaTile
          label="Posts publicados"
          value={nf.format(currentPosts.length)}
          deltaPct={periodDelta(currentPosts.length, previousPosts.length)}
        />
        <DeltaTile
          label="Alcance total"
          value={nf.format(curReach)}
          deltaPct={periodDelta(curReach, prevReach)}
        />
        <DeltaTile
          label="Engagement medio"
          value={pct(curAvgEr)}
          deltaPct={periodDelta(curAvgEr, prevAvgEr)}
        />
        <DeltaTile
          label="Posts ganadores"
          value={nf.format(curWinners)}
          deltaPct={periodDelta(curWinners, prevWinners)}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm font-medium">Alcance por semana</p>
          <div className="mt-4">
            <BarChart bars={weekly.reach} formatValue={(v) => nf.format(v)} ariaLabel="Alcance semanal" />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm font-medium">Engagement medio por semana</p>
          <div className="mt-4">
            <LineChart points={weekly.er} formatValue={(v) => pct(v)} ariaLabel="Engagement semanal" />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm font-medium">Rendimiento por formato</p>
          <div className="mt-4">
            <BarChart bars={formats} formatValue={(v) => pct(v)} ariaLabel="Engagement por formato" />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm font-medium">Mejor día para publicar</p>
          <div className="mt-4">
            <BarChart bars={weekdays} formatValue={(v) => pct(v)} ariaLabel="Engagement por día de la semana" />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-medium">🕐 Mapa de calor: mejor día y franja horaria</p>
        <div className="mt-4">
          <Heatmap days={heatmap.days} slots={heatmap.slots} grid={heatmap.grid} />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">📱 Historias</p>
          <p className="text-xs text-zinc-600">
            Se capturan al sincronizar mientras están activas (24 h) — sincroniza a diario
          </p>
        </div>

        {stories.length ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DeltaTile
                label="Historias capturadas"
                value={nf.format(stories.length)}
                deltaPct={periodDelta(stories.length, prevStories.length)}
              />
              <DeltaTile
                label="Alcance medio"
                value={nf.format(Math.round(avgStoryReach))}
                deltaPct={periodDelta(avgStoryReach, prevAvgStoryReach)}
              />
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-xs text-zinc-500">Respuestas totales</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{nf.format(storyReplies)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-xs text-zinc-500">Tasa de salida</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{pct(exitRate)}</p>
                <p className="mt-1 text-xs text-zinc-600">salidas / visualizaciones</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-zinc-400">Historias por semana</p>
                <div className="mt-3">
                  <BarChart
                    bars={storiesWeekly.count}
                    formatValue={(v) => nf.format(v)}
                    ariaLabel="Historias publicadas por semana"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-400">Alcance medio por semana</p>
                <div className="mt-3">
                  <BarChart
                    bars={storiesWeekly.reach}
                    formatValue={(v) => nf.format(v)}
                    ariaLabel="Alcance medio de historias por semana"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="py-2 font-medium">Fecha</th>
                    <th className="py-2 text-right font-medium">Visualiz.</th>
                    <th className="py-2 text-right font-medium">Alcance</th>
                    <th className="py-2 text-right font-medium">Respuestas</th>
                    <th className="py-2 text-right font-medium">Compart.</th>
                    <th className="py-2 text-right font-medium">Salidas</th>
                    <th className="py-2 text-right font-medium">% salida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {stories.slice(0, 10).map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 text-zinc-300">
                        {s.timestamp
                          ? new Date(s.timestamp).toLocaleString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums text-zinc-300">{nf.format(s.views)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-300">{nf.format(s.reach)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-300">{nf.format(s.replies)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-300">{nf.format(s.shares)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-300">{nf.format(s.exits)}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-300">
                        {s.views > 0 ? pct(s.exits / s.views) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">
            Aún no hay historias capturadas en este periodo. Las historias solo
            se pueden leer de la API mientras están activas: publica una
            historia y pulsa «Sincronizar Instagram» en el Dashboard antes de
            que pasen 24 h, y quedará guardada aquí para siempre.
          </p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Rendimiento por campaña</p>
          <Link href="/campanas" className="text-xs text-indigo-400 hover:text-indigo-300">
            Gestionar campañas →
          </Link>
        </div>
        {campaigns.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <th className="py-2 font-medium">Campaña</th>
                  <th className="py-2 text-right font-medium">Posts</th>
                  <th className="py-2 text-right font-medium">Alcance</th>
                  <th className="py-2 text-right font-medium">ER medio</th>
                  <th className="py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2">
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full"
                        style={{ background: c.color }}
                      />
                      {c.nombre}
                    </td>
                    <td className="py-2 text-right tabular-nums">{c.posts_count}</td>
                    <td className="py-2 text-right tabular-nums">{nf.format(c.total_reach)}</td>
                    <td className="py-2 text-right tabular-nums">{pct(c.avg_er)}</td>
                    <td className="py-2 text-xs capitalize text-zinc-400">{c.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            Aún no has creado campañas.{" "}
            <Link href="/campanas" className="text-indigo-400 hover:text-indigo-300">
              Crea la primera →
            </Link>
          </p>
        )}
      </div>

      <div className="mt-6">
        <ReportPanel days={days} initialReports={reports} />
      </div>
    </div>
  );
}
