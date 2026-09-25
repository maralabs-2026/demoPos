import { getNextRoute } from "@/modules/auth";
import { LoginView } from "./login-view";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const safeNext = getNextRoute(next);

  return <LoginView safeNext={safeNext} />;
}
