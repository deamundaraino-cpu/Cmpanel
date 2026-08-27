"use client";

import { useEffect, useState } from "react";

type LeadWeek = { week_start: string; count: number };

function label(week: string): string {
  const d = new Date(`${week}T00:00:00Z`);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * El único dato de negocio que la plataforma no puede sacar de la API de
 * Instagram. Sin esto los informes solo hablan de alcance y engagement.
 */
export default function LeadCounter() {
  const [weeks, setWeeks] = useState<LeadWeek[]>([]);
  const [semanaActual, setSemanaActual] = useState<string>("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    const res = await fetch("/api/leads");
    if (!res.ok) return;
    const json = await res.json();
    setWeeks(json.weeks || []);
    setSemanaActual(json.semanaActual);
    const actual = (json.weeks || []).find(
      (w: LeadWeek) => w.week_start === json.semanaActual
    );
    if (actual) setValue(String(actual.count));
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (value === "") return;
    setBusy(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: Number(value) }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      load();
    }
  }

  const max = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm font-medium">Leads captados</p>
      <p className="mt-1 text-xs text-zinc-500">
        Instagram no expone esto: anótalo tú cada semana y los informes con IA
        podrán comparar leads contra alcance en vez de hablar solo de métricas
        de vanidad.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="0"
          className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm tabular-nums outline-none focus:border-indigo-500"
        />
        <button
          onClick={save}
          disabled={busy || value === ""}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Guardando…" : saved ? "Guardado ✓" : "Guardar"}
        </button>
        <span className="text-xs text-zinc-600">
          semana del {semanaActual ? label(semanaActual) : "—"}
        </span>
      </div>

      {weeks.length > 1 && (
        <div className="mt-4 flex items-end gap-1.5">
          {weeks.map((w) => (
            <div key={w.week_start} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-zinc-500">{w.count}</span>
              <div
                className={`w-full rounded-t ${
                  w.week_start === semanaActual ? "bg-indigo-500" : "bg-indigo-500/40"
                }`}
                style={{ height: `${Math.max(3, (w.count / max) * 48)}px` }}
                title={`Semana del ${label(w.week_start)}: ${w.count} leads`}
              />
              <span className="text-[10px] text-zinc-600">{label(w.week_start)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
