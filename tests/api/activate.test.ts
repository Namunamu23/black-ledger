/**
 * Integration tests for POST /api/cases/activate.
 *
 * Strategy: Prisma + auth mock via vi.hoisted + vi.mock, consistent with
 * the other route tests. Resets the in-memory rate-limit bucket between
 * cases so per-IP throttling does not leak across tests.
 *
 * Coverage focus:
 *   SEC-01 regression — a revoked ActivationCode (revokedAt != null) must
 *   be rejected with 410 and must never grant case access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authFn: vi.fn(),
  activationCodeFindUnique: vi.fn(),
  userCaseFindUnique: vi.fn(),
  activationCodeUpdateMany: vi.fn(),
  userCaseCreate: vi.fn(),
  userCaseEventCreate: vi.fn(),
  txFn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activationCode: {
      findUnique: mocks.activationCodeFindUnique,
    },
    userCase: {
      findUnique: mocks.userCaseFindUnique,
    },
    $transaction: mocks.txFn,
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

import { POST } from "@/app/api/cases/activate/route";
import { _resetForTesting as resetRateLimit } from "@/lib/rate-limit";

function makeRequest(body: unknown, ip = "test-ip") {
  return new Request("http://localhost/api/cases/activate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
  });
}

const ACTIVE_CASE = {
  id: 1,
  title: "The Alders Case",
  slug: "the-alders-case",
  isActive: true,
};

const VALID_CODE = {
  id: 10,
  code: "ALDERS-ABCD1234",
  caseFileId: 1,
  claimedByUserId: null,
  claimedAt: null,
  revokedAt: null,
  caseFile: ACTIVE_CASE,
};

const REVOKED_CODE = {
  ...VALID_CODE,
  id: 11,
  code: "ALDERS-REVOKED1",
  revokedAt: new Date("2026-04-20T12:00:00.000Z"),
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
      (m as { mockReset: () => void }).mockReset();
    }
  });

  resetRateLimit();

  mocks.authFn.mockResolvedValue({ user: { id: "5", role: "INVESTIGATOR" } });
});

// ---------------------------------------------------------------------------
// SEC-01 regression
// ---------------------------------------------------------------------------

describe("POST /api/cases/activate — revoked code check (SEC-01)", () => {
  it("returns 410 and grants no access when the code has been revoked", async () => {
    mocks.activationCodeFindUnique.mockResolvedValue(REVOKED_CODE);
    mocks.userCaseFindUnique.mockResolvedValue(null);

    const response = await POST(makeRequest({ code: "ALDERS-REVOKED1" }));

    expect(response.status).toBe(410);
    const json = (await response.json()) as { message: string };
    expect(json.message).toContain("revoked");

    // Critical: the transaction that creates a UserCase must never be reached.
    expect(mocks.txFn).not.toHaveBeenCalled();
  });

  it("returns 410 before the already-claimed check (revoke check runs first)", async () => {
    // Code is both revoked AND already claimed by someone else.
    // The revoke guard should short-circuit before the claim check.
    mocks.activationCodeFindUnique.mockResolvedValue({
      ...REVOKED_CODE,
      claimedByUserId: 99, // different user
    });
    mocks.userCaseFindUnique.mockResolvedValue(null);

    const response = await POST(makeRequest({ code: "ALDERS-REVOKED1" }));

    expect(response.status).toBe(410);
    expect(mocks.txFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Existing happy-path (positive regression guard)
// ---------------------------------------------------------------------------

describe("POST /api/cases/activate — happy path", () => {
  it("returns 201 and calls the transaction for a valid unrevoked code", async () => {
    mocks.activationCodeFindUnique.mockResolvedValue(VALID_CODE);
    mocks.userCaseFindUnique.mockResolvedValue(null); // user does not yet own case

    // Simulate the transaction succeeding.
    mocks.txFn.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      const fakeTx = {
        activationCode: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        userCase: {
          create: vi.fn().mockResolvedValue({ id: 99, userId: 5, caseFileId: 1 }),
        },
        userCaseEvent: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      await cb(fakeTx);
    });

    const response = await POST(makeRequest({ code: "ALDERS-ABCD1234" }));

    expect(response.status).toBe(201);
    const json = (await response.json()) as { message: string; slug: string };
    expect(json.slug).toBe("the-alders-case");
    expect(mocks.txFn).toHaveBeenCalledOnce();
  });

  it("returns 200 (not 201) when the user already owns the case", async () => {
    mocks.activationCodeFindUnique.mockResolvedValue(VALID_CODE);
    mocks.userCaseFindUnique.mockResolvedValue({ id: 77 }); // already owns it

    const response = await POST(makeRequest({ code: "ALDERS-ABCD1234" }));

    expect(response.status).toBe(200);
    expect(mocks.txFn).not.toHaveBeenCalled();
  });

  it("returns 404 for a code that does not exist", async () => {
    mocks.activationCodeFindUnique.mockResolvedValue(null);

    const response = await POST(makeRequest({ code: "ALDERS-NOTFOUND" }));

    expect(response.status).toBe(404);
    expect(mocks.txFn).not.toHaveBeenCalled();
  });

  it("returns 409 when the code has already been claimed by someone else", async () => {
    mocks.activationCodeFindUnique.mockResolvedValue({
      ...VALID_CODE,
      claimedByUserId: 99, // different user
    });
    mocks.userCaseFindUnique.mockResolvedValue(null);

    const response = await POST(makeRequest({ code: "ALDERS-ABCD1234" }));

    expect(response.status).toBe(409);
    expect(mocks.txFn).not.toHaveBeenCalled();
  });
});
