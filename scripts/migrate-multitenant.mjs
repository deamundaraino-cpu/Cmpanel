#!/usr/bin/env node
/**
 * Migración single-tenant → multi-tenant (idempotente, se puede re-ejecutar).
 *
 * Uso:
 *   DATABASE_URL="postgres://..." OWNER_EMAIL="tu@email.com" node scripts/migrate-multitenant.mjs
 *
 * Requisitos: el dueño (OWNER_EMAIL) ya debe estar registrado vía Supabase Auth
 * (la fila existe en auth.users). Todos los datos actuales se asignan a él.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_EMAIL = process.env.OWNER_EMAIL;
if (!DATABASE_URL || !OWNER_EMAIL) {
  console.error("Faltan variables: DATABASE_URL y OWNER_EMAIL son obligatorias.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });
const __dirname = dirname(fileURLToPath(import.meta.url));

// Tablas con user_id NOT NULL. pk = PK compuesta deseada (null = la PK actual se queda).
const TABLES = [
  { name: "settings", pk: ["user_id", "key"] },
  { name: "posts", pk: ["user_id", "id"] },
  { name: "stories", pk: ["user_id", "id"] },
  { name: "comments", pk: ["user_id", "id"] },
  { name: "account_snapshots", pk: ["user_id", "date"] },
  { name: "recommendations", pk: null },
  { name: "ideas", pk: null },
  { name: "proposals", pk: null },
  { name: "campaigns", pk: null },
  { name: "calendar_items", pk: null },
  { name: "reports", pk: null },
];

const RLS_TABLES = [
  "users", "ai_usage", "settings", "posts", "account_snapshots",
  "recommendations", "ideas", "proposals", "structures", "campaigns",
  "calendar_items", "reports", "stories", "comments",
];

async function pkColumns(table) {
  const rows = await sql`
    SELECT a.attname
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = ${table}::regclass AND c.contype = 'p'
    ORDER BY k.ord
  `;
  return rows.map((r) => r.attname);
}

async function hasConstraint(table, name) {
  const rows = await sql`
    SELECT 1 FROM pg_constraint
    WHERE conrelid = ${table}::regclass AND conname = ${name}
  `;
  return rows.length > 0;
}

try {
  console.log("1/7 Creando users + ai_usage + trigger espejo…");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      ai_daily_limit INTEGER,
      last_synced_at TEXT,
      onboarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT now()::text
    );
    CREATE TABLE IF NOT EXISTS ai_usage (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, date, kind)
    );
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      INSERT INTO public.users (id, email)
      VALUES (NEW.id, COALESCE(NEW.email, ''))
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END; $$;
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  `);

  console.log(`2/7 Resolviendo dueño (${OWNER_EMAIL})…`);
  const owners = await sql`
    SELECT id, email FROM auth.users WHERE lower(email) = ${OWNER_EMAIL.toLowerCase()}
  `;
  if (!owners.length) {
    console.error(
      `\n✗ No existe ningún usuario ${OWNER_EMAIL} en auth.users.\n` +
        `  Regístrate primero en la app (/registro) con ese email y vuelve a ejecutar.`
    );
    process.exit(1);
  }
  const ownerId = owners[0].id;
  await sql`
    INSERT INTO users (id, email, role, onboarded)
    VALUES (${ownerId}, ${owners[0].email}, 'admin', 1)
    ON CONFLICT (id) DO UPDATE SET role = 'admin', onboarded = 1
  `;
  console.log(`   dueño: ${ownerId} (admin)`);

  console.log("3/7 Añadiendo user_id y reasignando datos al dueño…");
  for (const { name, pk } of TABLES) {
    await sql.unsafe(`ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS user_id UUID`);
    const updated = await sql.unsafe(
      `UPDATE ${name} SET user_id = '${ownerId}' WHERE user_id IS NULL`
    );
    await sql.unsafe(`ALTER TABLE ${name} ALTER COLUMN user_id SET NOT NULL`);
    const fkName = `${name}_user_id_fkey`;
    if (!(await hasConstraint(name, fkName))) {
      await sql.unsafe(
        `ALTER TABLE ${name} ADD CONSTRAINT ${fkName}
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
      );
    }
    if (pk) {
      const current = await pkColumns(name);
      if (current.join(",") !== pk.join(",")) {
        await sql.unsafe(`ALTER TABLE ${name} DROP CONSTRAINT ${name}_pkey`);
        await sql.unsafe(`ALTER TABLE ${name} ADD PRIMARY KEY (${pk.join(", ")})`);
      }
    }
    console.log(`   ${name}: ${updated.count} filas reasignadas`);
  }

  console.log("4/7 structures: builtins globales + unicidad por usuario…");
  await sql.unsafe(`ALTER TABLE structures ADD COLUMN IF NOT EXISTS user_id UUID`);
  // Las del usuario (no builtin) pasan al dueño; las builtin quedan globales (NULL)
  await sql.unsafe(
    `UPDATE structures SET user_id = '${ownerId}' WHERE user_id IS NULL AND is_builtin = 0`
  );
  if (!(await hasConstraint("structures", "structures_user_id_fkey"))) {
    await sql.unsafe(
      `ALTER TABLE structures ADD CONSTRAINT structures_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
    );
  }
  if (await hasConstraint("structures", "structures_nombre_key")) {
    await sql.unsafe(`ALTER TABLE structures DROP CONSTRAINT structures_nombre_key`);
  }
  if (!(await hasConstraint("structures", "structures_user_nombre_uni"))) {
    await sql.unsafe(
      `ALTER TABLE structures ADD CONSTRAINT structures_user_nombre_uni
       UNIQUE NULLS NOT DISTINCT (user_id, nombre)`
    );
  }

  console.log("5/7 Limpiando settings de IA (pasan a variables de entorno)…");
  const removed = await sql`
    DELETE FROM settings
    WHERE key IN ('llm_provider', 'llm_api_key', 'llm_model', 'llm_base_url', 'tavily_api_key')
  `;
  console.log(`   ${removed.count} filas de settings eliminadas`);

  console.log("6/7 Índices + RLS (deny-all para PostgREST)…");
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_posts_user_ts ON posts (user_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_stories_user_ts ON stories (user_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_comments_user_post ON comments (user_id, post_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_user_fecha ON calendar_items (user_id, fecha);
    CREATE INDEX IF NOT EXISTS idx_ideas_user ON ideas (user_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_user_status ON proposals (user_id, status);
    CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns (user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_user ON reports (user_id);
    CREATE INDEX IF NOT EXISTS idx_recommendations_user ON recommendations (user_id);
    CREATE INDEX IF NOT EXISTS idx_structures_user ON structures (user_id);
  `);
  for (const t of RLS_TABLES) {
    await sql.unsafe(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
  }

  console.log("7/7 Verificando…");
  let ok = true;
  for (const { name } of TABLES) {
    const [{ total, sin }] = await sql.unsafe(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE user_id IS NULL)::int AS sin
       FROM ${name}`
    );
    const mark = sin === 0 ? "✓" : "✗";
    if (sin > 0) ok = false;
    console.log(`   ${mark} ${name}: ${total} filas, ${sin} sin dueño`);
  }
  const [{ builtins }] = await sql`
    SELECT count(*)::int AS builtins FROM structures WHERE user_id IS NULL AND is_builtin = 1
  `;
  console.log(`   ✓ structures builtin globales: ${builtins}`);

  if (!ok) {
    console.error("\n✗ Quedaron filas sin dueño. Revisa antes de usar la app.");
    process.exit(1);
  }
  console.log("\nMigración multi-tenant completada ✓");
} finally {
  await sql.end();
}
