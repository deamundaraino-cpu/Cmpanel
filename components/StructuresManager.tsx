"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PILARES, PILAR_META, toPilar, type Pilar } from "@/lib/pilares";
import { EXECUTION_FORMATS, formatById, type Coste } from "@/lib/executionFormats";
import { familyById } from "@/lib/angles";
import type { StructureFicha } from "@/lib/baseStructures";

type Beat = { nombre: string; guia: string };
type Structure = {
  id: number;
  nombre: string;
  descripcion: string | null;
  beats: string;
  is_builtin: number;
  client_id: number | null;
  pilar: string | null;
  ficha: string | null;
};

type FormData = { nombre: string; descripcion: string; beats: Beat[]; soloEstaMarca: boolean; pilar: string };

const EMPTY_BEAT: Beat = { nombre: "", guia: "" };
const INPUT = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500";
const COSTE: Record<Coste, string> = {
  bajo: "bg-emerald-600/15 text-emerald-300",
  medio: "bg-amber-600/15 text-amber-300",
  alto: "bg-red-600/15 text-red-300",
};

function parseFicha(json: string | null): StructureFicha | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as StructureFicha;
  } catch {
    return null;
  }
}

/** Formulario compartido: sirve para crear una estructura nueva y para editar una existente. */
function StructureForm({
  title,
  initial,
  busy,
  clienteNombre,
  onSave,
  onCancel,
}: {
  title: string;
  initial?: FormData;
  busy: boolean;
  clienteNombre: string;
  onSave: (data: FormData) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion || "");
  const [soloEstaMarca, setSoloEstaMarca] = useState(initial?.soloEstaMarca ?? true);
  const [pilar, setPilar] = useState(initial?.pilar || "");
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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-400">Pilar de contenido</span>
          <select value={pilar} onChange={(e) => setPilar(e.target.value)} className={`mt-1 w-full ${INPUT}`}>
            <option value="">Sin pilar</option>
            {PILARES.map((p) => (
              <option key={p} value={p}>
                {PILAR_META[p].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-400">Dónde se usa</span>
          <select
            value={soloEstaMarca ? "marca" : "todas"}
            onChange={(e) => setSoloEstaMarca(e.target.value === "marca")}
            className={`mt-1 w-full ${INPUT}`}
          >
            <option value="marca">Solo {clienteNombre}</option>
            <option value="todas">Todas mis marcas</option>
          </select>
        </label>
      </div>

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
                placeholder="Qué tiene que conseguir esta sección (sin frases de ejemplo)"
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
          onClick={() => onSave({ nombre, descripcion, beats, soloEstaMarca, pilar })}
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

function PilarBadge({ pilar }: { pilar: Pilar | null }) {
  if (!pilar) return <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">Sin pilar</span>;
  return <span className={`rounded-md px-1.5 py-0.5 text-xs ${PILAR_META[pilar].badge}`}>{PILAR_META[pilar].label}</span>;
}

/** Bloque de la ficha: etiqueta + texto. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-0.5 text-sm text-zinc-300">{children}</div>
    </div>
  );
}

function StructureCard({
  s,
  clienteNombre,
  busy,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  s: Structure;
  clienteNombre: string;
  busy: boolean;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const beats = JSON.parse(s.beats) as Beat[];
  const ficha = parseFicha(s.ficha);
  const pilar = toPilar(s.pilar);

  return (
    <article className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <PilarBadge pilar={pilar} />
        {s.is_builtin ? (
          <span className="rounded-md bg-indigo-600/15 px-1.5 py-0.5 text-xs text-indigo-300">Base</span>
        ) : (
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs ${
              s.client_id != null ? "bg-emerald-600/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-300"
            }`}
          >
            {s.client_id != null ? `Solo ${clienteNombre}` : "Todas mis marcas"}
          </span>
        )}
        {ficha?.duracion && <span className="ml-auto text-xs tabular-nums text-zinc-500">⏱ {ficha.duracion}</span>}
      </div>

      <h3 className="mt-2 font-medium leading-snug">{s.nombre}</h3>
      {s.descripcion && <p className="mt-1 text-sm text-zinc-400">{s.descripcion}</p>}

      {ficha && (
        <p className="mt-3 rounded-lg bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
          <span className="text-zinc-500">Empuja:</span> {ficha.senal}
        </p>
      )}

      <p className="mt-3 text-xs text-zinc-500">{beats.map((b) => b.nombre).join(" → ")}</p>

      {open && (
        <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4">
          {ficha && (
            <>
              <Row label="Úsala cuando">{ficha.cuandoUsar}</Row>
              <Row label="No la uses si">
                <span className="text-amber-200/90">{ficha.cuandoNo}</span>
              </Row>
              <Row label="Por qué funciona">{ficha.porQueFunciona}</Row>
            </>
          )}
          <Row label="Bloques">
            <ol className="grid gap-1.5">
              {beats.map((beat, i) => (
                <li key={i} className="text-xs">
                  <span className="font-medium text-zinc-200">
                    {i + 1}. {beat.nombre}
                  </span>{" "}
                  <span className="text-zinc-500">{beat.guia}</span>
                </li>
              ))}
            </ol>
          </Row>
          {ficha && (
            <>
              <Row label="Cómo grabarla">
                <div className="flex flex-wrap gap-1">
                  {ficha.formatos.map((id) => (
                    <span key={id} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                      {formatById(id)?.nombre || id}
                    </span>
                  ))}
                </div>
              </Row>
              <Row label="Ganchos que le encajan">
                <div className="flex flex-wrap gap-1">
                  {ficha.familias.map((id) => (
                    <span
                      key={id}
                      title={familyById(id)?.objetivo}
                      className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300"
                    >
                      {familyById(id)?.nombre || id}
                    </span>
                  ))}
                </div>
              </Row>
              <Row label="Referentes">{ficha.referentes.join(" · ")}</Row>
              <Row label="Fuentes">
                <ul className="grid gap-0.5 text-xs text-zinc-500">
                  {ficha.fuentes.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Row>
            </>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-sm">
        <button onClick={() => setOpen((o) => !o)} className="text-indigo-400 transition hover:text-indigo-300">
          {open ? "Cerrar ficha" : "Ver ficha"}
        </button>
        <span className="ml-auto flex items-center gap-3">
          {s.is_builtin ? (
            <button
              onClick={onDuplicate}
              disabled={busy}
              title="Las estructuras base son compartidas: se copia para que puedas ajustarla"
              className="text-zinc-400 transition hover:text-indigo-300 disabled:opacity-50"
            >
              ⧉ Duplicar para editar
            </button>
          ) : (
            <>
              <button onClick={onEdit} className="text-zinc-400 transition hover:text-indigo-300" title="Editar secciones">
                ✏️ Editar
              </button>
              <button onClick={onDelete} className="text-zinc-500 transition hover:text-red-400" title="Eliminar">
                🗑
              </button>
            </>
          )}
        </span>
      </div>
    </article>
  );
}

type Filtro = "todas" | Pilar | "sin";

function PilarFilter({
  value,
  onChange,
  counts,
}: {
  value: Filtro;
  onChange: (f: Filtro) => void;
  counts: Record<Filtro, number>;
}) {
  const opts: { v: Filtro; label: string }[] = [
    { v: "todas", label: "Todas" },
    ...PILARES.map((p) => ({ v: p as Filtro, label: PILAR_META[p].label })),
    { v: "sin", label: "Sin pilar" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts
        .filter((o) => o.v !== "sin" || counts.sin > 0)
        .map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              value === o.v
                ? "border-indigo-500 bg-indigo-600/20 text-indigo-200"
                : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {o.label} <span className="tabular-nums opacity-60">{counts[o.v]}</span>
          </button>
        ))}
    </div>
  );
}

export default function StructuresManager({ clienteNombre }: { clienteNombre: string }) {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"estructuras" | "formatos">("estructuras");
  const [filtro, setFiltro] = useState<Filtro>("todas");
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

  async function save(data: FormData, id?: number) {
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
    await save({
      nombre: `${s.nombre} (${clienteNombre})`,
      descripcion: s.descripcion || "",
      beats: JSON.parse(s.beats) as Beat[],
      soloEstaMarca: true,
      pilar: s.pilar || "",
    });
  }

  async function deleteStructure(id: number) {
    if (!confirm("¿Eliminar esta estructura? Los guiones ya generados no se tocan.")) return;
    await fetch(`/api/structures/${id}`, { method: "DELETE" });
    load();
    router.refresh();
  }

  if (!loaded) return <p className="text-sm text-zinc-500">Cargando…</p>;

  const matches = (p: string | null, f: Filtro) =>
    f === "todas" ? true : f === "sin" ? !toPilar(p) : toPilar(p) === f;
  const countsFor = (list: (string | null)[]): Record<Filtro, number> => ({
    todas: list.length,
    crecimiento: list.filter((p) => p === "crecimiento").length,
    adoctrinamiento: list.filter((p) => p === "adoctrinamiento").length,
    conversion: list.filter((p) => p === "conversion").length,
    sin: list.filter((p) => !toPilar(p)).length,
  });

  const visibles = structures.filter((s) => matches(s.pilar, filtro));
  // Un formato de grabación cuenta para cada pilar en el que encaja.
  const formatos = EXECUTION_FORMATS.filter(
    (f) => filtro === "todas" || (filtro !== "sin" && f.pilares.includes(filtro))
  );
  const formatCounts: Record<Filtro, number> = {
    todas: EXECUTION_FORMATS.length,
    crecimiento: EXECUTION_FORMATS.filter((f) => f.pilares.includes("crecimiento")).length,
    adoctrinamiento: EXECUTION_FORMATS.filter((f) => f.pilares.includes("adoctrinamiento")).length,
    conversion: EXECUTION_FORMATS.filter((f) => f.pilares.includes("conversion")).length,
    sin: 0,
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-4 border-b border-zinc-800">
        {(
          [
            ["estructuras", `Estructuras de guion (${structures.length})`],
            ["formatos", `Formatos de grabación (${EXECUTION_FORMATS.length})`],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm transition ${
              tab === v ? "border-indigo-500 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <PilarFilter
        value={filtro}
        onChange={setFiltro}
        counts={tab === "estructuras" ? countsFor(structures.map((s) => s.pilar)) : formatCounts}
      />

      {msg && <p className="text-xs text-zinc-400">{msg}</p>}

      {tab === "estructuras" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {visibles.map((s) =>
              editing === s.id ? (
                <div key={s.id} className="rounded-xl border border-indigo-700/60 bg-zinc-900 p-5 md:col-span-2">
                  <StructureForm
                    title={`Editando: ${s.nombre}`}
                    initial={{
                      nombre: s.nombre,
                      descripcion: s.descripcion || "",
                      beats: JSON.parse(s.beats) as Beat[],
                      soloEstaMarca: s.client_id != null,
                      pilar: s.pilar || "",
                    }}
                    busy={busy}
                    clienteNombre={clienteNombre}
                    onSave={(data) => save(data, s.id)}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              ) : (
                <StructureCard
                  key={s.id}
                  s={s}
                  clienteNombre={clienteNombre}
                  busy={busy}
                  onDuplicate={() => duplicate(s)}
                  onEdit={() => {
                    setEditing(s.id);
                    setShowForm(false);
                  }}
                  onDelete={() => deleteStructure(s.id)}
                />
              )
            )}
            {!visibles.length && (
              <p className="py-6 text-sm text-zinc-500 md:col-span-2">No hay estructuras en este filtro.</p>
            )}
          </div>

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
              <StructureForm
                title="Nueva estructura"
                initial={{
                  nombre: "",
                  descripcion: "",
                  beats: [],
                  soloEstaMarca: true,
                  pilar: filtro !== "todas" && filtro !== "sin" ? filtro : "",
                }}
                busy={busy}
                clienteNombre={clienteNombre}
                onSave={(data) => save(data)}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-zinc-400">
            Cómo se filma la pieza, independiente de lo que dice. Elige uno al crear un guion y las notas de edición se
            adaptan a él. Basado en los formatos validados de VK Metrics, filtrados: los que eran narrativa se convirtieron
            en estructuras de guion.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {formatos.map((f) => (
              <article key={f.id} className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-md px-1.5 py-0.5 text-xs ${COSTE[f.coste]}`}>Coste {f.coste}</span>
                  {f.pilares.map((p) => (
                    <span key={p} className={`h-2 w-2 rounded-full ${PILAR_META[p].dot}`} title={PILAR_META[p].short} />
                  ))}
                </div>
                <h3 className="mt-2 font-medium">{f.nombre}</h3>
                <p className="mt-1 text-sm text-zinc-300">{f.como}</p>
                <p className="mt-2 text-xs text-zinc-400">{f.porque}</p>
                {f.ojo && <p className="mt-2 text-xs text-amber-200/90">⚠ {f.ojo}</p>}
                <p className="mt-auto pt-3 text-[11px] text-zinc-600">{f.origen}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
