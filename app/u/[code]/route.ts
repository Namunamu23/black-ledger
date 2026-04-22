import { redirect } from "next/navigation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  redirect(`/bureau/unlock?code=${encodeURIComponent(code)}`);
}
