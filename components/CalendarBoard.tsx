"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: number;
  fecha: string;
  titulo: string;
  formato: string | null;
  estado: string;
  campaign_id: number | null;
  notas: string | null;
};

type Campaign = { id: number; nombre: string; color: string };

const ESTADOS = ["idea", "en_diseno", "listo", "publicado"] as const;

const ESTADO_LABEL: Record<string, string> = {
  idea: "💡 Idea",
  en_diseno: "🎨 En diseño",
  listo: "✅ Listo",
  publicado: "🚀 Publicado",
};

const ESTADO_STYLE: Record<string, string> = {
  idea: "border-zinc-700 bg-zinc-800/70 text-zinc-300",
  en_diseno: "border-amber-700/50 bg-amber-900/30 text-amber-200",
  listo: "border-emerald-700/50 bg-emerald-900/30 text-emerald-200",
  publicado: "border-indigo-700/50 bg-indigo-900/30 text-indigo-200",
};

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
  const [busy, setBusy] = useState(false);

  const [year, mon] = month.split("-").map(Number);
  const first = new Date(year, mon - 1, 1);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7; // lunes = 0
  const todayStr = new Date().toISOString().slice(0, 10);

  const byDay = new Map<string, Item[]>();
  for (const it of items) {
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
      }),
    });
    setBusy(false);
    setTitulo("");
    setAddingDay(null);
    router.refresh();
  }

  async function cycleEstado(item: Item) {
    const idx = ESTADOS.indexOf(item.estado as (typeof ESTADOS)[number]);
    const next = ESTADOS[(idx + 1) % ESTADOS.length];
    await fetch(`/api/calendar/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: next }),
    });
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
            className={`min-h-[110px] bg-zinc-950 p-1.5 ${fecha === todayStr ? "bg-indigo-950/30" : ""}`}
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
                    return (
                      <div
                        key={it.id}
                        className={`group rounded border px-1.5 py-1 text-[10px] leading-tight ${ESTADO_STYLE[it.estado] || ESTADO_STYLE.idea}`}
                      >
                        <button
                          onClick={() => cycleEstado(it)}
                          className="block w-full text-left"
                          title={`${ESTADO_LABEL[it.estado]} — clic para avanzar estado`}
                        >
                          {camp && (
                            <span
                              className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                              style={{ background: camp.color }}
                            />
                          )}
                          {it.titulo}
                          <span className="mt-0.5 block text-[9px] opacity-70">
                            {ESTADO_LABEL[it.estado]} · {it.formato}
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
        Clic en una pieza para avanzar su estado: 💡 Idea → 🎨 En diseño → ✅ Listo → 🚀 Publicado.
      </p>
    </div>
  );
}
