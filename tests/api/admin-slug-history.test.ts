/**
 * Integration tests for slug-history behavior across the admin overview
 * PATCH and the bureau case page.
 *
 * Strategy: Prisma mock via vi.hoisted + vi.mock, plus a mock of
 * next/navigation's redirect for the page test (the function throws to
 * mirror Next.js's never-returns semantic).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authFn: vi.fn(),
  redirectFn: vi.fn(),
  notFoundFn: vi.fn(),
  caseFileFindUnique: vi.fn(),
  caseFileFindFirst: vi.fn(),
  caseFileUpdate: vi.fn(),
  caseSlugHistoryFindFirst: vi.fn(),
  caseSlugHistoryFindUnique: vi.fn(),
  caseSlugHistoryUpsert: vi.fn(),
  caseAuditCreate: vi.fn(),
  userCaseFindFirst: vi.fn(),
  transactionFn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    caseFile: {
      findUnique: mocks.caseFileFindUnique,
      findFirst: mocks.caseFileFindFirst,
      update: mocks.caseFileUpdate,
    },
    caseSlugHistory: {
      findFirst: mocks.caseSlugHistoryFindFirst,
      findUnique: mocks.caseSlugHistoryFindUnique,
      upsert: mocks.caseSlugHistoryUpsert,
    },
    caseAudit: { create: mocks.caseAuditCreate },
    userCase: { findFirst: mocks.userCaseFindFirst },
    $transaction: mocks.transactionFn,
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirectFn,
  notFound: mocks.notFoundFn,
}));

import { PATCH as overviewPATCH } from "@/app/api/admin/cases/[caseId]/overview/route";
import BureauCasePage from "@/app/bureau/cases/[slug]/page";

const overviewParams = () => Promise.resolve({ caseId: "1" });

function makeOverviewPatch(body: unknown) {
  return new Request("http://localhost/api/admin/cases/1/overview", {
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

  mocks.transactionFn.mockImplementation(async (callback: any) => {
    return await callback({
      caseFile: { update: mocks.caseFileUpdate },
      caseSlugHistory: { upsert: mocks.caseSlugHistoryUpsert },
      caseAudit: { create: mocks.caseAuditCreate },
    });
  });

  mocks.redirectFn.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  mocks.notFoundFn.mockImplementation(() => {
    throw new Error("NOT_FOUND");
  });
});

describe("PATCH /api/admin/cases/[caseId]/overview — slug history", () => {
  it("writes the previous slug to CaseSlugHistory when slug changes", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      slug: "alder-street-review",
    });
    mocks.caseFileFindFirst.mockResolvedValue(null);
    mocks.caseSlugHistoryFindFirst.mockResolvedValue(null);

    const response = await overviewPATCH(
      makeOverviewPatch({ slug: "alder-street-revisited" }),
      { params: overviewParams() }
    );

    expect(response.status).toBe(200);
    expect(mocks.caseSlugHistoryUpsert).toHaveBeenCalledOnce();
    const args = mocks.caseSlugHistoryUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ oldSlug: "alder-street-review" });
    expect(args.create).toEqual({
      caseFileId: 1,
      oldSlug: "alder-street-review",
    });
    expect(args.update).toEqual({ caseFileId: 1 });
  });

  it("does NOT write a CaseSlugHistory row when the submitted slug equals the current slug", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      slug: "alder-street-review",
    });
    mocks.caseFileFindFirst.mockResolvedValue(null);

    const response = await overviewPATCH(
      makeOverviewPatch({ slug: "alder-street-review" }),
      { params: overviewParams() }
    );

    expect(response.status).toBe(200);
    expect(mocks.caseSlugHistoryUpsert).not.toHaveBeenCalled();
    expect(mocks.caseSlugHistoryFindFirst).not.toHaveBeenCalled();
  });

  it("returns 409 when the new slug is already in another case's history", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 1,
      slug: "alder-street-review",
    });
    mocks.caseFileFindFirst.mockResolvedValue(null);
    mocks.caseSlugHistoryFindFirst.mockResolvedValue({
      id: 99,
      caseFileId: 2,
      oldSlug: "alder-street-revisited",
    });

    const response = await overviewPATCH(
      makeOverviewPatch({ slug: "alder-street-revisited" }),
      { params: overviewParams() }
    );

    expect(response.status).toBe(409);
    expect(mocks.caseFileUpdate).not.toHaveBeenCalled();
    expect(mocks.caseSlugHistoryUpsert).not.toHaveBeenCalled();
  });
});

describe("Bureau case page — slug history redirect", () => {
  it("redirects to the current slug when the requested slug matches a CaseSlugHistory row", async () => {
    mocks.userCaseFindFirst.mockResolvedValue(null);
    mocks.caseSlugHistoryFindUnique.mockResolvedValue({
      id: 99,
      caseFileId: 1,
      oldSlug: "alder-street-review",
      caseFile: { slug: "alder-street-revisited" },
    });

    await expect(
      BureauCasePage({
        params: Promise.resolve({ slug: "alder-street-review" }),
      })
    ).rejects.toThrow("REDIRECT:/bureau/cases/alder-street-revisited");

    expect(mocks.redirectFn).toHaveBeenCalledWith(
      "/bureau/cases/alder-street-revisited"
    );
    expect(mocks.notFoundFn).not.toHaveBeenCalled();
  });
});
