import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateCaseReadiness } from "@/lib/case-quality";
import { requireAdmin } from "@/lib/auth-helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { caseId } = await params;
  const parsedCaseId = Number(caseId);

  if (!Number.isInteger(parsedCaseId)) {
    return NextResponse.json({ message: "Invalid case id." }, { status: 400 });
  }

  const caseFile = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
    include: {
      people: true,
      records: true,
      hints: true,
      checkpoints: true,
    },
  });

  if (!caseFile) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  if (caseFile.workflowStatus === "PUBLISHED") {
    const updated = await prisma.caseFile.update({
      where: { id: caseFile.id },
      data: {
        workflowStatus: "DRAFT",
        publishedAt: null,
      },
    });

    return NextResponse.json(
      {
        message: `${updated.title} moved back to draft.`,
        workflowStatus: updated.workflowStatus,
      },
      { status: 200 }
    );
  }

  const readiness = evaluateCaseReadiness(caseFile);

  if (!readiness.isReady) {
    return NextResponse.json(
      {
        message: "Case is not ready to publish.",
        issues: readiness.issues,
      },
      { status: 400 }
    );
  }

  const updated = await prisma.caseFile.update({
    where: { id: caseFile.id },
    data: {
      workflowStatus: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  return NextResponse.json(
    {
      message: `${updated.title} published successfully.`,
      workflowStatus: updated.workflowStatus,
    },
    { status: 200 }
  );
}