import Link from "next/link";

export const metadata = { title: "Política de privacidad — Brandpanel" };

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
        ← Brandpanel
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Política de privacidad</h1>
      <p className="mt-2 text-xs text-zinc-500">Última actualización: 16 de julio de 2026</p>

      <div className="mt-8 grid gap-6 text-sm leading-relaxed text-zinc-300">
        <section>
          <h2 className="font-semibold text-zinc-100">Quiénes somos</h2>
          <p className="mt-1.5">
            Brandpanel es una herramienta de gestión de contenido para Instagram
            operada por David Digital. Contacto:{" "}
            <a href="mailto:daviddigitalco@gmail.com" className="text-indigo-400">
              daviddigitalco@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-100">Qué datos recopilamos</h2>
          <ul className="mt-1.5 list-disc pl-5">
            <li>
              <strong>Datos de cuenta:</strong> tu email y contraseña (cifrada) al
              registrarte.
            </li>
            <li>
              <strong>Datos de Instagram (solo lectura):</strong> si conectas tu
              cuenta profesional, obtenemos vía la API oficial de Instagram tu
              nombre de usuario, número de seguidores, tus publicaciones e
              historias con sus métricas (alcance, me gusta, guardados,
              compartidos) y los comentarios públicos de tus publicaciones.
            </li>
            <li>
              <strong>Ficha de marca:</strong> la información sobre tu marca que
              tú mismo escribes en la plataforma.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-100">Para qué los usamos</h2>
          <p className="mt-1.5">
            Exclusivamente para darte el servicio: mostrar tus métricas, calificar
            tus publicaciones y generar recomendaciones, ideas y propuestas de
            contenido con inteligencia artificial. No vendemos ni compartimos tus
            datos con terceros con fines publicitarios. Fragmentos de tus métricas
            y textos se envían de forma puntual a proveedores de IA para generar
            las recomendaciones que solicitas.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-100">Dónde se guardan</h2>
          <p className="mt-1.5">
            En una base de datos gestionada por Supabase con acceso restringido.
            Cada cuenta solo puede acceder a sus propios datos.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-100">Tus derechos y eliminación</h2>
          <p className="mt-1.5">
            Puedes desconectar tu Instagram en cualquier momento desde Ajustes y
            solicitar la eliminación completa de tu cuenta y tus datos. Consulta{" "}
            <Link href="/eliminar-datos" className="text-indigo-400">
              cómo eliminar tus datos
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-zinc-100">Cookies</h2>
          <p className="mt-1.5">
            Solo usamos cookies técnicas de sesión, imprescindibles para mantenerte
            conectado. No usamos cookies publicitarias ni de seguimiento.
          </p>
        </section>
      </div>
    </main>
  );
}
