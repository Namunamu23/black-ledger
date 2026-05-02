import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { peoplePatchSchema } from "@/lib/validators";

/**
 * Diff/upsert PATCH for a case's CasePerson collection.
 *
 * Same protection as the legacy aggregate PUT: globalPersonId is only
 * written when the submitted value strictly differs from the existing
 * value, so a normal save can never silently clear the link to a
 * GlobalPerson.
 */
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
  const parsed = peoplePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const existing = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
    include: { people: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  for (const item of parsed.data.people) {
    if (item.unlockStage > existing.maxStage) {
      return NextResponse.json(
        {
          message: `unlockStage ${item.unlockStage} exceeds case maxStage (${existing.maxStage}).`,
        },
        { status: 422 }
      );
    }
  }

  const existingPeopleById = new Map(existing.people.map((p) => [p.id, p]));
  const submittedIds = new Set<number>();
  const toCreate: Array<{
    caseFileId: number;
    globalPersonId: number | null;
    name: string;
    role: string;
    summary: string;
    portraitUrl: string | null;
    unlockStage: number;
    sortOrder: number;
  }> = [];
  const toUpdate: Array<{ id: number; data: Record<string, unknown> }> = [];

  for (const sub of parsed.data.people) {
    if (sub.id !== undefined) {
      submittedIds.add(sub.id);
      const ex = existingPeopleById.get(sub.id);
      if (!ex) {
        return NextResponse.json(
          { message: `Unknown CasePerson id ${sub.id}.` },
          { status: 422 }
        );
      }

      const update: Record<string, unknown> = {};
      if (sub.name !== ex.name) update.name = sub.name;
      if (sub.role !== ex.role) update.role = sub.role;
      if (sub.summary !== ex.summary) update.summary = sub.summary;
      if (sub.unlockStage !== ex.unlockStage)
        update.unlockStage = sub.unlockStage;
      if (sub.sortOrder !== ex.sortOrder) update.sortOrder = sub.sortOrder;

      const submittedGpid = sub.globalPersonId ?? null;
      if (submittedGpid !== ex.globalPersonId) {
        update.globalPersonId = submittedGpid;
      }

      const submittedPortrait = sub.portraitUrl ?? null;
      const existingPortrait = ex.portraitUrl ?? null;
      if (submittedPortrait !== existingPortrait) {
        update.portraitUrl = submittedPortrait;
      }

      if (Object.keys(update).length > 0) {
        toUpdate.push({ id: sub.id, data: update });
      }
    } else {
      toCreate.push({
        caseFileId: parsedCaseId,
        globalPersonId: sub.globalPersonId ?? null,
        name: sub.name,
        role: sub.role,
        summary: sub.summary,
        portraitUrl: sub.portraitUrl ?? null,
        unlockStage: sub.unlockStage,
        sortOrder: sub.sortOrder,
      });
    }
  }

  const toDelete = existing.people
    .filter((p) => !submittedIds.has(p.id))
    .map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.casePerson.deleteMany({ where: { id: { in: toDelete } } });
    }
    for (const u of toUpdate) {
      await tx.casePerson.update({ where: { id: u.id }, data: u.data });
    }
    if (toCreate.length > 0) {
      await tx.casePerson.createMany({ data: toCreate });
    }
    await tx.caseAudit.create({
      data: {
        caseFileId: parsedCaseId,
        userId,
        action: "UPDATE_PEOPLE",
        diff: {
          people: {
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
