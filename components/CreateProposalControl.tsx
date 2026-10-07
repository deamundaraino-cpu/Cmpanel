"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PILARES, PILAR_META, toPilar } from "@/lib/pilares";
import { EXECUTION_FORMATS } from "@/lib/executionFormats";

type Structure = { id: number; nombre: string; is_builtin: number; pilar: string | null; ficha: string | null };

/** Primer formato de grabación recomendado en la ficha de la estructura. */
function recommendedFormat(s: Structure | undefined): string {
  try {
    return (JSON.parse(s?.ficha || "{}").formatos as string[] | undefined)?.[0] || "";
  } catch {
    return "";
  }
}

export default function CreateProposalControl({
  postId,
  tema,
  ideaId,
  pilar,
  label = "Crear contenido",
  defaultFormato = "carrusel",
}: {
  postId?: string;
  tema?: string;
  /** Idea de origen: sin esto el pilar se pierde y no se puede medir la mezcla. */
  ideaId?: number;
  pilar?: string | null;
  label?: string;
  /** Formato que propone la idea (el usuario puede cambiarlo). */
  defaultFormato?: "carrusel" | "guion_video";
}) {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [formato, setFormato] = useState<"carrusel" | "guion_video">(defaultFormato);
  const [structureId, setStructureId] = useState<number | null>(null);
  const [formatoGrabacion, setFormatoGrabacion] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/structures")
      .then((r) => r.json())
      .then((rows: Structure[]) => {
        setStructures(rows);
        // Si la pieza viene de una idea con pilar, arranca en una estructura de ese pilar.
        const first = rows.find((r) => pilar && r.pilar === pilar) || rows[0];
        if (first) {
          setStructureId(first.id);
          setFormatoGrabacion(recommendedFormat(first));
        }
      });
  }, []);

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { formato };
      if (postId) body.postId = postId;
      else body.tema = tema;
      if (ideaId) body.ideaId = ideaId;
      if (pilar) body.pilar = pilar;
      if (formato === "guion_video") {
        body.structureId = structureId;
        if (formatoGrabacion) body.formatoGrabacion = formatoGrabacion;
      }

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
        // El guion se genera en dos versiones con ángulos distintos para elegir.
        const versiones = Array.isArray(json.variantes) ? json.variantes.length : 1;
        setMsg(
          formato === "carrusel"
            ? "Carrusel creado ✓"
            : versiones > 1
              ? `${versiones} versiones creadas ✓`
              : "Guion creado ✓"
        );
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
        <>
          <select
            value={structureId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              setStructureId(id);
              setFormatoGrabacion(recommendedFormat(structures.find((s) => s.id === id)));
            }}
            title="Estructura de guion"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500"
          >
            {PILARES.map((p) => {
              const group = structures.filter((s) => toPilar(s.pilar) === p);
              return group.length ? (
                <optgroup key={p} label={PILAR_META[p].label}>
                  {group.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
            {structures.some((s) => !toPilar(s.pilar)) && (
              <optgroup label="Sin pilar">
                {structures
                  .filter((s) => !toPilar(s.pilar))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
          <select
            value={formatoGrabacion}
            onChange={(e) => setFormatoGrabacion(e.target.value)}
            title="Formato de grabación: adapta las notas de edición"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500"
          >
            <option value="">🎥 Formato libre</option>
            {EXECUTION_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                🎥 {f.nombre}
              </option>
            ))}
          </select>
        </>
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
