import { redirect } from "next/navigation";
import { Profile } from "@/modules/auth/components/profile";
import { getAuthProfile } from "@/modules/auth/queries";

export default async function PerfilPage() {
  const profile = await getAuthProfile();
  if (!profile) redirect("/login");

  return <Profile profile={profile} />;
}
