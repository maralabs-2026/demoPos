import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiKitDemo } from "./ui-kit-demo";

export const metadata: Metadata = {
  title: "UI kit · Punto de Venta",
};

// Catálogo visual de componentes para revisar el UI kit. Se ve en local y en
// los deploys de preview de Vercel. En cualquier build de producción (Vercel o
// self-hosted con `next start`) no existe: queda fuera del login.
export default function UiKitPage() {
  const esPreview = process.env.VERCEL_ENV === "preview";
  if (process.env.NODE_ENV === "production" && !esPreview) notFound();
  return <UiKitDemo />;
}
