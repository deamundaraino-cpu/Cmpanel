#!/usr/bin/env node
/**
 * Limpia los recortes de fondo ya guardados (idempotente).
 *
 * MODNet deja la parte baja de la figura rota cuando hay ropa oscura sobre
 * fondo oscuro: manchas sueltas, restos del decorado y huecos, que se ven en
 * las portadas de fondo claro. lib/cutoutCleanup.ts quita las islas y, si
 * detecta zona rota, funde la base de la figura. Los recortes sanos solo
 * pierden las islas.
 *
 * Antes de escribir guarda los originales en data/backup-cutouts-<fecha>.json.
 * Marca cada recorte con `limpio: <versión>`: volver a ejecutarlo no hace nada.
 *
 * Uso:
 *   DATABASE_URL="postgres://..." npx tsx scripts/migrate-clean-cutouts.mjs
 */
import postgres from "postgres";
import { mkdirSync, writeFileSync } from "node:fs";
import { cleanCutout, CUTOUT_CLEAN_VERSION } from "../lib/cutoutCleanup.ts";
import { compressCutout } from "../lib/imageCompress.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Falta la variable DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1, prepare: false });

async function main() {
  const filas = await sql`
    SELECT client_id, key, value FROM settings WHERE key LIKE 'brand_cutout_%' ORDER BY client_id, key
  `;
  const pendientes = filas.filter((f) => {
    try {
      return (JSON.parse(f.value).limpio ?? 0) < CUTOUT_CLEAN_VERSION;
    } catch {
      return false;
    }
  });
  console.log(`Recortes: ${filas.length} · pendientes de limpiar: ${pendientes.length}`);
  if (!pendientes.length) return;

  mkdirSync("data", { recursive: true });
  const backup = `data/backup-cutouts-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(backup, JSON.stringify(pendientes));
  console.log(`Copia de los originales: ${backup}\n`);

  for (const f of pendientes) {
    const original = JSON.parse(f.value);
    const limpio = await cleanCutout(original.src);
    if (!limpio) {
      console.log(`  ! ${f.client_id}/${f.key}: no se pudo limpiar, se deja igual`);
      continue;
    }
    const comprimido = await compressCutout(limpio.dataUrl);
    const nuevo = {
      src: comprimido?.dataUrl ?? limpio.dataUrl,
      w: comprimido?.width ?? limpio.width,
      h: comprimido?.height ?? limpio.height,
      limpio: CUTOUT_CLEAN_VERSION,
    };
    await sql`UPDATE settings SET value = ${JSON.stringify(nuevo)} WHERE client_id = ${f.client_id} AND key = ${f.key}`;
    const { islasBorradas, inicioFundido, altoFigura } = limpio.stats;
    const fundido = inicioFundido < altoFigura ? `fundido desde el ${Math.round((100 * inicioFundido) / altoFigura)} %` : "sin fundido";
    console.log(`  ✓ ${f.client_id}/${f.key}: ${islasBorradas} isla(s), ${fundido}`);
  }
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
