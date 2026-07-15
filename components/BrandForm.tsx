"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Settings = Record<string, string>;

const KEYS = [
  "brand_name",
  "brand_handle",
  "brand_color",
  "brand_color_secondary",
  "brand_visual_style",
  "brand_logo",
  "brand_niche",
  "brand_mission",
  "brand_audience",
  "brand_value_prop",
  "brand_tone",
  "brand_pillars",
  "brand_objectives",
  "brand_avoid",
];

const VISUAL_STYLES = [
  {
    value: "minimal_oscuro",
    label: "Minimal oscuro",
    hint: "Fondo oscuro, texto claro, tu color como acento. Discreto y profesional.",
  },
  {
    value: "editorial_claro",
    label: "Editorial claro",
    hint: "Fondo claro, texto oscuro, barra de color como firma. Look de revista.",
  },
  {
    value: "bold_contraste",
    label: "Bold contraste",
    hint: "Fondo a todo color, texto grande en blanco. Máximo impacto para hooks.",
  },
];

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />
      {hint && <span className="mt-1 block text-xs text-zinc-600">{hint}</span>}
    </label>
  );
}

function TextArea({
  label,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <textarea
        {...props}
        rows={props.rows || 3}
        className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />
      {hint && <span className="mt-1 block text-xs text-zinc-600">{hint}</span>}
    </label>
  );
}

