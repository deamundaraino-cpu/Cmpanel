"use client";

import { useState } from "react";
import { stripEmphasis } from "@/lib/emphasis";

// Mismo orden que REEL_TEMPLATES en lib/reelCover.tsx (ese módulo es solo de servidor).
const TEMPLATES = [
  { value: "centro", label: "Bloque central" },
  { value: "arriba", label: "Titular arriba" },
  { value: "circulo", label: "Círculo" },
  { value: "cintas", label: "Cintas" },
  { value: "cita", label: "Cita" },
  { value: "split", label: "Bloque de color" },
  { value: "detras", label: "Texto detrás" },
];

export default function ReelCoverPicker({ id, initialTexts }: { id: number; initialTexts: string[] }) {
  const [texts, setTexts] = useState<string[]>(initialTexts);
  const [offsets, setOffsets] = useState<number[]>(TEMPLATES.map(() => 0));
  const [custom, setCustom] = useState("");
  const [applied, setApplied] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateTexts() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${id}/portada`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setTexts(json.portadas);
      setOffsets(TEMPLATES.map(() => 0));
      setApplied("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function textFor(i: number): string | null {
    if (applied) return applied;
    return texts.length ? texts[(i + offsets[i]) % texts.length] : null;
  }

  function url(i: number, download = false) {
    const t = textFor(i);
    const qs = new URLSearchParams({ t: TEMPLATES[i].value, k: String(i) });
    if (t) qs.set("texto", t);
    if (download) qs.set("download", "1");
    return `/api/proposals/${id}/portada?${qs}`;
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-400">🖼️ Portada del reel · {TEMPLATES.length} propuestas para elegir</p>
        <button
          onClick={generateTexts}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Generando textos…" : texts.length ? "🔄 Otra tanda de textos" : "✨ Generar textos de portada con IA"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setApplied(custom.trim())}
          maxLength={90}
          placeholder="Texto propio (opcional). Resalta con **palabra**"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => setApplied(custom.trim())}
          className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
        >
          Aplicar a todas
        </button>
        {applied && (
          <button onClick={() => setApplied("")} className="text-xs text-zinc-500 hover:text-zinc-300">
            Volver a los de la IA
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      {!texts.length && !applied && (
        <p className="mt-1.5 text-[11px] text-zinc-600">
          Este guion es anterior a los textos de portada: se usa la primera frase del gancho. Genera textos con IA para
          ver 6 ángulos distintos.
        </p>
      )}

      <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
        {TEMPLATES.map((t, i) => {
          const text = textFor(i);
          return (
            <div key={t.value} className="w-40 shrink-0">
              <a href={url(i)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url(i)}
                  alt={`Portada ${t.label}`}
                  className="aspect-[9/16] w-40 rounded-lg border border-zinc-800 bg-zinc-900 object-cover transition hover:border-indigo-500"
                  loading="lazy"
                />
              </a>
              <p className="mt-1 text-[11px] font-medium text-zinc-300">{t.label}</p>
              {text && <p className="line-clamp-2 text-[10px] leading-snug text-zinc-500">{stripEmphasis(text)}</p>}
              <div className="mt-1 flex gap-2">
                <a href={url(i, true)} className="text-[11px] text-indigo-400 hover:text-indigo-300">
                  Descargar
                </a>
                {texts.length > 1 && !applied && (
                  <button
                    onClick={() => setOffsets((o) => o.map((v, j) => (j === i ? v + 1 : v)))}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300"
                  >
                    ↻ Otro texto
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
