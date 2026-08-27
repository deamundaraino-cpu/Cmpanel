#!/usr/bin/env node
/**
 * Banco de ganchos ganadores (idempotente).
 *
 * Cuando un post resulta ganador y salió de una propuesta aprobada, su gancho
 * es un activo reutilizable — hasta ahora ese aprendizaje se perdía.
 *
 * Crea la tabla `hooks`. Es POR CLIENTE (no por editor como `structures`):
 * un gancho pertenece a la voz de esa marca, no se recicla entre clientes.
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/migrate-add-hooks.mjs
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

async function main() {
  const [before] = await sql`SELECT COUNT(*)::int AS n FROM proposals`;
  console.log("Propuestas existentes (no se tocan):", before.n);

  await sql`
    CREATE TABLE IF NOT EXISTS hooks (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      texto TEXT NOT NULL,
      formato TEXT,
      source_post_id TEXT,
      source_proposal_id BIGINT,
      er DOUBLE PRECISION,
      CONSTRAINT hooks_client_proposal_uni UNIQUE (client_id, source_proposal_id)
    )
  `;
  console.log("✓ tabla hooks");

  await sql`CREATE INDEX IF NOT EXISTS idx_hooks_client ON hooks (client_id)`;
  console.log("✓ índice idx_hooks_client");

  await sql`ALTER TABLE hooks ENABLE ROW LEVEL SECURITY`;
  console.log("✓ RLS activada (sin políticas: bloquea PostgREST, la app entra por el pooler)");

  const [after] = await sql`SELECT COUNT(*)::int AS n FROM proposals`;
  if (after.n !== before.n) {
    console.error("❌ Cambió el número de propuestas.");
    process.exitCode = 1;
  } else {
    console.log("✓ Propuestas intactas:", after.n);
  }

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'hooks' ORDER BY ordinal_position
  `;
  console.log("Columnas de hooks:", cols.map((c) => c.column_name).join(", "));

  await sql.end();
}

main().catch(async (e) => {
  console.error("Error en la migración:", e);
  await sql.end();
  process.exit(1);
});
