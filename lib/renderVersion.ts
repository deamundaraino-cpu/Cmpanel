import { createHash } from "crypto";
import { getSql } from "./db";
import { createCache } from "./memoCache";

// Identidad de una imagen renderizada, para que el navegador pueda preguntar
// "¿esto cambió?" en vez de volver a pedirla entera.
//
// Antes las imágenes salían con `no-store`: cada recarga regeneraba cada portada
// y cada regeneración releía las fotos de Postgres. Con ETag, una portada que no
// ha cambiado se resuelve con un 304 sin cuerpo — y, sobre todo, sin tocar las
// fotos, que es de donde salía el egress.
//
// No se usa un max-age a ojo porque una portada depende de dos cosas que cambian
// por separado: el contenido de la pieza y el diseño de la marca. La huella
// cubre las dos, así que nunca se ve una imagen vieja.

/** Huella del estado de la marca: si cambia un color, una foto o el ADN, cambia. */
const HUELLA_TTL_MS = 30 * 1000;
const huellaCache = createCache<string>({ ttlMs: HUELLA_TTL_MS, max: 32 });

export async function brandFingerprint(clientId: number): Promise<string> {
  const key = `fp:${clientId}`;
  const cached = huellaCache.get(key);
  if (cached !== undefined) return cached;

  // md5 se calcula en Postgres: así viajan 32 caracteres por fila en vez de la
  // foto entera. Es justo lo contrario de lo que hacía el código anterior.
  const [row] = await getSql()<{ fp: string | null }[]>`
    SELECT md5(string_agg(key || ':' || md5(value), ',' ORDER BY key)) AS fp
    FROM settings WHERE client_id = ${clientId}
  `;
  const fp = row?.fp || "sin-marca";
  huellaCache.set(key, fp);
  return fp;
}

/** ETag débil a partir de las piezas que determinan la imagen. */
export function etagFor(...parts: (string | number | null | undefined)[]): string {
  const h = createHash("sha1").update(parts.map((p) => String(p ?? "")).join("|")).digest("base64url").slice(0, 27);
  return `W/"${h}"`;
}

/**
 * Respuesta 304 cuando el navegador ya tiene esta versión. Se comprueba ANTES de
 * construir el estilo de marca, que es lo que lee las fotos.
 */
export function notModified(etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: { ETag: etag, "Cache-Control": "private, max-age=0, must-revalidate" },
  });
}

/** ¿El navegador ya tiene esta versión? Tolera la lista que mandan algunos clientes. */
export function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((t) => t.trim() === etag || t.trim() === etag.replace(/^W\//, ""));
}
