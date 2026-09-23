import { Navigation } from "@/modules/auth/components/navigation";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navigation />
      <div className="pb-14 md:pb-0">{children}</div>
    </>
  );
}
