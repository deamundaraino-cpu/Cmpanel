import type { MetadataRoute } from "next";

// Permite instalar el panel como app (PWA) en tablet, móvil o escritorio.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brandpanel — CM con IA",
    short_name: "Brandpanel",
    description: "Métricas, propuestas de contenido y teleprompter para grabar",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#08080d",
    theme_color: "#08080d",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Grabación y teleprompter", short_name: "Grabar", url: "/grabacion" },
      { name: "Calendario", url: "/calendario" },
    ],
  };
}
