import Link from "next/link";
import { getSql } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { requireClient } from "@/lib/auth";
import CreateProposalControl from "@/components/CreateProposalControl";
import { getTavilyKey } from "@/lib/appSettings";
import ResearchControl from "@/components/ResearchControl";
import IdeaUsageChecks from "@/components/IdeaUsageChecks";
import IdeaActions from "@/components/IdeaActions";
import AudienceVoice from "@/components/AudienceVoice";
import { PILARES, PILAR_META, toPilar } from "@/lib/pilares";
import { ETAPAS, ETAPA_META, toEtapa, coverageMatrix, gaps } from "@/lib/ideaSearch";

export const dynamic = "force-dynamic";

type IdeaRow = {
  id: number;
  created_at: string;
  tema: string;
  tesis: string | null;
  angulo: string | null;
  ganchos: string | null;
  formato: string | null;
  razon: string | null;
  pilar: string | null;
  etapa: string | null;
  evidencia: string | null;
  usado_video: boolean;
  usado_carrusel: boolean;
  descartada: boolean;
  parent_tema: string | null;
  ganadora: boolean;
};

// Los "recibos" de la IA: en qué dato real se basa cada idea.
const EVIDENCIA_META: Record<string, { label: string; badge: string }> = {
  audiencia: { label: "🗣️ Voz de la audiencia", badge: "bg-amber-600/20 text-amber-300" },
  comentarios: { label: "💬 De comentarios reales", badge: "bg-rose-600/20 text-rose-300" },
  conversacion: { label: "🧵 Conversación real", badge: "bg-orange-600/20 text-orange-300" },
  referente: { label: "👁 Referente", badge: "bg-sky-600/20 text-sky-300" },
  ganador: { label: "⭐ Basada en tu ganador", badge: "bg-emerald-600/20 text-emerald-300" },
  momento: { label: "📅 Momento del año", badge: "bg-cyan-600/20 text-cyan-300" },
  tendencia: { label: "🔍 Tendencia del nicho", badge: "bg-zinc-700/60 text-zinc-300" },
  // Ideas antiguas: la evidencia justificaba el formato, no la idea.
  formato: { label: "📊 Tu mejor formato", badge: "bg-indigo-600/20 text-indigo-300" },
};

function parseEvidencia(raw: string | null): { tipo: string; detalle: string } | null {
  if (!raw) return null;
  try {
    const e = JSON.parse(raw);
    return e?.tipo && EVIDENCIA_META[e.tipo] ? e : null;
  } catch {
    return null;
  }
}

