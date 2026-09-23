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
const INPUT = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500";

/** Formulario compartido: sirve para crear una estructura nueva y para editar una existente. */
function StructureForm({
  title,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  title: string;
  initial?: { nombre: string; descripcion: string; beats: Beat[] };
  busy: boolean;
  onSave: (data: { nombre: string; descripcion: string; beats: Beat[] }) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion || "");
  const [beats, setBeats] = useState<Beat[]>(initial?.beats?.length ? initial.beats : [{ ...EMPTY_BEAT }, { ...EMPTY_BEAT }]);

  const updateBeat = (i: number, field: keyof Beat, value: string) =>
    setBeats((prev) => prev.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)));

  const moveBeat = (i: number, dir: -1 | 1) =>
    setBeats((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="grid gap-3">
      <p className="font-medium">{title}</p>
      <label className="block">
        <span className="text-xs font-medium text-zinc-400">Nombre</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Storytelling en 3 actos"
          className={`mt-1 w-full ${INPUT}`}
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-zinc-400">Descripción (opcional)</span>
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Para qué tipo de video funciona mejor"
          className={`mt-1 w-full ${INPUT}`}
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
                className={`w-40 shrink-0 ${INPUT}`}
              />
              <input
                value={beat.guia}
                onChange={(e) => updateBeat(i, "guia", e.target.value)}
                placeholder="Qué debe pasar en esta sección"
                className={`flex-1 ${INPUT}`}
              />
              <div className="flex shrink-0 items-center">
                <button
                  onClick={() => moveBeat(i, -1)}
                  disabled={i === 0}
                  title="Subir"
                  className="px-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveBeat(i, 1)}
                  disabled={i === beats.length - 1}
                  title="Bajar"
                  className="px-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                >
                  ↓
                </button>
                {beats.length > 2 && (
                  <button
                    onClick={() => setBeats((prev) => prev.filter((_, idx) => idx !== i))}
                    title="Quitar sección"
                    className="px-1 text-zinc-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setBeats((prev) => [...prev, { ...EMPTY_BEAT }])}
          className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
        >
          + Añadir sección
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave({ nombre, descripcion, beats })}
          disabled={busy || !nombre.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar estructura"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function StructuresManager() {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
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

  async function save(data: { nombre: string; descripcion: string; beats: Beat[] }, id?: number) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(id ? `/api/structures/${id}` : "/api/structures", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(`⚠️ ${json.error || "Error"}`);
        return;
      }
      setMsg(id ? "Estructura actualizada ✓" : "Estructura creada ✓");
      setShowForm(false);
      setEditing(null);
      load();
      router.refresh();
    } catch {
      setMsg("⚠️ Error de red");
    } finally {
      setBusy(false);
    }
  }

  /** Las base son compartidas: se copian para poder ajustarlas sin tocar el original. */
  async function duplicate(s: Structure) {
    await save(
      {
        nombre: `${s.nombre} (mi versión)`,
        descripcion: s.descripcion || "",
        beats: JSON.parse(s.beats) as Beat[],
      }
    );
  }

  async function deleteStructure(id: number) {
    if (!confirm("¿Eliminar esta estructura? Los guiones ya generados no se tocan.")) return;
    await fetch(`/api/structures/${id}`, { method: "DELETE" });
    load();
    router.refresh();
  }

  if (!loaded) return <p className="text-sm text-zinc-500">Cargando…</p>;

  return (
    <div className="grid gap-4">
      {msg && <p className="text-xs text-zinc-400">{msg}</p>}

      {structures.map((s) => {
        const beats = JSON.parse(s.beats) as Beat[];
        if (editing === s.id) {
          return (
            <div key={s.id} className="rounded-xl border border-indigo-700/60 bg-zinc-900 p-5">
              <StructureForm
                title={`Editando: ${s.nombre}`}
                initial={{ nombre: s.nombre, descripcion: s.descripcion || "", beats }}
                busy={busy}
                onSave={(data) => save(data, s.id)}
                onCancel={() => setEditing(null)}
              />
            </div>
          );
        }
        return (
          <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{s.nombre}</p>
                  {!!s.is_builtin && (
                    <span className="rounded-md bg-indigo-600/15 px-1.5 py-0.5 text-xs text-indigo-300">Base</span>
                  )}
                </div>
                {s.descripcion && <p className="mt-1 text-sm text-zinc-400">{s.descripcion}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {s.is_builtin ? (
                  <button
                    onClick={() => duplicate(s)}
                    disabled={busy}
                    title="Las estructuras base son compartidas: se copia para que puedas ajustarla"
                    className="text-sm text-zinc-400 transition hover:text-indigo-300 disabled:opacity-50"
                  >
                    ⧉ Duplicar para editar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditing(s.id);
                        setShowForm(false);
                      }}
                      className="text-sm text-zinc-400 transition hover:text-indigo-300"
                      title="Editar secciones"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => deleteStructure(s.id)}
                      className="text-sm text-zinc-500 transition hover:text-red-400"
                      title="Eliminar"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            </div>
            <ol className="mt-3 grid gap-1.5">
              {beats.map((beat, i) => (
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
          onClick={() => {
            setShowForm(true);
            setEditing(null);
          }}
          className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400 transition hover:border-indigo-500 hover:text-indigo-300"
        >
          + Añadir nueva estructura
        </button>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <StructureForm title="Nueva estructura" busy={busy} onSave={(data) => save(data)} onCancel={() => setShowForm(false)} />
        </div>
      )}
    </div>
  );
}
