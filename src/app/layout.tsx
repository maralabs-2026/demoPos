import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Sohne (la tipografía de la referencia de diseño) es propietaria y no la
// bundleamos. Inter en peso liviano es el sustituto que la propia guía
// recomienda como equivalente abierto.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: "Punto de Venta",
  description: "Punto de venta web",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
