"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { stripEmphasis } from "@/lib/emphasis";
import { ESTADOS, LABEL, flowFor, isVideo, normalizeState, stepState } from "@/lib/pipelineStates";

export type PipelineItem = {
  id: number;
  fecha: string;
  titulo: string;
  formato: string | null;
  estado: string;
  campaign_id: number | null;
  proposal_id: number | null;
  notas: string | null;
  version: string | null;
  parent_item_id: number | null;
  fecha_entrega: string | null;
  brief_edicion: string | null;
  entrega_url: string | null;
  es_prueba: boolean;
  post_id: string | null;
};

type Campaign = { id: number; nombre: string; color: string };

/** Post publicado para enlazar una pieza (y medir si la prueba ganó). */
export type PostOption = { id: string; label: string; perf_ratio: number | null };

/** Guion (beats) o carrusel (slides) de la propuesta vinculada, más su copy. */
export type PieceContent = {
  formato: string | null;
  slides: { seccion?: string; texto?: string; edicion?: string; titulo?: string; cuerpo?: string }[];
  caption: string;
  hashtags: string[];
};

function pieceText(c: PieceContent): string {
  if (c.formato === "guion_video") {
    return c.slides
      .map((b) => `[${(b.seccion || "").toUpperCase()}]\n${stripEmphasis(b.texto || "")}${b.edicion ? `\n🎬 ${b.edicion}` : ""}`)
      .join("\n\n");
  }
  return c.slides
    .map((s, i) => `Slide ${i + 1}: ${stripEmphasis(s.titulo || "")}\n${stripEmphasis(s.cuerpo || "")}`)
    .join("\n\n");
}

/** Notas de edición por bloque del guion: punto de partida del brief. */
function defaultBrief(c: PieceContent | undefined): string {
  if (!c || c.formato !== "guion_video") return "";
  return c.slides
    .filter((b) => b.edicion)
    .map((b) => `• ${b.seccion || "Bloque"}: ${b.edicion}`)
    .join("\n");
}

