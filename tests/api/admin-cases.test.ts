/**
 * Integration test for PUT /api/admin/cases/[caseId].
 *
 * Strategy choice — Prisma mock via vi.hoisted + vi.mock (consistent with
 * tests/api/theory.test.ts).
 *
 * Why a mock and not in-memory SQLite:
 *   - The behavior under test is the diff/upsert correctness of the route's
 *     mutation block — specifically, that an unchanged CasePerson is not
 *     deleted-and-recreated and that its globalPersonId is never written
 *     back when unchanged. Both invariants are observable purely from the
 *     Prisma calls the route makes; no real SQL execution is required.
 *   - The "row id is preserved" assertion reduces to "delete was not called
 *     for that row." A mock proves this directly.
 *   - The "globalPersonId is unchanged in the DB" assertion reduces to
 *     "update was called with no globalPersonId in the data payload"
 *     (Prisma never writes fields you do not pass).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const caseFileFindUnique = vi.fn();
  const caseFileFindFirst = vi.fn();
  const caseSlugHistoryFindFirst = vi.fn();
  const caseSlugHistoryUpsert = vi.fn();
  const caseFileUpdate = vi.fn();
  const casePersonUpdate = vi.fn();
  const casePersonDeleteMany = vi.fn();
  const casePersonCreateMany = vi.fn();
  const caseRecordUpdate = vi.fn();
  const caseRecordDeleteMany = vi.fn();
  const caseRecordCreateMany = vi.fn();
  const caseHintUpdate = vi.fn();
  const caseHintDeleteMany = vi.fn();
  const caseHintCreateMany = vi.fn();
  const caseCheckpointUpdate = vi.fn();
  const caseCheckpointDeleteMany = vi.fn();
  const caseCheckpointCreateMany = vi.fn();
  const caseAuditCreate = vi.fn();
  const transactionFn = vi.fn();
  const authFn = vi.fn();
  return {
    caseFileFindUnique,
    caseFileFindFirst,
    caseSlugHistoryFindFirst,
    caseSlugHistoryUpsert,
    caseFileUpdate,
    casePersonUpdate,
    casePersonDeleteMany,
    casePersonCreateMany,
    caseRecordUpdate,
    caseRecordDeleteMany,
    caseRecordCreateMany,
    caseHintUpdate,
    caseHintDeleteMany,
    caseHintCreateMany,
    caseCheckpointUpdate,
    caseCheckpointDeleteMany,
    caseCheckpointCreateMany,
    caseAuditCreate,
    transactionFn,
    authFn,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    caseFile: {
      findUnique: mocks.caseFileFindUnique,
      findFirst: mocks.caseFileFindFirst,
      update: mocks.caseFileUpdate,
    },
    caseSlugHistory: {
      findFirst: mocks.caseSlugHistoryFindFirst,
      upsert: mocks.caseSlugHistoryUpsert,
    },
    casePerson: {
      update: mocks.casePersonUpdate,
      deleteMany: mocks.casePersonDeleteMany,
      createMany: mocks.casePersonCreateMany,
    },
    caseRecord: {
      update: mocks.caseRecordUpdate,
      deleteMany: mocks.caseRecordDeleteMany,
      createMany: mocks.caseRecordCreateMany,
    },
    caseHint: {
      update: mocks.caseHintUpdate,
      deleteMany: mocks.caseHintDeleteMany,
      createMany: mocks.caseHintCreateMany,
    },
    caseCheckpoint: {
      update: mocks.caseCheckpointUpdate,
      deleteMany: mocks.caseCheckpointDeleteMany,
      createMany: mocks.caseCheckpointCreateMany,
    },
    caseAudit: {
      create: mocks.caseAuditCreate,
    },
    $transaction: mocks.transactionFn,
  },
}));

vi.mock("@/auth", () => ({
  auth: mocks.authFn,
}));

import { PUT } from "@/app/api/admin/cases/[caseId]/route";

const SEED_CASE = {
  id: 1,
  slug: "alder-street-review",
  title: "The Alder Street Review",
  summary: "A summary long enough to satisfy the validator min length.",
  players: "1-4",
  duration: "90-150 min",
  difficulty: "Moderate",
  maxStage: 3,
  solutionSuspect: "Anya Volkov",
  solutionMotive: "Insurance fraud cover-up",
  solutionEvidence: "Lighter found at the scene",
  debriefOverview: "Overview copy.",
  debriefWhatHappened: "What happened copy.",
  debriefWhyItWorked: "Why it worked copy.",
  debriefClosing: "Closing copy.",
  debriefSectionTitle: "Why the robbery theory failed",
  debriefIntro: null,
  isActive: true,
  workflowStatus: "DRAFT" as const,
  publishedAt: null,
  createdAt: new Date(),
  people: [
    {
      id: 101,
      caseFileId: 1,
      globalPersonId: 9001,
      name: "Anya Volkov",
      role: "Suspect",
      summary: "Original suspect summary.",
      unlockStage: 1,
      sortOrder: 1,
      createdAt: new Date(),
    },
    {
      id: 102,
      caseFileId: 1,
      globalPersonId: 9002,
      name: "Mara Kessler",
      role: "Witness",
      summary: "Witness summary.",
      unlockStage: 1,
      sortOrder: 2,
      createdAt: new Date(),
    },
  ],
  records: [],
  hints: [],
  checkpoints: [],
};

function makePutRequest(body: unknown) {
  return new Request("http://localhost/api/admin/cases/1", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const params = () => Promise.resolve({ caseId: "1" });

describe("PUT /api/admin/cases/[caseId] — diff/upsert preserves CasePerson identity and globalPersonId", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => {
      if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
        (m as { mockReset: () => void }).mockReset();
      }
    });

    mocks.authFn.mockResolvedValue({
      user: { id: "1", role: "ADMIN" },
    });

    mocks.caseFileFindUnique.mockResolvedValue(SEED_CASE);
    mocks.caseFileFindFirst.mockResolvedValue(null);
    mocks.caseSlugHistoryFindFirst.mockResolvedValue(null);
    mocks.caseSlugHistoryUpsert.mockResolvedValue({});

    mocks.transactionFn.mockImplementation(async (callback: any) => {
      return await callback({
        caseFile: { update: mocks.caseFileUpdate },
        caseSlugHistory: { upsert: mocks.caseSlugHistoryUpsert },
        casePerson: {
          update: mocks.casePersonUpdate,
          deleteMany: mocks.casePersonDeleteMany,
          createMany: mocks.casePersonCreateMany,
        },
        caseRecord: {
          update: mocks.caseRecordUpdate,
          deleteMany: mocks.caseRecordDeleteMany,
          createMany: mocks.caseRecordCreateMany,
        },
        caseHint: {
          update: mocks.caseHintUpdate,
          deleteMany: mocks.caseHintDeleteMany,
          createMany: mocks.caseHintCreateMany,
        },
        caseCheckpoint: {
          update: mocks.caseCheckpointUpdate,
          deleteMany: mocks.caseCheckpointDeleteMany,
          createMany: mocks.caseCheckpointCreateMany,
        },
        caseAudit: { create: mocks.caseAuditCreate },
      });
    });
  });

  it("renaming one person preserves both globalPersonId values and does not delete-and-recreate either row", async () => {
    // Submit both existing people, only person 101's name has changed.
    const submission = {
      title: SEED_CASE.title,
      slug: SEED_CASE.slug,
      summary: SEED_CASE.summary,
      players: SEED_CASE.players,
      duration: SEED_CASE.duration,
      difficulty: SEED_CASE.difficulty,
      maxStage: SEED_CASE.maxStage,
      solutionSuspect: SEED_CASE.solutionSuspect,
      solutionMotive: SEED_CASE.solutionMotive,
      solutionEvidence: SEED_CASE.solutionEvidence,
      debriefOverview: SEED_CASE.debriefOverview,
      debriefWhatHappened: SEED_CASE.debriefWhatHappened,
      debriefWhyItWorked: SEED_CASE.debriefWhyItWorked,
      debriefClosing: SEED_CASE.debriefClosing,
      debriefSectionTitle: SEED_CASE.debriefSectionTitle,
      debriefIntro: SEED_CASE.debriefIntro,
      isActive: SEED_CASE.isActive,
      people: [
        {
          id: 101,
          globalPersonId: 9001,
          name: "Anya Volkov-Renamed",
          role: SEED_CASE.people[0].role,
          summary: SEED_CASE.people[0].summary,
          unlockStage: SEED_CASE.people[0].unlockStage,
          sortOrder: SEED_CASE.people[0].sortOrder,
        },
        {
          id: 102,
          globalPersonId: 9002,
          name: SEED_CASE.people[1].name,
          role: SEED_CASE.people[1].role,
          summary: SEED_CASE.people[1].summary,
          unlockStage: SEED_CASE.people[1].unlockStage,
          sortOrder: SEED_CASE.people[1].sortOrder,
        },
      ],
      records: [],
      hints: [],
      checkpoints: [],
    };

    const response = await PUT(makePutRequest(submission), { params: params() });

    expect(response.status).toBe(200);

    // Neither row was deleted — identity preserved.
    expect(mocks.casePersonDeleteMany).not.toHaveBeenCalled();

    // Exactly one update — for the renamed person only. The unchanged person
    // had no field deltas, so the route correctly skipped its update entirely.
    expect(mocks.casePersonUpdate).toHaveBeenCalledOnce();
    const updateArgs = mocks.casePersonUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 101 });

    // The protected field MUST NOT appear in the update payload.
    expect(updateArgs.data).not.toHaveProperty("globalPersonId");

    // Only `name` was changed.
    expect(updateArgs.data).toEqual({ name: "Anya Volkov-Renamed" });

    // No new people were created.
    expect(mocks.casePersonCreateMany).not.toHaveBeenCalled();

    // Audit row written exactly once.
    expect(mocks.caseAuditCreate).toHaveBeenCalledOnce();
    const auditArgs = mocks.caseAuditCreate.mock.calls[0][0];
    expect(auditArgs.data.caseFileId).toBe(1);
    expect(auditArgs.data.action).toBe("UPDATE");
    expect(auditArgs.data.diff.people).toEqual({
      created: 0,
      updated: 1,
      deleted: 0,
    });
  });

  it("legacy PUT writes CaseSlugHistory when slug changes", async () => {
    const submission = {
      title: SEED_CASE.title,
      slug: "new-slug",
      summary: SEED_CASE.summary,
      players: SEED_CASE.players,
      duration: SEED_CASE.duration,
      difficulty: SEED_CASE.difficulty,
      maxStage: SEED_CASE.maxStage,
      solutionSuspect: SEED_CASE.solutionSuspect,
      solutionMotive: SEED_CASE.solutionMotive,
      solutionEvidence: SEED_CASE.solutionEvidence,
      debriefOverview: SEED_CASE.debriefOverview,
      debriefWhatHappened: SEED_CASE.debriefWhatHappened,
      debriefWhyItWorked: SEED_CASE.debriefWhyItWorked,
      debriefClosing: SEED_CASE.debriefClosing,
      debriefSectionTitle: SEED_CASE.debriefSectionTitle,
      debriefIntro: SEED_CASE.debriefIntro,
      isActive: SEED_CASE.isActive,
      people: SEED_CASE.people.map((p) => ({
        id: p.id,
        globalPersonId: p.globalPersonId,
        name: p.name,
        role: p.role,
        summary: p.summary,
        unlockStage: p.unlockStage,
        sortOrder: p.sortOrder,
      })),
      records: [],
      hints: [],
      checkpoints: [],
    };

    const response = await PUT(makePutRequest(submission), {
      params: params(),
    });

    expect(response.status).toBe(200);
    expect(mocks.caseSlugHistoryUpsert).toHaveBeenCalledOnce();
    expect(mocks.caseSlugHistoryUpsert.mock.calls[0][0]).toEqual({
      where: { oldSlug: "alder-street-review" },
      update: { caseFileId: 1 },
      create: { caseFileId: 1, oldSlug: "alder-street-review" },
    });
  });

  it("legacy PUT rejects slug that is another case's retired oldSlug", async () => {
    mocks.caseSlugHistoryFindFirst.mockResolvedValue({
      id: 99,
      caseFileId: 2,
      oldSlug: "retired-slug",
    });

    const submission = {
      title: SEED_CASE.title,
      slug: "retired-slug",
      summary: SEED_CASE.summary,
      players: SEED_CASE.players,
      duration: SEED_CASE.duration,
      difficulty: SEED_CASE.difficulty,
      maxStage: SEED_CASE.maxStage,
      solutionSuspect: SEED_CASE.solutionSuspect,
      solutionMotive: SEED_CASE.solutionMotive,
      solutionEvidence: SEED_CASE.solutionEvidence,
      debriefOverview: SEED_CASE.debriefOverview,
      debriefWhatHappened: SEED_CASE.debriefWhatHappened,
      debriefWhyItWorked: SEED_CASE.debriefWhyItWorked,
      debriefClosing: SEED_CASE.debriefClosing,
      debriefSectionTitle: SEED_CASE.debriefSectionTitle,
      debriefIntro: SEED_CASE.debriefIntro,
      isActive: SEED_CASE.isActive,
      people: SEED_CASE.people.map((p) => ({
        id: p.id,
        globalPersonId: p.globalPersonId,
        name: p.name,
        role: p.role,
        summary: p.summary,
        unlockStage: p.unlockStage,
        sortOrder: p.sortOrder,
      })),
      records: [],
      hints: [],
      checkpoints: [],
    };

    const response = await PUT(makePutRequest(submission), {
      params: params(),
    });

    expect(response.status).toBe(409);
    expect(mocks.caseSlugHistoryUpsert).not.toHaveBeenCalled();
  });
});
