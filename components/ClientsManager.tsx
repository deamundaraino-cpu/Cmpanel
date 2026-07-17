"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: number;
  nombre: string;
  color: string;
  estado: string;
  igUsername: string | null;
  lastSyncedAt: string | null;
};

const COLORS = ["#3987e5", "#199e70", "#c98500", "#9085e9", "#e66767", "#d55181"];

export default function ClientsManager({
  initial,
  activeId,
}: {
  initial: Client[];
  activeId: number | null;
}) {
  const [showForm, setShowForm] = useState(initial.length === 0);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function create() {
    if (!nombre.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, color }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(`⚠️ ${json.error || "Error"}`);
      } else {
        setNombre("");
        setShowForm(false);
        router.refresh();
      }
    } catch {
      setMsg("⚠️ Error de red");
    } finally {
      setBusy(false);
    }
  }

  async function activate(id: number) {
    setBusy(true);
    await fetch("/api/clients/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id }),
    });
    setBusy(false);
    router.refresh();
  }

  async function setEstado(id: number, estado: string) {
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    router.refresh();
  }

  async function remove(id: number, nombre: string) {
    if (
      !confirm(
        `¿Eliminar el cliente «${nombre}» y TODO su contenido (posts, ideas, propuestas, métricas)? Esta acción no se puede deshacer.`
      )
    )
      return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const activos = initial.filter((c) => c.estado === "activo");
  const archivados = initial.filter((c) => c.estado !== "activo");

  return (
    <div className="grid gap-4">
      {msg && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200">
          {msg}
        </div>
      )}

      <div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          ＋ Nuevo cliente
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Nombre del cliente o marca"
            autoFocus
            className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <div className="mt-3 flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full transition ${color === c ? "ring-2 ring-white/70 ring-offset-2 ring-offset-zinc-900" : ""}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <button
            onClick={create}
            disabled={busy || !nombre.trim()}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Creando…" : "Crear y activar"}
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {activos.map((c) => (
          <div
            key={c.id}
            className={`rounded-xl border p-5 ${
              c.id === activeId
                ? "border-indigo-500/60 bg-indigo-950/20"
                : "border-zinc-800 bg-zinc-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
              <p className="min-w-0 flex-1 truncate font-medium">{c.nombre}</p>
              {c.id === activeId && (
                <span className="rounded-md bg-indigo-600/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                  ACTIVO
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {c.igUsername ? `📸 @${c.igUsername}` : "Sin Instagram conectado"}
              {c.lastSyncedAt &&
                ` · sync ${new Date(c.lastSyncedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.id !== activeId && (
                <button
                  onClick={() => activate(c.id)}
                  disabled={busy}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  Trabajar con este cliente
                </button>
              )}
              <button
                onClick={() => setEstado(c.id, "archivado")}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700"
              >
                Archivar
              </button>
            </div>
          </div>
        ))}
      </div>

      {!activos.length && !showForm && (
        <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
          No tienes clientes activos. Crea el primero con «＋ Nuevo cliente».
        </div>
      )}

      {archivados.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
            Archivados ({archivados.length})
          </summary>
          <div className="mt-3 grid gap-2">
            {archivados.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-4 py-2.5"
              >
                <span className="h-2.5 w-2.5 rounded-full opacity-50" style={{ background: c.color }} />
                <p className="min-w-0 flex-1 truncate text-sm text-zinc-400">{c.nombre}</p>
                <button
                  onClick={() => setEstado(c.id, "activo")}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Reactivar
                </button>
                <button
                  onClick={() => remove(c.id, c.nombre)}
                  className="text-xs text-zinc-600 hover:text-red-400"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
