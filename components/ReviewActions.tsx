"use client";

import { useState } from "react";

/** Botones de decisión del cliente en la página pública /revisar/[token]. */
export default function ReviewActions({
  token,
  initialStatus,
}: {
  token: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [showFeedback, setShowFeedback] = useState(false);
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(decision: "aprobar" | "cambios") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/revisar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comentario }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error");
      } else if (decision === "aprobar") {
        setStatus("aprobada");
        setDone("✓ Propuesta aprobada. Tu editor ya lo sabe — ¡gracias!");
      } else {
        setDone("✓ Comentarios enviados. Tu editor preparará una nueva versión.");
        setShowFeedback(false);
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-5 text-center">
        <p className="text-sm font-medium text-emerald-300">{done}</p>
      </div>
    );
  }

  if (status === "aprobada") {
    return (
      <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-5 text-center">
        <p className="text-sm font-medium text-emerald-300">
          ✓ Esta propuesta ya está aprobada.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm font-medium">¿Qué te parece esta propuesta?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => send("aprobar")}
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
        >
          ✓ Aprobar
        </button>
        <button
          onClick={() => setShowFeedback((v) => !v)}
          disabled={busy}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
        >
          ✏️ Pedir cambios
        </button>
      </div>

      {showFeedback && (
        <div className="mt-3">
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            placeholder="Ej: el gancho no me convence, prefiero un tono más cercano, cambia la sección 2…"
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => send("cambios")}
            disabled={busy || !comentario.trim()}
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Enviando…" : "Enviar comentarios"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
