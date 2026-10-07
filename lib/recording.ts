import { getSql } from "./db";

/**
 * Mete piezas de vídeo en una sesión de grabación. Solo piezas del cliente que
 * aún no se han grabado; sus gemelas (versión corta/larga) entran con ellas,
 * porque se graban en la misma toma.
 */
export async function assignToSession(clientId: number, sessionId: number, itemIds: unknown[]): Promise<number> {
  const ids = itemIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return 0;
  const sql = getSql();
  const res = await sql`
    UPDATE calendar_items SET session_id = ${sessionId}
    WHERE client_id = ${clientId} AND estado IN ('idea', 'por_grabar')
      AND formato IN ('guion_video', 'reel', 'video')
      AND (id IN ${sql(ids)} OR parent_item_id IN ${sql(ids)})
  `;
  return res.count;
}

/** Marca una pieza (y su gemela) como grabada. */
export async function markRecorded(clientId: number, itemId: number): Promise<number> {
  const sql = getSql();
  const [item] = await sql<{ id: number; parent_item_id: number | null }[]>`
    SELECT id, parent_item_id FROM calendar_items WHERE client_id = ${clientId} AND id = ${itemId}
  `;
  if (!item) return 0;
  const root = item.parent_item_id ?? item.id;
  const res = await sql`
    UPDATE calendar_items SET estado = 'grabado'
    WHERE client_id = ${clientId} AND estado IN ('idea', 'por_grabar')
      AND (id = ${root} OR parent_item_id = ${root})
  `;
  return res.count;
}
