"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Settings = Record<string, string>;

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
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        setS(json);
        setLoaded(true);
      });
  }, []);

  // Resultado del callback OAuth (?ig=ok|error)
  useEffect(() => {
    const ig = searchParams.get("ig");
    if (ig === "ok") {
      const u = searchParams.get("username");
      setMsg(`✓ Instagram conectado${u ? ` como @${u}` : ""}`);
    } else if (ig === "error") {
      setMsg(`⚠️ ${searchParams.get("msg") || "No se pudo conectar Instagram"}`);
    }
  }, [searchParams]);

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
  const connected = !!s.ig_username || !!s.ig_token;

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
          Conecta tu cuenta profesional (Business o Creator) con un clic. El
          acceso se renueva solo; puedes desconectarla cuando quieras.
        </p>

        <div className="mt-4 grid gap-3">
          {connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-emerald-400">
                ✓ Conectado{s.ig_username ? ` como @${s.ig_username}` : ""}
              </p>
              <button
                onClick={() =>
                  action({ action: "test_ig" }, "test_ig", (j) => {
                    const p = j.profile as { username: string; followers_count: number };
                    return `✓ Conexión activa: @${p.username} (${p.followers_count} seguidores)`;
                  })
                }
                disabled={!!busy}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
              >
                {busy === "test_ig" ? "Probando…" : "Probar conexión"}
              </button>
              <button
                onClick={() =>
                  action({ action: "refresh_ig_token" }, "refresh", () => "Acceso renovado ✓ (60 días más)")
                }
                disabled={!!busy}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
              >
                {busy === "refresh" ? "Renovando…" : "Renovar acceso"}
              </button>
              <button
                onClick={() => {
                  if (confirm("¿Desconectar Instagram? Tus datos ya sincronizados se conservan.")) {
                    action({ action: "disconnect_ig" }, "disconnect", () => "Instagram desconectado");
                    setS((prev) => ({ ...prev, ig_username: "", ig_token: "" }));
                  }
                }}
                disabled={!!busy}
                className="rounded-lg border border-red-900/60 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-950/40 disabled:opacity-50"
              >
                Desconectar
              </button>
            </div>
          ) : (
            <div>
              <a
                href="/api/instagram/connect"
                className="inline-block rounded-lg bg-gradient-to-r from-fuchsia-600 to-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                Conectar con Instagram
              </a>
              <p className="mt-2 text-xs text-zinc-600">
                Se abrirá Instagram para autorizar el acceso de solo lectura a
                tus métricas.
              </p>
            </div>
          )}

          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
              Avanzado: pegar token manualmente
            </summary>
            <div className="mt-3 grid gap-3">
              <Field
                label="Token de acceso de Instagram (larga duración)"
                value={s.ig_token || ""}
                onChange={set("ig_token")}
                placeholder="IGAA..."
                hint="Solo si sabes lo que haces: token generado en developers.facebook.com. Caduca a los 60 días; la plataforma lo renueva sola."
              />
              <div>
                <button
                  onClick={save}
                  disabled={!!busy}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
                >
                  {busy === "save" ? "Guardando…" : "Guardar token"}
                </button>
              </div>
            </div>
          </details>
        </div>
      </section>

      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4 text-xs text-zinc-500">
        🧠 La IA (análisis, ideas, propuestas) ya viene incluida y configurada
        — no necesitas ninguna API key. Tienes un cupo diario de operaciones de
        IA que se reinicia cada día.
      </div>
    </div>
  );
}
