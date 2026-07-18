import Link from "next/link";
import { getSql } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { requireClient } from "@/lib/auth";
import CreateProposalControl from "@/components/CreateProposalControl";
import { getTavilyKey } from "@/lib/appSettings";
import ResearchControl from "@/components/ResearchControl";

export const dynamic = "force-dynamic";

type IdeaRow = {
  id: number;
  created_at: string;
  tema: string;
  angulo: string | null;
  formato: string | null;
  razon: string | null;
  pilar: string | null;
  evidencia: string | null;
};

const PILAR_META: Record<string, { label: string; badge: string }> = {
  crecimiento: { label: "📈 Crecimiento", badge: "bg-sky-600/20 text-sky-300" },
  adoctrinamiento: { label: "🧲 Adoctrinamiento", badge: "bg-violet-600/20 text-violet-300" },
  conversion: { label: "🎯 Conversión", badge: "bg-amber-600/20 text-amber-300" },
};

// Los "recibos" de la IA: en qué dato real se basa cada idea.
const EVIDENCIA_META: Record<string, { label: string; badge: string }> = {
  ganador: { label: "⭐ Basada en tu ganador", badge: "bg-emerald-600/20 text-emerald-300" },
  comentarios: { label: "💬 De comentarios reales", badge: "bg-rose-600/20 text-rose-300" },
  formato: { label: "📊 Tu mejor formato", badge: "bg-indigo-600/20 text-indigo-300" },
  tendencia: { label: "🔍 Tendencia del nicho", badge: "bg-zinc-700/60 text-zinc-300" },
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

const FILTERS = [
  { value: "", label: "Todas" },
  { value: "crecimiento", label: "📈 Crecimiento" },
  { value: "adoctrinamiento", label: "🧲 Adoctrinamiento" },
  { value: "conversion", label: "🎯 Conversión" },
];

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ pilar?: string }>;
}) {
  const sp = await searchParams;
  const filter = ["crecimiento", "adoctrinamiento", "conversion"].includes(sp.pilar || "")
    ? sp.pilar!
    : "";

  const { clientId } = await requireClient();
  const sql = getSql();
  const ideas = (
    filter
      ? await sql`SELECT * FROM ideas
          WHERE client_id = ${clientId} AND pilar = ${filter} ORDER BY id DESC LIMIT 40`
      : await sql`SELECT * FROM ideas WHERE client_id = ${clientId} ORDER BY id DESC LIMIT 40`
  ) as unknown as IdeaRow[];
  const s = await getSettings(clientId, ["brand_niche"]);
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

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/ideas?pilar=${f.value}` : "/ideas"}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f.value
                ? "bg-indigo-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {ideas.map((idea) => {
          const meta = idea.pilar ? PILAR_META[idea.pilar] : null;
          const ev = parseEvidencia(idea.evidencia);
          const evMeta = ev ? EVIDENCIA_META[ev.tipo] : null;
          return (
            <div key={idea.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {meta && (
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                        {meta.label}
                      </span>
                    )}
                    <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {idea.formato}
                    </span>
                    {evMeta && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${evMeta.badge}`}
                        title={ev!.detalle}
                      >
                        {evMeta.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-medium">{idea.tema}</p>
                  {idea.angulo && <p className="mt-1 text-sm text-zinc-400">{idea.angulo}</p>}
                </div>
              </div>
              {ev?.detalle && (
                <p className="mt-2 text-xs text-zinc-500">📎 {ev.detalle}</p>
              )}
              {idea.razon && <p className="mt-2 text-xs text-zinc-500">💡 {idea.razon}</p>}
              <div className="mt-3">
                <CreateProposalControl
                  tema={`${idea.tema} — ${idea.angulo || ""}`}
                  label="Crear contenido"
                />
              </div>
            </div>
          );
        })}
        {!ideas.length && (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
            {filter
              ? "No hay ideas de este pilar todavía. Genera algunas con el selector de arriba."
              : "Aún no hay ideas. Pulsa «Investigar ahora» para que tu CM busque temas en tu nicho."}
          </div>
        )}
      </div>
    </div>
  );
}
