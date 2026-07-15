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
  const g = await guard();
  if (g) return g;
  try {
    const sql = getSql();
    const dump: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      const rows = await sql`SELECT * FROM ${sql(table)}`;
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
