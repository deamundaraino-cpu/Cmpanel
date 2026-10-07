#!/usr/bin/env node
/**
 * Sistema de contenido (idempotente):
 *  - calendar_items: fases de producción (por_grabar, grabado, en_edicion,
 *    revision) + versión corta/larga, pieza gemela, entrega de edición,
 *    sesión de grabación, marca de prueba y post publicado.
 *  - recording_sessions: días de grabación por lotes.
 *  - referentes / referente_piezas: cuentas de referencia cargadas a mano.
 *  - posts.perf_ratio: rendimiento frente a la mediana de la cuenta.
 *  - proposals.origen: 'exprimir' cuando nace de exprimir un ganador.
 *  - hooks.origen: '@handle' cuando el gancho viene de un referente.
 *  - Renombra el estado legado en_diseno → en_edicion.
 *  - Galería de estructuras: structures.pilar + structures.ficha (JSON) y
 *    siembra/actualiza las estructuras base de lib/baseStructures.ts (solo
 *    las globales: las copias de los editores no se tocan).
 *
 * Uso:
 *   DATABASE_URL="postgres://..." npx tsx scripts/migrate-production-system.mjs
 */
import postgres from "postgres";
import { BASE_STRUCTURES } from "../lib/baseStructures.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

async function main() {
  // —— Sesiones de grabación (antes que la FK de calendar_items) ——
  await sql`
    CREATE TABLE IF NOT EXISTS recording_sessions (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      fecha TEXT NOT NULL,
      notas TEXT,
      estado TEXT NOT NULL DEFAULT 'planificada'
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_recording_sessions_client ON recording_sessions (client_id, fecha)`;
  await sql`ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY`;

  // —— calendar_items ——
  await sql`ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS version TEXT`;
  await sql`ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS parent_item_id BIGINT REFERENCES calendar_items(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS fecha_entrega TEXT`;
  await sql`ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS brief_edicion TEXT`;
  await sql`ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS entrega_url TEXT`;
  await sql`ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES recording_sessions(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS es_prueba BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS post_id TEXT`;
  const renamed = await sql`UPDATE calendar_items SET estado = 'en_edicion' WHERE estado = 'en_diseno'`;
  console.log(`Piezas en_diseno → en_edicion: ${renamed.count}`);

  // —— Referentes ——
  await sql`
    CREATE TABLE IF NOT EXISTS referentes (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      handle TEXT NOT NULL,
      nombre TEXT,
      notas TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS referente_piezas (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      referente_id BIGINT NOT NULL REFERENCES referentes(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      url TEXT,
      formato TEXT,
      texto TEXT NOT NULL,
      vistas INTEGER,
      likes INTEGER,
      comentarios INTEGER,
      analisis TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_referentes_client ON referentes (client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_referente_piezas_ref ON referente_piezas (client_id, referente_id)`;
  await sql`ALTER TABLE referentes ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE referente_piezas ENABLE ROW LEVEL SECURITY`;

  // —— Testeo / exprimir ——
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS perf_ratio DOUBLE PRECISION`;
  await sql`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS origen TEXT`;
  // Ganchos guardados a mano desde un referente (no son ganadores propios).
  await sql`ALTER TABLE hooks ADD COLUMN IF NOT EXISTS origen TEXT`;

  // —— Galería de estructuras por pilar ——
  await sql`ALTER TABLE structures ADD COLUMN IF NOT EXISTS pilar TEXT`;
  await sql`ALTER TABLE structures ADD COLUMN IF NOT EXISTS ficha TEXT`;
  let creadas = 0;
  let fichas = 0;
  for (const base of BASE_STRUCTURES) {
    const ficha = JSON.stringify(base.ficha);
    const filas = await sql`
      SELECT id, pilar, ficha FROM structures
      WHERE user_id IS NULL AND client_id IS NULL AND nombre = ${base.nombre}
    `;
    if (!filas.length) {
      await sql`
        INSERT INTO structures (created_at, user_id, nombre, descripcion, beats, is_builtin, pilar, ficha)
        VALUES (${new Date().toISOString()}, NULL, ${base.nombre}, ${base.descripcion}, ${JSON.stringify(base.beats)}, 1,
          ${base.pilar}, ${ficha})
      `;
      creadas++;
      continue;
    }
    for (const f of filas) {
      if (f.pilar === base.pilar && f.ficha === ficha) continue;
      await sql`UPDATE structures SET pilar = ${base.pilar}, ficha = ${ficha}, descripcion = ${base.descripcion} WHERE id = ${f.id}`;
      fichas++;
    }
  }
  console.log(`Estructuras base: ${creadas} creada(s), ${fichas} ficha(s) actualizada(s)`);

  const cols = await sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE (table_name = 'calendar_items' AND column_name IN ('version','parent_item_id','fecha_entrega','brief_edicion','entrega_url','session_id','es_prueba','post_id'))
       OR (table_name = 'posts' AND column_name = 'perf_ratio')
       OR (table_name IN ('proposals', 'hooks') AND column_name = 'origen')
  `;
  console.log("Columnas nuevas:", cols.map((c) => `${c.table_name}.${c.column_name}`).join(", "));
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
