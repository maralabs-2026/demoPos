import { redirect } from "next/navigation";
import { getAuthProfile } from "@/modules/auth";
import { ChangePasswordView } from "./change-password-view";

export const dynamic = "force-dynamic";

export default async function CambiarContrasenaPage() {
  const profile = await getAuthProfile();
  if (!profile) redirect("/login");
  if (!profile.must_change_password) redirect("/vender");

  return <ChangePasswordView />;
}
