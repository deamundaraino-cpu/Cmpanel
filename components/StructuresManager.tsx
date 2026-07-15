"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Beat = { nombre: string; guia: string };
type Structure = {
  id: number;
  nombre: string;
  descripcion: string | null;
  beats: string;
  is_builtin: number;
};

const EMPTY_BEAT: Beat = { nombre: "", guia: "" };

export default function StructuresManager() {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [beats, setBeats] = useState<Beat[]>([{ ...EMPTY_BEAT }, { ...EMPTY_BEAT }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function load() {
    fetch("/api/structures")
      .then((r) => r.json())
      .then((rows: Structure[]) => {
        setStructures(rows);
        setLoaded(true);
      });
  }

  useEffect(load, []);

  function updateBeat(i: number, field: keyof Beat, value: string) {
    setBeats((prev) => prev.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)));
  }

  function addBeat() {
    setBeats((prev) => [...prev, { ...EMPTY_BEAT }]);
  }

  function removeBeat(i: number) {
    setBeats((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function createStructure() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, descripcion, beats }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(`⚠️ ${json.error || "Error"}`);
      } else {
        setMsg("Estructura creada ✓");
        setNombre("");
        setDescripcion("");
        setBeats([{ ...EMPTY_BEAT }, { ...EMPTY_BEAT }]);
        setShowForm(false);
        load();
        router.refresh();
      }
    } catch {
      setMsg("⚠️ Error de red");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStructure(id: number) {
    if (!confirm("¿Eliminar esta estructura?")) return;
    await fetch(`/api/structures/${id}`, { method: "DELETE" });
    load();
    router.refresh();
  }

  if (!loaded) return <p className="text-sm text-zinc-500">Cargando…</p>;

  return (
    <div className="grid gap-4">
      {structures.map((s) => {
        const b = JSON.parse(s.beats) as Beat[];
        return (
          <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{s.nombre}</p>
                  {!!s.is_builtin && (
                    <span className="rounded-md bg-indigo-600/15 px-1.5 py-0.5 text-xs text-indigo-300">
                      Base
                    </span>
                  )}
                </div>
                {s.descripcion && <p className="mt-1 text-sm text-zinc-400">{s.descripcion}</p>}
              </div>
              {!s.is_builtin && (
                <button
                  onClick={() => deleteStructure(s.id)}
                  className="shrink-0 text-sm text-zinc-500 transition hover:text-red-400"
                  title="Eliminar"
                >
                  🗑
                </button>
              )}
            </div>
            <ol className="mt-3 grid gap-1.5">
              {b.map((beat, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  <span className="w-28 shrink-0 font-medium text-zinc-300">
                    {i + 1}. {beat.nombre}
                  </span>
                  <span className="text-zinc-500">{beat.guia}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      })}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400 transition hover:border-indigo-500 hover:text-indigo-300"
        >
          + Añadir nueva estructura
        </button>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="font-medium">Nueva estructura</p>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Nombre</span>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Storytelling en 3 actos"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Descripción (opcional)</span>
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Para qué tipo de video funciona mejor"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </label>

            <div>
              <span className="text-xs font-medium text-zinc-400">Secciones (en orden)</span>
              <div className="mt-2 grid gap-2">
                {beats.map((beat, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={beat.nombre}
                      onChange={(e) => updateBeat(i, "nombre", e.target.value)}
                      placeholder={`Sección ${i + 1} (ej: Hook)`}
                      className="w-40 shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                    <input
                      value={beat.guia}
                      onChange={(e) => updateBeat(i, "guia", e.target.value)}
                      placeholder="Qué debe pasar en esta sección"
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                    {beats.length > 2 && (
                      <button
                        onClick={() => removeBeat(i)}
                        className="shrink-0 rounded-lg px-2 text-zinc-500 hover:text-red-400"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addBeat}
                className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
              >
                + Añadir sección
              </button>
            </div>

            {msg && <p className="text-xs text-zinc-400">{msg}</p>}

            <div className="flex gap-2">
              <button
                onClick={createStructure}
                disabled={busy || !nombre.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? "Guardando…" : "Guardar estructura"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
