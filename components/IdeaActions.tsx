"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * «No me sirve» (descarte que la IA aprende) y «Más como esta» (variantes de
 * una idea ya convertida en contenido).
 */
export default function IdeaActions({
  ideaId,
  descartada,
  usada,
}: {
  ideaId: number;
  descartada: boolean;
  usada: boolean;
}) {
  const [busy, setBusy] = useState<"descartar" | "variantes" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  async function descartar() {
    setBusy("descartar");
    setMsg(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descartada: !descartada }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(true);
      setMsg("Error de red");
    } finally {
      setBusy(null);
    }
  }

  async function variantes() {
    setBusy("variantes");
    setMsg(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "variantes", ideaId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(true);
        setMsg(json.error || "Error");
      } else {
        setError(false);
        setMsg(`${json.count} variantes nuevas arriba ✓`);
        router.refresh();
      }
    } catch {
      setError(true);
      setMsg("Error de red");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {usada && !descartada && (
        <button
          onClick={variantes}
          disabled={!!busy}
          className="rounded-lg bg-emerald-600/15 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-600/25 disabled:opacity-50"
        >
          {busy === "variantes" ? "Generando…" : "✨ Más como esta"}
        </button>
      )}
      <button
        onClick={descartar}
        disabled={!!busy}
        title={descartada ? "Volver a mostrarla" : "Se oculta y la IA evitará ideas parecidas"}
        className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
      >
        {descartada ? "↺ Recuperar" : "✕ No me sirve"}
      </button>
      {msg && <span className={`text-xs ${error ? "text-red-400" : "text-emerald-400"}`}>{msg}</span>}
    </div>
  );
}
