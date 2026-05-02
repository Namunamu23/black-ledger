import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminCaseContentSchema } from "@/lib/validators";
import { requireAdmin } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(
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
      people: { orderBy: { sortOrder: "asc" } },
      records: { orderBy: { sortOrder: "asc" } },
      hints: { orderBy: [{ unlockStage: "asc" }, { sortOrder: "asc" }] },
      checkpoints: { orderBy: { stage: "asc" } },
    },
  });

  if (!caseFile) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  return NextResponse.json(caseFile);
}

type CollectionDiff = { created: number; updated: number; deleted: number };

export async function PUT(
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

  if (!Number.isInteger(userId)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
  }

  const { caseId } = await params;
  const parsedCaseId = Number(caseId);

  if (!Number.isInteger(parsedCaseId)) {
    return NextResponse.json({ message: "Invalid case id." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = adminCaseContentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existing = await prisma.caseFile.findUnique({
      where: { id: parsedCaseId },
      include: {
        people: true,
        records: true,
        hints: true,
        checkpoints: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "Case not found." }, { status: 404 });
    }

    const slugConflict = await prisma.caseFile.findFirst({
      where: {
        slug: data.slug,
        NOT: { id: parsedCaseId },
      },
    });

    if (slugConflict) {
      return NextResponse.json(
        { message: "Another case already uses that slug." },
        { status: 409 }
      );
    }

    if (data.slug !== existing.slug) {
      const historyConflict = await prisma.caseSlugHistory.findFirst({
        where: { oldSlug: data.slug, NOT: { caseFileId: parsedCaseId } },
      });
      if (historyConflict) {
        return NextResponse.json(
          {
            message:
              "That slug was previously used by another case and is reserved.",
          },
          { status: 409 }
        );
      }
    }

    const invalidUnlockStage =
      [...data.people, ...data.records, ...data.hints].some(
        (item) => item.unlockStage > data.maxStage
      ) ||
      data.checkpoints.some((item) => item.stage >= data.maxStage);

    if (invalidUnlockStage) {
      return NextResponse.json(
        {
          message:
            "Unlock stages must not exceed maxStage, and checkpoint stages must be lower than maxStage.",
        },
        { status: 400 }
      );
    }

    // ---- Case-level scalar diff ----
    // Normalize the two nullable debrief copy fields exactly like the
    // previous handler did (empty input → null) before comparing.
    const submittedDebriefSectionTitle =
      data.debriefSectionTitle?.trim() || null;
    const submittedDebriefIntro = data.debriefIntro?.trim() || null;

    const caseFileScalars: Record<string, unknown> = {};
    const caseFileChanged: string[] = [];

    function diffField<K extends string>(
      key: K,
      submitted: unknown,
      current: unknown
    ) {
      if (submitted !== current) {
        caseFileScalars[key] = submitted;
        caseFileChanged.push(key);
      }
    }

    diffField("title", data.title, existing.title);
    diffField("slug", data.slug, existing.slug);
    diffField("summary", data.summary, existing.summary);
    diffField("players", data.players, existing.players);
    diffField("duration", data.duration, existing.duration);
    diffField("difficulty", data.difficulty, existing.difficulty);
    diffField("maxStage", data.maxStage, existing.maxStage);
    diffField("solutionSuspect", data.solutionSuspect, existing.solutionSuspect);
    diffField("solutionMotive", data.solutionMotive, existing.solutionMotive);
    diffField("solutionEvidence", data.solutionEvidence, existing.solutionEvidence);
    diffField("debriefOverview", data.debriefOverview, existing.debriefOverview);
    diffField("debriefWhatHappened", data.debriefWhatHappened, existing.debriefWhatHappened);
    diffField("debriefWhyItWorked", data.debriefWhyItWorked, existing.debriefWhyItWorked);
    diffField("debriefClosing", data.debriefClosing, existing.debriefClosing);
    diffField("debriefSectionTitle", submittedDebriefSectionTitle, existing.debriefSectionTitle);
    diffField("debriefIntro", submittedDebriefIntro, existing.debriefIntro);
    diffField("isActive", data.isActive, existing.isActive);

    // ---- People diff (with globalPersonId protection) ----
    const existingPeopleById = new Map(existing.people.map((p) => [p.id, p]));
    const submittedPeopleIds = new Set<number>();
    const peopleToCreate: Array<{
      caseFileId: number;
      globalPersonId: number | null;
      name: string;
      role: string;
      summary: string;
      unlockStage: number;
      sortOrder: number;
    }> = [];
    const peopleToUpdate: Array<{ id: number; data: Record<string, unknown> }> = [];

    for (const sub of data.people) {
      if (sub.id !== undefined) {
        submittedPeopleIds.add(sub.id);
        const ex = existingPeopleById.get(sub.id);
        if (!ex) {
          return NextResponse.json(
            { message: `Unknown CasePerson id ${sub.id}.` },
            { status: 400 }
          );
        }

        const update: Record<string, unknown> = {};
        if (sub.name !== ex.name) update.name = sub.name;
        if (sub.role !== ex.role) update.role = sub.role;
        if (sub.summary !== ex.summary) update.summary = sub.summary;
        if (sub.unlockStage !== ex.unlockStage)
          update.unlockStage = sub.unlockStage;
        if (sub.sortOrder !== ex.sortOrder) update.sortOrder = sub.sortOrder;

        // globalPersonId is the load-bearing field. Only write it when the
        // submitted value strictly differs from the existing value, so an
        // edit that doesn't touch the link cannot accidentally clear it.
        const submittedGpid = sub.globalPersonId ?? null;
        if (submittedGpid !== ex.globalPersonId) {
          update.globalPersonId = submittedGpid;
        }

        if (Object.keys(update).length > 0) {
          peopleToUpdate.push({ id: sub.id, data: update });
        }
      } else {
        peopleToCreate.push({
          caseFileId: parsedCaseId,
          globalPersonId: sub.globalPersonId ?? null,
          name: sub.name,
          role: sub.role,
          summary: sub.summary,
          unlockStage: sub.unlockStage,
          sortOrder: sub.sortOrder,
        });
      }
    }

    const peopleToDelete = existing.people
      .filter((p) => !submittedPeopleIds.has(p.id))
      .map((p) => p.id);

    const peopleDiff: CollectionDiff = {
      created: peopleToCreate.length,
      updated: peopleToUpdate.length,
      deleted: peopleToDelete.length,
    };

    // ---- Records diff ----
    const existingRecordsById = new Map(existing.records.map((r) => [r.id, r]));
    const submittedRecordsIds = new Set<number>();
    const recordsToCreate: Array<{
      caseFileId: number;
      title: string;
      category: string;
      summary: string;
      body: string;
      unlockStage: number;
      sortOrder: number;
    }> = [];
    const recordsToUpdate: Array<{ id: number; data: Record<string, unknown> }> = [];

    for (const sub of data.records) {
      if (sub.id !== undefined) {
        submittedRecordsIds.add(sub.id);
        const ex = existingRecordsById.get(sub.id);
        if (!ex) {
          return NextResponse.json(
            { message: `Unknown CaseRecord id ${sub.id}.` },
            { status: 400 }
          );
        }
        const update: Record<string, unknown> = {};
        if (sub.title !== ex.title) update.title = sub.title;
        if (sub.category !== ex.category) update.category = sub.category;
        if (sub.summary !== ex.summary) update.summary = sub.summary;
        if (sub.body !== ex.body) update.body = sub.body;
        if (sub.unlockStage !== ex.unlockStage) update.unlockStage = sub.unlockStage;
        if (sub.sortOrder !== ex.sortOrder) update.sortOrder = sub.sortOrder;
        if (Object.keys(update).length > 0) {
          recordsToUpdate.push({ id: sub.id, data: update });
        }
      } else {
        recordsToCreate.push({
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
    const recordsToDelete = existing.records
      .filter((r) => !submittedRecordsIds.has(r.id))
      .map((r) => r.id);
    const recordsDiff: CollectionDiff = {
      created: recordsToCreate.length,
      updated: recordsToUpdate.length,
      deleted: recordsToDelete.length,
    };

    // ---- Hints diff ----
    const existingHintsById = new Map(existing.hints.map((h) => [h.id, h]));
    const submittedHintsIds = new Set<number>();
    const hintsToCreate: Array<{
      caseFileId: number;
      level: number;
      title: string;
      content: string;
      unlockStage: number;
      sortOrder: number;
    }> = [];
    const hintsToUpdate: Array<{ id: number; data: Record<string, unknown> }> = [];

    for (const sub of data.hints) {
      if (sub.id !== undefined) {
        submittedHintsIds.add(sub.id);
        const ex = existingHintsById.get(sub.id);
        if (!ex) {
          return NextResponse.json(
            { message: `Unknown CaseHint id ${sub.id}.` },
            { status: 400 }
          );
        }
        const update: Record<string, unknown> = {};
        if (sub.level !== ex.level) update.level = sub.level;
        if (sub.title !== ex.title) update.title = sub.title;
        if (sub.content !== ex.content) update.content = sub.content;
        if (sub.unlockStage !== ex.unlockStage) update.unlockStage = sub.unlockStage;
        if (sub.sortOrder !== ex.sortOrder) update.sortOrder = sub.sortOrder;
        if (Object.keys(update).length > 0) {
          hintsToUpdate.push({ id: sub.id, data: update });
        }
      } else {
        hintsToCreate.push({
          caseFileId: parsedCaseId,
          level: sub.level,
          title: sub.title,
          content: sub.content,
          unlockStage: sub.unlockStage,
          sortOrder: sub.sortOrder,
        });
      }
    }
    const hintsToDelete = existing.hints
      .filter((h) => !submittedHintsIds.has(h.id))
      .map((h) => h.id);
    const hintsDiff: CollectionDiff = {
      created: hintsToCreate.length,
      updated: hintsToUpdate.length,
      deleted: hintsToDelete.length,
    };

    // ---- Checkpoints diff ----
    const existingCheckpointsById = new Map(
      existing.checkpoints.map((c) => [c.id, c])
    );
    const submittedCheckpointsIds = new Set<number>();
    const checkpointsToCreate: Array<{
      caseFileId: number;
      stage: number;
      prompt: string;
      acceptedAnswers: string;
      successMessage: string;
    }> = [];
    const checkpointsToUpdate: Array<{ id: number; data: Record<string, unknown> }> = [];

    for (const sub of data.checkpoints) {
      if (sub.id !== undefined) {
        submittedCheckpointsIds.add(sub.id);
        const ex = existingCheckpointsById.get(sub.id);
        if (!ex) {
          return NextResponse.json(
            { message: `Unknown CaseCheckpoint id ${sub.id}.` },
            { status: 400 }
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
          checkpointsToUpdate.push({ id: sub.id, data: update });
        }
      } else {
        checkpointsToCreate.push({
          caseFileId: parsedCaseId,
          stage: sub.stage,
          prompt: sub.prompt,
          acceptedAnswers: sub.acceptedAnswers,
          successMessage: sub.successMessage,
        });
      }
    }
    const checkpointsToDelete = existing.checkpoints
      .filter((c) => !submittedCheckpointsIds.has(c.id))
      .map((c) => c.id);
    const checkpointsDiff: CollectionDiff = {
      created: checkpointsToCreate.length,
      updated: checkpointsToUpdate.length,
      deleted: checkpointsToDelete.length,
    };

    const diff = {
      caseFile: caseFileChanged,
      people: peopleDiff,
      records: recordsDiff,
      hints: hintsDiff,
      checkpoints: checkpointsDiff,
    };

    await prisma.$transaction(async (tx) => {
      if (Object.keys(caseFileScalars).length > 0) {
        await tx.caseFile.update({
          where: { id: parsedCaseId },
          data: caseFileScalars,
        });
      }

      if (caseFileChanged.includes("slug")) {
        await tx.caseSlugHistory.upsert({
          where: { oldSlug: existing.slug },
          update: { caseFileId: parsedCaseId },
          create: {
            caseFileId: parsedCaseId,
            oldSlug: existing.slug,
          },
        });
      }

      // Order: deletes → updates → creates per collection. Deleting first
      // frees up unique constraints (e.g. CaseCheckpoint(caseFileId, stage))
      // for any subsequent updates that re-use a stage value.
      if (peopleToDelete.length > 0) {
        await tx.casePerson.deleteMany({ where: { id: { in: peopleToDelete } } });
      }
      for (const u of peopleToUpdate) {
        await tx.casePerson.update({ where: { id: u.id }, data: u.data });
      }
      if (peopleToCreate.length > 0) {
        await tx.casePerson.createMany({ data: peopleToCreate });
      }

      if (recordsToDelete.length > 0) {
        await tx.caseRecord.deleteMany({ where: { id: { in: recordsToDelete } } });
      }
      for (const u of recordsToUpdate) {
        await tx.caseRecord.update({ where: { id: u.id }, data: u.data });
      }
      if (recordsToCreate.length > 0) {
        await tx.caseRecord.createMany({ data: recordsToCreate });
      }

      if (hintsToDelete.length > 0) {
        await tx.caseHint.deleteMany({ where: { id: { in: hintsToDelete } } });
      }
      for (const u of hintsToUpdate) {
        await tx.caseHint.update({ where: { id: u.id }, data: u.data });
      }
      if (hintsToCreate.length > 0) {
        await tx.caseHint.createMany({ data: hintsToCreate });
      }

      if (checkpointsToDelete.length > 0) {
        await tx.caseCheckpoint.deleteMany({
          where: { id: { in: checkpointsToDelete } },
        });
      }
      for (const u of checkpointsToUpdate) {
        await tx.caseCheckpoint.update({ where: { id: u.id }, data: u.data });
      }
      if (checkpointsToCreate.length > 0) {
        await tx.caseCheckpoint.createMany({ data: checkpointsToCreate });
      }

      await tx.caseAudit.create({
        data: {
          caseFileId: parsedCaseId,
          userId,
          action: "UPDATE",
          diff,
        },
      });
    });

    return NextResponse.json(
      { message: "Case content updated successfully.", diff },
      { status: 200 }
    );
  } catch (error) {
    const maybe = error as { code?: string };
    if (maybe.code === "P2002") {
      // Concurrent admin save raced past the slug pre-check. Return 409 with
      // a reload hint instead of a generic 500. Mirrors Batch 2's pattern in
      // app/api/admin/cases/route.ts (POST P2002 catch on case create).
      return NextResponse.json(
        {
          message:
            "Another admin save changed this case while you were editing. Please reload and try again.",
        },
        { status: 409 }
      );
    }
    console.error("Admin case update error:", error);

    return NextResponse.json(
      { message: "Something went wrong while updating the case." },
      { status: 500 }
    );
  }
}
