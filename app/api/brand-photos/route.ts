import { NextRequest, NextResponse } from "next/server";
import { guardClient, fail } from "@/lib/api";
import {
  addBrandPhoto,
  deleteBrandPhoto,
  listPhotoMeta,
  loadPhoto,
  setBrandCutout,
  MAX_CUTOUT_CHARS,
  MAX_PHOTO_CHARS,
} from "@/lib/brandPhotos";
import type { Cutout } from "@/lib/slide";

function validPhoto(src: unknown): src is string {
  return typeof src === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(src) && src.length <= MAX_PHOTO_CHARS;
}

function toCutout(raw: unknown): Cutout | null {
  const c = raw as Partial<Cutout> | null;
  if (!c || typeof c.src !== "string" || !c.src.startsWith("data:image/png;base64,")) return null;
  if (c.src.length > MAX_CUTOUT_CHARS) throw new Error("El recorte pesa demasiado.");
  const w = Number(c.w);
  const h = Number(c.h);
  if (!(w > 0 && h > 0)) return null;
  return { src: c.src, w: Math.round(w), h: Math.round(h) };
}

/** Sin `id`: lista de metadatos. Con `id` y `kind`: la imagen (foto o recorte) en binario. */
export async function GET(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json(await listPhotoMeta(auth.clientId));

  const photo = await loadPhoto(auth.clientId, id);
  const kind = req.nextUrl.searchParams.get("kind");
  const dataUrl = kind === "cutout" ? photo?.cutout?.src : photo?.src;
  const m = dataUrl?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(m[2], "base64")), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

export async function POST(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    if (!validPhoto(body.photo)) return fail(new Error("Foto inválida o demasiado pesada."), 400);
    const id = await addBrandPhoto(auth.clientId, body.photo, toCutout(body.cutout));
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return fail(e, 400);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    const cutout = toCutout(body.cutout);
    if (typeof body.id !== "string" || !cutout) return fail(new Error("Recorte inválido."), 400);
    await setBrandCutout(auth.clientId, body.id, cutout);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e, 400);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await guardClient();
  if (auth instanceof NextResponse) return auth;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail(new Error("Falta id"), 400);
  try {
    await deleteBrandPhoto(auth.clientId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
