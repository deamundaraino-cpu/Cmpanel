"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import AuthCard from "@/components/AuthCard";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthCard
      title="Recuperar contraseña"
      subtitle="Te enviamos un enlace para restablecerla"
    >
      {sent ? (
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          Si <span className="text-indigo-400">{email}</span> tiene una cuenta,
          recibirás un correo con el enlace para crear una contraseña nueva.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Tu email"
            autoFocus
            autoComplete="email"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            disabled={loading || !email}
            className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>
      )}
      <p className="mt-4 text-xs text-zinc-500">
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthCard>
  );
}
