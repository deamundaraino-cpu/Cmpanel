"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Campaign = { id: number; nombre: string };

export default function CampaignSelect({
  postId,
  current,
  campaigns,
}: {
  postId: string;
  current: number | null;
  campaigns: Campaign[];
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function assign(value: string) {
    setBusy(true);
    await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: value ? Number(value) : null }),
    });
    setBusy(false);
    router.refresh();
  }

  if (!campaigns.length) return null;

  return (
    <select
      value={current ?? ""}
      onChange={(e) => assign(e.target.value)}
      disabled={busy}
      className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500 disabled:opacity-50"
      title="Asignar a campaña"
    >
      <option value="">Sin campaña</option>
      {campaigns.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  );
}
