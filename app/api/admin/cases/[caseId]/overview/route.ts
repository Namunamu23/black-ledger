import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { overviewPatchSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const userId = Number(guard.user.id);

  const { caseId } = await params;
  const parsedCaseId = Number(caseId);
  if (!Number.isInteger(parsedCaseId)) {
    return NextResponse.json({ message: "Invalid case id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = overviewPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const submittedKeys = Object.keys(data);

  if (submittedKeys.length === 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Slug uniqueness check, only when slug is in the payload.
  if (data.slug !== undefined) {
    const slugConflict = await prisma.caseFile.findFirst({
      where: { slug: data.slug, NOT: { id: parsedCaseId } },
    });
    if (slugConflict) {
      return NextResponse.json(
        { message: "Another case already uses that slug." },
        { status: 409 }
      );
    }
  }

  const existing = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
  });
  if (!existing) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.caseFile.update({ where: { id: parsedCaseId }, data });
    await tx.caseAudit.create({
      data: {
        caseFileId: parsedCaseId,
        userId,
        action: "UPDATE_OVERVIEW",
        diff: { caseFile: submittedKeys },
      },
    });
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
