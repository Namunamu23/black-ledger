import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { solutionPatchSchema } from "@/lib/validators";

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
  const parsed = solutionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const data: Record<string, unknown> = { ...parsed.data };

  // Empty-string-to-null coercion for the two nullable debrief fields,
  // mirroring the legacy aggregate PUT behavior.
  if (data.debriefSectionTitle !== undefined) {
    data.debriefSectionTitle =
      (data.debriefSectionTitle as string | null)?.toString().trim() || null;
  }
  if (data.debriefIntro !== undefined) {
    data.debriefIntro =
      (data.debriefIntro as string | null)?.toString().trim() || null;
  }

  const submittedKeys = Object.keys(data);
  if (submittedKeys.length === 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
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
        action: "UPDATE_SOLUTION",
        diff: { caseFile: submittedKeys },
      },
    });
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
