import { getSql, ReportRow } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type ReportContent = {
  resumen: string;
  aciertos: string[];
  riesgos: string[];
  recomendaciones: string[];
};

/**
 * Página PÚBLICA del informe ejecutivo: el gestor la comparte por enlace y
 * su cliente la lee desde el móvil, sin cuenta ni login.
 */
export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sql = getSql();
  const rows = await sql<ReportRow[]>`
    SELECT * FROM reports WHERE share_token = ${token}
  `;
  const report = rows[0];

  if (!report) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <p className="text-2xl">🔍</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Enlace no válido</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Este informe ya no existe o el enlace es incorrecto. Pide a tu
          gestor de contenido que te comparta uno nuevo.
        </p>
      </main>
    );
  }

  const c: ReportContent = JSON.parse(report.content);
  const s = await getSettings(report.client_id, ["brand_name", "brand_handle"]);
  const brandLabel = s.brand_name || s.brand_handle || "la cuenta";

  const SECTIONS: { title: string; color: string; items: string[] }[] = [
    { title: "✅ Qué funcionó", color: "text-emerald-400", items: c.aciertos || [] },
    { title: "⚠️ Qué vigilar", color: "text-amber-400", items: c.riesgos || [] },
    { title: "🎯 Recomendaciones", color: "text-indigo-300", items: c.recomendaciones || [] },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Informe de rendimiento en Instagram
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{brandLabel}</h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          Últimos {report.period_days} días ·{" "}
          {new Date(report.created_at).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </header>

      <section className="mt-8 rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
          Resumen ejecutivo
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-200">{c.resumen}</p>
      </section>

      <div className="mt-4 grid gap-4">
        {SECTIONS.filter((sec) => sec.items.length).map((sec) => (
          <section key={sec.title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className={`text-xs font-semibold uppercase tracking-wide ${sec.color}`}>
              {sec.title}
            </p>
            <ul className="mt-2 grid gap-1.5 pl-4 text-sm leading-relaxed text-zinc-300">
              {sec.items.map((item, i) => (
                <li key={i} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="mt-12 pb-6 text-center text-xs text-zinc-600">
        Preparado por tu gestor de contenido · Hecho con Brandpanel
      </footer>
    </main>
  );
}
