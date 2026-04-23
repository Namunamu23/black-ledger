/**
 * Integration test for POST /api/cases/[slug]/theory.
 *
 * Strategy choice — Prisma mock via vi.hoisted + vi.mock, NOT in-memory SQLite.
 *
 * Why a mock and not in-memory SQLite:
 *   - The behavior under test is the SOLVED-protection invariant — a logical
 *     decision the route delegates to lib/user-case-state and then writes
 *     back. None of that requires real SQL execution.
 *   - Spinning an in-memory Prisma client would drag in the better-sqlite3
 *     native binding and require running migrations against the in-memory DB
 *     at test setup. That is heavier than the value it adds for verifying a
 *     state-transition contract.
 *   - The pure transition logic is already covered by
 *     tests/lib/user-case-state.test.ts. This file focuses on the route's
 *     wiring: that it reads the current status, asks the transition function
 *     for the next one, and writes that next status (not a recomputed one)
 *     back to the DB inside a single $transaction.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const userCaseFindFirst = vi.fn();
  const userCaseUpdate = vi.fn();
  const theorySubmissionCreate = vi.fn();
  const userCaseEventCreate = vi.fn();
  const transactionFn = vi.fn();
  const authFn = vi.fn();
  return {
    userCaseFindFirst,
    userCaseUpdate,
    theorySubmissionCreate,
    userCaseEventCreate,
    transactionFn,
    authFn,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCase: {
      findFirst: mocks.userCaseFindFirst,
      update: mocks.userCaseUpdate,
    },
    theorySubmission: {
      create: mocks.theorySubmissionCreate,
    },
    userCaseEvent: {
      create: mocks.userCaseEventCreate,
    },
    $transaction: mocks.transactionFn,
  },
}));

vi.mock("@/auth", () => ({
  auth: mocks.authFn,
}));

import { POST } from "@/app/api/cases/[slug]/theory/route";

const SOLUTION = {
  solutionSuspect: "Anya Volkov",
  solutionMotive: "Insurance fraud cover-up",
  solutionEvidence: "Lighter found at the scene",
};

function makeRequest(body: unknown) {
  return new Request(
    "http://localhost/api/cases/alder-street-review/theory",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }
  );
}

const params = () =>
  Promise.resolve({ slug: "alder-street-review" });

describe("POST /api/cases/[slug]/theory — UserCase state transitions", () => {
  beforeEach(() => {
    mocks.userCaseFindFirst.mockReset();
    mocks.userCaseUpdate.mockReset();
    mocks.theorySubmissionCreate.mockReset();
    mocks.transactionFn.mockReset();
    mocks.authFn.mockReset();

    mocks.authFn.mockResolvedValue({
      user: { id: "1", role: "INVESTIGATOR" },
    });

    mocks.transactionFn.mockImplementation(async (callback: any) => {
      return await callback({
        userCase: { update: mocks.userCaseUpdate },
        theorySubmission: { create: mocks.theorySubmissionCreate },
        userCaseEvent: { create: mocks.userCaseEventCreate },
      });
    });
  });

  it("does NOT downgrade status when current status is SOLVED, even on an obviously wrong submission", async () => {
    const originalCompletedAt = new Date("2026-04-01T12:00:00Z");

    mocks.userCaseFindFirst.mockResolvedValue({
      id: 42,
      status: "SOLVED",
      currentStage: 3,
      caseFileId: 7,
      completedAt: originalCompletedAt,
      caseFile: { id: 7, slug: "alder-street-review", maxStage: 3, ...SOLUTION },
    });

    const response = await POST(
      makeRequest({
        suspectName: "Wrong Person",
        motive: "completely unrelated motive that should not score",
        evidenceSummary: "absolutely no evidence at all here",
      }),
      { params: params() }
    );

    expect(response.status).toBe(201);

    expect(mocks.theorySubmissionCreate).toHaveBeenCalledOnce();
    expect(mocks.userCaseUpdate).toHaveBeenCalledOnce();

    const updateArgs = mocks.userCaseUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 42 });
    expect(updateArgs.data.status).toBe("SOLVED");
    expect(updateArgs.data.completedAt).toEqual(originalCompletedAt);
  });

  it("upgrades FINAL_REVIEW to SOLVED on a correct submission and stamps completedAt", async () => {
    mocks.userCaseFindFirst.mockResolvedValue({
      id: 42,
      status: "FINAL_REVIEW",
      currentStage: 3,
      caseFileId: 7,
      completedAt: null,
      caseFile: { id: 7, slug: "alder-street-review", maxStage: 3, ...SOLUTION },
    });

    const response = await POST(
      makeRequest({
        suspectName: "Anya Volkov",
        motive:
          "She committed insurance fraud as a cover-up for the embezzlement",
        evidenceSummary: "The lighter was found at the scene of the fire",
      }),
      { params: params() }
    );

    expect(response.status).toBe(201);

    const updateArgs = mocks.userCaseUpdate.mock.calls[0][0];
    expect(updateArgs.data.status).toBe("SOLVED");
    expect(updateArgs.data.completedAt).toBeInstanceOf(Date);
  });

  it("uses a single $transaction wrapping the submission insert and the userCase update", async () => {
    mocks.userCaseFindFirst.mockResolvedValue({
      id: 42,
      status: "FINAL_REVIEW",
      currentStage: 3,
      caseFileId: 7,
      completedAt: null,
      caseFile: { id: 7, slug: "alder-street-review", maxStage: 3, ...SOLUTION },
    });

    await POST(
      makeRequest({
        suspectName: "Wrong Person",
        motive: "completely unrelated motive text",
        evidenceSummary: "totally unrelated evidence text",
      }),
      { params: params() }
    );

    expect(mocks.transactionFn).toHaveBeenCalledOnce();
    expect(mocks.theorySubmissionCreate).toHaveBeenCalledOnce();
    expect(mocks.userCaseUpdate).toHaveBeenCalledOnce();
  });
});
