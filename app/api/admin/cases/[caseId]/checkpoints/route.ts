import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { checkpointsPatchSchema } from "@/lib/validators";

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
  const parsed = checkpointsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const existing = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
    include: { checkpoints: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  const existingById = new Map(existing.checkpoints.map((c) => [c.id, c]));
  const submittedIds = new Set<number>();
  const toCreate: Array<{
    caseFileId: number;
    stage: number;
    prompt: string;
    acceptedAnswers: string;
    successMessage: string;
  }> = [];
  const toUpdate: Array<{ id: number; data: Record<string, unknown> }> = [];

  for (const sub of parsed.data.checkpoints) {
    if (sub.id !== undefined) {
      submittedIds.add(sub.id);
      const ex = existingById.get(sub.id);
      if (!ex) {
        return NextResponse.json(
          { message: `Unknown CaseCheckpoint id ${sub.id}.` },
          { status: 422 }
        );
      }
      const update: Record<string, unknown> = {};
      if (sub.stage !== ex.stage) update.stage = sub.stage;
      if (sub.prompt !== ex.prompt) update.prompt = sub.prompt;
      if (sub.acceptedAnswers !== ex.acceptedAnswers)
        update.acceptedAnswers = sub.acceptedAnswers;
      if (sub.successMessage !== ex.successMessage)
        update.successMessage = sub.successMessage;
      if (Object.keys(update).length > 0) {
        toUpdate.push({ id: sub.id, data: update });
      }
    } else {
      toCreate.push({
        caseFileId: parsedCaseId,
        stage: sub.stage,
        prompt: sub.prompt,
        acceptedAnswers: sub.acceptedAnswers,
        successMessage: sub.successMessage,
      });
    }
  }

  const toDelete = existing.checkpoints
    .filter((c) => !submittedIds.has(c.id))
    .map((c) => c.id);

  await prisma.$transaction(async (tx) => {
    // delete-then-update-then-create — same ordering as the legacy PUT so
    // unique-constraint slots on (caseFileId, stage) are freed before any
    // update or create reuses them.
    if (toDelete.length > 0) {
      await tx.caseCheckpoint.deleteMany({ where: { id: { in: toDelete } } });
    }
    for (const u of toUpdate) {
      await tx.caseCheckpoint.update({ where: { id: u.id }, data: u.data });
    }
    if (toCreate.length > 0) {
      await tx.caseCheckpoint.createMany({ data: toCreate });
    }
    await tx.caseAudit.create({
      data: {
        caseFileId: parsedCaseId,
        userId,
        action: "UPDATE_CHECKPOINTS",
        diff: {
          checkpoints: {
            created: toCreate.length,
            updated: toUpdate.length,
            deleted: toDelete.length,
          },
        },
      },
    });
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
