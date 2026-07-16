import { getSql, ProposalRow } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import ProposalCard from "@/components/ProposalCard";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const { userId } = await requireUser();
  const sql = getSql();
  const proposals = await sql<ProposalRow[]>`
    SELECT * FROM proposals WHERE user_id = ${userId} ORDER BY id DESC
  `;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Propuestas de contenido</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Tu CM diseña, tú decides. Aprueba una propuesta para descargar las
        imágenes del carrusel o el guion de video, listos para grabar o
        publicar.
      </p>

      <div className="mt-6 grid gap-4">
        {proposals.map((p) => {
          const isScript = p.formato === "guion_video";
          const parsed = p.slides ? JSON.parse(p.slides) : [];
          return (
            <ProposalCard
              key={p.id}
              id={p.id}
              status={p.status}
              createdAt={p.created_at}
              formato={p.formato || "carrusel"}
              slides={isScript ? [] : parsed}
              beats={isScript ? parsed : []}
              caption={p.caption || ""}
              hashtags={p.hashtags ? JSON.parse(p.hashtags) : []}
              quality={p.quality}
              qualityNotes={p.quality_notes}
            />
          );
        })}
        {!proposals.length && (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
            No hay propuestas todavía. Genera una desde un post ganador en
            «Publicaciones» o desde una idea en «Ideas y nicho».
          </div>
        )}
      </div>
    </div>
  );
}
