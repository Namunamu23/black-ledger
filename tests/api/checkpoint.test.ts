/**
 * Integration test for POST /api/cases/[slug]/checkpoint.
 *
 * Strategy: Prisma mock via vi.hoisted + vi.mock (consistent with
 * tests/api/theory.test.ts and tests/api/admin-cases.test.ts). The behavior
 * under test is the answer-matcher's acceptance/rejection contract — purely
 * a logical decision driven by lib/text-utils.ts utilities. No real SQL
 * required; we observe the route's calls to prisma.userCase.update (the
 * stage-advance write) to assert pass/fail.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const userCaseFindFirst = vi.fn();
  const userCaseUpdateMany = vi.fn();
  const checkpointAttemptCreate = vi.fn();
  const userCaseEventCreate = vi.fn();
  const transactionFn = vi.fn();
  const authFn = vi.fn();
  return {
    userCaseFindFirst,
    userCaseUpdateMany,
    checkpointAttemptCreate,
    userCaseEventCreate,
    transactionFn,
    authFn,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCase: {
      findFirst: mocks.userCaseFindFirst,
      updateMany: mocks.userCaseUpdateMany,
    },
    checkpointAttempt: {
      create: mocks.checkpointAttemptCreate,
    },
    userCaseEvent: {
      create: mocks.userCaseEventCreate,
    },
    $transaction: mocks.transactionFn,
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

import { POST } from "@/app/api/cases/[slug]/checkpoint/route";

const ALDER_USER_CASE = {
  id: 1,
  userId: 1,
  caseFileId: 1,
  currentStage: 1,
  status: "ACTIVE",
  firstOpenedAt: null,
  caseFile: {
    id: 1,
    slug: "alder-street-review",
    maxStage: 3,
    checkpoints: [
      {
        id: 11,
        stage: 1,
        prompt:
          "Which record should you compare next if you want to challenge the official timeline?",
        acceptedAnswers: "badge access log|access log|badge log",
        successMessage: "Stage 2 unlocked.",
      },
    ],
  },
};

function makeRequest(answer: string) {
  return new Request(
    "http://localhost/api/cases/alder-street-review/checkpoint",
    {
      method: "POST",
      body: JSON.stringify({ answer }),
      headers: { "content-type": "application/json" },
    }
  );
}

const params = () => Promise.resolve({ slug: "alder-street-review" });

describe("POST /api/cases/[slug]/checkpoint — strict matcher", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => {
      if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
        (m as { mockReset: () => void }).mockReset();
      }
    });

    mocks.authFn.mockResolvedValue({
      user: { id: "1", role: "INVESTIGATOR" },
    });
    mocks.userCaseFindFirst.mockResolvedValue(ALDER_USER_CASE);
    mocks.userCaseUpdateMany.mockResolvedValue({ count: 1 });

    mocks.transactionFn.mockImplementation(async (callback: any) => {
      return await callback({
        userCase: { updateMany: mocks.userCaseUpdateMany },
        userCaseEvent: { create: mocks.userCaseEventCreate },
        checkpointAttempt: { create: mocks.checkpointAttemptCreate },
      });
    });
  });

  it("exact match passes", async () => {
    const response = await POST(makeRequest("badge access log"), {
      params: params(),
    });

    expect(response.status).toBe(200);
    expect(mocks.userCaseUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.userCaseUpdateMany.mock.calls[0][0].data.currentStage).toBe(2);
  });

  it("case-insensitive match passes", async () => {
    const response = await POST(makeRequest("BADGE ACCESS LOG"), {
      params: params(),
    });

    expect(response.status).toBe(200);
    expect(mocks.userCaseUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.userCaseUpdateMany.mock.calls[0][0].data.currentStage).toBe(2);
  });

  it("submission shorter than 3 normalized chars is rejected", async () => {
    const response = await POST(makeRequest("ab"), { params: params() });

    expect(response.status).toBe(400);
    expect(mocks.userCaseUpdateMany).not.toHaveBeenCalled();
  });

  it("pure substring that is not a real match is rejected", async () => {
    // "log" is 3 chars (passes the normalized-length floor) but does not
    // equal any candidate and tokenizes to an empty set (token min length
    // is 4), so no Jaccard match is possible. The old bidirectional
    // includes() would have wrongly accepted this.
    const response = await POST(makeRequest("log"), { params: params() });

    expect(response.status).toBe(400);
    expect(mocks.userCaseUpdateMany).not.toHaveBeenCalled();
  });

  it("phrasing variation passes via Jaccard", async () => {
    // candidate "badge access log" tokens: {badge, access}  (log < 4 chars)
    // submission "the badge access logs" tokens: {badge, access, logs}
    // intersection 2, union 3, Jaccard ≈ 0.667 ≥ 0.45 → match
    const response = await POST(makeRequest("the badge access logs"), {
      params: params(),
    });

    expect(response.status).toBe(200);
    expect(mocks.userCaseUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.userCaseUpdateMany.mock.calls[0][0].data.currentStage).toBe(2);
  });

  it("returns 409 when a concurrent advance wins the race (ARCH-01)", async () => {
    mocks.userCaseUpdateMany.mockResolvedValue({ count: 0 });

    const response = await POST(makeRequest("badge access log"), {
      params: params(),
    });

    expect(response.status).toBe(409);
  });
});
