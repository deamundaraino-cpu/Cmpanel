"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import AuthCard from "@/components/AuthCard";

const INPUT =
  "mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-indigo-500";

export default function RegistroPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message.includes("already registered")
          ? "Ese email ya tiene una cuenta. Inicia sesión."
          : error.message
      );
      return;
    }
    if (data.session) {
      // Confirmación de email desactivada: sesión inmediata.
      router.push("/onboarding");
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <AuthCard title="Revisa tu correo" subtitle="Un paso más">
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          Te enviamos un enlace de confirmación a{" "}
          <span className="text-indigo-400">{email}</span>. Ábrelo para
          activar tu cuenta y luego inicia sesión.
        </p>
        <Link
          href="/login"
          className="mt-5 block w-full rounded-lg bg-indigo-600 py-2 text-center text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          Ir a iniciar sesión
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Crea tu cuenta"
      subtitle="Conecta tu Instagram y deja que la IA trabaje contigo"
    >
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
          placeholder="Contraseña (mínimo 8 caracteres)"
          autoComplete="new-password"
          className={INPUT}
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button
          disabled={loading || !email || !password}
          className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-4 text-xs text-zinc-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
          Inicia sesión
        </Link>
      </p>
    </AuthCard>
  );
}
