import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: "👥",
    title: "Todos tus clientes en un panel",
    text: "Cada cliente con su Instagram, su ficha de marca y sus métricas, separados. Cambia de cliente en un clic y nunca mezcles contenido.",
  },
  {
    icon: "🎬",
    title: "Guiones listos para editar",
    text: "La IA convierte ideas y posts ganadores en guiones con estructura probada e indicaciones de corte, B-roll y texto en pantalla por sección.",
  },
  {
    icon: "🔗",
    title: "Aprobación del cliente sin fricción",
    text: "Comparte un enlace y tu cliente aprueba o pide cambios desde el móvil, sin crear cuenta. El feedback te llega directo a la propuesta.",
  },
  {
    icon: "📊",
    title: "Métricas que justifican tu trabajo",
    text: "Cada post calificado frente a la media de esa cuenta: detecta ganadores, mejores horas y formatos, e informes ejecutivos para reportar.",
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
        <p className="mx-auto inline-block rounded-full border border-indigo-800/50 bg-indigo-950/30 px-3 py-1 text-xs text-indigo-300">
          🧪 Beta cerrada — acceso con invitación
        </p>
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          El centro de mando para
          <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            {" "}
            editores{" "}
          </span>
          que gestionan varios clientes
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
          Conecta el Instagram de cada cliente, entiende qué contenido le
          funciona y recibe ideas, guiones de video con notas de edición y
          carruseles con su identidad. Tu cliente aprueba con un enlace, tú
          editas y publicas.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/registro"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500"
          >
            Entrar con mi código de invitación
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
        <p>Brandpanel — el panel multi-cliente para editores de contenido en Instagram</p>
        <p className="mt-2">
          <Link href="/privacidad" className="hover:text-zinc-400">
            Privacidad
          </Link>
          {" · "}
          <Link href="/eliminar-datos" className="hover:text-zinc-400">
            Eliminación de datos
          </Link>
        </p>
      </footer>
    </main>
  );
}
