import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Fuentes guardadas en el repo (subset latin, licencia SIL OFL: ver fonts/README.md). Con
// next/font/google el build bajaba los archivos de Google en cada deploy y fallaba si Google
// respondía raro; así el build no depende de un servicio externo.

// DM Sans: tipografía del UI kit POS. Archivo variable: cubre todos los pesos.
const dmSans = localFont({
  variable: "--font-sans",
  src: "./fonts/dm-sans-latin-variable.woff2",
  weight: "100 1000",
  display: "swap",
});

// Manrope para montos y títulos; IBM Plex Mono para códigos de barras y atajos (Mostrador).
const manrope = localFont({
  variable: "--font-manrope",
  src: "./fonts/manrope-latin-variable.woff2",
  weight: "200 800",
  display: "swap",
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "./fonts/ibm-plex-mono-latin-500.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-mono-latin-600.woff2", weight: "600" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Punto de Venta",
  description: "Punto de venta web",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={`${dmSans.variable} ${manrope.variable} ${plexMono.variable}`}
    >
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
