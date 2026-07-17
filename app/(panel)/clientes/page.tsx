import { requireUser } from "@/lib/auth";
import { getSql, ClientRow } from "@/lib/db";
import ClientsManager from "@/components/ClientsManager";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { userId, clientId } = await requireUser();
  const sql = getSql();
  const clients = await sql<(ClientRow & { ig_username: string | null })[]>`
    SELECT c.*,
      (SELECT value FROM settings s WHERE s.client_id = c.id AND s.key = 'ig_username') AS ig_username
    FROM clients c
    WHERE c.owner_user_id = ${userId}
    ORDER BY c.created_at ASC, c.id ASC
  `;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
        Cada cliente tiene su propio Instagram, ficha de marca, ideas,
        propuestas y métricas. Cambia de cliente activo desde aquí o desde el
        selector de la barra lateral.
      </p>

      <div className="mt-6">
        <ClientsManager
          initial={clients.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            color: c.color,
            estado: c.estado,
            igUsername: c.ig_username,
            lastSyncedAt: c.last_synced_at,
          }))}
          activeId={clientId}
        />
      </div>
    </div>
  );
}
