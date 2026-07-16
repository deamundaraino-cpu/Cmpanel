import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { hasBrandBrief } from "@/lib/brand";
import OnboardingWizard from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { userId, email } = await requireUser();
  const igUsername = await getSetting(userId, "ig_username");
  const igToken = await getSetting(userId, "ig_token");
  const brandDone = await hasBrandBrief(userId);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        ¡Bienvenido a Brandpanel!
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        {email} — 3 pasos y tu CM con IA queda listo para trabajar.
      </p>

      <div className="mt-6">
        <OnboardingWizard
          igConnected={!!igToken}
          igUsername={igUsername}
          brandDone={brandDone}
        />
      </div>
    </div>
  );
}
