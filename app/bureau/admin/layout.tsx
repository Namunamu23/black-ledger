import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-helpers";
import { UserRole } from "@/lib/enums";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  if (session.user.role !== UserRole.ADMIN) {
    redirect("/bureau");
  }

  return <>{children}</>;
}
