"use client";

import { useEffect, useState } from "react";
import { cutoutFromPhoto, optimizePhoto } from "@/lib/photoProcessing";

type Photo = { id: string; hasCutout: boolean; cover: boolean; avatar: boolean; bg: boolean };

function imageUrl(p: Photo, kind: "photo" | "cutout") {
  // El recorte se regenera con el mismo id: la URL cambia para no ver el anterior.
  return `/api/brand-photos?id=${encodeURIComponent(p.id)}&kind=${kind}&v=${p.hasCutout ? 1 : 0}`;
}

const MAX_PHOTOS = 8;

export default function BrandPhotos({ onChanged }: { onChanged: () => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const res = await fetch("/api/brand-photos");
    if (res.ok) setPhotos(await res.json());
  }

  useEffect(() => {
    reload();
  }, []);

  async function api(method: "POST" | "PATCH", body: object) {
    const res = await fetch("/api/brand-photos", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Error al guardar la foto");
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, MAX_PHOTOS - photos.length);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setNotice(null);
    let saved = 0;
    const sinRecorte: string[] = [];
    try {
      for (const [i, file] of files.entries()) {
        const n = files.length > 1 ? ` ${i + 1}/${files.length}` : "";
        setStatus(`Optimizando foto${n}…`);
        const photo = await optimizePhoto(file);
        setStatus(`Recortando fondo${n}… (la primera vez descarga el modelo, ~25 MB)`);
        let cutout = null;
        try {
          cutout = await cutoutFromPhoto(photo);
        } catch {
          sinRecorte.push(file.name);
        }
        setStatus(`Guardando foto${n}…`);
        await api("POST", { photo, cutout });
        saved++;
      }
      setNotice({
        ok: true,
        text:
          `✓ ${saved} foto${saved === 1 ? "" : "s"} guardada${saved === 1 ? "" : "s"}.` +
          (sinRecorte.length ? ` No se pudo recortar: ${sinRecorte.join(", ")} (se usará como foto de fondo).` : ""),
      });
    } catch (err) {
      setNotice({ ok: false, text: `⚠️ ${err instanceof Error ? err.message : "Error"}${saved ? ` (${saved} guardadas)` : ""}` });
    } finally {
      setStatus(null);
      setBusy(false);
      await reload();
      onChanged();
    }
  }

  async function recortar(p: Photo) {
    setBusy(true);
    setNotice(null);
    try {
      setStatus("Recortando fondo… (la primera vez descarga el modelo, ~25 MB)");
      const cutout = await cutoutFromPhoto(new URL(imageUrl(p, "photo"), window.location.href).href);
      await api("PATCH", { id: p.id, cutout });
      setNotice({ ok: true, text: "✓ Recorte listo." });
    } catch (err) {
      setNotice({ ok: false, text: `⚠️ ${err instanceof Error ? err.message : "Error"}` });
    } finally {
      setStatus(null);
      setBusy(false);
      await reload();
      onChanged();
    }
  }

  async function toggleFlag(p: Photo, flags: { cover?: boolean; avatar?: boolean; bg?: boolean }) {
    setBusy(true);
    try {
      await api("PATCH", { id: p.id, flags });
    } catch (err) {
      setNotice({ ok: false, text: `⚠️ ${err instanceof Error ? err.message : "Error"}` });
    } finally {
      setBusy(false);
      await reload();
      onChanged();
    }
  }

  async function eliminar(p: Photo) {
    setBusy(true);
    await fetch(`/api/brand-photos?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
    setBusy(false);
    await reload();
    onChanged();
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-zinc-400">Fotos tuyas para portadas</span>
        {photos.length < MAX_PHOTOS && (
          <label
            className={`rounded-lg bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 transition hover:bg-zinc-700 ${
              busy ? "pointer-events-none opacity-50" : "cursor-pointer"
            }`}
          >
            + Subir fotos
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onFiles} className="hidden" disabled={busy} />
          </label>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-600">
        Hasta {MAX_PHOTOS} fotos tuyas de medio cuerpo, con buena luz y fondo simple. Se les quita el fondo
        automáticamente en tu navegador y se guardan al instante (no hace falta pulsar &quot;Guardar ficha&quot;).
        Pasa el ratón por una foto para elegir si entra en las portadas, si es la del avatar o si es una imagen de
        fondo (textura, oficina, escenario) para las composiciones que la usan.
      </p>

      {status && (
        <p className="mt-2 flex items-center gap-2 text-xs text-indigo-300">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
          {status}
        </p>
      )}
      {notice && <p className={`mt-2 text-xs ${notice.ok ? "text-emerald-400" : "text-red-400"}`}>{notice.text}</p>}

      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {photos.map((p) => (
            <div
              key={p.id}
              className={`group relative aspect-[4/5] overflow-hidden rounded-lg border bg-zinc-800 ${
                p.cover ? "border-zinc-700" : "border-zinc-800 opacity-45"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(p, p.hasCutout && !p.bg ? "cutout" : "photo")}
                alt="Foto de marca"
                className={`h-full w-full ${p.hasCutout && !p.bg ? "object-contain object-bottom" : "object-cover"}`}
              />
              <span
                className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  p.bg ? "bg-sky-500/90 text-black" : p.hasCutout ? "bg-emerald-500/90 text-black" : "bg-amber-500/90 text-black"
                }`}
              >
                {p.bg ? "Fondo" : p.hasCutout ? "Recortada" : "Sin recorte"}
              </span>
              {p.avatar && (
                <span className="absolute bottom-1 right-1 rounded bg-indigo-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Avatar
                </span>
              )}
              <div className="absolute right-1 top-1 flex flex-col items-end gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => eliminar(p)}
                  disabled={busy}
                  aria-label="Quitar foto"
                  className="rounded-full bg-black/70 px-1.5 py-0.5 text-xs text-white hover:text-red-400"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => toggleFlag(p, { cover: !p.cover })}
                  disabled={busy}
                  title={p.cover ? "No usar en portadas" : "Usar en portadas"}
                  className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white hover:text-indigo-300"
                >
                  {p.cover ? "Quitar de portadas" : "Usar en portadas"}
                </button>
                {!p.avatar && !p.bg && (
                  <button
                    type="button"
                    onClick={() => toggleFlag(p, { avatar: true })}
                    disabled={busy}
                    title="Usar como avatar de los slides interiores"
                    className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white hover:text-indigo-300"
                  >
                    Avatar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleFlag(p, { bg: !p.bg })}
                  disabled={busy}
                  title="Usarla como imagen de fondo de las composiciones"
                  className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white hover:text-sky-300"
                >
                  {p.bg ? "No es fondo" : "Fondo"}
                </button>
                {!p.hasCutout && (
                  <button
                    type="button"
                    onClick={() => recortar(p)}
                    disabled={busy}
                    className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white hover:text-indigo-300"
                  >
                    Recortar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
