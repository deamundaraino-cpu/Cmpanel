"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Slide = { titulo: string; cuerpo: string };
type Beat = { seccion: string; texto: string; edicion?: string };

export default function ProposalCard({
  id,
  status,
  createdAt,
  formato,
  slides,
  beats,
  caption,
  hashtags,
  quality,
  qualityNotes,
  clientFeedback,
}: {
  id: number;
  status: string;
  createdAt: string;
  formato: string;
  slides: Slide[];
  beats: Beat[];
  caption: string;
  hashtags: string[];
  quality?: number | null;
  qualityNotes?: string | null;
  clientFeedback?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [regenError, setRegenError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const isScript = formato === "guion_video";

  async function regenerate(text?: string) {
    const fb = (text ?? feedback).trim();
    if (!fb) return;
    setBusy(true);
    setRegenError(null);
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate", feedback: fb }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRegenError(json.error || "Error");
      } else {
        setFeedback("");
        setShowFeedback(false);
        router.refresh();
      }
    } catch {
      setRegenError("Error de red");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(next: string) {
    setBusy(true);
    await fetch(`/api/proposals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    router.refresh();
  }

  async function share() {
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share" }),
      });
      const json = await res.json();
      if (res.ok && json.path) {
        const url = `${window.location.origin}${json.path}`;
        setShareUrl(url);
        await navigator.clipboard.writeText(url).catch(() => {});
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("¿Eliminar esta propuesta?")) return;
    setBusy(true);
    await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  async function copyScript() {
    const text = beats
      .map(
        (b) =>
          `[${b.seccion.toUpperCase()}]\n${b.texto}${b.edicion ? `\n🎬 ${b.edicion}` : ""}`
      )
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const badge =
    status === "aprobada"
      ? "bg-emerald-600/20 text-emerald-300"
      : status === "rechazada"
        ? "bg-red-600/15 text-red-300"
        : "bg-amber-600/20 text-amber-300";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${badge}`}>
            {status}
          </span>
          {quality != null && (
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                quality >= 85
                  ? "bg-emerald-600/20 text-emerald-300"
                  : quality >= 65
                    ? "bg-amber-600/20 text-amber-300"
                    : "bg-red-600/15 text-red-300"
              }`}
              title={qualityNotes || "Autoevaluación de calidad de la IA"}
            >
              Score {quality}
            </span>
          )}
          <span className="text-xs text-zinc-500">
            {isScript ? `🎬 Guion de video · ${beats.length} secciones` : `🎨 Carrusel · ${slides.length} slides`} ·{" "}
            {new Date(createdAt).toLocaleString("es-ES")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === "pendiente" && (
            <>
              <button
                onClick={() => setStatus("aprobada")}
                disabled={busy}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                ✓ Aprobar
              </button>
              <button
                onClick={() => setStatus("rechazada")}
                disabled={busy}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
              >
                ✕ Rechazar
              </button>
            </>
          )}
          <button
            onClick={share}
            disabled={busy}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
            title="Genera un enlace público para que tu cliente apruebe o pida cambios sin cuenta"
          >
            {shareCopied ? "Enlace copiado ✓" : "🔗 Compartir con cliente"}
          </button>
          {isScript && (
            <button
              onClick={copyScript}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              {copied ? "Copiado ✓" : "📋 Copiar guion"}
            </button>
          )}
          <button
            onClick={() => setShowFeedback((v) => !v)}
            disabled={busy}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
          >
            ✏️ Pedir cambios
          </button>
          {status === "aprobada" && (
            <a
              href={`/api/proposals/${id}/download`}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              {isScript ? "⬇ Descargar .txt" : "⬇ Descargar ZIP"}
            </a>
          )}
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition hover:text-red-400"
            title="Eliminar"
          >
            🗑
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="mt-3 rounded-lg border border-indigo-900/50 bg-indigo-950/20 px-3 py-2 text-xs text-zinc-300">
          Enlace para tu cliente (copiado al portapapeles):{" "}
          <a
            href={shareUrl}
            target="_blank"
            className="break-all text-indigo-400 hover:text-indigo-300"
          >
            {shareUrl}
          </a>
        </div>
      )}

      {clientFeedback && (
        <div className="mt-3 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-300">
            💬 Tu cliente pidió cambios
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{clientFeedback}</p>
          <button
            onClick={() => regenerate(clientFeedback)}
            disabled={busy}
            className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Regenerando…" : "Regenerar aplicando su feedback"}
          </button>
        </div>
      )}

      {showFeedback && (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="Ej: hazlo más directo, cambia el gancho, menos hashtags, enfócalo a agencias…"
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          {regenError && <p className="mt-1 text-xs text-red-400">{regenError}</p>}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => regenerate()}
              disabled={busy || !feedback.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? "Regenerando…" : "Regenerar con estos cambios"}
            </button>
            <button
              onClick={() => setShowFeedback(false)}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isScript ? (
        <div className="mt-4 grid gap-2.5">
          {beats.map((b, i) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                {b.seccion}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{b.texto}</p>
              {b.edicion && (
                <p className="mt-2 border-t border-zinc-800/70 pt-2 text-xs text-zinc-500">
                  🎬 {b.edicion}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {slides.map((_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={`/api/slide?pid=${id}&i=${i}`}
              alt={`Slide ${i + 1}`}
              className="h-52 w-auto shrink-0 rounded-lg border border-zinc-800"
              loading="lazy"
            />
          ))}
        </div>
      )}

      <button
        onClick={() => setShowCaption((v) => !v)}
        className="mt-3 text-xs text-indigo-400 hover:text-indigo-300"
      >
        {showCaption ? "Ocultar caption" : "Ver caption y hashtags"}
      </button>
      {showCaption && (
        <div className="mt-2 rounded-lg bg-zinc-950 p-4 text-sm">
          <p className="whitespace-pre-wrap text-zinc-300">{caption}</p>
          <p className="mt-3 text-xs text-indigo-300">{hashtags.join(" ")}</p>
        </div>
      )}
    </div>
  );
}
