import { requireSession } from "@/lib/auth-helpers";

export default async function BureauLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireSession();

  return <>{children}</>;
}
