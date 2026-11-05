import { redirect } from "next/navigation";
import { canAccess, getAuthProfile } from "@/modules/auth";

// Dueño y encargado arrancan por el inicio; el cajero, directo en el mostrador.
export default async function Home() {
  const profile = await getAuthProfile();
  redirect(
    profile && canAccess(profile.rol, "/inicio") ? "/inicio" : "/vender",
  );
}
