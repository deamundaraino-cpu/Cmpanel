#!/usr/bin/env node
/**
 * Conector MCP (idempotente): tabla mcp_tokens con los tokens personales que
 * usa Claude para leer y escribir en la plataforma. Solo se guarda el hash.
 * RLS activada sin políticas (bloquea PostgREST, igual que el resto).
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/migrate-mcp-tokens.mjs
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
    CREATE TABLE IF NOT EXISTS mcp_tokens (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      nombre TEXT,
      prefijo TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT
    )
  `;
  await sql`ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY`;
  await sql`CREATE INDEX IF NOT EXISTS mcp_tokens_user_idx ON mcp_tokens (user_id)`;
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM mcp_tokens`;
  console.log(`mcp_tokens lista (${n} tokens).`);
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
