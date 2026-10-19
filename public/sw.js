// Service worker mínimo: hace la app instalable y muestra un aviso si no hay red.
// No guarda páginas ni datos en caché: todo depende del cliente activo y de la
// sesión, y servir algo viejo o de otra marca sería peor que no servir nada.
const OFFLINE_HTML = `<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#08080d;color:#f4f4f5;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><p style="font-size:20px;font-weight:600">Sin conexión</p>
<p style="opacity:.6">Brandpanel necesita internet. Vuelve a intentarlo cuando tengas red.</p>
<button onclick="location.reload()" style="margin-top:12px;padding:10px 18px;border-radius:10px;border:0;background:#6366f1;color:#fff;font-size:16px">Reintentar</button></div>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});
