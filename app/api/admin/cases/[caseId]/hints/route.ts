import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { hintsPatchSchema } from "@/lib/validators";

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
  const parsed = hintsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const existing = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
    include: { hints: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  for (const item of parsed.data.hints) {
    if (item.unlockStage > existing.maxStage) {
      return NextResponse.json(
        {
          message: `unlockStage ${item.unlockStage} exceeds case maxStage (${existing.maxStage}).`,
        },
        { status: 422 }
      );
    }
  }

  const existingById = new Map(existing.hints.map((h) => [h.id, h]));
  const submittedIds = new Set<number>();
  const toCreate: Array<{
    caseFileId: number;
    level: number;
    title: string;
    content: string;
    unlockStage: number;
    sortOrder: number;
  }> = [];
  const toUpdate: Array<{ id: number; data: Record<string, unknown> }> = [];

  for (const sub of parsed.data.hints) {
    if (sub.id !== undefined) {
      submittedIds.add(sub.id);
      const ex = existingById.get(sub.id);
      if (!ex) {
        return NextResponse.json(
          { message: `Unknown CaseHint id ${sub.id}.` },
          { status: 422 }
        );
      }
      const update: Record<string, unknown> = {};
      if (sub.level !== ex.level) update.level = sub.level;
      if (sub.title !== ex.title) update.title = sub.title;
      if (sub.content !== ex.content) update.content = sub.content;
      if (sub.unlockStage !== ex.unlockStage)
        update.unlockStage = sub.unlockStage;
      if (sub.sortOrder !== ex.sortOrder) update.sortOrder = sub.sortOrder;
      if (Object.keys(update).length > 0) {
        toUpdate.push({ id: sub.id, data: update });
      }
    } else {
      toCreate.push({
        caseFileId: parsedCaseId,
        level: sub.level,
        title: sub.title,
        content: sub.content,
        unlockStage: sub.unlockStage,
        sortOrder: sub.sortOrder,
      });
    }
  }

  const toDelete = existing.hints
    .filter((h) => !submittedIds.has(h.id))
    .map((h) => h.id);

  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.caseHint.deleteMany({ where: { id: { in: toDelete } } });
    }
    for (const u of toUpdate) {
      await tx.caseHint.update({ where: { id: u.id }, data: u.data });
    }
    if (toCreate.length > 0) {
      await tx.caseHint.createMany({ data: toCreate });
    }
    await tx.caseAudit.create({
      data: {
        caseFileId: parsedCaseId,
        userId,
        action: "UPDATE_HINTS",
        diff: {
          hints: {
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
