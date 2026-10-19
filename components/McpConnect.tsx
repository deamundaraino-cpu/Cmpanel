"use client";

import { useEffect, useState } from "react";

type TokenRow = { id: number; nombre: string | null; prefijo: string; created_at: string; last_used_at: string | null };
type Created = { token: string; url_claude_ai: string; url_header: string };

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="shrink-0 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-200 transition hover:bg-zinc-700"
    >
      {done ? "Copiado ✓" : "Copiar"}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200">{value}</code>
        <Copy text={value} />
      </div>
    </div>
  );
}

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" }) : "nunca");

/**
 * Conector MCP: la vía principal para generar ideas, guiones e informes con
 * Claude (claude.ai o Claude Code). La IA interna queda como respaldo.
 */
export default function McpConnect() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [created, setCreated] = useState<Created | null>(null);
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/mcp-tokens");
    if (res.ok) setTokens(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mcp-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre || "Claude" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setCreated(json);
      setNombre("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    if (!confirm("¿Revocar este token? Claude dejará de tener acceso con él al instante.")) return;
    await fetch(`/api/mcp-tokens?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="rounded-xl border border-indigo-500/40 bg-zinc-900 p-5">
      <h2 className="font-medium">🤖 Conectar con Claude</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        Genera ideas, guiones, carruseles e informes desde Claude con los datos y las reglas de cada cliente. Claude
        escribe y la plataforma valida y guarda todo aquí para que lo revises y apruebes. Usa tu suscripción de Claude,
        sin límites de IA de la plataforma.
      </p>

      {created ? (
        <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
          <p className="text-xs font-medium text-emerald-300">
            Token creado. Cópialo ahora: por seguridad no se vuelve a mostrar.
          </p>
          <p className="mt-2 text-xs text-zinc-300">
            claude.ai → Ajustes → Conectores → Añadir conector personalizado → «Sin inicio de sesión»:
          </p>
          <Field label="URL:" value={created.url_header} />
          <Field label="Encabezados de solicitud → nombre: Authorization · valor:" value={`Bearer ${created.token}`} />
          <details className="mt-2 text-xs text-zinc-500">
            <summary className="cursor-pointer select-none">Alternativa: URL con el token incluido (sin encabezado)</summary>
            <Field label="URL:" value={created.url_claude_ai} />
          </details>
          <Field
            label="Claude Code (terminal):"
            value={`claude mcp add --transport http brandpanel ${created.url_header} --header "Authorization: Bearer ${created.token}"`}
          />
          <p className="mt-2 text-xs text-zinc-500">
            Trata la URL como una contraseña: quien la tenga puede leer y escribir en tus clientes. Si se filtra, revócala abajo.
          </p>
          <button onClick={() => setCreated(null)} className="mt-3 text-xs text-zinc-400 hover:text-zinc-200">
            Ya lo copié
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (ej. claude.ai, portátil)"
            className="w-56 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500"
          />
          <button
            onClick={create}
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Creando…" : "Generar conexión"}
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-800 border-t border-zinc-800">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-xs">
              <div className="min-w-0">
                <span className="text-zinc-200">{t.nombre || "Sin nombre"}</span>{" "}
                <code className="text-zinc-500">{t.prefijo}…</code>
                <div className="text-zinc-500">
                  Creado {fecha(t.created_at)} · último uso {fecha(t.last_used_at)}
                </div>
              </div>
              <button onClick={() => revoke(t.id)} className="shrink-0 text-red-400 hover:text-red-300">
                Revocar
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-4 text-xs text-zinc-400">
        <summary className="cursor-pointer select-none text-zinc-300">Qué puedes pedirle a Claude</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>«Búscame 6 ideas de crecimiento para Daviddigital» — usa tus datos, busca en la web y las guarda en Ideas.</li>
          <li>«Convierte la idea 212 en un guion con Storytelling 3 actos» — lo valida con las reglas de la marca y lo deja en Propuestas.</li>
          <li>«Aplica el feedback del cliente a la propuesta 88».</li>
          <li>«Exprime el mejor post ganador del último mes».</li>
          <li>«Prepara el informe de los últimos 30 días y dame el enlace».</li>
        </ul>
        <p className="mt-2">En claude.ai también tienes atajos en el menú «+» → Brandpanel: buscar ideas, escribir pieza, exprimir ganador e informe.</p>
      </details>
    </div>
  );
}
