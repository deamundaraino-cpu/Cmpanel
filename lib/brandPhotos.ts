import { getSql } from "./db";
import { getSettings, setSetting } from "./settings";
import type { BrandPhoto, Cutout } from "./slide";

// Cada foto vive en su propia fila de `settings` (brand_photo_<id> y
// brand_cutout_<id>): juntas superan el límite de 4,5 MB por petición/respuesta
// de Vercel. `brand_photo_ids` guarda el orden. Los listados solo devuelven
// metadatos; las imágenes se cargan de una en una.

export const MAX_PHOTOS = 8;
export const MAX_PHOTO_CHARS = 900_000;
export const MAX_CUTOUT_CHARS = 3_500_000;

export type PhotoFlags = { cover: boolean; avatar: boolean };
export type PhotoMeta = { id: string; hasCutout: boolean } & PhotoFlags;

function parseIds(raw: string | null): string[] {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parseFlags(raw: string | null): Record<string, Partial<PhotoFlags>> {
  try {
    const f = JSON.parse(raw || "{}");
    return f && typeof f === "object" ? f : {};
  } catch {
    return {};
  }
}

function parseCutout(raw: string | null): Cutout | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    return typeof c?.src === "string" && c.w > 0 && c.h > 0 ? { src: c.src, w: c.w, h: c.h } : null;
  } catch {
    return null;
  }
}

function hashString(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Pasa las fotos del formato antiguo (array JSON en brand_photos) a filas propias. */
async function migrateLegacy(clientId: number): Promise<string[]> {
  const { brand_photos } = await getSettings(clientId, ["brand_photos"]);
  if (!brand_photos) return [];
  let legacy: string[] = [];
  try {
    const arr = JSON.parse(brand_photos);
    legacy = Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    legacy = [];
  }
  // Ids fijos: varias miniaturas se renderizan en paralelo y todas pueden migrar a la vez.
  const ids: string[] = [];
  for (const [i, src] of legacy.slice(0, MAX_PHOTOS).entries()) {
    const id = `legacy${i}`;
    await setSetting(clientId, `brand_photo_${id}`, src);
    ids.push(id);
  }
  await setSetting(clientId, "brand_photo_ids", JSON.stringify(ids));
  const sql = getSql();
  await sql`DELETE FROM settings WHERE client_id = ${clientId} AND key = 'brand_photos'`;
  return ids;
}

export async function listPhotoMeta(clientId: number): Promise<PhotoMeta[]> {
  const { brand_photo_ids, brand_photo_flags } = await getSettings(clientId, ["brand_photo_ids", "brand_photo_flags"]);
  const ids = brand_photo_ids === null ? await migrateLegacy(clientId) : parseIds(brand_photo_ids);
  if (!ids.length) return [];
  const flags = parseFlags(brand_photo_flags);
  const sql = getSql();
  const rows = await sql<{ key: string }[]>`
    SELECT key FROM settings
    WHERE client_id = ${clientId}
      AND key = ANY(${ids.flatMap((id) => [`brand_photo_${id}`, `brand_cutout_${id}`])})
  `;
  const keys = new Set(rows.map((r) => r.key));
  return ids
    .filter((id) => keys.has(`brand_photo_${id}`))
    .map((id) => ({
      id,
      hasCutout: keys.has(`brand_cutout_${id}`),
      // Por defecto toda foto sirve para portadas; el avatar se marca a mano.
      cover: flags[id]?.cover !== false,
      avatar: flags[id]?.avatar === true,
    }));
}

export async function setPhotoFlags(clientId: number, id: string, next: Partial<PhotoFlags>): Promise<void> {
  const meta = await listPhotoMeta(clientId);
  if (!meta.some((p) => p.id === id)) throw new Error("Foto no encontrada");
  const flags: Record<string, Partial<PhotoFlags>> = {};
  for (const p of meta) {
    const cover = p.id === id && next.cover !== undefined ? next.cover : p.cover;
    // El avatar es uno solo: marcar una desmarca las demás.
    const avatar = next.avatar === true ? p.id === id : p.id === id && next.avatar === false ? false : p.avatar;
    flags[p.id] = { cover, avatar };
  }
  await setSetting(clientId, "brand_photo_flags", JSON.stringify(flags));
}

/** Foto del avatar de los slides interiores: la marcada, o la primera disponible. */
export function chooseAvatarPhoto(meta: PhotoMeta[]): PhotoMeta | null {
  return meta.find((m) => m.avatar) || meta.find((m) => m.cover) || meta[0] || null;
}

export async function loadPhoto(clientId: number, id: string): Promise<BrandPhoto | null> {
  const rows = await getSettings(clientId, [`brand_photo_${id}`, `brand_cutout_${id}`]);
  const src = rows[`brand_photo_${id}`];
  return src ? { src, cutout: parseCutout(rows[`brand_cutout_${id}`]) } : null;
}

/**
 * Foto de portada para un carrusel: determinística por el título de portada
 * (todos los slides del carrusel coinciden) y distinta entre carruseles.
 * Prioriza fotos con recorte, que son las que permiten composiciones.
 */
export function chooseCoverPhoto(meta: PhotoMeta[], seed: string): PhotoMeta | null {
  const usable = meta.filter((m) => m.cover);
  const pool = usable.filter((m) => m.hasCutout).length ? usable.filter((m) => m.hasCutout) : usable;
  const fallback = pool.length ? pool : meta;
  return fallback.length ? fallback[hashString(seed) % fallback.length] : null;
}

export async function addBrandPhoto(clientId: number, src: string, cutout: Cutout | null): Promise<string> {
  const meta = await listPhotoMeta(clientId);
  if (meta.length >= MAX_PHOTOS) throw new Error(`Máximo ${MAX_PHOTOS} fotos.`);
  const id = Math.random().toString(36).slice(2, 10);
  await setSetting(clientId, `brand_photo_${id}`, src);
  if (cutout) await setSetting(clientId, `brand_cutout_${id}`, JSON.stringify(cutout));
  await setSetting(clientId, "brand_photo_ids", JSON.stringify([...meta.map((p) => p.id), id]));
  return id;
}

export async function setBrandCutout(clientId: number, id: string, cutout: Cutout): Promise<void> {
  const meta = await listPhotoMeta(clientId);
  if (!meta.some((p) => p.id === id)) throw new Error("Foto no encontrada");
  await setSetting(clientId, `brand_cutout_${id}`, JSON.stringify(cutout));
}

export async function deleteBrandPhoto(clientId: number, id: string): Promise<void> {
  const meta = await listPhotoMeta(clientId);
  const sql = getSql();
  await sql`
    DELETE FROM settings WHERE client_id = ${clientId}
      AND key IN (${`brand_photo_${id}`}, ${`brand_cutout_${id}`})
  `;
  await setSetting(clientId, "brand_photo_ids", JSON.stringify(meta.map((p) => p.id).filter((p) => p !== id)));
}
