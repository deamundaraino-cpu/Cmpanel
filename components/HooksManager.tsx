"use client";

import { useEffect, useState } from "react";

type Hook = {
  id: number;
  texto: string;
  formato: string | null;
  source_post_id: string | null;
  er: number | null;
};

const pct = (v: number) => (v * 100).toFixed(2).replace(".", ",") + "%";

export default function HooksManager() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);

  async function load() {
    const res = await fetch("/api/hooks");
    if (res.ok) setHooks(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: number) {
    if (!confirm("¿Quitar este gancho de la librería?")) return;
    await fetch(`/api/hooks/${id}`, { method: "DELETE" });
    setHooks((prev) => prev.filter((h) => h.id !== id));
  }

  async function copy(h: Hook) {
    await navigator.clipboard.writeText(h.texto);
    setCopied(h.id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando…</p>;
  }

  if (!hooks.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-500">
        Todavía no hay ganchos archivados. Se guardan solos cuando un post que
        salió de una propuesta aprobada resulta <strong>ganador</strong> — es
        decir, cuando su engagement supera 1,5× tu mediana con alcance por
        encima de la mediana.
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      {hooks.map((h) => (
        <div
          key={h.id}
          className="group rounded-xl border border-zinc-800 bg-zinc-900 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-snug text-zinc-200">{h.texto}</p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => copy(h)}
                className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700"
              >
                {copied === h.id ? "Copiado ✓" : "Copiar"}
              </button>
              <button
                onClick={() => remove(h.id)}
                className="hidden text-xs text-zinc-600 transition hover:text-red-400 group-hover:block"
                title="Quitar"
              >
                🗑
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-md bg-emerald-600/15 px-2 py-0.5 text-emerald-300">
              ⭐ Ganador
            </span>
            {h.er != null && (
              <span className="tabular-nums">{pct(h.er)} ER</span>
            )}
            <span>{h.formato === "guion_video" ? "🎬 Guion" : "🎨 Carrusel"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
