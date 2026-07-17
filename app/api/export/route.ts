import { NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql, ClientRow } from "@/lib/db";

export const maxDuration = 60;

const CLIENT_TABLES = [
  "settings",
  "posts",
  "account_snapshots",
  "recommendations",
  "ideas",
  "proposals",
  "campaigns",
  "calendar_items",
  "reports",
  "stories",
  "comments",
] as const;

/** Copia de seguridad completa en JSON: TODOS los clientes del editor + su librería de estructuras. */
export async function GET() {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  try {
    const sql = getSql();

    const clients = await sql<ClientRow[]>`
      SELECT * FROM clients WHERE owner_user_id = ${auth.userId}
      ORDER BY created_at ASC, id ASC
    `;

    const clientDumps = [];
    for (const client of clients) {
      const tables: Record<string, unknown[]> = {};
      for (const table of CLIENT_TABLES) {
        const rows = await sql`
          SELECT * FROM ${sql(table)} WHERE client_id = ${client.id}
        `;
        tables[table] = [...rows];
      }
      clientDumps.push({
        id: client.id,
        nombre: client.nombre,
        color: client.color,
        estado: client.estado,
        tables,
      });
    }

    // Estructuras: las propias del editor + las builtin globales.
    const structures = await sql`
      SELECT * FROM structures WHERE user_id = ${auth.userId} OR user_id IS NULL
    `;

    const payload = JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        clients: clientDumps,
        structures: [...structures],
      },
      null,
      1
    );
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(payload, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="brandpanel-backup-${date}.json"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
