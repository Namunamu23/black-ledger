/**
 * Integration test for PATCH /api/admin/cases/[caseId]/workflow.
 *
 * Strategy: Prisma mock via vi.hoisted + vi.mock (consistent with the
 * other route tests). Validates the transition contract and the
 * requireAdmin gate; no real SQL is needed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const caseFileFindUnique = vi.fn();
  const caseFileUpdate = vi.fn();
  const authFn = vi.fn();
  return { caseFileFindUnique, caseFileUpdate, authFn };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    caseFile: {
      findUnique: mocks.caseFileFindUnique,
      update: mocks.caseFileUpdate,
    },
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

import { PATCH } from "@/app/api/admin/cases/[caseId]/workflow/route";

const params = () => Promise.resolve({ caseId: "1" });

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/admin/cases/1/workflow", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const BASE_CASE = {
  id: 1,
  slug: "alder-street-review",
  title: "The Alder Street Review",
  workflowStatus: "DRAFT",
  publishedAt: null,
};

describe("PATCH /api/admin/cases/[caseId]/workflow", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => {
      if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
        (m as { mockReset: () => void }).mockReset();
      }
    });

    mocks.authFn.mockResolvedValue({
      user: { id: "1", role: "ADMIN" },
    });
  });

  it("DRAFT → IN_REVIEW succeeds", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      ...BASE_CASE,
      workflowStatus: "DRAFT",
    });
    mocks.caseFileUpdate.mockResolvedValue({
      ...BASE_CASE,
      workflowStatus: "IN_REVIEW",
    });

    const response = await PATCH(makeRequest({ workflowStatus: "IN_REVIEW" }), {
      params: params(),
    });

    expect(response.status).toBe(200);
    expect(mocks.caseFileUpdate).toHaveBeenCalledOnce();
    const updateArgs = mocks.caseFileUpdate.mock.calls[0][0];
    expect(updateArgs.data.workflowStatus).toBe("IN_REVIEW");
    expect(updateArgs.data.publishedAt).toBeNull();
  });

  it("IN_REVIEW → PUBLISHED succeeds and stamps publishedAt", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      ...BASE_CASE,
      workflowStatus: "IN_REVIEW",
    });
    mocks.caseFileUpdate.mockResolvedValue({
      ...BASE_CASE,
      workflowStatus: "PUBLISHED",
      publishedAt: new Date(),
    });

    const response = await PATCH(makeRequest({ workflowStatus: "PUBLISHED" }), {
      params: params(),
    });

    expect(response.status).toBe(200);
    const updateArgs = mocks.caseFileUpdate.mock.calls[0][0];
    expect(updateArgs.data.workflowStatus).toBe("PUBLISHED");
    expect(updateArgs.data.publishedAt).toBeInstanceOf(Date);
  });

  it("invalid skip transition DRAFT → PUBLISHED returns 422", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      ...BASE_CASE,
      workflowStatus: "DRAFT",
    });

    const response = await PATCH(makeRequest({ workflowStatus: "PUBLISHED" }), {
      params: params(),
    });

    expect(response.status).toBe(422);
    expect(mocks.caseFileUpdate).not.toHaveBeenCalled();
  });

  it("non-admin caller gets 403", async () => {
    mocks.authFn.mockResolvedValue({
      user: { id: "2", role: "INVESTIGATOR" },
    });

    const response = await PATCH(makeRequest({ workflowStatus: "IN_REVIEW" }), {
      params: params(),
    });

    expect(response.status).toBe(403);
    expect(mocks.caseFileFindUnique).not.toHaveBeenCalled();
    expect(mocks.caseFileUpdate).not.toHaveBeenCalled();
  });
});
