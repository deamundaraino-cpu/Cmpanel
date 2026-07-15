"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Settings = Record<string, string>;

const PROVIDER_OPTIONS = [
  { value: "groq", label: "Groq — gratis (recomendado)" },
  { value: "openrouter", label: "OpenRouter — modelos :free" },
  { value: "gemini", label: "Google Gemini — capa gratis" },
  { value: "custom", label: "Personalizado (URL OpenAI-compatible)" },
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

export default function SettingsForm() {
  const [s, setS] = useState<Settings>({});
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        setS(json);
        setLoaded(true);
      });
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setS((prev) => ({ ...prev, [k]: e.target.value }));

  async function action(body: Record<string, unknown>, key: string, done: (j: Record<string, unknown>) => string) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setMsg(res.ok ? done(json) : `⚠️ ${json.error || "Error"}`);
      if (res.ok) router.refresh();
    } catch {
      setMsg("⚠️ Error de red");
    } finally {
      setBusy(null);
    }
  }

  const save = () => action(s, "save", () => "Ajustes guardados ✓");

  if (!loaded) return <p className="text-sm text-zinc-500">Cargando…</p>;

  return (
    <div className="grid gap-6">
      {msg && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200">
          {msg}
        </div>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">📸 Conexión con Instagram</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Pega tu token de larga duración (ver GUIA.md, paso 1). Caduca a los 60
          días: usa «Renovar token» antes de esa fecha.
        </p>
        <div className="mt-4 grid gap-3">
          <Field
            label="Token de acceso de Instagram"
            value={s.ig_token || ""}
            onChange={set("ig_token")}
            placeholder="IGAA..."
          />
          {s.ig_username && (
            <p className="text-xs text-emerald-400">Cuenta verificada: @{s.ig_username}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                action(
                  { action: "test_ig" },
                  "test_ig",
                  (j) => {
                    const p = j.profile as { username: string; followers_count: number };
                    return `✓ Conectado como @${p.username} (${p.followers_count} seguidores)`;
                  }
                )
              }
              disabled={!!busy}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy === "test_ig" ? "Probando…" : "Probar conexión"}
            </button>
            <button
              onClick={() =>
                action({ action: "refresh_ig_token" }, "refresh", () => "Token renovado ✓ (60 días más)")
              }
              disabled={!!busy}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy === "refresh" ? "Renovando…" : "Renovar token"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">🧠 Proveedor de IA (gratis)</h2>
        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-400">Proveedor</span>
            <select
              value={s.llm_provider || "groq"}
              onChange={set("llm_provider")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            >
              {PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="API Key"
            value={s.llm_api_key || ""}
            onChange={set("llm_api_key")}
            placeholder="gsk_... / sk-or-... / AIza..."
            hint="Groq: console.groq.com · OpenRouter: openrouter.ai/keys · Gemini: aistudio.google.com"
          />
          <Field
            label="Modelo (opcional, hay uno por defecto)"
            value={s.llm_model || ""}
            onChange={set("llm_model")}
            placeholder="ej. llama-3.3-70b-versatile"
          />
          {s.llm_provider === "custom" && (
            <Field
              label="URL base (OpenAI-compatible)"
              value={s.llm_base_url || ""}
              onChange={set("llm_base_url")}
              placeholder="https://mi-proveedor/v1"
            />
          )}
          <div>
            <button
              onClick={() =>
                action({ action: "test_llm" }, "test_llm", (j) => `✓ IA responde: "${j.reply}"`)
              }
              disabled={!!busy}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy === "test_llm" ? "Probando…" : "Probar IA"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">🔍 Búsqueda web (opcional)</h2>
        <div className="mt-4">
          <Field
            label="Tavily API Key"
            value={s.tavily_api_key || ""}
            onChange={set("tavily_api_key")}
            hint="Gratis 1.000 búsquedas/mes en tavily.com — sin ella, las ideas se generan sin búsqueda en vivo."
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!!busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy === "save" ? "Guardando…" : "Guardar ajustes"}
        </button>
      </div>
    </div>
  );
}
