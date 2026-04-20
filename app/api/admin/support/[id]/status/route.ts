import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { supportStatusPatchSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId)) {
    return NextResponse.json({ message: "Invalid id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = supportStatusPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const existing = await prisma.supportMessage.findUnique({
    where: { id: parsedId },
  });
  if (!existing) {
    return NextResponse.json(
      { message: "Support message not found." },
      { status: 404 }
    );
  }

  await prisma.supportMessage.update({
    where: { id: parsedId },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
