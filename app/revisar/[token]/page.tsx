import { getSql, ProposalRow } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import ReviewActions from "@/components/ReviewActions";

export const dynamic = "force-dynamic";

type Beat = { seccion: string; texto: string; edicion?: string };
type Slide = { titulo: string; cuerpo: string };

/**
 * Página PÚBLICA de revisión para el cliente final: ve la propuesta en
 * solo-lectura y puede aprobarla o pedir cambios, sin cuenta ni login.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sql = getSql();
  const rows = await sql<ProposalRow[]>`
    SELECT * FROM proposals WHERE share_token = ${token}
  `;
  const proposal = rows[0];

  if (!proposal?.slides) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <p className="text-2xl">🔍</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Enlace no válido</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Esta propuesta ya no existe o el enlace es incorrecto. Pide a tu
          editor que te comparta uno nuevo.
        </p>
      </main>
    );
  }

  const isScript = proposal.formato === "guion_video";
  const parsed = JSON.parse(proposal.slides) as Beat[] | Slide[];
  const s = await getSettings(proposal.client_id, ["brand_name", "brand_handle"]);
  const brandLabel = s.brand_name || s.brand_handle || "tu marca";

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Propuesta de contenido para revisar
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {isScript ? "🎬 Guion de video" : "🎨 Carrusel"} · {brandLabel}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Tu editor preparó esta pieza. Revísala y dinos si la aprobamos o qué
          cambiarías — no necesitas cuenta.
        </p>
      </header>

      <section className="mt-8">
        {isScript ? (
          <div className="grid gap-2.5">
            {(parsed as Beat[]).map((b, i) => (
              <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                  {b.seccion}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{b.texto}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(parsed as Slide[]).map((_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`/api/slide?pid=${proposal.id}&i=${i}&token=${token}`}
                alt={`Slide ${i + 1}`}
                className="h-72 w-auto shrink-0 rounded-lg border border-zinc-800"
                loading="lazy"
              />
            ))}
          </div>
        )}

        {proposal.caption && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium text-zinc-500">
              {isScript ? "Copy para acompañar el video" : "Caption del post"}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-300">
              {proposal.caption}
            </p>
          </div>
        )}
      </section>

      <section className="mt-8">
        <ReviewActions token={token} initialStatus={proposal.status} />
      </section>

      <footer className="mt-12 pb-6 text-center text-xs text-zinc-600">
        Hecho con Brandpanel
      </footer>
    </main>
  );
}
