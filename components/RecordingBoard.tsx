"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { stripEmphasis } from "@/lib/emphasis";
import Teleprompter, { type PrompterScript } from "./Teleprompter";

export type RecItem = {
  id: number;
  titulo: string;
  fecha: string;
  estado: string;
  version: string | null;
  parent_item_id: number | null;
  session_id: number | null;
  /** Texto hablado del guion por bloques (vacío si la pieza no viene de propuesta). */
  bloques: string[];
};

export type RecSession = { id: number; fecha: string; notas: string | null; estado: string };

function fmtDate(d: string) {
  return new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function nextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function RecordingBoard({ sessions, items }: { sessions: RecSession[]; items: RecItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fecha, setFecha] = useState(nextWeekday());
  const [busy, setBusy] = useState(false);
  const [prompter, setPrompter] = useState<PrompterScript[] | null>(null);

  // Las gemelas se graban con su pieza principal: solo se listan las principales.
  const isTwin = (it: RecItem) => it.parent_item_id != null && items.some((x) => x.id === it.parent_item_id);
  const twinOf = (it: RecItem) => items.find((x) => x.parent_item_id === it.id);
  const pendientes = items.filter((it) => it.session_id == null && it.estado !== "grabado" && !isTwin(it));

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Algo falló");
      return false;
    }
    router.refresh();
    return true;
  }

  function toggle(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function createSession() {
    const ok = await call("/api/recording-sessions", "POST", { fecha, itemIds: [...selected] });
    if (ok) setSelected(new Set());
  }

  async function addToSession(sessionId: number) {
    const ok = await call(`/api/recording-sessions/${sessionId}`, "PATCH", { action: "asignar", itemIds: [...selected] });
    if (ok) setSelected(new Set());
  }

  function openPrompter(sessionItems: RecItem[]) {
    const scripts = sessionItems
      .filter((it) => it.estado !== "grabado" && it.bloques.length)
      .map((it) => ({ itemId: it.id, titulo: stripEmphasis(it.titulo), bloques: it.bloques }));
    if (!scripts.length) return alert("No hay guiones pendientes de grabar en esta sesión.");
    setPrompter(scripts);
  }

  const planned = sessions.filter((s) => s.estado !== "hecha");
  const past = sessions.filter((s) => s.estado === "hecha");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {/* —— Piezas por grabar —— */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Guiones por grabar</h2>
          <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-xs tabular-nums text-zinc-400">{pendientes.length}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Guiones aprobados que aún no tienen día de grabación. Selecciónalos y agrúpalos en una sesión.
        </p>
        <div className="mt-3 grid gap-2">
          {pendientes.map((it) => {
            const twin = twinOf(it);
            return (
              <label
                key={it.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  selected.has(it.id) ? "border-indigo-500 bg-indigo-950/30" : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
                }`}
              >
                <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} className="mt-1" />
                <span className="min-w-0">
                  <span className="block text-sm leading-snug">{stripEmphasis(it.titulo)}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Publica {new Date(it.fecha.slice(0, 10) + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                    {twin && " · + versión " + (twin.version === "largo" ? "larga" : "corta")}
                    {!it.bloques.length && " · sin guion"}
                  </span>
                </span>
              </label>
            );
          })}
          {!pendientes.length && (
            <p className="py-6 text-center text-xs text-zinc-600">
              Nada pendiente. Los guiones aprobados en Propuestas aparecen aquí.
            </p>
          )}
        </div>

        {pendientes.length > 0 && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-4">
            <label className="text-xs text-zinc-500">
              Día de grabación
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 block rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
              />
            </label>
            <button
              onClick={createSession}
              disabled={busy || !selected.size}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              Crear sesión con {selected.size || "…"}
            </button>
          </div>
        )}
      </section>

      {/* —— Sesiones —— */}
      <section className="grid content-start gap-4">
        {!planned.length && (
          <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
            Sin sesiones planificadas. Lo ideal: un día fijo a la semana, una hora, todos los guiones de la semana.
          </div>
        )}
        {planned.map((s) => {
          const sItems = items.filter((it) => it.session_id === s.id && !isTwin(it));
          const grabadas = sItems.filter((it) => it.estado === "grabado").length;
          return (
            <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-sm font-medium capitalize">🎙️ {fmtDate(s.fecha)}</h3>
                <span className="text-xs tabular-nums text-zinc-500">
                  {grabadas}/{sItems.length} grabadas
                </span>
                <button
                  onClick={() => openPrompter(sItems)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500"
                >
                  Teleprompter
                </button>
                {selected.size > 0 && (
                  <button
                    onClick={() => addToSession(s.id)}
                    disabled={busy}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Añadir {selected.size}
                  </button>
                )}
              </div>
              <ul className="mt-3 grid gap-1.5">
                {sItems.map((it) => {
                  const twin = twinOf(it);
                  const hecho = it.estado === "grabado";
                  return (
                    <li key={it.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={hecho}
                        disabled={hecho || busy}
                        onChange={() => call(`/api/recording-sessions/${s.id}`, "PATCH", { action: "grabado", itemId: it.id })}
                        title="Marcar grabado"
                      />
                      <span className={`min-w-0 flex-1 text-sm ${hecho ? "text-zinc-500 line-through" : ""}`}>
                        {stripEmphasis(it.titulo)}
                        {twin && (
                          <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 no-underline">
                            ×2 formatos
                          </span>
                        )}
                      </span>
                      {!hecho && (
                        <button
                          onClick={() => call(`/api/recording-sessions/${s.id}`, "PATCH", { action: "quitar", itemId: it.id })}
                          className="text-xs text-zinc-600 hover:text-red-400"
                          title="Sacar de la sesión"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
                {!sItems.length && <li className="py-2 text-xs text-zinc-600">Sesión vacía: selecciona guiones y pulsa «Añadir».</li>}
              </ul>
              <div className="mt-3 flex gap-3 text-xs">
                <button
                  onClick={() => call(`/api/recording-sessions/${s.id}`, "PATCH", { action: "cerrar" })}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  Cerrar sesión
                </button>
                <button
                  onClick={() => confirm("¿Borrar la sesión? Las piezas vuelven a «por grabar».") && call(`/api/recording-sessions/${s.id}`, "DELETE")}
                  className="text-zinc-600 hover:text-red-400"
                >
                  Borrar
                </button>
              </div>
            </div>
          );
        })}

        {past.length > 0 && (
          <details className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
            <summary className="cursor-pointer text-zinc-400">Sesiones cerradas ({past.length})</summary>
            <ul className="mt-2 grid gap-1 text-xs text-zinc-500">
              {past.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <span className="capitalize">{fmtDate(s.fecha)}</span>
                  <span>
                    {items.filter((it) => it.session_id === s.id && !isTwin(it)).length} piezas ·{" "}
                    <button
                      onClick={() => call(`/api/recording-sessions/${s.id}`, "PATCH", { action: "reabrir" })}
                      className="hover:text-zinc-300"
                    >
                      reabrir
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {prompter && (
        <Teleprompter
          scripts={prompter}
          onClose={() => {
            setPrompter(null);
            router.refresh();
          }}
          onRecorded={async (itemId) => {
            const it = items.find((x) => x.id === itemId);
            if (it?.session_id) {
              await fetch(`/api/recording-sessions/${it.session_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "grabado", itemId }),
              });
            }
          }}
        />
      )}
    </div>
  );
}
