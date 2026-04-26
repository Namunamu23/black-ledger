/**
 * Integration test for POST /api/access-codes/redeem.
 *
 * Strategy: Prisma + auth mock via vi.hoisted + vi.mock, consistent with
 * the other route tests. Resets the in-memory rate-limit bucket between
 * cases so per-IP throttling does not leak across tests.
 *
 * Coverage focus is the ownership check: pre-fix the route only checked
 * ownership inside the `requiresStage !== null` branch, so codes with a
 * null requiresStage could be redeemed by any signed-in user, including
 * non-owners. Post-fix, ownership is checked unconditionally before any
 * unlock content is resolved or any redemption row is created.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authFn: vi.fn(),
  accessCodeFindUnique: vi.fn(),
  userCaseFindFirst: vi.fn(),
  redemptionFindFirst: vi.fn(),
  redemptionCreate: vi.fn(),
  caseRecordFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accessCode: { findUnique: mocks.accessCodeFindUnique },
    userCase: { findFirst: mocks.userCaseFindFirst },
    accessCodeRedemption: {
      findFirst: mocks.redemptionFindFirst,
      create: mocks.redemptionCreate,
    },
    caseRecord: { findUnique: mocks.caseRecordFindUnique },
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

import { POST } from "@/app/api/access-codes/redeem/route";
import { _resetForTesting as resetRateLimit } from "@/lib/rate-limit";

function makeRequest(body: unknown, ip: string) {
  return new Request("http://localhost/api/access-codes/redeem", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
  });
}

const NULL_STAGE_CODE = {
  id: 100,
  code: "ALDER-A1B2C3D4",
  kind: "ARTIFACT_QR",
  caseFileId: 7,
  unlocksTarget: { type: "record", id: 42 },
  requiresStage: null,
  oneTimePerUser: false,
  retiredAt: null,
};

const STAGE_GATED_CODE = {
  ...NULL_STAGE_CODE,
  id: 101,
  code: "ALDER-S2B3C4D5",
  requiresStage: 2,
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
      (m as { mockReset: () => void }).mockReset();
    }
  });

  resetRateLimit();

  // Default — investigator session. Individual tests override or null
  // this when they need to test the unauthenticated path.
  mocks.authFn.mockResolvedValue({
    user: { id: "5", role: "INVESTIGATOR" },
  });
});

describe("POST /api/access-codes/redeem — ownership check is unconditional", () => {
  it("rejects non-owners with 403 even when the code has no requiresStage gate (P1-4 regression)", async () => {
    mocks.accessCodeFindUnique.mockResolvedValue(NULL_STAGE_CODE);
    mocks.userCaseFindFirst.mockResolvedValue(null); // non-owner

    const response = await POST(
      makeRequest({ code: "ALDER-A1B2C3D4" }, "non-owner-ip-1")
    );

    expect(response.status).toBe(403);
    const json = (await response.json()) as { message: string };
    expect(json.message).toContain("activated");

    // Critical: no redemption row created, no content resolved.
    expect(mocks.redemptionCreate).not.toHaveBeenCalled();
    expect(mocks.caseRecordFindUnique).not.toHaveBeenCalled();
  });

  it("rejects non-owners with 403 when the code IS stage-gated (existing behavior preserved)", async () => {
    mocks.accessCodeFindUnique.mockResolvedValue(STAGE_GATED_CODE);
    mocks.userCaseFindFirst.mockResolvedValue(null); // non-owner

    const response = await POST(
      makeRequest({ code: "ALDER-S2B3C4D5" }, "non-owner-ip-2")
    );

    expect(response.status).toBe(403);
    expect(mocks.redemptionCreate).not.toHaveBeenCalled();
    expect(mocks.caseRecordFindUnique).not.toHaveBeenCalled();
  });

  it("rejects owners whose currentStage is below requiresStage with 403", async () => {
    mocks.accessCodeFindUnique.mockResolvedValue(STAGE_GATED_CODE);
    mocks.userCaseFindFirst.mockResolvedValue({
      id: 999,
      currentStage: 1, // below requiresStage = 2
    });

    const response = await POST(
      makeRequest({ code: "ALDER-S2B3C4D5" }, "below-stage-ip")
    );

    expect(response.status).toBe(403);
    const json = (await response.json()) as { message: string };
    expect(json.message).toContain("required stage");
    expect(mocks.redemptionCreate).not.toHaveBeenCalled();
  });

  it("redeems successfully for an owner when the code has no requiresStage gate (positive case)", async () => {
    mocks.accessCodeFindUnique.mockResolvedValue(NULL_STAGE_CODE);
    mocks.userCaseFindFirst.mockResolvedValue({
      id: 555,
      currentStage: 1,
    });
    mocks.redemptionCreate.mockResolvedValue({ id: 1 });
    mocks.caseRecordFindUnique.mockResolvedValue({
      id: 42,
      title: "Badge Access Log",
      body: "Access record body content.",
    });

    const response = await POST(
      makeRequest({ code: "ALDER-A1B2C3D4" }, "owner-ip-1")
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      alreadyRedeemed: boolean;
      content: { type: string };
    };
    expect(json.alreadyRedeemed).toBe(false);
    expect(json.content.type).toBe("record");

    expect(mocks.redemptionCreate).toHaveBeenCalledOnce();
    const createArgs = mocks.redemptionCreate.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      accessCodeId: 100,
      userId: 5,
      caseFileId: 7,
    });
  });

  it("rejects unauthenticated requests with 401 before any DB lookup", async () => {
    mocks.authFn.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ code: "ALDER-A1B2C3D4" }, "anon-ip")
    );

    expect(response.status).toBe(401);
    expect(mocks.accessCodeFindUnique).not.toHaveBeenCalled();
    expect(mocks.userCaseFindFirst).not.toHaveBeenCalled();
  });
});
