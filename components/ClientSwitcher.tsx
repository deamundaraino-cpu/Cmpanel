"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ClientItem = { id: number; nombre: string; color: string };

/** Selector de cliente activo en la sidebar (dropdown ligero, sin librerías). */
export default function ClientSwitcher({
  clients,
  activeId,
}: {
  clients: ClientItem[];
  activeId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const active = clients.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function activate(id: number) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    await fetch("/api/clients/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id }),
    });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-zinc-800/60"
        title="Cambiar de cliente"
      >
        {active ? (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: active.color }} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400">
              {active.nombre}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-zinc-500">Sin cliente activo</span>
        )}
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3 shrink-0 text-zinc-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-xl shadow-black/40">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => activate(c.id)}
              disabled={busy}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-zinc-800/70 disabled:opacity-50 ${
                c.id === activeId ? "text-zinc-100" : "text-zinc-400"
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
              {c.id === activeId && <span className="text-indigo-400">✓</span>}
            </button>
          ))}
          <Link
            href="/clientes"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-lg border-t border-zinc-800/70 px-2.5 py-2 text-xs text-indigo-400 transition hover:bg-zinc-800/70 hover:text-indigo-300"
          >
            Gestionar clientes →
          </Link>
        </div>
      )}
    </div>
  );
}
