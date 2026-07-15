"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Campaign = {
  id: number;
  nombre: string;
  descripcion: string | null;
  color: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
  posts_count: number;
  total_reach: number;
  avg_er: number;
};

const nf = new Intl.NumberFormat("es-ES");
const pct = (v: number) => (v * 100).toFixed(2).replace(".", ",") + "%";

const COLORS = ["#3987e5", "#199e70", "#c98500", "#9085e9", "#e66767", "#d55181"];

export default function CampaignsManager({ initial }: { initial: Campaign[] }) {
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          descripcion,
          color,
          fecha_inicio: fechaInicio || null,
          fecha_fin: fechaFin || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(`⚠️ ${json.error || "Error"}`);
      } else {
        setNombre("");
        setDescripcion("");
        setFechaInicio("");
        setFechaFin("");
        setShowForm(false);
        router.refresh();
      }
    } catch {
      setMsg("⚠️ Error de red");
    } finally {
      setBusy(false);
    }
  }

  async function setEstado(id: number, estado: string) {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    router.refresh();
  }

  async function remove(id: number) {
    if (!confirm("¿Eliminar esta campaña? Los posts asignados quedan sin campaña (no se borran).")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      {initial.map((c) => (
        <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ background: c.color }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{c.nombre}</p>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs capitalize ${
                      c.estado === "activa"
                        ? "bg-emerald-600/20 text-emerald-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {c.estado}
                  </span>
                </div>
                {c.descripcion && <p className="mt-1 text-sm text-zinc-400">{c.descripcion}</p>}
                <p className="mt-1 text-xs text-zinc-500">
                  {c.fecha_inicio || "—"} → {c.fecha_fin || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {c.estado === "activa" ? (
                <button
                  onClick={() => setEstado(c.id, "finalizada")}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700"
                >
                  Finalizar
                </button>
              ) : (
                <button
                  onClick={() => setEstado(c.id, "activa")}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700"
                >
                  Reactivar
                </button>
              )}
              <button
                onClick={() => remove(c.id)}
                className="rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition hover:text-red-400"
                title="Eliminar"
              >
                🗑
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-3">
            <div>
              <p className="text-xs text-zinc-500">Posts</p>
              <p className="text-sm font-semibold tabular-nums">{c.posts_count}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Alcance</p>
              <p className="text-sm font-semibold tabular-nums">{nf.format(c.total_reach)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">ER medio</p>
              <p className="text-sm font-semibold tabular-nums">{pct(c.avg_er)}</p>
            </div>
          </div>
        </div>
      ))}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400 transition hover:border-indigo-500 hover:text-indigo-300"
        >
          + Nueva campaña
        </button>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="font-medium">Nueva campaña</p>
          <div className="mt-3 grid gap-3">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre (ej: Lanzamiento infoproducto Q3)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción / objetivo (opcional)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-zinc-500">Inicio</span>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">Fin</span>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color:</span>
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full transition ${
                    color === c ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : ""
                  }`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            {msg && <p className="text-xs text-zinc-400">{msg}</p>}
            <div className="flex gap-2">
              <button
                onClick={create}
                disabled={busy || !nombre.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? "Creando…" : "Crear campaña"}
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
