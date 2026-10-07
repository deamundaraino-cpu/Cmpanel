#!/usr/bin/env node
/**
 * Búsqueda de ideas v2 (idempotente):
 *  - tesis: la afirmación concreta y discutible de la idea (no solo el tema).
 *  - ganchos: JSON string[] con 2-3 aperturas posibles.
 *  - etapa: consciencia | consideracion | decision (etapa del cliente ideal).
 *  - descartada: "No me sirve" — se oculta y se le pasa a la IA como "esto no".
 *  - parent_id: variante nacida de otra idea ("Más como esta").
 * Columnas nullable / con default: las ideas viejas siguen funcionando.
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/migrate-idea-search.mjs
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

async function main() {
  await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS tesis TEXT`;
  await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS ganchos TEXT`;
  await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS etapa TEXT`;
  await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS descartada BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES ideas(id) ON DELETE SET NULL`;

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'ideas' AND column_name IN ('tesis', 'ganchos', 'etapa', 'descartada', 'parent_id')
  `;
  console.log("Columnas en ideas:", cols.map((c) => c.column_name).join(", "));
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
