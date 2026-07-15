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
const LABEL: Record<string, string> = {
  idea: "💡 Ideas",
  en_diseno: "🎨 En diseño",
  listo: "✅ Listas",
  publicado: "🚀 Publicadas",
};

export default function PipelineBoard({
  items,
  campaigns,
}: {
  items: Item[];
  campaigns: Campaign[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  async function move(item: Item, dir: 1 | -1) {
    const idx = ESTADOS.indexOf(item.estado as (typeof ESTADOS)[number]);
    const next = ESTADOS[idx + dir];
    if (!next) return;
    setBusy(item.id);
    await fetch(`/api/calendar/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: next }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {ESTADOS.map((estado) => {
        const lane = items.filter((i) => i.estado === estado);
        return (
          <div key={estado} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-medium">{LABEL[estado]}</p>
              <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-xs tabular-nums text-zinc-400">
                {lane.length}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {lane.map((it) => {
                const camp = it.campaign_id ? campaignById.get(it.campaign_id) : null;
                const idx = ESTADOS.indexOf(estado);
                return (
                  <div
                    key={it.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <p className="text-sm leading-snug">{it.titulo}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {camp && (
                        <span
                          className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                          style={{ background: camp.color }}
                        />
                      )}
                      {new Date(it.fecha + "T00:00:00").toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}{" "}
                      · {it.formato}
                    </p>
                    <div className="mt-2 flex gap-1">
                      {idx > 0 && (
                        <button
                          onClick={() => move(it, -1)}
                          disabled={busy === it.id}
                          className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 transition hover:bg-zinc-700 disabled:opacity-50"
                        >
                          ←
                        </button>
                      )}
                      {idx < ESTADOS.length - 1 && (
                        <button
                          onClick={() => move(it, 1)}
                          disabled={busy === it.id}
                          className="flex-1 rounded bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-200 transition hover:bg-indigo-600 disabled:opacity-50"
                        >
                          Avanzar →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!lane.length && (
                <p className="px-1 py-3 text-center text-xs text-zinc-700">Vacío</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
