import { NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { getSql } from "@/lib/db";

export const maxDuration = 60;

const TABLES = [
  "settings",
  "posts",
  "account_snapshots",
  "recommendations",
  "ideas",
  "proposals",
  "structures",
  "campaigns",
  "calendar_items",
  "reports",
  "stories",
  "comments",
] as const;

/** Copia de seguridad completa en JSON (todas las tablas). */
export async function GET() {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  try {
    const sql = getSql();
    const dump: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      // structures incluye también las builtin globales (user_id NULL)
      const rows =
        table === "structures"
          ? await sql`SELECT * FROM structures
              WHERE user_id = ${auth.userId} OR user_id IS NULL`
          : await sql`SELECT * FROM ${sql(table)} WHERE user_id = ${auth.userId}`;
      dump[table] = [...rows];
    }
    const payload = JSON.stringify(
      { exported_at: new Date().toISOString(), tables: dump },
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
