#!/usr/bin/env node
/**
 * Migración multi-tenant por usuario → multi-cliente (idempotente).
 *
 * Convierte la tenancy de contenido de user_id (UUID) a client_id (BIGINT):
 * crea 1 cliente por cada usuario existente, reasigna todas sus filas y
 * elimina la columna user_id de las tablas de contenido.
 * structures y ai_usage se quedan en user_id (librería/cuota del editor).
 *
 * Uso:
 *   DATABASE_URL="postgres://..." node scripts/migrate-clients.mjs
 *
 * ⚠️ Ejecutar SOLO tras validar en local y con backup reciente
 *    (Ajustes → Descargar copia de seguridad, o dump de Supabase).
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

// Tablas de contenido que pasan de user_id a client_id.
// pk = PK compuesta deseada (null = la PK actual con id propio se queda).
const TABLES = [
  { name: "settings", pk: ["client_id", "key"] },
  { name: "posts", pk: ["client_id", "id"] },
  { name: "stories", pk: ["client_id", "id"] },
  { name: "comments", pk: ["client_id", "id"] },
  { name: "account_snapshots", pk: ["client_id", "date"] },
  { name: "recommendations", pk: null },
  { name: "ideas", pk: null },
  { name: "proposals", pk: null },
  { name: "campaigns", pk: null },
  { name: "calendar_items", pk: null },
  { name: "reports", pk: null },
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

async function hasColumn(table, column) {
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
  `;
  return rows.length > 0;
}

try {
  console.log("1/7 Creando tabla clients…");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS clients (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT now()::text,
      nombre TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3987e5',
      estado TEXT NOT NULL DEFAULT 'activo',
      last_synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients (owner_user_id);
    ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
  `);

  console.log("2/7 Creando 1 cliente por usuario existente…");
  // Nombre del cliente: brand_name → ig_username → "Mi primer cliente".
  // Solo para usuarios que aún no tienen ningún cliente (idempotencia).
  const settingsHasUserId = await hasColumn("settings", "user_id");
  if (settingsHasUserId) {
    await sql.unsafe(`
      INSERT INTO clients (owner_user_id, created_at, nombre)
      SELECT u.id, now()::text, COALESCE(
        NULLIF((SELECT value FROM settings s WHERE s.user_id = u.id AND s.key = 'brand_name'), ''),
        NULLIF((SELECT value FROM settings s WHERE s.user_id = u.id AND s.key = 'ig_username'), ''),
        'Mi primer cliente'
      )
      FROM users u
      WHERE NOT EXISTS (SELECT 1 FROM clients c WHERE c.owner_user_id = u.id)
    `);
  } else {
    await sql.unsafe(`
      INSERT INTO clients (owner_user_id, created_at, nombre)
      SELECT u.id, now()::text, 'Mi primer cliente'
      FROM users u
      WHERE NOT EXISTS (SELECT 1 FROM clients c WHERE c.owner_user_id = u.id)
    `);
  }
  const [{ n: clientCount }] = await sql`SELECT count(*)::int AS n FROM clients`;
  console.log(`   clientes totales: ${clientCount}`);

  console.log("3/7 Migrando tablas de contenido user_id → client_id…");
  for (const { name, pk } of TABLES) {
    await sql.unsafe(`ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS client_id BIGINT`);

    if (await hasColumn(name, "user_id")) {
      // Backfill: cada fila pasa al cliente más antiguo de su dueño
      // (los usuarios migrados tienen exactamente 1 cliente).
      const updated = await sql.unsafe(`
        UPDATE ${name} t SET client_id = (
          SELECT c.id FROM clients c
          WHERE c.owner_user_id = t.user_id
          ORDER BY c.created_at ASC, c.id ASC LIMIT 1
        )
        WHERE t.client_id IS NULL AND t.user_id IS NOT NULL
      `);
      console.log(`   ${name}: ${updated.count} filas reasignadas`);
    }

    await sql.unsafe(`ALTER TABLE ${name} ALTER COLUMN client_id SET NOT NULL`);

    const fkName = `${name}_client_id_fkey`;
    if (!(await hasConstraint(name, fkName))) {
      await sql.unsafe(
        `ALTER TABLE ${name} ADD CONSTRAINT ${fkName}
         FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE`
      );
    }
    if (pk) {
      const current = await pkColumns(name);
      if (current.join(",") !== pk.join(",")) {
        await sql.unsafe(`ALTER TABLE ${name} DROP CONSTRAINT ${name}_pkey`);
        await sql.unsafe(`ALTER TABLE ${name} ADD PRIMARY KEY (${pk.join(", ")})`);
      }
    }
    // La columna vieja sobra: el dueño se resuelve vía clients.owner_user_id.
    await sql.unsafe(`ALTER TABLE ${name} DROP COLUMN IF EXISTS user_id`);
  }

  console.log("4/7 last_synced_at: users → clients…");
  if (await hasColumn("users", "last_synced_at")) {
    await sql.unsafe(`
      UPDATE clients c SET last_synced_at = u.last_synced_at
      FROM users u
      WHERE u.id = c.owner_user_id AND c.last_synced_at IS NULL
        AND u.last_synced_at IS NOT NULL
    `);
    await sql.unsafe(`ALTER TABLE users DROP COLUMN last_synced_at`);
  }

  console.log("5/7 proposals: share_token + client_feedback…");
  await sql.unsafe(`
    ALTER TABLE proposals ADD COLUMN IF NOT EXISTS share_token TEXT;
    ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_feedback TEXT;
  `);
  if (!(await hasConstraint("proposals", "proposals_share_token_key"))) {
    await sql.unsafe(
      `ALTER TABLE proposals ADD CONSTRAINT proposals_share_token_key UNIQUE (share_token)`
    );
  }

  console.log("6/7 Índices nuevos…");
  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_posts_client_ts ON posts (client_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_stories_client_ts ON stories (client_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_comments_client_post ON comments (client_id, post_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_client_fecha ON calendar_items (client_id, fecha);
    CREATE INDEX IF NOT EXISTS idx_ideas_client ON ideas (client_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_client_status ON proposals (client_id, status);
    CREATE INDEX IF NOT EXISTS idx_campaigns_client ON campaigns (client_id);
    CREATE INDEX IF NOT EXISTS idx_reports_client ON reports (client_id);
    CREATE INDEX IF NOT EXISTS idx_recommendations_client ON recommendations (client_id);
    DROP INDEX IF EXISTS idx_posts_user_ts;
    DROP INDEX IF EXISTS idx_stories_user_ts;
    DROP INDEX IF EXISTS idx_comments_user_post;
    DROP INDEX IF EXISTS idx_calendar_user_fecha;
    DROP INDEX IF EXISTS idx_ideas_user;
    DROP INDEX IF EXISTS idx_proposals_user_status;
    DROP INDEX IF EXISTS idx_campaigns_user;
    DROP INDEX IF EXISTS idx_reports_user;
    DROP INDEX IF EXISTS idx_recommendations_user;
  `);

  console.log("7/7 Verificando…");
  let ok = true;
  for (const { name } of TABLES) {
    const [{ total, sin }] = await sql.unsafe(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE client_id IS NULL)::int AS sin
       FROM ${name}`
    );
    const mark = sin === 0 ? "✓" : "✗";
    if (sin > 0) ok = false;
    console.log(`   ${mark} ${name}: ${total} filas, ${sin} sin cliente`);
  }
  const [{ huerfanos }] = await sql`
    SELECT count(*)::int AS huerfanos FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM clients c WHERE c.owner_user_id = u.id)
  `;
  console.log(`   ${huerfanos === 0 ? "✓" : "✗"} usuarios sin cliente: ${huerfanos}`);
  if (huerfanos > 0) ok = false;

  if (!ok) {
    console.error("\n✗ Quedaron filas sin cliente. Revisa antes de usar la app.");
    process.exit(1);
  }
  console.log("\nMigración multi-cliente completada ✓");
} finally {
  await sql.end();
}
