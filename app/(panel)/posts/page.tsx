import { getSql, PostRow, CampaignRow } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import CreateProposalControl from "@/components/CreateProposalControl";
import CampaignSelect from "@/components/CampaignSelect";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("es-ES");
const pct = (v: number) => (v * 100).toFixed(1).replace(".", ",") + "%";

function scoreColor(score: number | null) {
  if (score == null) return "bg-zinc-800 text-zinc-400";
  if (score >= 7.5) return "bg-emerald-600/20 text-emerald-300";
  if (score >= 5) return "bg-amber-600/20 text-amber-300";
  return "bg-red-600/15 text-red-300";
}

export default async function PostsPage() {
  const { userId } = await requireUser();
  const sql = getSql();
  const posts = await sql<PostRow[]>`
    SELECT * FROM posts WHERE user_id = ${userId} ORDER BY timestamp DESC
  `;
  const campaignRows = await sql<CampaignRow[]>`
    SELECT * FROM campaigns
    WHERE user_id = ${userId} AND estado = 'activa' ORDER BY created_at DESC
  `;
  const campaigns = campaignRows.map((c) => ({ id: c.id, nombre: c.nombre }));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">Publicaciones</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Cada post calificado del 1 al 10 frente a tu propia media. ⭐ = ganador
        (engagement ≥ 1,5x tu mediana): puedes recrearlo como carrusel o
        convertirlo en guion de video.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs text-zinc-500">
              <th className="px-3 py-2.5 font-medium">Nota</th>
              <th className="px-3 py-2.5 font-medium">Post</th>
              <th className="px-3 py-2.5 font-medium">Formato</th>
              <th className="px-3 py-2.5 text-right font-medium">Alcance</th>
              <th className="px-3 py-2.5 text-right font-medium">Likes</th>
              <th className="px-3 py-2.5 text-right font-medium">Coment.</th>
              <th className="px-3 py-2.5 text-right font-medium">Guardados</th>
              <th className="px-3 py-2.5 text-right font-medium">Compart.</th>
              <th className="px-3 py-2.5 text-right font-medium">ER</th>
              <th className="px-3 py-2.5 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {posts.map((p) => (
              <tr key={p.id} className="bg-zinc-950/40 hover:bg-zinc-900/60">
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${scoreColor(p.score)}`}
                  >
                    {p.score?.toFixed(1) ?? "—"}
                  </span>
                </td>
                <td className="max-w-[280px] px-3 py-2.5">
                  <p className="truncate text-zinc-200">
                    {p.is_winner ? "⭐ " : ""}
                    {p.permalink ? (
                      <a
                        href={p.permalink}
                        target="_blank"
                        className="hover:text-indigo-300 hover:underline"
                      >
                        {p.caption || "(sin caption)"}
                      </a>
                    ) : (
                      p.caption || "(sin caption)"
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {p.timestamp ? new Date(p.timestamp).toLocaleDateString("es-ES") : ""}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-400">
                  {p.media_product_type === "REELS" ? "Reel" : p.media_type === "CAROUSEL_ALBUM" ? "Carrusel" : "Imagen"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{nf.format(p.reach)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{nf.format(p.like_count)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{nf.format(p.comments_count)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{nf.format(p.saved)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{nf.format(p.shares)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{pct(p.er)}</td>
                <td className="px-3 py-2.5">
                  <div className="grid gap-1.5">
                    <CreateProposalControl postId={p.id} label="Recrear" />
                    <CampaignSelect postId={p.id} current={p.campaign_id} campaigns={campaigns} />
                  </div>
                </td>
              </tr>
            ))}
            {!posts.length && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-zinc-500">
                  No hay publicaciones todavía. Sincroniza desde el Dashboard.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
