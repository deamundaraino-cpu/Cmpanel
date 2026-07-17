"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BrandForm from "@/components/BrandForm";

type Props = {
  hasClient: boolean;
  clientNombre: string | null;
  igConnected: boolean;
  igUsername: string | null;
  brandDone: boolean;
};

export default function OnboardingWizard({
  hasClient,
  clientNombre,
  igConnected,
  igUsername,
  brandDone,
}: Props) {
  const [step, setStep] = useState(
    !hasClient ? 1 : !igConnected ? 2 : !brandDone ? 3 : 4
  );
  const [nombre, setNombre] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const router = useRouter();

  async function finish() {
    await fetch("/api/onboarding", { method: "POST" });
    router.push("/dashboard");
    router.refresh();
  }

  async function createClient() {
    if (!nombre.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error || "Error al crear el cliente");
      } else {
        setStep(2);
        router.refresh();
      }
    } catch {
      setCreateError("Error de red");
    } finally {
      setCreating(false);
    }
  }

  async function firstSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setSyncMsg(`✓ ${json.synced} posts y ${json.syncedStories || 0} historias sincronizados`);
      } else {
        setSyncMsg(`⚠️ ${json.error || "Error al sincronizar"}`);
      }
    } catch {
      setSyncMsg("⚠️ Error de red");
    } finally {
      setSyncing(false);
    }
  }

  const steps = [
    { n: 1, label: "Tu primer cliente" },
    { n: 2, label: "Su Instagram" },
    { n: 3, label: "Su marca" },
    { n: 4, label: "Primer análisis" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <button
              onClick={() => (s.n === 1 || hasClient) && setStep(s.n)}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
                step === s.n
                  ? "bg-indigo-600 text-white"
                  : step > s.n
                  ? "bg-emerald-600/20 text-emerald-300"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {step > s.n ? "✓" : s.n}
            </button>
            <span className={`text-xs ${step === s.n ? "text-zinc-200" : "text-zinc-500"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-zinc-800" />}
          </div>
        ))}
      </div>

      <div className="mt-6">
        {step === 1 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="font-medium">👥 Añade tu primer cliente</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              Cada cliente tiene su propio Instagram, su ficha de marca y su
              contenido, separados del resto. Si gestionas tu propia marca,
              créala también como cliente. Podrás añadir más desde «Clientes».
            </p>
            {hasClient ? (
              <div className="mt-4">
                <p className="text-sm text-emerald-400">
                  ✓ Cliente creado{clientNombre ? `: ${clientNombre}` : ""}
                </p>
                <button
                  onClick={() => setStep(2)}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  Continuar →
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createClient()}
                  placeholder="Nombre del cliente o de la marca (ej: Clínica Sonría)"
                  autoFocus
                  className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
                {createError && <p className="mt-2 text-xs text-red-400">{createError}</p>}
                <button
                  onClick={createClient}
                  disabled={creating || !nombre.trim()}
                  className="mt-3 block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {creating ? "Creando…" : "Crear cliente →"}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="font-medium">📸 Conecta el Instagram del cliente</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              La cuenta debe ser profesional (Business o Creator). El acceso es
              de solo lectura: métricas, posts, historias y comentarios. Durante
              la beta, pide al equipo de Brandpanel que añada la cuenta como
              tester antes de conectar (o pega un token manual en Ajustes →
              Avanzado).
            </p>
            {igConnected ? (
              <div className="mt-4">
                <p className="text-sm text-emerald-400">
                  ✓ Conectado{igUsername ? ` como @${igUsername}` : ""}
                </p>
                <button
                  onClick={() => setStep(3)}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  Continuar →
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  href="/api/instagram/connect"
                  className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Conectar con Instagram
                </a>
                <button
                  onClick={() => setStep(3)}
                  className="text-sm text-zinc-500 hover:text-zinc-300"
                >
                  Lo haré después
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="font-medium">🧠 Cuéntale a la IA quién es este cliente</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                Esta ficha se inyecta en cada análisis, idea y guion que la IA
                genere para este cliente. Con el cliente ideal y los pilares de
                contenido ya se nota la diferencia — puedes completar el resto
                después en 🧠 Marca.
              </p>
            </div>
            <div className="mt-4">
              <BrandForm />
            </div>
            <button
              onClick={() => setStep(4)}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Continuar →
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="font-medium">🚀 El primer análisis</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              Trae los posts e historias del cliente y deja que el sistema los
              califique. Tarda un minuto aproximadamente.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={firstSync}
                disabled={syncing || !igConnected}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {syncing ? "Sincronizando…" : "Sincronizar ahora"}
              </button>
              <button
                onClick={finish}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
              >
                Ir a mi panel →
              </button>
            </div>
            {!igConnected && (
              <p className="mt-3 text-xs text-amber-400">
                Conecta el Instagram en el paso 2 para poder sincronizar (o
                entra al panel y hazlo desde Ajustes).
              </p>
            )}
            {syncMsg && <p className="mt-3 text-sm text-zinc-300">{syncMsg}</p>}
          </div>
        )}
      </div>

      {hasClient && (
        <button onClick={finish} className="mt-6 text-xs text-zinc-600 hover:text-zinc-400">
          Saltar por ahora e ir al panel
        </button>
      )}
    </div>
  );
}
