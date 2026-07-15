import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Panel de Marca — CM con IA",
  description: "Métricas, calificación y propuestas de contenido para tu Instagram",
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
      </body>
    </html>
  );
}
