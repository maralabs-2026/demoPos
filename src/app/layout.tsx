import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Fuentes guardadas en el repo (subset latin, licencia SIL OFL: ver fonts/README.md). Con
// next/font/google el build bajaba los archivos de Google en cada deploy y fallaba si Google
// respondía raro; así el build no depende de un servicio externo.

// Urbanist: tipografía de la interfaz. Archivo variable: cubre todos los pesos.
const urbanist = localFont({
  variable: "--font-urbanist",
  src: "./fonts/urbanist-latin-variable.woff2",
  weight: "100 900",
  display: "swap",
});

// Urbanist no tiene números de ancho fijo (tabular-nums no hace nada) y los montos tienen que
// quedar alineados en tablas y tickets. Por eso los dígitos salen de Manrope: esta cara cubre
// solo 0-9 y va primera en la pila de fuentes (globals.css).
const digits = localFont({
  variable: "--font-digits",
  src: "./fonts/manrope-latin-variable.woff2",
  weight: "200 800",
  display: "swap",
  declarations: [{ prop: "unicode-range", value: "U+0030-0039" }],
  // Sin esto next/font suma un respaldo Arial que cubre todas las letras y le gana a Urbanist.
  adjustFontFallback: false,
});

// IBM Plex Mono para códigos de barras y atajos.

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
      className={`${urbanist.variable} ${digits.variable} ${plexMono.variable}`}
    >
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
