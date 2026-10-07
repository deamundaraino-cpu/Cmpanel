#!/usr/bin/env node
/**
 * Estructuras base: de molde a intención (idempotente).
 *
 * Las guías de las estructuras base dictaban frases literales —algunas de ellas
 * prohibidas por las propias marcas ("eso no es lo más loco...", "el que nadie
 * dice")—, así que el modelo las copiaba y después el filtro castigaba la pieza.
 * Ahora cada guía declara qué tiene que conseguir el bloque.
 *
 * Solo toca las estructuras base compartidas (user_id IS NULL AND is_builtin),
 * que alcanzan a todas las marcas. Las copias del editor NO se tocan: llevan
 * ajustes hechos a mano. Se listan al final para revisarlas.
 *
 * Uso:
 *   DATABASE_URL="postgres://..." npx tsx scripts/migrate-structure-intents.mjs
 */
import postgres from "postgres";
import { BASE_STRUCTURES } from "../lib/baseStructures.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

/** Frases de ejemplo que las guías nunca deben volver a contener. */
const MULETILLAS = ["eso no es lo más loco", "y curiosamente", "nadie dice", "lo más increíble", "el secreto que"];

async function main() {
  const [{ n: propuestas }] = await sql`SELECT COUNT(*)::int AS n FROM proposals`;
  console.log("Propuestas existentes (no se tocan):", propuestas);

  let actualizadas = 0;
  let creadas = 0;

  for (const base of BASE_STRUCTURES) {
    const beats = JSON.stringify(base.beats);
    const filas = await sql`
      SELECT id, beats FROM structures
      WHERE user_id IS NULL AND is_builtin = 1 AND nombre = ${base.nombre}
    `;

    if (!filas.length) {
      await sql`
        INSERT INTO structures (created_at, user_id, nombre, descripcion, beats, is_builtin)
        VALUES (${new Date().toISOString()}, NULL, ${base.nombre}, ${base.descripcion}, ${beats}, 1)
        ON CONFLICT (user_id, nombre) DO NOTHING
      `;
      creadas++;
      console.log(`  + creada  ${base.nombre}`);
      continue;
    }

    for (const fila of filas) {
      if (fila.beats === beats) {
        console.log(`  = al día  ${base.nombre}`);
        continue;
      }
      const antes = JSON.parse(fila.beats).length;
      await sql`
        UPDATE structures
        SET beats = ${beats}, descripcion = ${base.descripcion}
        WHERE id = ${fila.id}
      `;
      actualizadas++;
      console.log(`  ~ #${fila.id} ${base.nombre}: ${antes} → ${base.beats.length} secciones`);
    }
  }

  console.log(`\nBase: ${actualizadas} actualizada(s), ${creadas} creada(s).`);

  // Las copias del editor se respetan, pero conviene saber cuáles arrastran
  // todavía frases de ejemplo o parches escritos a mano contra ellas.
  const propias = await sql`
    SELECT id, nombre, client_id, beats FROM structures
    WHERE user_id IS NOT NULL
    ORDER BY id
  `;
  const sospechosas = propias.filter((s) => {
    const texto = (s.beats || "").toLowerCase();
    return MULETILLAS.some((m) => texto.includes(m));
  });

  if (sospechosas.length) {
    console.log("\n⚠️  Tus estructuras (no se han tocado) que aún mencionan muletillas:");
    for (const s of sospechosas) {
      console.log(`   #${s.id} "${s.nombre}"${s.client_id ? ` · marca ${s.client_id}` : ""}`);
    }
    console.log("   Revísalas en Configuración → Estructuras: las prohibiciones que escribiste a mano");
    console.log("   ya las cubre el nuevo diseño, y las guías pueden pasar a declarar intención.");
  } else {
    console.log("\nNinguna estructura tuya arrastra muletillas.");
  }
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
