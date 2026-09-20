"use client";

import { useEffect, useState } from "react";
import {
  COVER_LAYOUTS,
  DEFAULT_DESIGN,
  DESIGN_LABELS,
  DESIGN_OPTIONS,
  FONT_PAIRS,
  REEL_TEMPLATES,
  type BrandDesign,
  type CoverLayout,
  type FontPairKey,
  type ReelTemplate,
} from "@/lib/brandDesign";

const KNOBS: { key: keyof typeof DESIGN_OPTIONS; label: string }[] = [
  { key: "textCase", label: "Texto" },
  { key: "emphasis", label: "Frase clave" },
  { key: "shape", label: "Esquinas" },
  { key: "background", label: "Fondo" },
  { key: "texture", label: "Grafismo" },
  { key: "align", label: "Alineación" },
];

export default function BrandDesignPanel({ onChanged }: { onChanged: () => void }) {
  const [design, setDesign] = useState<BrandDesign | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/brand-design")
      .then((r) => (r.ok ? r.json() : DEFAULT_DESIGN))
      .then(setDesign)
      .catch(() => setDesign(DEFAULT_DESIGN));
  }, []);

  async function save(next: BrandDesign) {
    setDesign(next);
    setBusy(true);
    try {
      const res = await fetch("/api/brand-design", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      // Lo que vale es lo que quedó guardado, no lo que se pulsó.
      if (json.design) setDesign(json.design);
      setNotice(null);
      onChanged();
    } catch (e) {
      setNotice({ ok: false, text: `⚠️ ${e instanceof Error ? e.message : "Error"}` });
    } finally {
      setBusy(false);
    }
  }

  async function proposeWithAI() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/brand-design", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setDesign(json.design);
      setNotice({ ok: true, text: json.design.notes ? `✓ ${json.design.notes}` : "✓ Esquema propuesto." });
      onChanged();
    } catch (e) {
      setNotice({ ok: false, text: `⚠️ ${e instanceof Error ? e.message : "Error"}` });
    } finally {
      setBusy(false);
    }
  }

  if (!design) return <p className="mt-5 text-xs text-zinc-600">Cargando esquema…</p>;

  const toggleTemplate = (t: ReelTemplate) => {
    const has = design.reelTemplates.includes(t);
    const next = has ? design.reelTemplates.filter((x) => x !== t) : [...design.reelTemplates, t];
    if (next.length < 3) return;
    save({ ...design, reelTemplates: next });
  };

  const toggleCover = (c: CoverLayout) => {
    const has = design.coverLayouts.includes(c);
    const next = has ? design.coverLayouts.filter((x) => x !== c) : [...design.coverLayouts, c];
    if (next.length < 2) return;
    save({ ...design, coverLayouts: next });
  };

  return (
    <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-medium text-zinc-300">🧬 Esquema de diseño de la marca</span>
          <p className="mt-1 text-xs text-zinc-600">
            Define cómo se dibujan carruseles y portadas: tipografía, cómo se resalta la frase clave, formas y fondo.
            Dos marcas con el mismo esquema se ven iguales aunque cambien los colores.
          </p>
        </div>
        <button
          onClick={proposeWithAI}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Pensando…" : "✨ Proponer según mi marca"}
        </button>
      </div>
      {notice && <p className={`mt-2 text-xs ${notice.ok ? "text-emerald-400" : "text-red-400"}`}>{notice.text}</p>}

      <div className="mt-3">
        <span className="text-[11px] font-medium text-zinc-500">Tipografía</span>
        <div className="mt-1.5 grid grid-cols-2 gap-2 lg:grid-cols-3">
          {(Object.keys(FONT_PAIRS) as FontPairKey[]).map((key) => {
            const pair = FONT_PAIRS[key];
            const active = design.fontPair === key;
            return (
              <button
                key={key}
                onClick={() => save({ ...design, fontPair: key })}
                disabled={busy}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  active ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-700 hover:border-zinc-600"
                }`}
              >
                <p className="text-xs font-semibold text-zinc-200">{pair.label}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{pair.vibe}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {KNOBS.map(({ key, label }) => (
          <label key={key} className="block">
            <span className="text-[11px] font-medium text-zinc-500">{label}</span>
            <select
              value={design[key] as string}
              disabled={busy}
              onChange={(e) => save({ ...design, [key]: e.target.value } as BrandDesign)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500"
            >
              {(DESIGN_OPTIONS[key] as readonly string[]).map((v) => (
                <option key={v} value={v}>
                  {DESIGN_LABELS[key]?.[v] || v}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex items-end gap-2 pb-1">
          <input
            type="checkbox"
            checked={design.tilt}
            disabled={busy}
            onChange={(e) => save({ ...design, tilt: e.target.checked })}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
          />
          <span className="text-xs text-zinc-300">Elementos girados (cintas, círculos)</span>
        </label>
      </div>

      <div className="mt-3">
        <span className="text-[11px] font-medium text-zinc-500">Composiciones de portada de carrusel</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {COVER_LAYOUTS.map((c) => {
            const active = design.coverLayouts.includes(c.value);
            return (
              <button
                key={c.value}
                onClick={() => toggleCover(c.value)}
                disabled={busy}
                title={c.hint}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  active ? "border-indigo-500 bg-indigo-500/15 text-zinc-100" : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <span className="text-[11px] font-medium text-zinc-500">Portadas de reel que usa esta marca</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {REEL_TEMPLATES.map((t) => {
            const active = design.reelTemplates.includes(t.value);
            return (
              <button
                key={t.value}
                onClick={() => toggleTemplate(t.value)}
                disabled={busy}
                title={t.hint}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  active ? "border-indigo-500 bg-indigo-500/15 text-zinc-100" : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
