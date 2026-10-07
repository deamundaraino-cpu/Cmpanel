"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Campo = "usado_video" | "usado_carrusel";

const OPCIONES: { campo: Campo; label: string }[] = [
  { campo: "usado_video", label: "🎬 Video" },
  { campo: "usado_carrusel", label: "🎨 Carrusel" },
];

/** Checks de "ya se creó contenido de esta idea" por formato. */
export default function IdeaUsageChecks({
  ideaId,
  usadoVideo,
  usadoCarrusel,
}: {
  ideaId: number;
  usadoVideo: boolean;
  usadoCarrusel: boolean;
}) {
  const [estado, setEstado] = useState<Record<Campo, boolean>>({
    usado_video: usadoVideo,
    usado_carrusel: usadoCarrusel,
  });
  const [busy, setBusy] = useState<Campo | null>(null);
  const router = useRouter();

  async function toggle(campo: Campo) {
    const valor = !estado[campo];
    setBusy(campo);
    setEstado((s) => ({ ...s, [campo]: valor }));
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setEstado((s) => ({ ...s, [campo]: !valor }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      {OPCIONES.map(({ campo, label }) => (
        <label
          key={campo}
          className={`flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1 text-xs transition ${
            estado[campo]
              ? "bg-emerald-600/15 text-emerald-300"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <input
            type="checkbox"
            checked={estado[campo]}
            disabled={busy === campo}
            onChange={() => toggle(campo)}
            className="h-3.5 w-3.5 accent-emerald-500"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
