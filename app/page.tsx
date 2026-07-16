import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: "📊",
    title: "Métricas que importan",
    text: "Cada post calificado del 1 al 10 frente a tu propia media. Detecta ganadores, mejores horas y formatos que funcionan.",
  },
  {
    icon: "💡",
    title: "Ideas alineadas a tu estrategia",
    text: "La IA investiga tu nicho y los comentarios reales de tu audiencia para proponerte ideas por pilar de contenido.",
  },
  {
    icon: "🎨",
    title: "Carruseles y guiones listos",
    text: "Propuestas con tu identidad visual: apruébalas, pide cambios y descarga las imágenes o el guion para grabar.",
  },
  {
    icon: "🤖",
    title: "En piloto automático",
    text: "Sincronización diaria de posts e historias, alertas operativas y renovación automática del acceso a Instagram.",
  },
];

export default async function LandingPage() {
  const auth = await getAuth();
  if (auth) redirect("/dashboard");

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
            B
          </div>
          <p className="text-sm font-semibold tracking-tight">Brandpanel</p>
        </div>
        <Link
          href="/login"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Iniciar sesión
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-14 text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Tu community manager
          <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            {" "}
            con IA{" "}
          </span>
          para Instagram
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
          Conecta tu cuenta, entiende qué contenido funciona y recibe ideas,
          carruseles y guiones de video hechos a medida de tu marca. Tú
          apruebas, él trabaja.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/registro"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-6 py-3 text-sm text-zinc-400 transition hover:text-white"
          >
            Ya tengo cuenta →
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-2xl">{f.icon}</p>
            <p className="mt-3 font-medium">{f.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-zinc-800/60 py-8 text-center text-xs text-zinc-600">
        Brandpanel — gestiona tu marca personal en Instagram con IA
      </footer>
    </main>
  );
}
