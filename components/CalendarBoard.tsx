"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PILARES, PILAR_META, toPilar } from "@/lib/pilares";
import { LABEL, normalizeState, stepState } from "@/lib/pipelineStates";

type Item = {
  id: number;
  fecha: string;
  titulo: string;
  formato: string | null;
  estado: string;
  campaign_id: number | null;
  notas: string | null;
  pilar: string | null;
};

type Campaign = { id: number; nombre: string; color: string };

const ESTADO_STYLE: Record<string, string> = {
  idea: "border-zinc-700 bg-zinc-800/70 text-zinc-300",
  por_grabar: "border-sky-700/50 bg-sky-900/30 text-sky-200",
  grabado: "border-sky-700/50 bg-sky-900/30 text-sky-200",
  en_edicion: "border-amber-700/50 bg-amber-900/30 text-amber-200",
  revision: "border-amber-700/50 bg-amber-900/30 text-amber-200",
  listo: "border-emerald-700/50 bg-emerald-900/30 text-emerald-200",
  publicado: "border-indigo-700/50 bg-indigo-900/30 text-indigo-200",
};

const estadoLabel = (estado: string) => LABEL[normalizeState(estado) ?? "idea"];
const estadoStyle = (estado: string) => ESTADO_STYLE[normalizeState(estado) ?? "idea"];

