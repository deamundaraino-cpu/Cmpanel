"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminUserRow({
  userId,
  currentLimit,
  defaultLimit,
}: {
  userId: string;
  currentLimit: number | null;
  defaultLimit: number;
}) {
  const [value, setValue] = useState(currentLimit === null ? "" : String(currentLimit));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save() {
    setBusy(true);
    setSaved(false);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ai_daily_limit: value === "" ? null : Number(value) }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={String(defaultLimit)}
        className="w-16 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs tabular-nums outline-none focus:border-indigo-500"
      />
      <button
        onClick={save}
        disabled={busy}
        className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {busy ? "…" : saved ? "✓" : "OK"}
      </button>
    </div>
  );
}
