"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActionButton({
  label,
  url,
  body,
  variant = "primary",
  doneMessage,
}: {
  label: string;
  url: string;
  body?: Record<string, unknown>;
  variant?: "primary" | "ghost" | "danger";
  /** Plantilla con {clave} interpolada desde la respuesta JSON, ej. "{synced} posts" */
  doneMessage?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(true);
        setMsg(json.error || "Error");
      } else {
        setError(false);
        setMsg(
          doneMessage
            ? doneMessage.replace(/\{(\w+)\}/g, (_, k) => String(json[k] ?? ""))
            : "Hecho ✓"
        );
        router.refresh();
      }
    } catch {
      setError(true);
      setMsg("Error de red");
    } finally {
      setLoading(false);
    }
  }

  const styles = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white",
    ghost: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200",
    danger: "bg-red-900/60 hover:bg-red-800 text-red-100",
  }[variant];

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={run}
        disabled={loading}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles}`}
      >
        {loading ? "Procesando…" : label}
      </button>
      {msg && (
        <span className={`text-xs ${error ? "text-red-400" : "text-emerald-400"}`}>
          {msg}
        </span>
      )}
    </span>
  );
}
