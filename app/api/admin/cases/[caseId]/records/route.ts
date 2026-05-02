import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { recordsPatchSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const limit = await rateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { message: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const userId = Number(guard.user.id);

  const { caseId } = await params;
  const parsedCaseId = Number(caseId);
  if (!Number.isInteger(parsedCaseId)) {
    return NextResponse.json({ message: "Invalid case id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = recordsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const existing = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
    include: { records: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  for (const item of parsed.data.records) {
    if (item.unlockStage > existing.maxStage) {
      return NextResponse.json(
        {
          message: `unlockStage ${item.unlockStage} exceeds case maxStage (${existing.maxStage}).`,
        },
        { status: 422 }
      );
    }
  }

  const existingById = new Map(existing.records.map((r) => [r.id, r]));
  const submittedIds = new Set<number>();
  const toCreate: Array<{
    caseFileId: number;
    title: string;
    category: string;
    summary: string;
    body: string;
    unlockStage: number;
    sortOrder: number;
  }> = [];
  const toUpdate: Array<{ id: number; data: Record<string, unknown> }> = [];

  for (const sub of parsed.data.records) {
    if (sub.id !== undefined) {
      submittedIds.add(sub.id);
      const ex = existingById.get(sub.id);
      if (!ex) {
        return NextResponse.json(
          { message: `Unknown CaseRecord id ${sub.id}.` },
          { status: 422 }
        );
      }
      const update: Record<string, unknown> = {};
      if (sub.title !== ex.title) update.title = sub.title;
      if (sub.category !== ex.category) update.category = sub.category;
      if (sub.summary !== ex.summary) update.summary = sub.summary;
      if (sub.body !== ex.body) update.body = sub.body;
      if (sub.unlockStage !== ex.unlockStage)
        update.unlockStage = sub.unlockStage;
      if (sub.sortOrder !== ex.sortOrder) update.sortOrder = sub.sortOrder;
      if (Object.keys(update).length > 0) {
        toUpdate.push({ id: sub.id, data: update });
      }
    } else {
      toCreate.push({
        caseFileId: parsedCaseId,
        title: sub.title,
        category: sub.category,
        summary: sub.summary,
        body: sub.body,
        unlockStage: sub.unlockStage,
        sortOrder: sub.sortOrder,
      });
    }
  }

  const toDelete = existing.records
    .filter((r) => !submittedIds.has(r.id))
    .map((r) => r.id);

  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.caseRecord.deleteMany({ where: { id: { in: toDelete } } });
    }
    for (const u of toUpdate) {
      await tx.caseRecord.update({ where: { id: u.id }, data: u.data });
    }
    if (toCreate.length > 0) {
      await tx.caseRecord.createMany({ data: toCreate });
    }
    await tx.caseAudit.create({
      data: {
        caseFileId: parsedCaseId,
        userId,
        action: "UPDATE_RECORDS",
        diff: {
          records: {
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
