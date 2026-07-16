import Link from "next/link";
import { getSql } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { requireUser } from "@/lib/auth";
import CreateProposalControl from "@/components/CreateProposalControl";
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
};

const PILAR_META: Record<string, { label: string; badge: string }> = {
  crecimiento: { label: "📈 Crecimiento", badge: "bg-sky-600/20 text-sky-300" },
  adoctrinamiento: { label: "🧲 Adoctrinamiento", badge: "bg-violet-600/20 text-violet-300" },
  conversion: { label: "🎯 Conversión", badge: "bg-amber-600/20 text-amber-300" },
};

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

  const { userId } = await requireUser();
  const sql = getSql();
  const ideas = (
    filter
      ? await sql`SELECT * FROM ideas
          WHERE user_id = ${userId} AND pilar = ${filter} ORDER BY id DESC LIMIT 40`
      : await sql`SELECT * FROM ideas WHERE user_id = ${userId} ORDER BY id DESC LIMIT 40`
  ) as unknown as IdeaRow[];
  const s = await getSettings(userId, ["brand_niche"]);
  const niche = s.brand_niche;
  const hasTavily = !!process.env.TAVILY_API_KEY;

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
                  </div>
                  <p className="mt-2 font-medium">{idea.tema}</p>
                  {idea.angulo && <p className="mt-1 text-sm text-zinc-400">{idea.angulo}</p>}
                </div>
              </div>
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
