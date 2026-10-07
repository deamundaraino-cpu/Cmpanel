#!/usr/bin/env node
/**
 * Marcas de uso por idea (idempotente): usado_video / usado_carrusel.
 *
 * Permiten ver de un vistazo qué ideas ya se convirtieron en contenido y en
 * qué formato. Se rellenan con las propuestas ya existentes (idea_id + formato).
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/migrate-add-idea-usage.mjs
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

async function main() {
  await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS usado_video BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS usado_carrusel BOOLEAN NOT NULL DEFAULT FALSE`;

  const v = await sql`
    UPDATE ideas SET usado_video = TRUE
    WHERE id IN (SELECT idea_id FROM proposals WHERE idea_id IS NOT NULL AND formato = 'guion_video')
  `;
  const c = await sql`
    UPDATE ideas SET usado_carrusel = TRUE
    WHERE id IN (SELECT idea_id FROM proposals WHERE idea_id IS NOT NULL AND formato = 'carrusel')
  `;
  console.log(`Ideas marcadas con video: ${v.count} · con carrusel: ${c.count}`);
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
