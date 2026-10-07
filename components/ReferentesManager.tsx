"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReferenteAnalisis } from "@/lib/referentes";

export type RefView = { id: number; handle: string; nombre: string | null; notas: string | null };
export type PiezaView = {
  id: number;
  referente_id: number;
  url: string | null;
  formato: string | null;
  texto: string;
  vistas: number | null;
  likes: number | null;
  comentarios: number | null;
  analisis: ReferenteAnalisis | null;
  ratio: number | null;
};

const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500";
const fmt = (n: number) => n.toLocaleString("es-ES");

export default function ReferentesManager({ referentes, piezas }: { referentes: RefView[]; piezas: PiezaView[] }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function call(key: string, url: string, method: string, body?: unknown) {
    setBusy(key);
    setMsg(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(null);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(j.error || "Algo falló");
      return null;
    }
    router.refresh();
    return j;
  }

  async function addRef() {
    if (!handle.trim()) return;
    const ok = await call("ref", "/api/referentes", "POST", { handle, nombre });
    if (ok) {
      setHandle("");
      setNombre("");
    }
  }

  async function saveStructure(p: PiezaView, ref: RefView) {
    if (!p.analisis || p.analisis.estructura.length < 2) return;
    const ok = await call(`est-${p.id}`, "/api/structures", "POST", {
      nombre: `Patrón @${ref.handle} · ${p.analisis.formato || "pieza"} #${p.id}`.slice(0, 80),
      descripcion: p.analisis.patron_replicable,
      beats: p.analisis.estructura,
      soloEstaMarca: true,
    });
    if (ok) setMsg("Estructura guardada: ya la puedes elegir al crear un guion.");
  }

  return (
    <div className="grid gap-6">
      {msg && (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">{msg}</p>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <label className="text-xs text-zinc-500">
          Cuenta referente
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@cuenta" className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-xs text-zinc-500">
          Nota (opcional)
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Competidor directo, referente de formato…"
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <button
          onClick={addRef}
          disabled={busy === "ref" || !handle.trim()}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          Añadir referente
        </button>
      </div>

      {!referentes.length && (
        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-500">
          Añade 3-5 cuentas que admires o con las que compitas. Luego pega sus mejores piezas (caption o transcripción y
          vistas): la plataforma detecta las que destacan sobre su media y la IA extrae el patrón para que lo adaptes.
        </div>
      )}

      {referentes.map((ref) => {
        const list = piezas.filter((p) => p.referente_id === ref.id);
        return (
          <section key={ref.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-sm font-medium">
                @{ref.handle}
                {ref.nombre && <span className="ml-2 font-normal text-zinc-500">{ref.nombre}</span>}
              </h2>
              <a
                href={`https://www.instagram.com/${ref.handle}/`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Ver perfil ↗
              </a>
              <button
                onClick={() => setAddingTo(addingTo === ref.id ? null : ref.id)}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
              >
                + Pegar pieza
              </button>
              <button
                onClick={() => confirm(`¿Borrar @${ref.handle} y sus piezas?`) && call(`del-${ref.id}`, `/api/referentes/${ref.id}`, "DELETE")}
                className="text-xs text-zinc-600 hover:text-red-400"
              >
                Borrar
              </button>
            </div>

            {addingTo === ref.id && (
              <PiezaForm
                busy={busy === `add-${ref.id}`}
                onSubmit={async (data) => {
                  const ok = await call(`add-${ref.id}`, `/api/referentes/${ref.id}`, "POST", data);
                  if (ok) setAddingTo(null);
                  return !!ok;
                }}
              />
            )}

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {list.map((p) => (
                <article key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {p.ratio != null && (
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          p.ratio >= 2 ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                        }`}
                        title="Vistas frente a la mediana de este referente"
                      >
                        ×{p.ratio.toFixed(1).replace(".", ",")} sobre su media
                      </span>
                    )}
                    {p.formato && <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">{p.formato}</span>}
                    {p.vistas != null && <span className="text-zinc-500">{fmt(p.vistas)} vistas</span>}
                    {p.likes != null && <span className="text-zinc-500">· {fmt(p.likes)} likes</span>}
                    {p.comentarios != null && <span className="text-zinc-500">· {fmt(p.comentarios)} coment.</span>}
                    <span className="ml-auto flex gap-2">
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
                          Abrir ↗
                        </a>
                      )}
                      <button
                        onClick={() => confirm("¿Borrar esta pieza?") && call(`delp-${p.id}`, `/api/referentes/piezas/${p.id}`, "DELETE")}
                        className="text-zinc-600 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-zinc-300">{p.texto}</p>

                  {p.analisis ? (
                    <div className="mt-3 grid gap-1.5 border-t border-zinc-800 pt-3 text-xs">
                      <p>
                        <span className="text-zinc-500">Gancho:</span> <span className="text-zinc-200">{p.analisis.gancho}</span>
                      </p>
                      {p.analisis.estructura.length > 0 && (
                        <p>
                          <span className="text-zinc-500">Estructura:</span>{" "}
                          <span className="text-zinc-300">{p.analisis.estructura.map((b) => b.nombre).join(" → ")}</span>
                        </p>
                      )}
                      <p>
                        <span className="text-zinc-500">Por qué funciona:</span>{" "}
                        <span className="text-zinc-300">{p.analisis.por_que_funciona}</span>
                      </p>
                      <p>
                        <span className="text-zinc-500">Cómo adaptarlo:</span>{" "}
                        <span className="text-indigo-300">{p.analisis.patron_replicable}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <button
                          onClick={async () => {
                            const ok = await call(`gan-${p.id}`, `/api/referentes/piezas/${p.id}`, "POST", { action: "guardar_gancho" });
                            if (ok) setMsg("Gancho guardado en tu banco de Ganchos.");
                          }}
                          disabled={busy === `gan-${p.id}`}
                          className="rounded bg-zinc-800 px-2 py-1 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          Guardar gancho
                        </button>
                        {p.analisis.estructura.length >= 2 && (
                          <button
                            onClick={() => saveStructure(p, ref)}
                            disabled={busy === `est-${p.id}`}
                            className="rounded bg-zinc-800 px-2 py-1 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                          >
                            Guardar como estructura
                          </button>
                        )}
                        <button
                          onClick={() => call(`an-${p.id}`, `/api/referentes/piezas/${p.id}`, "POST", { action: "analizar" })}
                          disabled={busy === `an-${p.id}`}
                          className="px-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
                        >
                          {busy === `an-${p.id}` ? "Analizando…" : "Re-analizar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => call(`an-${p.id}`, `/api/referentes/piezas/${p.id}`, "POST", { action: "analizar" })}
                      disabled={busy === `an-${p.id}`}
                      className="mt-3 rounded-lg bg-indigo-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {busy === `an-${p.id}` ? "Analizando…" : "Analizar con IA"}
                    </button>
                  )}
                </article>
              ))}
              {!list.length && addingTo !== ref.id && (
                <p className="text-xs text-zinc-600">Sin piezas. Pega 3 o más con sus vistas para detectar las que destacan.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PiezaForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (data: Record<string, string>) => Promise<boolean>;
}) {
  const [f, setF] = useState({ url: "", formato: "reel", texto: "", vistas: "", likes: "", comentarios: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input value={f.url} onChange={set("url")} placeholder="URL del post (opcional)" className={inputCls} />
        <select value={f.formato} onChange={set("formato")} className={inputCls}>
          <option value="reel">Reel</option>
          <option value="carrusel">Carrusel</option>
          <option value="video largo">Vídeo largo</option>
          <option value="tiktok">TikTok</option>
        </select>
      </div>
      <textarea
        value={f.texto}
        onChange={set("texto")}
        rows={5}
        placeholder="Pega aquí la transcripción del vídeo o el caption / texto de las slides…"
        className={inputCls}
      />
      <div className="grid grid-cols-3 gap-2">
        <input value={f.vistas} onChange={set("vistas")} inputMode="numeric" placeholder="Vistas" className={inputCls} />
        <input value={f.likes} onChange={set("likes")} inputMode="numeric" placeholder="Likes" className={inputCls} />
        <input value={f.comentarios} onChange={set("comentarios")} inputMode="numeric" placeholder="Comentarios" className={inputCls} />
      </div>
      <div>
        <button
          onClick={async () => {
            const clean = (v: string) => v.replace(/[.\s]/g, "").replace(",", ".");
            const ok = await onSubmit({ ...f, vistas: clean(f.vistas), likes: clean(f.likes), comentarios: clean(f.comentarios) });
            if (ok) setF({ url: "", formato: f.formato, texto: "", vistas: "", likes: "", comentarios: "" });
          }}
          disabled={busy || f.texto.trim().length < 20}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Guardar pieza
        </button>
      </div>
    </div>
  );
}
