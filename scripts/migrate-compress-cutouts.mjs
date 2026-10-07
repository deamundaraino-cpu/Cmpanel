#!/usr/bin/env node
/**
 * Recomprime los recortes ya guardados (idempotente).
 *
 * Llegaron como PNG sin optimizar desde canvas.toDataURL: hasta 2,4 MB cada uno,
 * releídos de Postgres en cada render de portada. Se reescalan al ancho real del
 * lienzo (1080) y se vuelven a codificar. Se mantiene PNG porque el renderizador
 * de portadas no acepta WebP y el recorte necesita transparencia.
 *
 * Solo escribe si el resultado pesa menos, así que volver a ejecutarlo no hace nada.
 *
 * Uso:
 *   DATABASE_URL="postgres://..." npx tsx scripts/migrate-compress-cutouts.mjs
 */
import postgres from "postgres";
import { compressCutout } from "../lib/imageCompress.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function main() {
  const filas = await sql`
    SELECT client_id, key, value, octet_length(value) AS bytes FROM settings
    WHERE key LIKE 'brand_cutout_%'
    ORDER BY bytes DESC
  `;
  console.log(`Recortes encontrados: ${filas.length}\n`);

  let antes = 0;
  let despues = 0;
  let tocados = 0;

  for (const fila of filas) {
    antes += Number(fila.bytes);
    let cutout;
    try {
      cutout = JSON.parse(fila.value);
    } catch {
      console.log(`  ! ${fila.key}: no es JSON válido, se deja intacto`);
      despues += Number(fila.bytes);
      continue;
    }

    const out = await compressCutout(cutout?.src || "");
    if (!out) {
      console.log(`  = ${fila.key.padEnd(26)} ya está optimizado (${kb(Number(fila.bytes))})`);
      despues += Number(fila.bytes);
      continue;
    }

    const nuevo = JSON.stringify({ ...cutout, src: out.dataUrl, w: out.width, h: out.height });
    await sql`
      UPDATE settings SET value = ${nuevo}
      WHERE client_id = ${fila.client_id} AND key = ${fila.key}
    `;
    tocados++;
    despues += Buffer.byteLength(nuevo);
    console.log(`  ~ ${fila.key.padEnd(26)} ${kb(Number(fila.bytes))} → ${kb(Buffer.byteLength(nuevo))}  (${(Number(fila.bytes) / Buffer.byteLength(nuevo)).toFixed(1)}x)`);
  }

  console.log(`\n${tocados} recorte(s) recomprimido(s).`);
  console.log(`Total: ${(antes / 1048576).toFixed(2)} MB → ${(despues / 1048576).toFixed(2)} MB`);
  if (despues < antes) console.log(`Ahorro: ${(100 - (despues / antes) * 100).toFixed(0)}% en cada lectura de foto.`);
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
