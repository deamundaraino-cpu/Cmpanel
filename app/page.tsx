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
    title: "Del dato al guion listo para grabar",
    text: "La IA convierte los ganadores y las ideas de cada cuenta en guiones con estructura probada y notas de edición para entregarle a tu editor.",
  },
  {
    icon: "🔗",
    title: "Aprobación del cliente sin fricción",
    text: "Comparte un enlace y tu cliente aprueba o pide cambios desde el móvil, sin crear cuenta. El feedback te llega directo a la propuesta.",
  },
  {
    icon: "📊",
    title: "Informes que retienen clientes",
    text: "Cada post calificado frente a la media de esa cuenta, e informes ejecutivos con IA que le envías a tu cliente con un enlace.",
  },
];

const VS_CHATGPT = [
  {
    title: "Conoce las métricas reales de cada cuenta",
    chat: "Escribe sobre lo que le pidas, sin saber qué funcionó",
    brand:
      "Cada idea y guion se ancla a los ganadores, el mejor formato y el mejor día de ESA cuenta — y te muestra la evidencia",
  },
  {
    title: "Tu cliente participa sin apps ni cuentas",
    chat: "Copias y pegas a WhatsApp, el feedback se pierde en audios",
    brand:
      "Enlace de aprobación y de informe: tu cliente aprueba, pide cambios o lee resultados desde el móvil",
  },
  {
    title: "Cada cliente, su mundo",
    chat: "Un solo hilo donde se mezclan todos tus clientes",
    brand:
      "Ficha de marca, historial, calendario y pipeline separados por cliente, más tu librería de estructuras reutilizable",
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
            gestores de contenido{" "}
          </span>
          que llevan varios clientes
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
          Conecta el Instagram de cada cliente, entiende qué contenido le
          funciona y convierte esos datos en ideas, guiones y carruseles con su
          identidad. Tu cliente aprueba con un enlace; tú entregas y reportas.
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

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-16 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-2xl">{f.icon}</p>
            <p className="mt-3 font-medium">{f.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          ¿Por qué no simplemente ChatGPT?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-zinc-400">
          Un chat escribe bonito. Un gestor necesita que el contenido salga de
          los datos de cada cuenta y vuelva aprobado por el cliente.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {VS_CHATGPT.map((row) => (
            <div key={row.title} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6">
              <p className="font-medium">{row.title}</p>
              <div className="mt-4 grid gap-3 text-sm leading-relaxed">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Con un chat genérico
                  </p>
                  <p className="mt-1 text-zinc-500">{row.chat}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                    Con Brandpanel
                  </p>
                  <p className="mt-1 text-zinc-300">{row.brand}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-800/60 py-8 text-center text-xs text-zinc-600">
        <p>Brandpanel — el panel multi-cliente para gestores de contenido en Instagram</p>
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
