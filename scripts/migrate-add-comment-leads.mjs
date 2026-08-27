#!/usr/bin/env node
/**
 * Comentarios accionables (idempotente).
 *
 * Hasta ahora los comentarios solo servían de materia prima para generar ideas:
 * no se guardaba QUIÉN comentaba, así que era imposible distinguir a un
 * desconocido de alguien que lleva meses siguiéndote.
 *
 * Añade (aditivo, no toca filas existentes):
 *   comments.username  TEXT     -- autor (requiere scope instagram_business_manage_comments)
 *   comments.is_lead   INTEGER  -- marcado a mano como posible lead
 *   comments.nota      TEXT     -- nota corta del gestor
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/migrate-add-comment-leads.mjs
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

async function main() {
  const [before] = await sql`SELECT COUNT(*)::int AS n FROM comments`;
  console.log("Comentarios ANTES:", before.n);

  await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS username TEXT`;
  console.log("✓ comments.username");

  await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_lead INTEGER DEFAULT 0`;
  console.log("✓ comments.is_lead");

  await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS nota TEXT`;
  console.log("✓ comments.nota");

  const [after] = await sql`SELECT COUNT(*)::int AS n FROM comments`;
  console.log("Comentarios DESPUÉS:", after.n);
  if (after.n !== before.n) {
    console.error("❌ Cambió el número de comentarios.");
    process.exitCode = 1;
  } else {
    console.log("✓ Ninguna fila perdida.");
  }

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name IN ('username', 'is_lead', 'nota')
    ORDER BY column_name
  `;
  console.log("Columnas verificadas:", cols.map((c) => c.column_name).join(", "));
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
