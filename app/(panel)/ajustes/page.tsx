import Link from "next/link";
import SettingsForm from "@/components/SettingsForm";
import ActionButton from "@/components/ActionButton";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Conecta tu cuenta de Instagram, tu proveedor de IA y la búsqueda web.
        Para la identidad, el cliente ideal y la estrategia de contenido, ve a{" "}
        <Link href="/marca" className="text-indigo-400 hover:text-indigo-300">
          🧠 Marca
        </Link>
        .
      </p>

      <div className="mt-6">
        <SettingsForm />
      </div>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">💾 Copia de seguridad</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Descarga todos tus datos (posts, historias, ideas, propuestas, ficha
          de marca, informes…) en un archivo JSON. Guárdalo de vez en cuando.
        </p>
        <div className="mt-3">
          <a
            href="/api/export"
            className="inline-block rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700"
          >
            ⬇ Descargar copia de seguridad
          </a>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-medium">🧪 Datos de demostración</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Carga 12 posts ficticios para probar la plataforma sin conectar
          Instagram todavía. Se pueden borrar en cualquier momento.
        </p>
        <div className="mt-3 flex gap-2">
          <ActionButton
            label="Cargar datos demo"
            url="/api/demo"
            variant="ghost"
            doneMessage="{seeded} posts demo cargados ({winners} ganadores)"
          />
          <ActionButton
            label="Borrar datos demo"
            url="/api/demo"
            body={{ action: "clear" }}
            variant="danger"
            doneMessage="Datos demo eliminados"
          />
        </div>
      </div>
    </div>
  );
}
