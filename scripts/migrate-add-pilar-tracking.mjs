#!/usr/bin/env node
/**
 * Trazabilidad de pilares: idea → propuesta → pieza del calendario (idempotente).
 *
 * Hasta ahora `ideas.pilar` moría al generar la propuesta: solo se pasaba el
 * texto del tema al prompt, así que era imposible saber qué mezcla de pilares
 * (crecimiento / adoctrinamiento / conversión) se estaba produciendo de verdad.
 *
 * Añade (todo aditivo, no toca ni borra filas existentes):
 *   proposals.pilar        TEXT
 *   proposals.idea_id      BIGINT REFERENCES ideas(id) ON DELETE SET NULL
 *   calendar_items.pilar   TEXT
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/migrate-add-pilar-tracking.mjs
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

const COUNTED = ["ideas", "proposals", "calendar_items"];

async function counts() {
  const out = {};
  for (const t of COUNTED) {
    const [row] = await sql`SELECT COUNT(*)::int AS n FROM ${sql(t)}`;
    out[t] = row.n;
  }
  return out;
}

async function main() {
  const before = await counts();
  console.log("Filas ANTES:", before);

  await sql`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS pilar TEXT`;
  console.log("✓ proposals.pilar");

  await sql`
    ALTER TABLE proposals ADD COLUMN IF NOT EXISTS idea_id BIGINT
    REFERENCES ideas(id) ON DELETE SET NULL
  `;
  console.log("✓ proposals.idea_id");

  await sql`ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS pilar TEXT`;
  console.log("✓ calendar_items.pilar");

  const after = await counts();
  console.log("Filas DESPUÉS:", after);

  const perdidas = COUNTED.filter((t) => after[t] !== before[t]);
  if (perdidas.length) {
    console.error("❌ CAMBIÓ el número de filas en:", perdidas.join(", "));
    process.exitCode = 1;
  } else {
    console.log("✓ Ninguna fila perdida ni alterada.");
  }

  // Verificación de que las columnas existen realmente.
  const cols = await sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE (table_name = 'proposals' AND column_name IN ('pilar', 'idea_id'))
       OR (table_name = 'calendar_items' AND column_name = 'pilar')
    ORDER BY table_name, column_name
  `;
  console.log(
    "Columnas verificadas:",
    cols.map((c) => `${c.table_name}.${c.column_name}`).join(", ")
  );
  if (cols.length !== 3) {
    console.error("❌ Se esperaban 3 columnas.");
    process.exitCode = 1;
  }

  await sql.end();
}

main().catch(async (e) => {
  console.error("Error en la migración:", e);
  await sql.end();
  process.exit(1);
});
