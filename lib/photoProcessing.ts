// Procesamiento de fotos de marca en el NAVEGADOR: optimización y recorte de
// fondo con MODNet (Apache-2.0) vía transformers.js. Corre en el equipo del
// usuario, sin coste de servidor; el modelo (~25 MB) se descarga una vez y
// queda en la caché del navegador.

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm";
const MAX_SIDE = 1350;
const MAX_PHOTO_CHARS = 880_000;
const MAX_CUTOUT_CHARS = 3_400_000;

export type CutoutData = { src: string; w: number; h: number };

type RawImageLike = { data: Uint8ClampedArray | Uint8Array; width: number; height: number; channels: number };
type Segmenter = (input: string) => Promise<RawImageLike | RawImageLike[]>;

let segmenterPromise: Promise<Segmenter> | null = null;

function loadSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      // Import desde CDN en tiempo de ejecución: empaquetar onnxruntime-web con
      // el bundler de Next es frágil, y así el modelo no pesa en el bundle.
      const importUrl = new Function("u", "return import(u)") as (u: string) => Promise<{
        pipeline: (task: string, model: string, opts: object) => Promise<Segmenter>;
      }>;
      const { pipeline } = await importUrl(TRANSFORMERS_URL);
      return pipeline("background-removal", "Xenova/modnet", { dtype: "fp32" });
    })().catch((e) => {
      segmenterPromise = null;
      throw e;
    });
  }
  return segmenterPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen."));
    img.src = src;
  });
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

/** Redimensiona a máx. 1350 px de lado y comprime a JPEG hasta caber en el límite. */
export async function optimizePhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  let scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  for (let attempt = 0; attempt < 6; attempt++) {
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const [c, ctx] = canvas(w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = c.toDataURL("image/jpeg", 0.86);
    if (out.length <= MAX_PHOTO_CHARS) return out;
    scale *= 0.82;
  }
  throw new Error("No se pudo comprimir la foto lo suficiente.");
}

/** Quita el fondo y recorta el PNG al contorno de la persona. */
export async function cutoutFromPhoto(photo: string): Promise<CutoutData> {
  const segment = await loadSegmenter();
  const result = await segment(photo);
  const out = Array.isArray(result) ? result[0] : result;
  const { width: w, height: h, channels } = out;
  const rgba = new Uint8ClampedArray(w * h * 4);
  if (channels === 4) {
    rgba.set(out.data);
  } else {
    throw new Error("Formato de recorte inesperado.");
  }

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || (maxX - minX) * (maxY - minY) < w * h * 0.03) {
    throw new Error("No se detectó una persona en la foto.");
  }

  const [full, fullCtx] = canvas(w, h);
  fullCtx.putImageData(new ImageData(rgba, w, h), 0, 0);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  let scale = 1;
  for (let attempt = 0; attempt < 6; attempt++) {
    const tw = Math.round(cw * scale);
    const th = Math.round(ch * scale);
    const [c, ctx] = canvas(tw, th);
    ctx.drawImage(full, minX, minY, cw, ch, 0, 0, tw, th);
    const src = c.toDataURL("image/png");
    if (src.length <= MAX_CUTOUT_CHARS) return { src, w: tw, h: th };
    scale *= 0.8;
  }
  throw new Error("El recorte pesa demasiado.");
}
