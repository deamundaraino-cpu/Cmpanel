"use client";

import { useEffect, useState } from "react";

type Comment = {
  id: string;
  text: string | null;
  username: string | null;
  is_lead: number;
  nota: string | null;
  timestamp: string | null;
  like_count: number;
  caption: string | null;
  permalink: string | null;
};

type Commenter = { username: string; veces: number; ultimo: string | null; leads: number };

export default function CommentsInbox() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [recurrentes, setRecurrentes] = useState<Commenter[]>([]);
  const [sinAutores, setSinAutores] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"todos" | "leads" | "recurrentes">("todos");
  const [editing, setEditing] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  async function load() {
    const res = await fetch("/api/comments");
    if (res.ok) {
      const json = await res.json();
      setComments(json.comments || []);
      setRecurrentes(json.recurrentes || []);
      setSinAutores(Boolean(json.sinAutores));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, data: Record<string, unknown>) {
    await fetch(`/api/comments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async function toggleLead(c: Comment) {
    const next = c.is_lead ? 0 : 1;
    setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_lead: next } : x)));
    await patch(c.id, { is_lead: next });
  }

  async function saveNota(c: Comment) {
    setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, nota } : x)));
    setEditing(null);
    await patch(c.id, { nota });
  }

  if (loading) return <p className="text-sm text-zinc-500">Cargando…</p>;

  if (!comments.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-500">
        Todavía no hay comentarios capturados. Pulsa «Sincronizar Instagram» en el
        Dashboard: se guardan los de tus 10 publicaciones con más interacción.
      </div>
    );
  }

  const leads = comments.filter((c) => c.is_lead);
  const visibles = tab === "leads" ? leads : comments;

  const TABS = [
    { id: "todos" as const, label: `Todos (${comments.length})` },
    { id: "leads" as const, label: `⭐ Leads (${leads.length})` },
    { id: "recurrentes" as const, label: `🔁 Recurrentes (${recurrentes.length})` },
  ];

  return (
    <div>
      {sinAutores && (
        <div className="mb-4 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-xs text-amber-300">
          Instagram no está devolviendo el nombre de quien comenta. Tu token no
          tiene el permiso de comentarios: vuelve a conectar la cuenta desde
          Ajustes para poder identificar a los recurrentes. Los comentarios se
          siguen guardando igual.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs transition ${
              tab === t.id
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "recurrentes" ? (
        <div className="mt-4 grid gap-2">
          {!recurrentes.length && (
            <p className="text-sm text-zinc-500">
              Nadie ha comentado más de una vez todavía (o falta el permiso de
              comentarios).
            </p>
          )}
          {recurrentes.map((r) => (
            <div
              key={r.username}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-zinc-200">@{r.username}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {r.veces} comentarios
                  {r.ultimo
                    ? ` · último ${new Date(r.ultimo).toLocaleDateString("es-ES")}`
                    : ""}
                </p>
              </div>
              {r.leads > 0 && (
                <span className="rounded-md bg-emerald-600/15 px-2 py-0.5 text-xs text-emerald-300">
                  ⭐ Lead
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-2.5">
          {!visibles.length && (
            <p className="text-sm text-zinc-500">Todavía no has marcado ningún lead.</p>
          )}
          {visibles.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border bg-zinc-900 p-4 ${
                c.is_lead ? "border-emerald-800/60" : "border-zinc-800"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">
                    {c.username ? `@${c.username}` : "Autor no disponible"}
                    {c.timestamp
                      ? ` · ${new Date(c.timestamp).toLocaleDateString("es-ES")}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm leading-snug text-zinc-200">{c.text}</p>
                </div>
                <button
                  onClick={() => toggleLead(c)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-xs transition ${
                    c.is_lead
                      ? "bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {c.is_lead ? "⭐ Lead" : "Marcar lead"}
                </button>
              </div>

              {c.caption && (
                <p className="mt-2 truncate text-xs text-zinc-600">
                  en: {c.permalink ? (
                    <a
                      href={c.permalink}
                      target="_blank"
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      {c.caption.slice(0, 70)}
                    </a>
                  ) : (
                    c.caption.slice(0, 70)
                  )}
                </p>
              )}

              {editing === c.id ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveNota(c)}
                    autoFocus
                    placeholder="Nota corta…"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => saveNota(c)}
                    className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs text-white"
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditing(c.id);
                    setNota(c.nota || "");
                  }}
                  className="mt-2 text-xs text-zinc-500 hover:text-indigo-300"
                >
                  {c.nota ? `📝 ${c.nota}` : "+ Añadir nota"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
