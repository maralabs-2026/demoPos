import { NavBar } from "@/components/nav-bar";
import { getComercioName } from "@/modules/config";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const comercioResult = await getComercioName();
  const comercioNombre = comercioResult.ok
    ? comercioResult.data
    : "Punto de Venta";

  return (
    <>
      <NavBar comercioNombre={comercioNombre} />
      {children}
    </>
  );
}
