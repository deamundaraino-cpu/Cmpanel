"use client";

import { useEffect, useState } from "react";

type Provider = { value: string; label: string; model: string };
type AiData = {
  values: Record<string, string>;
  env: Record<string, string>;
  effective: { provider: string; model: string; source: string } | null;
  providers: Provider[];
};

const INPUT =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500";

/** Panel de IA global — solo super admin. Overrides en BD; vacío = env vars. */
export default function AdminAiPanel() {
  const [data, setData] = useState<AiData | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/ai");
    const json = await res.json();
    setData(json);
    setForm(json.values);
  }

  useEffect(() => {
    load();
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      setMsg(res.ok ? "Guardado ✓ — aplica al instante, sin redeploy" : `⚠️ ${json.error}`);
      if (res.ok) load();
    } catch {
      setMsg("⚠️ Error de red");
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const json = await res.json();
      setMsg(
        res.ok
          ? `✓ ${json.provider} · ${json.model} (config de ${json.source === "db" ? "este panel" : "env vars"}): «${json.reply}»`
          : `⚠️ ${json.error}`
      );
    } catch {
      setMsg("⚠️ Error de red");
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <p className="text-sm text-zinc-500">Cargando panel de IA…</p>;

  const providerPreset = data.providers.find((p) => p.value === (form.llm_provider || ""));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">🤖 Proveedor de IA de la plataforma</h2>
        {data.effective && (
          <span className="rounded-md bg-indigo-600/15 px-2 py-0.5 text-xs text-indigo-300">
            Activo: {data.effective.provider} · {data.effective.model} ·{" "}
            {data.effective.source === "db" ? "configurado aquí" : "desde env vars"}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Solo tú ves esto. Lo que guardes aquí manda sobre las variables de
        entorno de Vercel y aplica al instante para todos los usuarios. Deja un
        campo vacío para volver al valor de las env vars
        {data.env.llm_api_key ? ` (env actual: ${data.env.llm_provider || "groq"} · llave ${data.env.llm_api_key})` : " (no hay llave en env)"}
        .
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-400">Proveedor</span>
          <select value={form.llm_provider || ""} onChange={set("llm_provider")} className={INPUT}>
            <option value="">— usar env vars —</option>
            {data.providers.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-400">API key del proveedor</span>
          <input
            value={form.llm_api_key || ""}
            onChange={set("llm_api_key")}
            placeholder="gsk_… / sk-or-… / AIza…"
            autoComplete="off"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-400">Modelo (opcional)</span>
          <input
            value={form.llm_model || ""}
            onChange={set("llm_model")}
            placeholder={providerPreset ? `default: ${providerPreset.model}` : "default del proveedor"}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-400">
            Base URL (solo proveedor personalizado)
          </span>
          <input
            value={form.llm_base_url || ""}
            onChange={set("llm_base_url")}
            placeholder="https://…/v1 (compatible OpenAI)"
            className={INPUT}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-zinc-400">
            Tavily API key (búsqueda web para Ideas, opcional)
          </span>
          <input
            value={form.tavily_api_key || ""}
            onChange={set("tavily_api_key")}
            placeholder="tvly-…"
            autoComplete="off"
            className={INPUT}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={!!busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy === "save" ? "Guardando…" : "Guardar"}
        </button>
        <button
          onClick={test}
          disabled={!!busy}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy === "test" ? "Probando…" : "Probar IA"}
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-zinc-300">{msg}</p>}
    </div>
  );
}
