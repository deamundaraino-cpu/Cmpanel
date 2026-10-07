"use client";

import { useState } from "react";
import Link from "next/link";

const NOMBRE: Record<string, string> = { corto: "reel corto", carrusel: "carrusel", largo: "vídeo largo" };

/**
 * Exprime un post ganador: genera de una vez reel corto + carrusel + vídeo
 * largo a partir de él (3 operaciones de IA). Las piezas quedan en Propuestas.
 */
export default function ExprimirButton({ postId, compact = false }: { postId: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function run() {
    if (!confirm("Exprimir este ganador: se generan un reel corto, un carrusel y un vídeo largo (3 operaciones de IA). ¿Seguir?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/exprimir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      const j = await res.json();
      if (!res.ok) {
        setOk(false);
        setMsg(j.error || "No se pudo exprimir");
        return;
      }
      setOk(true);
      const hechas = (j.creadas as { pieza: string }[]).map((c) => NOMBRE[c.pieza] || c.pieza);
      const faltan = [...(j.omitidas as string[]), ...(j.fallidas as { pieza: string }[]).map((f) => f.pieza)].map(
        (p) => NOMBRE[p] || p
      );
      setMsg(`Listo: ${hechas.join(", ")}.${faltan.length ? ` Faltó: ${faltan.join(", ")} (cuota o error de IA).` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1">
      <button
        onClick={run}
        disabled={busy}
        title="Generar reel corto + carrusel + vídeo largo a partir de este ganador"
        className={`rounded-lg bg-emerald-600/90 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50 ${
          compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
        }`}
      >
        {busy ? "Exprimiendo…" : "🍋 Exprimir"}
      </button>
      {msg && (
        <p className={`max-w-[220px] text-[11px] ${ok ? "text-emerald-300" : "text-red-400"}`}>
          {msg}{" "}
          {ok && (
            <Link href="/propuestas" className="underline">
              Ver propuestas
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
