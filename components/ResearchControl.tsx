"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "", label: "⚖️ Mix de los 3 pilares" },
  { value: "huecos", label: "🧭 Llenar huecos (lo menos trabajado)" },
  { value: "crecimiento", label: "📈 Solo Crecimiento" },
  { value: "adoctrinamiento", label: "🧲 Solo Adoctrinamiento" },
  { value: "conversion", label: "🎯 Solo Conversión" },
  { value: "comentarios", label: "🗣️ Desde la voz de la audiencia" },
  { value: "referentes", label: "👁 Desde tus referentes" },
];

export default function ResearchControl() {
  const [pilar, setPilar] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const body =
        pilar === "comentarios" || pilar === "huecos" || pilar === "referentes" ? { source: pilar } : pilar ? { pilar } : {};
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(true);
        setMsg(json.error || "Error");
      } else {
        setError(false);
        setMsg(
          `${json.count} ideas nuevas${json.webSearch ? " (con búsqueda web)" : ""}${
            json.repetidas ? ` · ${json.repetidas} descartadas por repetidas` : ""
          }`
        );
        router.refresh();
      }
    } catch {
      setError(true);
      setMsg("Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={pilar}
        onChange={(e) => setPilar(e.target.value)}
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? "Investigando…" : "🔍 Investigar ahora"}
      </button>
      {msg && (
        <span className={`text-xs ${error ? "text-red-400" : "text-emerald-400"}`}>{msg}</span>
      )}
    </div>
  );
}