export default function BrandForm() {
  const [s, setS] = useState<Settings>({});
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        setS(json);
        setLoaded(true);
      });
  }, []);

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setS((prev) => ({ ...prev, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, string> = {};
      for (const k of KEYS) body[k] = s[k] || "";
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setMsg(res.ok ? "Ficha de marca guardada ✓ — la IA ya la usará en sus próximos análisis, ideas y propuestas." : `⚠️ ${json.error || "Error"}`);
      if (res.ok) {
        setPreviewVersion((v) => v + 1);
        router.refresh();
      }
    } catch {
      setMsg("⚠️ Error de red");
    } finally {
      setBusy(false);
    }
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 400_000) {
      setMsg("⚠️ La imagen pesa demasiado. Usa un logo cuadrado de menos de 400 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setS((prev) => ({ ...prev, brand_logo: reader.result as string }));
    reader.readAsDataURL(file);
  }

  if (!loaded) return <p className="text-sm text-zinc-500">Cargando…</p>;

  return (
    <div className="grid gap-6">
      {msg && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200">
          {msg}
        </div>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">🏷️ Identidad</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Nombre de marca" value={s.brand_name || ""} onChange={set("brand_name")} placeholder="ADSHouse" />
          <Field label="Handle de Instagram" value={s.brand_handle || ""} onChange={set("brand_handle")} placeholder="@adshouse" />
          <Field
            label="Nicho / industria"
            value={s.brand_niche || ""}
            onChange={set("brand_niche")}
            placeholder="marketing digital y publicidad para pymes"
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">🎨 Identidad visual</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Así se ven tus carruseles y guiones generados. Colores, logo y
          estilo de diseño — para que se vea como tu marca, no como una IA
          genérica.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-zinc-400">Color primario</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(s.brand_color || "") ? s.brand_color : "#e8590c"}
                onChange={set("brand_color")}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950"
              />
              <input
                value={s.brand_color || ""}
                onChange={set("brand_color")}
                placeholder="#e8590c"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-400">Color secundario</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={
                  /^#[0-9a-f]{6}$/i.test(s.brand_color_secondary || "")
                    ? s.brand_color_secondary
                    : "#3987e5"
                }
                onChange={set("brand_color_secondary")}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950"
              />
              <input
                value={s.brand_color_secondary || ""}
                onChange={set("brand_color_secondary")}
                placeholder="#3987e5"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </label>
        </div>

        <div className="mt-5">
          <span className="text-xs font-medium text-zinc-400">Logo (opcional)</span>
          <div className="mt-2 flex items-center gap-3">
            {s.brand_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.brand_logo}
                alt="Logo"
                className="h-14 w-14 rounded-lg border border-zinc-700 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-600">
                Sin logo
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="cursor-pointer rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-700">
                Subir imagen
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogoChange} className="hidden" />
              </label>
              {s.brand_logo && (
                <button
                  onClick={() => setS((prev) => ({ ...prev, brand_logo: "" }))}
                  className="text-xs text-zinc-500 hover:text-red-400"
                >
                  Quitar logo
                </button>
              )}
            </div>
            <span className="text-xs text-zinc-600">
              Cuadrada, menos de 400 KB. Si no subes una, se usa un punto de tu color primario.
            </span>
          </div>
        </div>

        <div className="mt-5">
          <span className="text-xs font-medium text-zinc-400">Estilo de diseño</span>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {VISUAL_STYLES.map((style) => {
              const active = (s.brand_visual_style || "minimal_oscuro") === style.value;
              return (
                <button
                  key={style.value}
                  onClick={() => setS((prev) => ({ ...prev, brand_visual_style: style.value }))}
                  className={`overflow-hidden rounded-lg border text-left transition ${
                    active
                      ? "border-indigo-500 ring-1 ring-indigo-500"
                      : "border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/brand-preview?style=${style.value}&v=${previewVersion}`}
                    alt={style.label}
                    className="h-32 w-full object-cover"
                  />
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-zinc-200">{style.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{style.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">
            Las miniaturas usan tus colores guardados — guarda primero si acabas de cambiarlos.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">🎯 Cliente ideal</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Quién es, qué le duele, qué desea lograr, en qué punto está de su
          camino cuando te encuentra.
        </p>
        <div className="mt-3">
          <TextArea
            label="Describe a tu cliente ideal"
            value={s.brand_audience || ""}
            onChange={set("brand_audience")}
            rows={4}
            placeholder="Ej: dueños de agencias de 1-10 personas que ya facturan pero se sienten estancados, quieren escalar sin depender de referidos, desconfían de las promesas fáciles de 'hazte rico' del nicho."
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">💎 Propuesta de valor</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Qué te hace diferente. Por qué deberían seguirte a ti y no a otro
          creador del mismo nicho.
        </p>
        <div className="mt-3">
          <TextArea
            label="Diferenciadores"
            value={s.brand_value_prop || ""}
            onChange={set("brand_value_prop")}
            rows={3}
            placeholder="Ej: hablo con datos reales de mis propias campañas, sin humo. Combino estrategia con ejecución técnica. Cero recetas genéricas de 'gurú'."
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">🧭 Misión y propósito</h2>
        <div className="mt-3">
          <TextArea
            label="¿Por qué existe esta marca?"
            value={s.brand_mission || ""}
            onChange={set("brand_mission")}
            rows={3}
            placeholder="Ej: ayudar a dueños de negocios digitales a dejar de improvisar en redes y construir un sistema de contenido que realmente venda."
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">🗣️ Tono de voz</h2>
        <div className="mt-3">
          <TextArea
            label="¿Cómo suena tu marca?"
            value={s.brand_tone || ""}
            onChange={set("brand_tone")}
            rows={3}
            placeholder="Ej: directo, sin rodeos, con humor seco. Tuteo. Nada de emojis en exceso. Frases cortas. Cero lenguaje corporativo."
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">📚 Líneas de contenido (pilares)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Los grandes temas sobre los que siempre puedes crear contenido. Uno
          por línea.
        </p>
        <div className="mt-3">
          <TextArea
            label="Pilares de contenido"
            value={s.brand_pillars || ""}
            onChange={set("brand_pillars")}
            rows={5}
            placeholder={"Estrategia de precios y ventas\nErrores comunes al escalar una agencia\nCasos reales de campañas propias\nMentalidad y hábitos de trabajo\nHerramientas y automatización con IA"}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">🚀 Objetivos actuales</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Qué buscas ahora mismo con tu contenido: autoridad, comunidad,
          leads, ventas de un producto concreto, etc.
        </p>
        <div className="mt-3">
          <TextArea
            label="Objetivos"
            value={s.brand_objectives || ""}
            onChange={set("brand_objectives")}
            rows={3}
            placeholder="Ej: posicionarme como referente en publicidad para pymes, generar leads para el servicio de auditorías, lanzar un infoproducto en 3 meses."
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">🚫 Qué evitar</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Temas, palabras, comparaciones o estilos que no quieres que la IA
          use nunca.
        </p>
        <div className="mt-3">
          <TextArea
            label="Líneas rojas"
            value={s.brand_avoid || ""}
            onChange={set("brand_avoid")}
            rows={3}
            placeholder="Ej: nada de promesas de 'hazte rico rápido', no mencionar competidores por nombre, evitar anglicismos innecesarios."
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar ficha de marca"}
        </button>
      </div>
    </div>
  );
}
