import { NextResponse } from "next/server";
import { guardClient } from "@/lib/api";
import { getSql } from "@/lib/db";
import { extractWinningHooks, type HookRow } from "@/lib/hooks";

export async function GET() {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;

  // Recalcular al vuelo por si hay ganadores nuevos desde el último sync.
  try {
    await extractWinningHooks(auth.clientId);
  } catch {
    // Si falla la extracción seguimos mostrando lo ya archivado.
  }

  const sql = getSql();
  const rows = await sql<HookRow[]>`
    SELECT * FROM hooks WHERE client_id = ${auth.clientId}
    ORDER BY er DESC NULLS LAST, id DESC
  `;
  return NextResponse.json(rows);
}
