"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Structure = { id: number; nombre: string; is_builtin: number };

export default function CreateProposalControl({
  postId,
  tema,
  label = "Crear contenido",
}: {
  postId?: string;
  tema?: string;
  label?: string;
}) {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [formato, setFormato] = useState<"carrusel" | "guion_video">("carrusel");
  const [structureId, setStructureId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/structures")
      .then((r) => r.json())
      .then((rows: Structure[]) => {
        setStructures(rows);
        if (rows.length) setStructureId(rows[0].id);
      });
  }, []);

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { formato };
      if (postId) body.postId = postId;
      else body.tema = tema;
      if (formato === "guion_video") body.structureId = structureId;

      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(true);
        setMsg(json.error || "Error");
      } else {
        setError(false);
        setMsg(formato === "carrusel" ? "Carrusel creado ✓" : "Guion creado ✓");
        router.refresh();
      }
    } catch {
      setError(true);
      setMsg("Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={formato}
        onChange={(e) => setFormato(e.target.value as "carrusel" | "guion_video")}
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500"
      >
        <option value="carrusel">🎨 Carrusel</option>
        <option value="guion_video">🎬 Guion de video</option>
      </select>
      {formato === "guion_video" && (
        <select
          value={structureId ?? ""}
          onChange={(e) => setStructureId(Number(e.target.value))}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500"
        >
          {structures.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={generate}
        disabled={busy || (formato === "guion_video" && !structureId)}
        className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {busy ? "Generando…" : label}
      </button>
      {msg && (
        <span className={`text-xs ${error ? "text-red-400" : "text-emerald-400"}`}>{msg}</span>
      )}
    </div>
  );
}