export default function CalendarBoard({
  month, // YYYY-MM
  items,
  campaigns,
}: {
  month: string;
  items: Item[];
  campaigns: Campaign[];
}) {
  const router = useRouter();
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [formato, setFormato] = useState("carrusel");
  const [campaignId, setCampaignId] = useState<string>("");
  const [pilar, setPilar] = useState<string>("");
  const [busy, setBusy] = useState(false);
  // Drag & drop: la pieza que se arrastra, el día sobre el que está y los
  // movimientos optimistas (id → nueva fecha) mientras el servidor confirma.
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [moved, setMoved] = useState<Record<number, string>>({});

  const [year, mon] = month.split("-").map(Number);
  const first = new Date(year, mon - 1, 1);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7; // lunes = 0
  const todayStr = new Date().toISOString().slice(0, 10);

  const byDay = new Map<string, Item[]>();
  for (const raw of items) {
    const it = moved[raw.id] ? { ...raw, fecha: moved[raw.id] } : raw;
    const key = it.fecha.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) || []), it]);
  }

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  async function addItem(fecha: string) {
    if (!titulo.trim()) return;
    setBusy(true);
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha,
        titulo,
        formato,
        campaign_id: campaignId ? Number(campaignId) : null,
        pilar: pilar || null,
      }),
    });
    setBusy(false);
    setTitulo("");
    setPilar("");
    setAddingDay(null);
    router.refresh();
  }

  async function cycleEstado(item: Item) {
    // Sigue el flujo del formato; tras «publicado» vuelve a empezar.
    const next = stepState(item.formato, item.estado, 1) ?? "idea";
    await fetch(`/api/calendar/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: next }),
    });
    router.refresh();
  }

  async function moveItem(id: number, day: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const current = (moved[id] || item.fecha).slice(0, 10);
    if (current === day) return;
    // Conserva la hora si la fecha la incluye; solo cambia el día.
    const fecha = day + item.fecha.slice(10);
    setMoved((m) => ({ ...m, [id]: fecha }));
    const res = await fetch(`/api/calendar/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha }),
    });
    if (!res.ok) {
      setMoved((m) => {
        const { [id]: _, ...rest } = m;
        return rest;
      });
      alert("No se pudo mover la pieza. Inténtalo de nuevo.");
      return;
    }
    router.refresh();
  }

  async function removeItem(id: number) {
    if (!confirm("¿Eliminar esta pieza del calendario?")) return;
    await fetch(`/api/calendar/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = String(i + 1).padStart(2, "0");
      return `${month}-${d}`;
    }),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-px text-center text-xs text-zinc-500">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="py-2 font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800">
        {cells.map((fecha, i) => (
          <div
            key={i}
            onDragOver={(e) => {
              if (!fecha || draggingId === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overDay !== fecha) setOverDay(fecha);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOverDay((d) => (d === fecha ? null : d));
              }
            }}
            onDrop={(e) => {
              if (!fecha) return;
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("text/plain"));
              setOverDay(null);
              setDraggingId(null);
              if (id) moveItem(id, fecha);
            }}
            className={`min-h-[110px] bg-zinc-950 p-1.5 transition-colors ${
              fecha === todayStr ? "bg-indigo-950/30" : ""
            } ${overDay === fecha ? "!bg-indigo-900/40 ring-1 ring-inset ring-indigo-500" : ""}`}
          >
            {fecha && (
              <>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs tabular-nums ${
                      fecha === todayStr ? "font-bold text-indigo-300" : "text-zinc-500"
                    }`}
                  >
                    {Number(fecha.slice(-2))}
                  </span>
                  <button
                    onClick={() => {
                      setAddingDay(addingDay === fecha ? null : fecha);
                      setTitulo("");
                    }}
                    className="rounded px-1 text-xs text-zinc-600 transition hover:text-indigo-300"
                    title="Añadir pieza"
                  >
                    +
                  </button>
                </div>
                <div className="mt-1 grid gap-1">
                  {(byDay.get(fecha) || []).map((it) => {
                    const camp = it.campaign_id ? campaignById.get(it.campaign_id) : null;
                    const p = toPilar(it.pilar);
                    return (
                      <div
                        key={it.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", String(it.id));
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(it.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverDay(null);
                        }}
                        className={`group cursor-grab rounded border px-1.5 py-1 text-[10px] leading-tight active:cursor-grabbing ${
                          estadoStyle(it.estado)
                        } ${draggingId === it.id ? "opacity-40" : ""}`}
                      >
                        <button
                          onClick={() => cycleEstado(it)}
                          className="block w-full text-left"
                          title={`${estadoLabel(it.estado)} — clic para avanzar estado`}
                        >
                          {camp && (
                            <span
                              className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                              style={{ background: camp.color }}
                            />
                          )}
                          {p && (
                            <span
                              className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${PILAR_META[p].dot}`}
                              title={PILAR_META[p].short}
                            />
                          )}
                          {it.titulo}
                          <span className="mt-0.5 block text-[9px] opacity-70">
                            {estadoLabel(it.estado)} · {it.formato}
                          </span>
                        </button>
                        <button
                          onClick={() => removeItem(it.id)}
                          className="mt-0.5 hidden text-[9px] text-zinc-500 hover:text-red-400 group-hover:block"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })}
                </div>
                {addingDay === fecha && (
                  <div className="mt-1 grid gap-1">
                    <input
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addItem(fecha)}
                      placeholder="Título…"
                      autoFocus
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-[10px] outline-none focus:border-indigo-500"
                    />
                    <select
                      value={formato}
                      onChange={(e) => setFormato(e.target.value)}
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-[10px] outline-none"
                    >
                      <option value="carrusel">Carrusel</option>
                      <option value="reel">Reel</option>
                      <option value="imagen">Imagen</option>
                      <option value="historia">Historia</option>
                    </select>
                    <select
                      value={pilar}
                      onChange={(e) => setPilar(e.target.value)}
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-[10px] outline-none"
                    >
                      <option value="">Sin pilar</option>
                      {PILARES.map((p) => (
                        <option key={p} value={p}>
                          {PILAR_META[p].label}
                        </option>
                      ))}
                    </select>
                    {campaigns.length > 0 && (
                      <select
                        value={campaignId}
                        onChange={(e) => setCampaignId(e.target.value)}
                        className="w-full rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-[10px] outline-none"
                      >
                        <option value="">Sin campaña</option>
                        {campaigns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => addItem(fecha)}
                      disabled={busy || !titulo.trim()}
                      className="rounded bg-indigo-600 px-1.5 py-1 text-[10px] font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {busy ? "…" : "Añadir"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-600">
        Arrastra una pieza a otro día para reprogramarla. Clic para avanzar su estado: 💡 Idea →
        🎨 En diseño → ✅ Listo → 🚀 Publicado.
      </p>
    </div>
  );
}
