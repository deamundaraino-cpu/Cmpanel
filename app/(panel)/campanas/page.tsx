import { getSql, CampaignRow } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import CampaignsManager from "@/components/CampaignsManager";

export const dynamic = "force-dynamic";

type CampaignRollup = CampaignRow & {
  posts_count: number;
  total_reach: number;
  avg_er: number;
};

export default async function CampaignsPage() {
  const { clientId } = await requireClient();
  const sql = getSql();
  const campaigns = (await sql`
    SELECT c.*, COUNT(p.id)::int AS posts_count, COALESCE(SUM(p.reach), 0)::int AS total_reach,
      COALESCE(AVG(p.er), 0)::float AS avg_er
    FROM campaigns c
    LEFT JOIN posts p ON p.client_id = c.client_id AND p.campaign_id = c.id
    WHERE c.client_id = ${clientId}
    GROUP BY c.id ORDER BY c.created_at DESC
  `) as unknown as CampaignRollup[];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Campañas</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Agrupa tus publicaciones por campaña para medir qué iniciativas
        funcionan. Asigna posts a una campaña desde «Publicaciones».
      </p>

      <div className="mt-6">
        <CampaignsManager initial={campaigns} />
      </div>
    </div>
  );
}
