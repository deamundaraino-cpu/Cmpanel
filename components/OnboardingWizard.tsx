"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BrandForm from "@/components/BrandForm";

type Props = {
  igConnected: boolean;
  igUsername: string | null;
  brandDone: boolean;
};

export default function OnboardingWizard({ igConnected, igUsername, brandDone }: Props) {
  const [step, setStep] = useState(igConnected ? (brandDone ? 3 : 2) : 1);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const router = useRouter();

  async function finish() {
    await fetch("/api/onboarding", { method: "POST" });
    router.push("/dashboard");
    router.refresh();
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
    { n: 1, label: "Conectar Instagram" },
    { n: 2, label: "Tu marca" },
    { n: 3, label: "Primer análisis" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s.n)}
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
            <h2 className="font-medium">📸 Conecta tu Instagram</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              Necesitas una cuenta profesional (Business o Creator). El acceso
              es de solo lectura: métricas, posts, historias y comentarios.
            </p>
            {igConnected ? (
              <div className="mt-4">
                <p className="text-sm text-emerald-400">
                  ✓ Conectado{igUsername ? ` como @${igUsername}` : ""}
                </p>
                <button
                  onClick={() => setStep(2)}
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
                  onClick={() => setStep(2)}
                  className="text-sm text-zinc-500 hover:text-zinc-300"
                >
                  Lo haré después
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="font-medium">🧠 Cuéntale a la IA quién eres</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                Esta ficha se inyecta en cada análisis, idea y propuesta. Con
                el cliente ideal y los pilares de contenido ya se nota la
                diferencia — puedes completar el resto después en 🧠 Marca.
              </p>
            </div>
            <div className="mt-4">
              <BrandForm />
            </div>
            <button
              onClick={() => setStep(3)}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Continuar →
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="font-medium">🚀 Tu primer análisis</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              Trae tus posts e historias de Instagram y deja que el sistema los
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
                Conecta Instagram en el paso 1 para poder sincronizar (o entra
                al panel y hazlo desde Ajustes).
              </p>
            )}
            {syncMsg && <p className="mt-3 text-sm text-zinc-300">{syncMsg}</p>}
          </div>
        )}
      </div>

      <button onClick={finish} className="mt-6 text-xs text-zinc-600 hover:text-zinc-400">
        Saltar por ahora e ir al panel
      </button>
    </div>
  );
}
