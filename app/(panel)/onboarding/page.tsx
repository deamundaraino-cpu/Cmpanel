import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { hasBrandBrief } from "@/lib/brand";
import OnboardingWizard from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { email, clientId, clientNombre } = await requireUser();
  const igUsername = clientId != null ? await getSetting(clientId, "ig_username") : null;
  const igToken = clientId != null ? await getSetting(clientId, "ig_token") : null;
  const brandDone = clientId != null ? await hasBrandBrief(clientId) : false;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        ¡Bienvenido a Brandpanel!
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        {email} — añade tu primer cliente y su centro de contenido queda listo
        para trabajar.
      </p>
      <p className="mt-3 inline-block rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-300">
        🧪 Estás en la beta cerrada: el contenido lo genera IA — revísalo antes
        de publicarlo. Tu feedback nos ayuda a mejorar la plataforma.
      </p>

      <div className="mt-6">
        <OnboardingWizard
          hasClient={clientId != null}
          clientNombre={clientNombre}
          igConnected={!!igToken}
          igUsername={igUsername}
          brandDone={brandDone}
        />
      </div>
    </div>
  );
}
