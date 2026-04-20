/**
 * Integration tests for the activation-codes admin endpoints.
 * Strategy: Prisma mock via vi.hoisted + vi.mock, consistent with the
 * other route tests. Resets the in-memory rate-limit bucket between
 * cases so per-IP throttling does not leak across tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const caseFileFindUnique = vi.fn();
  const activationCodeFindMany = vi.fn();
  const activationCodeFindUnique = vi.fn();
  const activationCodeCreateMany = vi.fn();
  const activationCodeUpdate = vi.fn();
  const authFn = vi.fn();
  return {
    caseFileFindUnique,
    activationCodeFindMany,
    activationCodeFindUnique,
    activationCodeCreateMany,
    activationCodeUpdate,
    authFn,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    caseFile: { findUnique: mocks.caseFileFindUnique },
    activationCode: {
      findMany: mocks.activationCodeFindMany,
      findUnique: mocks.activationCodeFindUnique,
      createMany: mocks.activationCodeCreateMany,
      update: mocks.activationCodeUpdate,
    },
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

import { POST as codesPOST } from "@/app/api/admin/cases/[caseId]/codes/route";
import { PATCH as codePATCH } from "@/app/api/admin/cases/[caseId]/codes/[codeId]/route";
import { _resetForTesting as resetRateLimit } from "@/lib/rate-limit";

const params = () => Promise.resolve({ caseId: "1" });
const codeParams = (codeId: string) =>
  Promise.resolve({ caseId: "1", codeId });

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/admin/cases/1/codes", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "test-ip",
    },
  });
}

function makePatchRequest(codeId: number, body: unknown) {
  return new Request(`http://localhost/api/admin/cases/1/codes/${codeId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
      (m as { mockReset: () => void }).mockReset();
    }
  });

  mocks.authFn.mockResolvedValue({
    user: { id: "1", role: "ADMIN" },
  });

  resetRateLimit();
});

describe("POST /api/admin/cases/[caseId]/codes — batch generate", () => {
  it("generates the requested number of codes", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      slug: "alder-street-review",
    });
    mocks.activationCodeFindMany.mockResolvedValue([]); // no collisions
    mocks.activationCodeCreateMany.mockResolvedValue({ count: 5 });

    const response = await codesPOST(
      makePostRequest({ count: 5, kitSerialPrefix: "ALDER-" }),
      { params: params() }
    );

    expect(response.status).toBe(201);
    const json = (await response.json()) as { codes: string[] };
    expect(json.codes).toHaveLength(5);
    json.codes.forEach((code) => {
      expect(code.startsWith("ALDER-")).toBe(true);
    });

    expect(mocks.activationCodeCreateMany).toHaveBeenCalledOnce();
    const createArgs = mocks.activationCodeCreateMany.mock.calls[0][0];
    expect(createArgs.data).toHaveLength(5);
    createArgs.data.forEach((row: { caseFileId: number; kitSerial: string }) => {
      expect(row.caseFileId).toBe(1);
      expect(row.kitSerial).toBe("ALDER-");
    });
  });

  it("rejects count > 100 with 422", async () => {
    const response = await codesPOST(makePostRequest({ count: 101 }), {
      params: params(),
    });

    expect(response.status).toBe(422);
    expect(mocks.activationCodeCreateMany).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/cases/[caseId]/codes/[codeId] — revoke", () => {
  it("revokes a code (revokedAt is set on the row)", async () => {
    mocks.activationCodeFindUnique.mockResolvedValue({
      id: 42,
      caseFileId: 1,
      code: "ALDER-ABCD1234",
      revokedAt: null,
    });
    mocks.activationCodeUpdate.mockResolvedValue({ id: 42, revokedAt: new Date() });

    const ts = new Date("2026-04-20T03:00:00.000Z").toISOString();
    const response = await codePATCH(makePatchRequest(42, { revokedAt: ts }), {
      params: codeParams("42"),
    });

    expect(response.status).toBe(200);
    expect(mocks.activationCodeUpdate).toHaveBeenCalledOnce();
    const updateArgs = mocks.activationCodeUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 42 });
    expect(updateArgs.data.revokedAt).toBeInstanceOf(Date);
  });

  it("returns 409 when the code is already revoked", async () => {
    mocks.activationCodeFindUnique.mockResolvedValue({
      id: 42,
      caseFileId: 1,
      code: "ALDER-ABCD1234",
      revokedAt: new Date("2026-04-19T00:00:00.000Z"),
    });

    const response = await codePATCH(
      makePatchRequest(42, { revokedAt: new Date().toISOString() }),
      { params: codeParams("42") }
    );

    expect(response.status).toBe(409);
    expect(mocks.activationCodeUpdate).not.toHaveBeenCalled();
  });
});
