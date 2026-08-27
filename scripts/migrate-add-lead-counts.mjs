#!/usr/bin/env node
/**
 * Registro semanal de leads captados (idempotente).
 *
 * Todo el pilar de "conversión" generaba texto de CTA, pero nada conectaba el
 * contenido con resultado de negocio: los informes hablaban solo de alcance y
 * engagement. Esta tabla es el dato mínimo para que el informe pueda comparar
 * tendencia de leads contra tendencia de alcance.
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/migrate-add-lead-counts.mjs
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS lead_counts (
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      week_start TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (client_id, week_start)
    )
  `;
  console.log("✓ tabla lead_counts");

  await sql`ALTER TABLE lead_counts ENABLE ROW LEVEL SECURITY`;
  console.log("✓ RLS activada");

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'lead_counts' ORDER BY ordinal_position
  `;
  console.log("Columnas:", cols.map((c) => c.column_name).join(", "));
  if (cols.length !== 4) {
    console.error("❌ Se esperaban 4 columnas.");
    process.exitCode = 1;
  }

  await sql.end();
}

main().catch(async (e) => {
  console.error("Error en la migración:", e);
  await sql.end();
  process.exit(1);
});
