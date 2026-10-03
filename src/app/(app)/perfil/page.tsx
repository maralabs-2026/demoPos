import { redirect } from "next/navigation";
import { getAuthProfile } from "@/modules/auth";
import { Profile } from "@/modules/auth/components/profile";

export default async function PerfilPage() {
  const profile = await getAuthProfile();
  if (!profile) redirect("/login");

  return <Profile profile={profile} />;
}
