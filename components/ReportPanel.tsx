"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReportContent = {
  resumen: string;
  aciertos: string[];
  riesgos: string[];
  recomendaciones: string[];
};
type ReportRow = { id: number; created_at: string; period_days: number; content: string };

export default function ReportPanel({
  days,
  initialReports,
}: {
  days: number;
  initialReports: ReportRow[];
}) {
  const [reports, setReports] = useState(initialReports);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error");
      } else {
        setReports((prev) => [
          {
            id: json.id,
            created_at: new Date().toISOString(),
            period_days: days,
            content: JSON.stringify(json.report),
          },
          ...prev,
        ]);
        router.refresh();
      }
    } catch {
      setError("Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">📋 Informe ejecutivo</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Resumen con IA de los últimos {days} días.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Generando…" : "Generar informe"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <div className="mt-4 grid gap-3">
        {reports.map((r) => {
          const c: ReportContent = JSON.parse(r.content);
          return (
            <div key={r.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs text-zinc-500">
                {new Date(r.created_at).toLocaleString("es-ES")} · últimos {r.period_days} días
              </p>
              <p className="mt-1.5 text-sm text-zinc-200">{c.resumen}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-emerald-400">Qué funcionó</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-zinc-400">
                    {c.aciertos?.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-400">Qué vigilar</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-zinc-400">
                    {c.riesgos?.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-300">Recomendaciones</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-zinc-400">
                    {c.recomendaciones?.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
        {!reports.length && (
          <p className="text-xs text-zinc-600">Aún no has generado ningún informe.</p>
        )}
      </div>
    </div>
  );
}
