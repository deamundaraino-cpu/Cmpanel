"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import AuthCard from "@/components/AuthCard";

export default function RestablecerPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setLoading(true);
    setError(null);
    // El enlace del correo ya abrió sesión (código intercambiado al cargar).
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(
        "No se pudo actualizar. Abre el enlace del correo de nuevo (caduca pronto)."
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard title="Nueva contraseña" subtitle="Elige una contraseña nueva">
      <form onSubmit={submit} className="mt-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nueva contraseña (mínimo 8 caracteres)"
          autoFocus
          autoComplete="new-password"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button
          disabled={loading || !password}
          className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>
    </AuthCard>
  );
}