function fmtDate(d: string) {
  return new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

/** Texto listo para pegar en WhatsApp/email al editor. */
function editorBrief(it: PipelineItem, c: PieceContent | undefined): string {
  const partes = [
    `🎬 ${stripEmphasis(it.titulo)}`,
    [
      it.version ? `Versión: ${it.version === "largo" ? "LARGA" : "CORTA"}` : null,
      it.fecha_entrega ? `Entrega: ${fmtDate(it.fecha_entrega)}` : null,
      `Publicación: ${fmtDate(it.fecha)}`,
    ]
      .filter(Boolean)
      .join(" · "),
  ];
  if (it.brief_edicion) partes.push(`INDICACIONES DE EDICIÓN\n${it.brief_edicion}`);
  if (c) partes.push(`${c.formato === "guion_video" ? "GUION" : "CARRUSEL"}\n${pieceText(c)}`);
  if (c?.caption) partes.push(`COPY\n${c.caption}${c.hashtags.length ? `\n\n${c.hashtags.join(" ")}` : ""}`);
  if (it.notas) partes.push(`NOTAS\n${it.notas}`);
  return partes.join("\n\n");
}

export default function PipelineBoard({
  items,
  content,
  campaigns,
  posts,
}: {
  items: PipelineItem[];
  content: Record<number, PieceContent>;
  campaigns: Campaign[];
  posts: PostOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const open = items.find((i) => i.id === openId) || null;
  const openContent = open?.proposal_id ? content[open.proposal_id] : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const twinIds = new Set(items.map((i) => i.parent_item_id).filter((x): x is number => x != null));

  useEffect(() => {
    if (openId == null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  async function patch(item: PipelineItem, body: Record<string, unknown>) {
    setBusy(item.id);
    const res = await fetch(`/api/calendar/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "No se pudo guardar");
      return false;
    }
    router.refresh();
    return true;
  }

  function move(item: PipelineItem, dir: 1 | -1) {
    const next = stepState(item.formato, item.estado, dir);
    if (next) patch(item, { estado: next });
  }

  // Borra la pieza del pipeline (y del calendario). La propuesta original no se toca.
  async function remove(item: PipelineItem) {
    if (!confirm(`¿Eliminar «${stripEmphasis(item.titulo)}» del pipeline? También desaparece del calendario.`)) return;
    setBusy(item.id);
    await fetch(`/api/calendar/${item.id}`, { method: "DELETE" });
    setBusy(null);
    setOpenId(null);
    router.refresh();
  }

  async function duplicate(item: PipelineItem) {
    setBusy(item.id);
    const res = await fetch(`/api/calendar/${item.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicar" }),
    });
    setBusy(null);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return alert(j.error || "No se pudo duplicar");
    router.refresh();
  }

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="grid min-w-[1260px] grid-cols-7 gap-3">
          {ESTADOS.map((estado) => {
            const lane = items.filter((i) => normalizeState(i.estado) === estado);
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
                    const prev = stepState(it.formato, it.estado, -1);
                    const next = stepState(it.formato, it.estado, 1);
                    const vencida = it.fecha_entrega && it.fecha_entrega < today && !["listo", "publicado"].includes(estado);
                    return (
                      <div
                        key={it.id}
                        onClick={() => setOpenId(it.id)}
                        className="group relative cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950 p-3 transition hover:border-zinc-600"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(it);
                          }}
                          disabled={busy === it.id}
                          title="Eliminar del pipeline"
                          className="absolute right-1.5 top-1.5 rounded px-1.5 text-xs text-zinc-600 opacity-0 transition hover:bg-red-950 hover:text-red-400 group-hover:opacity-100 disabled:opacity-50"
                        >
                          ✕
                        </button>
                        <p className="pr-4 text-sm leading-snug">{stripEmphasis(it.titulo)}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {camp && (
                            <span
                              className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                              style={{ background: camp.color }}
                            />
                          )}
                          {fmtDate(it.fecha)} · {isVideo(it.formato) ? "vídeo" : "carrusel"}
                        </p>
                        {(it.version || it.es_prueba || it.fecha_entrega) && (
                          <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                            {it.version && (
                              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                                {it.version === "largo" ? "Largo" : "Corto"}
                              </span>
                            )}
                            {it.es_prueba && (
                              <span className="rounded bg-violet-950 px-1.5 py-0.5 text-violet-300">🧪 Prueba</span>
                            )}
                            {it.fecha_entrega && (
                              <span
                                className={`rounded px-1.5 py-0.5 ${
                                  vencida ? "bg-red-950 text-red-300" : "bg-zinc-800 text-zinc-400"
                                }`}
                              >
                                Entrega {fmtDate(it.fecha_entrega)}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="mt-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {prev && (
                            <button
                              onClick={() => move(it, -1)}
                              disabled={busy === it.id}
                              title={`Volver a ${LABEL[prev]}`}
                              className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 transition hover:bg-zinc-700 disabled:opacity-50"
                            >
                              ←
                            </button>
                          )}
                          {next && (
                            <button
                              onClick={() => move(it, 1)}
                              disabled={busy === it.id}
                              title={`Pasar a ${LABEL[next]}`}
                              className="flex-1 rounded bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-200 transition hover:bg-indigo-600 disabled:opacity-50"
                            >
                              Avanzar →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!lane.length && <p className="px-1 py-3 text-center text-xs text-zinc-700">Vacío</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setOpenId(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4">
              <div>
                <p className="text-xs text-zinc-500">
                  {LABEL[normalizeState(open.estado) ?? "idea"]} · {isVideo(open.formato) ? "vídeo" : "carrusel"}
                  {open.version && ` · versión ${open.version}`}
                </p>
                <h2 className="mt-1 text-base font-semibold leading-snug">{stripEmphasis(open.titulo)}</h2>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Flujo: {flowFor(open.formato).map((s) => LABEL[s].split(" ").slice(1).join(" ")).join(" → ")}
                </p>
              </div>
              <button
                onClick={() => setOpenId(null)}
                className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <ProductionForm
                key={open.id}
                item={open}
                content={openContent}
                posts={posts}
                busy={busy === open.id}
                onSave={(body) => patch(open, body)}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => copy("brief", editorBrief(open, openContent))}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  {copied === "brief" ? "¡Brief copiado!" : "Copiar brief para el editor"}
                </button>
                {isVideo(open.formato) && !open.parent_item_id && !twinIds.has(open.id) && (
                  <button
                    onClick={() => duplicate(open)}
                    disabled={busy === open.id}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Duplicar en versión {open.version === "largo" ? "corta" : "larga"}
                  </button>
                )}
              </div>

              <div className="mt-6 border-t border-zinc-800 pt-4">
                {openContent ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{openContent.formato === "guion_video" ? "Guion" : "Carrusel"}</p>
                      <button
                        onClick={() => copy("pieza", pieceText(openContent))}
                        className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                      >
                        {copied === "pieza" ? "¡Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <div className="mt-2 grid gap-2">
                      {openContent.slides.map((s, i) =>
                        openContent.formato === "guion_video" ? (
                          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">{s.seccion}</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{stripEmphasis(s.texto || "")}</p>
                            {s.edicion && (
                              <p className="mt-2 border-t border-zinc-800/70 pt-2 text-xs text-zinc-500">🎬 {s.edicion}</p>
                            )}
                          </div>
                        ) : (
                          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                            <p className="text-xs text-zinc-500">Slide {i + 1}</p>
                            <p className="mt-1 text-sm font-medium text-zinc-100">{stripEmphasis(s.titulo || "")}</p>
                            {s.cuerpo && (
                              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{stripEmphasis(s.cuerpo)}</p>
                            )}
                          </div>
                        )
                      )}
                    </div>

                    {(openContent.caption || openContent.hashtags.length > 0) && (
                      <>
                        <div className="mt-5 flex items-center justify-between">
                          <p className="text-sm font-medium">Copy</p>
                          <button
                            onClick={() =>
                              copy(
                                "copy",
                                [openContent.caption, openContent.hashtags.join(" ")].filter(Boolean).join("\n\n")
                              )
                            }
                            className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            {copied === "copy" ? "¡Copiado!" : "Copiar"}
                          </button>
                        </div>
                        <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm">
                          <p className="whitespace-pre-wrap text-zinc-300">{openContent.caption}</p>
                          {openContent.hashtags.length > 0 && (
                            <p className="mt-3 text-xs text-indigo-300">{openContent.hashtags.join(" ")}</p>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Esta pieza no viene de una propuesta, así que no tiene guion ni copy guardados.
                  </p>
                )}

                {open.notas && (
                  <div className="mt-5">
                    <p className="text-sm font-medium">Notas</p>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                      {open.notas}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-zinc-800 p-4">
              <button
                onClick={() => remove(open)}
                disabled={busy === open.id}
                className="rounded-lg border border-red-900/60 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-950 disabled:opacity-50"
              >
                Eliminar del pipeline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500";

/** Datos de producción y edición de una pieza (se guardan juntos). */
function ProductionForm({
  item,
  content,
  posts,
  busy,
  onSave,
}: {
  item: PipelineItem;
  content: PieceContent | undefined;
  posts: PostOption[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [version, setVersion] = useState(item.version || "");
  const [entrega, setEntrega] = useState(item.fecha_entrega || "");
  const [brief, setBrief] = useState(item.brief_edicion ?? defaultBrief(content));
  const [url, setUrl] = useState(item.entrega_url || "");
  const [prueba, setPrueba] = useState(item.es_prueba);
  const [postId, setPostId] = useState(item.post_id || "");
  const [saved, setSaved] = useState(false);

  async function save() {
    const ok = await onSave({
      version: version || null,
      fecha_entrega: entrega || null,
      brief_edicion: brief,
      entrega_url: url,
      es_prueba: prueba,
      post_id: postId || null,
    });
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  const linked = posts.find((p) => p.id === postId);

  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">Producción y edición</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-zinc-500">
          Versión
          <select value={version} onChange={(e) => setVersion(e.target.value)} className={inputCls}>
            <option value="">—</option>
            <option value="corto">Corta</option>
            <option value="largo">Larga</option>
          </select>
        </label>
        <label className="text-xs text-zinc-500">
          Entrega de edición
          <input type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} className={inputCls} />
        </label>
      </div>
      <label className="text-xs text-zinc-500">
        Indicaciones para el editor
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={4}
          placeholder="Ritmo, subtítulos, B-roll, música, duración…"
          className={inputCls}
        />
      </label>
      <label className="text-xs text-zinc-500">
        Enlace de la entrega (Drive, WeTransfer…)
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={inputCls} />
      </label>
      {item.entrega_url && /^https?:\/\//.test(item.entrega_url) && (
        <a href={item.entrega_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300">
          Abrir entrega ↗
        </a>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={prueba} onChange={(e) => setPrueba(e.target.checked)} />
          🧪 Es una prueba de formato
        </label>
        <label className="text-xs text-zinc-500">
          Post publicado
          <select value={postId} onChange={(e) => setPostId(e.target.value)} className={inputCls}>
            <option value="">— sin enlazar —</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {linked?.perf_ratio != null && (
        <p className="text-xs text-zinc-400">
          Rendimiento: <span className="font-medium text-zinc-200">×{linked.perf_ratio.toFixed(1)}</span> sobre la media
          de la cuenta
        </p>
      )}
      <div>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {saved ? "¡Guardado!" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
