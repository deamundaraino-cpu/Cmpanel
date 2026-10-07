#!/usr/bin/env node
/**
 * Familia de gancho por propuesta (idempotente).
 *
 * Sin registrar con qué familia se escribió cada pieza no se puede rotar: el
 * sistema volvería a elegir la misma una y otra vez. Columna nullable y sin
 * relleno retroactivo — las piezas anteriores se escribieron sin familia y
 * cuentan como "ninguna usada".
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/migrate-add-hook-family.mjs
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

async function main() {
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM proposals`;
  console.log("Propuestas existentes (no se tocan):", n);

  await sql`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS hook_family TEXT`;

  const [col] = await sql`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'hook_family'
  `;
  console.log("Columna hook_family:", col ? `${col.column_name} (nullable: ${col.is_nullable})` : "NO CREADA");
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
