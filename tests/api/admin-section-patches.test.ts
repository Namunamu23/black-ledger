/**
 * Integration tests for the per-section PATCH endpoints used by the
 * tabbed admin editor. Strategy: Prisma mock via vi.hoisted + vi.mock,
 * consistent with tests/api/admin-cases.test.ts.
 *
 * Coverage:
 *   - PATCH /people: existing row renamed, globalPersonId never written
 *   - PATCH /people: new row added (no id) without touching existing rows
 *   - PATCH /people: existing id omitted from payload → row deleted
 *   - PATCH /overview: only the submitted column lands in the update
 *   - PATCH /solution: only the submitted column lands in the update
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const caseFileFindUnique = vi.fn();
  const caseFileFindFirst = vi.fn();
  const caseFileUpdate = vi.fn();
  const casePersonUpdate = vi.fn();
  const casePersonDeleteMany = vi.fn();
  const casePersonCreateMany = vi.fn();
  const caseAuditCreate = vi.fn();
  const transactionFn = vi.fn();
  const authFn = vi.fn();
  return {
    caseFileFindUnique,
    caseFileFindFirst,
    caseFileUpdate,
    casePersonUpdate,
    casePersonDeleteMany,
    casePersonCreateMany,
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
    casePerson: {
      update: mocks.casePersonUpdate,
      deleteMany: mocks.casePersonDeleteMany,
      createMany: mocks.casePersonCreateMany,
    },
    caseAudit: { create: mocks.caseAuditCreate },
    $transaction: mocks.transactionFn,
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

import { PATCH as peoplePATCH } from "@/app/api/admin/cases/[caseId]/people/route";
import { PATCH as recordsPATCH } from "@/app/api/admin/cases/[caseId]/records/route";
import { PATCH as hintsPATCH } from "@/app/api/admin/cases/[caseId]/hints/route";
import { PATCH as checkpointsPATCH } from "@/app/api/admin/cases/[caseId]/checkpoints/route";
import { PATCH as overviewPATCH } from "@/app/api/admin/cases/[caseId]/overview/route";
import { PATCH as solutionPATCH } from "@/app/api/admin/cases/[caseId]/solution/route";

const params = () => Promise.resolve({ caseId: "1" });

function makeRequest(path: string, body: unknown) {
  return new Request(`http://localhost/api/admin/cases/1/${path}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const SEED_PEOPLE = [
  {
    id: 101,
    caseFileId: 1,
    globalPersonId: 9001,
    name: "Anya Volkov",
    role: "Suspect",
    summary: "Original summary.",
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
];

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
      (m as { mockReset: () => void }).mockReset();
    }
  });

  mocks.authFn.mockResolvedValue({
    user: { id: "1", role: "ADMIN" },
  });

  mocks.transactionFn.mockImplementation(async (callback: any) => {
    return await callback({
      caseFile: { update: mocks.caseFileUpdate },
      casePerson: {
        update: mocks.casePersonUpdate,
        deleteMany: mocks.casePersonDeleteMany,
        createMany: mocks.casePersonCreateMany,
      },
      caseAudit: { create: mocks.caseAuditCreate },
    });
  });
});

describe("PATCH /api/admin/cases/[caseId]/people", () => {
  it("renaming one person preserves both globalPersonId values and does not delete any row", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      people: SEED_PEOPLE,
    });

    const submission = {
      people: [
        {
          id: 101,
          globalPersonId: 9001,
          name: "Anya Volkov-Renamed",
          role: SEED_PEOPLE[0].role,
          summary: SEED_PEOPLE[0].summary,
          unlockStage: SEED_PEOPLE[0].unlockStage,
          sortOrder: SEED_PEOPLE[0].sortOrder,
        },
        {
          id: 102,
          globalPersonId: 9002,
          name: SEED_PEOPLE[1].name,
          role: SEED_PEOPLE[1].role,
          summary: SEED_PEOPLE[1].summary,
          unlockStage: SEED_PEOPLE[1].unlockStage,
          sortOrder: SEED_PEOPLE[1].sortOrder,
        },
      ],
    };

    const response = await peoplePATCH(makeRequest("people", submission), {
      params: params(),
    });

    expect(response.status).toBe(200);
    expect(mocks.casePersonDeleteMany).not.toHaveBeenCalled();

    expect(mocks.casePersonUpdate).toHaveBeenCalledOnce();
    const updateArgs = mocks.casePersonUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 101 });
    expect(updateArgs.data).not.toHaveProperty("globalPersonId");
    expect(updateArgs.data).toEqual({ name: "Anya Volkov-Renamed" });

    expect(mocks.casePersonCreateMany).not.toHaveBeenCalled();
    expect(mocks.caseAuditCreate).toHaveBeenCalledOnce();
    expect(mocks.caseAuditCreate.mock.calls[0][0].data.action).toBe(
      "UPDATE_PEOPLE"
    );
  });

  it("adding a new person (no id) creates exactly one row and leaves existing rows untouched", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      people: SEED_PEOPLE,
    });

    const submission = {
      people: [
        ...SEED_PEOPLE.map((p) => ({
          id: p.id,
          globalPersonId: p.globalPersonId,
          name: p.name,
          role: p.role,
          summary: p.summary,
          unlockStage: p.unlockStage,
          sortOrder: p.sortOrder,
        })),
        {
          globalPersonId: null,
          name: "Leah Morn",
          role: "Records Clerk",
          summary: "New entry.",
          unlockStage: 3,
          sortOrder: 3,
        },
      ],
    };

    const response = await peoplePATCH(makeRequest("people", submission), {
      params: params(),
    });

    expect(response.status).toBe(200);
    expect(mocks.casePersonDeleteMany).not.toHaveBeenCalled();
    expect(mocks.casePersonUpdate).not.toHaveBeenCalled();

    expect(mocks.casePersonCreateMany).toHaveBeenCalledOnce();
    const createArgs = mocks.casePersonCreateMany.mock.calls[0][0];
    expect(createArgs.data).toHaveLength(1);
    expect(createArgs.data[0]).toMatchObject({
      caseFileId: 1,
      name: "Leah Morn",
      globalPersonId: null,
    });
  });

  it("people PATCH rejects unlockStage > maxStage", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      maxStage: 3,
      people: SEED_PEOPLE,
    });

    const submission = {
      people: [
        {
          globalPersonId: null,
          name: "Out of Range",
          role: "Witness",
          summary: "Submitted with an invalid unlockStage.",
          unlockStage: 5,
          sortOrder: 9,
        },
      ],
    };

    const response = await peoplePATCH(makeRequest("people", submission), {
      params: params(),
    });

    expect(response.status).toBe(422);
    const json = (await response.json()) as { message?: string };
    expect(json.message).toContain("maxStage");

    expect(mocks.casePersonUpdate).not.toHaveBeenCalled();
    expect(mocks.casePersonCreateMany).not.toHaveBeenCalled();
    expect(mocks.casePersonDeleteMany).not.toHaveBeenCalled();
  });

  it("omitting an existing person id from the payload deletes that row", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      people: SEED_PEOPLE,
    });

    const submission = {
      // Only person 101 is present; 102 is omitted → should be deleted.
      people: [
        {
          id: 101,
          globalPersonId: 9001,
          name: SEED_PEOPLE[0].name,
          role: SEED_PEOPLE[0].role,
          summary: SEED_PEOPLE[0].summary,
          unlockStage: SEED_PEOPLE[0].unlockStage,
          sortOrder: SEED_PEOPLE[0].sortOrder,
        },
      ],
    };

    const response = await peoplePATCH(makeRequest("people", submission), {
      params: params(),
    });

    expect(response.status).toBe(200);

    expect(mocks.casePersonDeleteMany).toHaveBeenCalledOnce();
    const deleteArgs = mocks.casePersonDeleteMany.mock.calls[0][0];
    expect(deleteArgs.where).toEqual({ id: { in: [102] } });

    expect(mocks.casePersonUpdate).not.toHaveBeenCalled();
    expect(mocks.casePersonCreateMany).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/cases/[caseId]/overview", () => {
  it("only the submitted column lands in the update payload", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      title: "Old Title",
      slug: "alder-street-review",
    });
    mocks.caseFileFindFirst.mockResolvedValue(null);

    const response = await overviewPATCH(
      makeRequest("overview", { title: "New Title" }),
      { params: params() }
    );

    expect(response.status).toBe(200);
    expect(mocks.caseFileUpdate).toHaveBeenCalledOnce();
    const updateArgs = mocks.caseFileUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 1 });
    expect(Object.keys(updateArgs.data)).toEqual(["title"]);
    expect(updateArgs.data.title).toBe("New Title");

    expect(mocks.caseAuditCreate).toHaveBeenCalledOnce();
    expect(mocks.caseAuditCreate.mock.calls[0][0].data.action).toBe(
      "UPDATE_OVERVIEW"
    );
  });
});

describe("PATCH /api/admin/cases/[caseId]/solution", () => {
  it("only the submitted column lands in the update payload", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({ id: 1 });

    const response = await solutionPATCH(
      makeRequest("solution", {
        solutionSuspect: "Anya Volkov|Mr. Volkov",
      }),
      { params: params() }
    );

    expect(response.status).toBe(200);
    expect(mocks.caseFileUpdate).toHaveBeenCalledOnce();
    const updateArgs = mocks.caseFileUpdate.mock.calls[0][0];
    expect(Object.keys(updateArgs.data)).toEqual(["solutionSuspect"]);
    expect(updateArgs.data.solutionSuspect).toBe("Anya Volkov|Mr. Volkov");

    expect(mocks.caseAuditCreate).toHaveBeenCalledOnce();
    expect(mocks.caseAuditCreate.mock.calls[0][0].data.action).toBe(
      "UPDATE_SOLUTION"
    );
  });
});

describe("PATCH /api/admin/cases/[caseId]/records", () => {
  it("records PATCH rejects unlockStage > maxStage", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      maxStage: 3,
      records: [],
    });

    const submission = {
      records: [
        {
          title: "Out of Range Record",
          category: "Report",
          summary: "Submitted with an invalid unlockStage.",
          body: "Body text.",
          unlockStage: 5,
          sortOrder: 1,
        },
      ],
    };

    const response = await recordsPATCH(makeRequest("records", submission), {
      params: params(),
    });

    expect(response.status).toBe(422);
    const json = (await response.json()) as { message?: string };
    expect(json.message).toContain("maxStage");
  });
});

describe("PATCH /api/admin/cases/[caseId]/hints", () => {
  it("hints PATCH rejects unlockStage > maxStage", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      maxStage: 3,
      hints: [],
    });

    const submission = {
      hints: [
        {
          level: 1,
          title: "Out of Range Hint",
          content: "Submitted with an invalid unlockStage.",
          unlockStage: 5,
          sortOrder: 1,
        },
      ],
    };

    const response = await hintsPATCH(makeRequest("hints", submission), {
      params: params(),
    });

    expect(response.status).toBe(422);
    const json = (await response.json()) as { message?: string };
    expect(json.message).toContain("maxStage");
  });
});

describe("PATCH /api/admin/cases/[caseId]/checkpoints", () => {
  it("checkpoints PATCH rejects stage >= maxStage", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      maxStage: 3,
      checkpoints: [],
    });

    const submission = {
      checkpoints: [
        {
          stage: 3,
          prompt: "Out of range checkpoint?",
          acceptedAnswers: "answer",
          successMessage: "Should never trigger.",
        },
      ],
    };

    const response = await checkpointsPATCH(
      makeRequest("checkpoints", submission),
      { params: params() }
    );

    expect(response.status).toBe(422);
    const json = (await response.json()) as { message?: string };
    expect(json.message).toContain("maxStage");
  });
});
