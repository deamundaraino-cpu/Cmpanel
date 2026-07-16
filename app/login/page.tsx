"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import AuthCard from "@/components/AuthCard";

const INPUT =
  "mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos"
          : error.message
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard title="Brandpanel" subtitle="Tu CM con IA para Instagram">
      <form onSubmit={submit} className="mt-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoFocus
          autoComplete="email"
          className={INPUT}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          className={INPUT}
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button
          disabled={loading || !email || !password}
          className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
        <Link href="/registro" className="hover:text-indigo-400">
          Crear cuenta
        </Link>
        <Link href="/recuperar" className="hover:text-indigo-400">
          Olvidé mi contraseña
        </Link>
      </div>
    </AuthCard>
  );
}
