"use client";

import { useState } from "react";
import { COVER_LAYOUTS, type CoverLayout } from "@/lib/brandDesign";
import { stripEmphasis } from "@/lib/emphasis";

type Photo = { id: string; hasCutout: boolean };

/** Elige la composición y la foto de la portada del carrusel (se guarda en la propuesta). */
export default function CarouselCoverPicker({
  id,
  photos,
  layouts,
  layout,
  selectedPhoto,
  titulo,
  initialTexts,
  onChanged,
}: {
  id: number;
  photos: Photo[];
  layouts: CoverLayout[];
  layout?: string;
  selectedPhoto?: string;
  titulo: string;
  initialTexts: string[];
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState({ layout, foto: selectedPhoto, titulo });
  const [texts, setTexts] = useState<string[]>(initialTexts);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = COVER_LAYOUTS.filter((l) => layouts.includes(l.value));
  if (!options.length) return null;

  async function generateTexts() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${id}/portada`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setTexts(json.portadas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function save(next: { layout?: string; foto?: string; titulo?: string }) {
    setBusy(true);
    setError(null);
    const merged = { ...current, ...next };
    setCurrent(merged);
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cover", ...merged }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && draft.trim() && save({ titulo: draft.trim() })}
          maxLength={120}
          placeholder={`Texto de portada: ${stripEmphasis(current.titulo)}`}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => draft.trim() && save({ titulo: draft.trim() })}
          disabled={busy || !draft.trim()}
          className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          Cambiar texto
        </button>
        <button
          onClick={generateTexts}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "…" : texts.length ? "🔄 Otros textos" : "✨ Proponer textos"}
        </button>
      </div>

      {texts.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {texts.map((t) => (
            <button
              key={t}
              onClick={() => save({ titulo: t })}
              disabled={busy}
              title="Usar este texto en la portada"
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                current.titulo === t ? "border-indigo-500 bg-indigo-500/15 text-zinc-100" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {stripEmphasis(t)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-zinc-500">Portada:</span>
      {options.map((l) => (
        <button
          key={l.value}
          onClick={() => save({ layout: l.value })}
          disabled={busy}
          title={l.hint}
          className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
            current.layout === l.value ? "border-indigo-500 bg-indigo-500/15 text-zinc-100" : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
          }`}
        >
          {l.label}
        </button>
      ))}
      {photos.length > 0 &&
        photos.map((p) => (
          <button
            key={p.id}
            onClick={() => save({ foto: p.id })}
            disabled={busy}
            className={`overflow-hidden rounded-lg border transition ${
              current.foto === p.id ? "border-indigo-500" : "border-zinc-700 hover:border-zinc-600"
            }`}
            title={p.hasCutout ? "Foto recortada" : "Sin recorte"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/brand-photos?id=${encodeURIComponent(p.id)}&kind=${p.hasCutout ? "cutout" : "photo"}`}
              alt="Foto"
              className="h-8 w-8 object-cover"
            />
          </button>
        ))}
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>
      <p className="mt-1 text-[10px] text-zinc-600">
        El texto de portada es también el título del primer slide. Resalta con **palabra**.
      </p>
    </div>
  );
}
