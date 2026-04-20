import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { CaseWorkflowStatus } from "@/lib/enums";

/**
 * Legal workflow transitions. The lifecycle is forward-only:
 *
 *   DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED
 *
 * ARCHIVED can also be reached directly from any earlier state. Once a
 * case is ARCHIVED, no further transition is allowed via this route.
 *
 * Backward transitions (e.g. PUBLISHED → DRAFT) are not exposed here —
 * un-publishing is intentionally a separate concern (and currently
 * absent). Same-state transitions are also rejected.
 */
const LEGAL_TRANSITIONS: Record<CaseWorkflowStatus, CaseWorkflowStatus[]> = {
  [CaseWorkflowStatus.DRAFT]: [
    CaseWorkflowStatus.IN_REVIEW,
    CaseWorkflowStatus.ARCHIVED,
  ],
  [CaseWorkflowStatus.IN_REVIEW]: [
    CaseWorkflowStatus.PUBLISHED,
    CaseWorkflowStatus.ARCHIVED,
  ],
  [CaseWorkflowStatus.PUBLISHED]: [CaseWorkflowStatus.ARCHIVED],
  [CaseWorkflowStatus.ARCHIVED]: [],
};

function isLegalTransition(
  from: CaseWorkflowStatus,
  to: CaseWorkflowStatus
): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

const workflowPatchSchema = z.object({
  workflowStatus: z.enum([
    CaseWorkflowStatus.DRAFT,
    CaseWorkflowStatus.IN_REVIEW,
    CaseWorkflowStatus.PUBLISHED,
    CaseWorkflowStatus.ARCHIVED,
  ]),
});

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

  const body = await request.json().catch(() => null);
  const parsed = workflowPatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const targetStatus = parsed.data.workflowStatus;

  const caseFile = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
  });

  if (!caseFile) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  const currentStatus = caseFile.workflowStatus as CaseWorkflowStatus;

  if (!isLegalTransition(currentStatus, targetStatus)) {
    return NextResponse.json(
      {
        message: `Illegal workflow transition: ${currentStatus} → ${targetStatus}.`,
      },
      { status: 422 }
    );
  }

  // Stamp publishedAt the first time a case enters PUBLISHED. Preserve
  // the original timestamp on later transitions (e.g. PUBLISHED → ARCHIVED)
  // so historical first-publish information is not lost.
  const publishedAt =
    targetStatus === CaseWorkflowStatus.PUBLISHED && !caseFile.publishedAt
      ? new Date()
      : caseFile.publishedAt;

  const updated = await prisma.caseFile.update({
    where: { id: caseFile.id },
    data: {
      workflowStatus: targetStatus,
      publishedAt,
    },
  });

  return NextResponse.json(updated, { status: 200 });
}
