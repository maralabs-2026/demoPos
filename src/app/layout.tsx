import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { getComercioName } from "@/modules/config";

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

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const comercioResult = await getComercioName();
  const comercioNombre = comercioResult.ok
    ? comercioResult.data
    : "Punto de Venta";

  return (
    <html lang="es-AR">
      <body className={`${inter.variable} antialiased`}>
        <NavBar comercioNombre={comercioNombre} />
        {children}
      </body>
    </html>
  );
}
