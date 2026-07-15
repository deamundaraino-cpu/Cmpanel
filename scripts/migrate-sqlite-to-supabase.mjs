// Migración única: data/app.db (SQLite) → Supabase Postgres.
// Uso: DATABASE_URL="postgres://..." node scripts/migrate-sqlite-to-supabase.mjs
// Idempotente: se puede re-ejecutar; usa ON CONFLICT en todas las inserciones.

import Database from "better-sqlite3";
import postgres from "postgres";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (usa la URI del Transaction Pooler de Supabase, puerto 6543).");
  process.exit(1);
}

const sqlite = new Database(path.join(__dirname, "..", "data", "app.db"), { readonly: true });
const sql = postgres(url, { ssl: "require", max: 1, prepare: false });

function rows(table) {
  try {
    return sqlite.prepare(`SELECT * FROM ${table}`).all();
  } catch {
    return [];
  }
}

async function count(table) {
  const [r] = await sql`SELECT COUNT(*)::int AS n FROM ${sql(table)}`;
  return r.n;
}

console.log("1/4 Aplicando esquema…");
await sql.file(path.join(__dirname, "schema.sql"));

console.log("2/4 Migrando datos…");

// Tablas con PK natural (TEXT): upsert completo.
for (const table of ["settings", "posts", "account_snapshots", "stories"]) {
  const data = rows(table);
  for (const row of data) {
    const cols = Object.keys(row);
    const pk = table === "settings" ? "key" : table === "account_snapshots" ? "date" : "id";
    const updates = cols.filter((c) => c !== pk);
    await sql`
      INSERT INTO ${sql(table)} ${sql(row, cols)}
      ON CONFLICT (${sql(pk)}) DO UPDATE SET ${sql(
        Object.fromEntries(updates.map((c) => [c, row[c]])),
        updates
      )}
    `;
  }
  console.log(`  ${table}: ${data.length} filas`);
}

// Tablas con id autonumérico: preservar ids (OVERRIDING SYSTEM VALUE) y ajustar la secuencia.
for (const table of ["recommendations", "ideas", "proposals", "campaigns", "calendar_items", "reports"]) {
  const data = rows(table);
  for (const row of data) {
    const cols = Object.keys(row);
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const values = cols.map((c) => row[c]);
    await sql.unsafe(
      `INSERT INTO ${table} (${colList}) OVERRIDING SYSTEM VALUE VALUES (${cols
        .map((_, i) => `$${i + 1}`)
        .join(", ")}) ON CONFLICT (id) DO NOTHING`,
      values
    );
  }
  if (data.length) {
    await sql.unsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`
    );
  }
  console.log(`  ${table}: ${data.length} filas`);
}

// Estructuras: las builtin ya vienen del seed del schema (por nombre único);
// solo se migran las creadas por el usuario, con id nuevo.
const userStructures = rows("structures").filter((s) => !s.is_builtin);
for (const s of userStructures) {
  await sql`
    INSERT INTO structures (created_at, nombre, descripcion, beats, is_builtin)
    VALUES (${s.created_at}, ${s.nombre}, ${s.descripcion}, ${s.beats}, 0)
    ON CONFLICT (nombre) DO NOTHING
  `;
}
console.log(`  structures (usuario): ${userStructures.length} filas`);

console.log("3/4 Verificando conteos…");
const checks = [
  "settings",
  "posts",
  "account_snapshots",
  "stories",
  "recommendations",
  "ideas",
  "proposals",
  "campaigns",
  "calendar_items",
  "reports",
  "structures",
];
let ok = true;
for (const table of checks) {
  const local = rows(table).length;
  const remote = await count(table);
  const flag = remote >= local ? "✓" : "✗";
  if (remote < local && table !== "structures") ok = false;
  console.log(`  ${flag} ${table}: sqlite=${local} → supabase=${remote}`);
}

console.log("4/4 " + (ok ? "Migración completada ✓" : "ATENCIÓN: hay tablas con menos filas de las esperadas"));
await sql.end();
sqlite.close();
process.exit(ok ? 0 : 1);
