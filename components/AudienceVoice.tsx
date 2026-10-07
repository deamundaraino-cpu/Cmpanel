"use client";

import { useState } from "react";

/**
 * Lo que la audiencia dice fuera de los comentarios públicos: DMs, preguntas
 * de las llamadas de venta, objeciones. Es la fuente de ideas más valiosa y la
 * única que Instagram no puede dar.
 */
export default function AudienceVoice({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience_voice: text }),
      });
      if (!res.ok) throw new Error();
      setSaved(text);
      setMsg("Guardado ✓");
    } catch {
      setMsg("Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  const lineas = saved.split("\n").filter((l) => l.trim()).length;

  return (
    <details className="group rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-zinc-200">
        🗣️ Voz de la audiencia{" "}
        <span className="font-normal text-zinc-500">
          · {lineas ? `${lineas} líneas — la IA las usa en cada búsqueda` : "vacío — pega aquí DMs, preguntas y objeciones"}
        </span>
      </summary>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        Pega lo que tu cliente dice con sus palabras: DMs, preguntas de las llamadas de venta, objeciones al comprar,
        respuestas a historias. Una por línea. Es la mejor materia prima para ideas que conectan.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"\"Ya invertí en anuncios y no me funcionó\"\n\"¿Esto sirve si vendo un curso de 97 USD?\"\n\"No tengo tiempo para grabar todos los días\""}
        className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy || text === saved}
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
        {msg && <span className="text-xs text-emerald-400">{msg}</span>}
      </div>
    </details>
  );
}
