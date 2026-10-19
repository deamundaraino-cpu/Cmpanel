import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Panel de Marca — CM con IA",
  description: "Métricas, calificación y propuestas de contenido para tu Instagram",
  applicationName: "Brandpanel",
  // Instalación en iPad/iPhone ("Añadir a pantalla de inicio").
  appleWebApp: { capable: true, title: "Brandpanel", statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#08080d",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.className} h-full antialiased`}>
      <body className="min-h-full">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('bp-theme')==='light'){document.documentElement.dataset.theme='light'}}catch(e){}})()",
          }}
        />
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