function parseGanchos(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const g = JSON.parse(raw);
    return Array.isArray(g) ? g.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Ideas antiguas guardaban reel/imagen/historia; la plataforma crea carrusel o guion. */
function formatoIdea(f: string | null): "carrusel" | "guion_video" {
  return f === "guion_video" || f === "reel" ? "guion_video" : "carrusel";
}

const FILTERS = [
  { value: "", label: "Todas" },
  ...PILARES.map((p) => ({ value: p as string, label: PILAR_META[p].label })),
];

// Filtro por uso: qué ideas ya se convirtieron en contenido (video o carrusel).
const USOS = [
  { value: "", label: "Todas" },
  { value: "sin", label: "Sin usar" },
  { value: "usadas", label: "Ya usadas" },
  { value: "descartadas", label: "Descartadas" },
] as const;

function ideasHref(pilar: string, uso: string) {
  const q = new URLSearchParams();
  if (pilar) q.set("pilar", pilar);
  if (uso) q.set("uso", uso);
  const qs = q.toString();
  return qs ? `/ideas?${qs}` : "/ideas";
}

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ pilar?: string; uso?: string }>;
}) {
  const sp = await searchParams;
  const filter = toPilar(sp.pilar) ?? "";
  const uso = sp.uso === "sin" || sp.uso === "usadas" || sp.uso === "descartadas" ? sp.uso : "";

  const { clientId } = await requireClient();
  const sql = getSql();
  const ideas = (await sql`
    SELECT i.*, parent.tema AS parent_tema,
      EXISTS (
        SELECT 1 FROM proposals pr JOIN posts p ON p.client_id = pr.client_id AND p.id = pr.post_id
        WHERE pr.client_id = i.client_id AND pr.idea_id = i.id AND p.is_winner = 1
      ) AS ganadora
    FROM ideas i
    LEFT JOIN ideas parent ON parent.id = i.parent_id
    WHERE i.client_id = ${clientId}
      ${filter ? sql`AND i.pilar = ${filter}` : sql``}
      ${uso === "descartadas" ? sql`AND i.descartada` : sql`AND NOT i.descartada`}
      ${uso === "sin" ? sql`AND NOT i.usado_video AND NOT i.usado_carrusel` : sql``}
      ${uso === "usadas" ? sql`AND (i.usado_video OR i.usado_carrusel)` : sql``}
    ORDER BY i.id DESC LIMIT 40`) as unknown as IdeaRow[];

  const coverageRows = await sql<{ pilar: string | null; etapa: string | null; usada: boolean }[]>`
    SELECT pilar, etapa, (usado_video OR usado_carrusel) AS usada FROM ideas
    WHERE client_id = ${clientId} AND NOT descartada AND etapa IS NOT NULL
  `;
  const cells = coverageMatrix(coverageRows);
  const huecos = new Set(gaps(cells, 3).map((c) => `${c.pilar}:${c.etapa}`));
  const hayMapa = coverageRows.length > 0;

  const s = await getSettings(clientId, ["brand_niche", "audience_voice"]);
  const niche = s.brand_niche;
  const hasTavily = !!(await getTavilyKey());

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ideas y nicho</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            {niche ? `Nicho: ${niche.slice(0, 80)}…` : "Configura tu nicho en 🧠 Marca."}
            {!hasTavily && " · Sin Tavily la investigación no usa búsqueda web en vivo."}
          </p>
        </div>
        <ResearchControl />
      </div>

      <div className="mt-5 grid gap-3">
        <AudienceVoice initial={s.audience_voice || ""} />

        <details className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3" open={hayMapa}>
          <summary className="cursor-pointer select-none text-sm font-medium text-zinc-200">
            🧭 Mapa de huecos{" "}
            <span className="font-normal text-zinc-500">· ideas usadas / propuestas por pilar y etapa del cliente</span>
          </summary>
          {hayMapa ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="py-1.5 text-left font-normal"></th>
                    {ETAPAS.map((e) => (
                      <th key={e} className="py-1.5 text-center font-normal">
                        {ETAPA_META[e].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PILARES.map((p) => (
                    <tr key={p}>
                      <td className="py-1 pr-3 text-zinc-300">{PILAR_META[p].label}</td>
                      {ETAPAS.map((e) => {
                        const c = cells.find((x) => x.pilar === p && x.etapa === e)!;
                        const hueco = huecos.has(`${p}:${e}`);
                        return (
                          <td key={e} className="p-1">
                            <div
                              className={`rounded-md py-1.5 text-center ${
                                hueco
                                  ? "border border-dashed border-amber-500/50 text-amber-300"
                                  : c.usadas
                                    ? "bg-emerald-600/15 text-emerald-300"
                                    : "bg-zinc-800/60 text-zinc-400"
                              }`}
                            >
                              {c.usadas} / {c.propuestas}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-zinc-500">
                Con borde ámbar, lo menos trabajado. «🧭 Llenar huecos» genera ideas justo ahí.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">
              Se llena con las ideas nuevas (las antiguas no tienen etapa del cliente). Genera ideas para verlo.
            </p>
          )}
        </details>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={ideasHref(f.value, uso)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f.value
                ? "bg-indigo-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <span className="mx-1 w-px self-stretch bg-zinc-800" />
        {USOS.map((u) => (
          <Link
            key={u.value}
            href={ideasHref(filter, u.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              uso === u.value
                ? "bg-emerald-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {u.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {ideas.map((idea) => {
          const p = toPilar(idea.pilar);
          const meta = p ? PILAR_META[p] : null;
          const etapa = toEtapa(idea.etapa);
          const ev = parseEvidencia(idea.evidencia);
          const evMeta = ev ? EVIDENCIA_META[ev.tipo] : null;
          const ganchos = parseGanchos(idea.ganchos);
          const formato = formatoIdea(idea.formato);
          const usada = idea.usado_video || idea.usado_carrusel;
          return (
            <div
              key={idea.id}
              className={`rounded-xl border p-5 ${
                idea.descartada
                  ? "border-zinc-800 bg-zinc-900/40 opacity-70"
                  : usada
                    ? "border-emerald-900/50 bg-zinc-900/60"
                    : "border-zinc-800 bg-zinc-900"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {meta && (
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                        {meta.label}
                      </span>
                    )}
                    {etapa && (
                      <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300" title={ETAPA_META[etapa].guia}>
                        👤 {ETAPA_META[etapa].label}
                      </span>
                    )}
                    <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {formato === "guion_video" ? "🎬 video" : "🎨 carrusel"}
                    </span>
                    {evMeta && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${evMeta.badge}`}
                        title={ev!.detalle}
                      >
                        {evMeta.label}
                      </span>
                    )}
                    {idea.ganadora && (
                      <span className="rounded-md bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-300">
                        🏆 Funcionó
                      </span>
                    )}
                  </div>
                  {idea.parent_tema && (
                    <p className="mt-2 text-xs text-zinc-500">↳ Variante de: {idea.parent_tema}</p>
                  )}
                  <p className="mt-2 font-medium">{idea.tema}</p>
                  {idea.tesis && (
                    <p className="mt-1.5 border-l-2 border-indigo-500/60 pl-3 text-sm text-zinc-200">
                      {idea.tesis}
                    </p>
                  )}
                  {idea.angulo && <p className="mt-1.5 text-sm text-zinc-400">{idea.angulo}</p>}
                </div>
                <IdeaUsageChecks
                  ideaId={idea.id}
                  usadoVideo={!!idea.usado_video}
                  usadoCarrusel={!!idea.usado_carrusel}
                />
              </div>
              {ganchos.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer select-none text-xs text-zinc-400 hover:text-zinc-200">
                    🪝 {ganchos.length} ganchos posibles
                  </summary>
                  <ul className="mt-1.5 grid gap-1">
                    {ganchos.map((g, n) => (
                      <li key={n} className="rounded-md bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-300">
                        {g}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {ev?.detalle && <p className="mt-2 text-xs text-zinc-500">📎 {ev.detalle}</p>}
              {idea.razon && <p className="mt-2 text-xs text-zinc-500">💡 {idea.razon}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {!idea.descartada ? (
                  <CreateProposalControl
                    tema={`${idea.tema} — ${idea.angulo || ""}`}
                    ideaId={idea.id}
                    pilar={idea.pilar}
                    label="Crear contenido"
                    defaultFormato={formato}
                  />
                ) : (
                  <span />
                )}
                <IdeaActions ideaId={idea.id} descartada={idea.descartada} usada={usada} />
              </div>
            </div>
          );
        })}
        {!ideas.length && (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
            {uso
              ? "No hay ideas con este filtro."
              : filter
                ? "No hay ideas de este pilar todavía. Genera algunas con el selector de arriba."
                : "Aún no hay ideas. Pulsa «Investigar ahora» para que tu CM busque temas en tu nicho."}
          </div>
        )}
      </div>
    </div>
  );
}
