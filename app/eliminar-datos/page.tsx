import Link from "next/link";

export const metadata = { title: "Eliminación de datos — Brandpanel" };

export default function EliminarDatosPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
        ← Brandpanel
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        Eliminación de tus datos
      </h1>

      <div className="mt-8 grid gap-6 text-sm leading-relaxed text-zinc-300">
        <section>
          <h2 className="font-semibold text-zinc-100">
            Desconectar Instagram (inmediato)
          </h2>
          <p className="mt-1.5">
            Entra en <strong>Ajustes → Conexión con Instagram → Desconectar</strong>.
            Esto revoca el acceso de Brandpanel a tu cuenta de Instagram al
            instante. También puedes revocarlo desde Instagram en{" "}
            <em>Configuración → Sitios web y aplicaciones</em>.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-100">
            Eliminar tu cuenta y todos tus datos
          </h2>
          <p className="mt-1.5">
            Envía un correo a{" "}
            <a href="mailto:daviddigitalco@gmail.com" className="text-indigo-400">
              daviddigitalco@gmail.com
            </a>{" "}
            desde el email con el que te registraste, con el asunto{" "}
            <strong>&quot;Eliminar mi cuenta&quot;</strong>. En un plazo máximo de
            7 días eliminaremos de forma permanente tu cuenta y todos los datos
            asociados: publicaciones e historias sincronizadas, métricas,
            comentarios, ideas, propuestas, ficha de marca e informes.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-100">Copia de tus datos</h2>
          <p className="mt-1.5">
            Antes de eliminar tu cuenta puedes descargar todos tus datos en un
            archivo JSON desde <strong>Ajustes → Copia de seguridad</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}
