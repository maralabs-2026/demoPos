import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiKitDemo } from "./ui-kit-demo";

export const metadata: Metadata = {
  title: "UI kit · Punto de Venta",
};

// Catálogo visual de componentes para revisar el UI kit. Se ve en local y en
// los deploys de preview; en producción no existe.
export default function UiKitPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <UiKitDemo />;
}
