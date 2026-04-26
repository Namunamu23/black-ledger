/**
 * Integration test for /bureau/people/[personId].
 *
 * Strategy: Prisma mock via vi.hoisted + vi.mock, consistent with the
 * other Bureau-page tests (see admin-slug-history.test.ts). The behavior
 * under test is the visibility filter applied to PersonAnalystNote rows
 * before they reach the rendered page — observable directly from the
 * `include.analystNotes` argument the route passes to Prisma. No real
 * SQL is needed.
 *
 * The page also conditionally renders the "Internal Notes" panel based
 * on session role. That branch is observable in JSX inspection, but the
 * load-bearing security check is the Prisma `where` clause asserted
 * here — UI-side rendering is defense-in-depth.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authFn: vi.fn(),
  notFoundFn: vi.fn(),
  globalPersonFindUnique: vi.fn(),
  userCaseFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    globalPerson: { findUnique: mocks.globalPersonFindUnique },
    userCase: { findMany: mocks.userCaseFindMany },
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFoundFn,
}));

import BureauPersonProfilePage from "@/app/bureau/people/[personId]/page";

const SEED_PERSON = {
  id: 1,
  bureauId: "BL-PER-0001",
  firstName: "Elena",
  lastName: "Voss",
  fullName: "Elena Voss",
  dateOfBirth: null,
  knownLocation: null,
  gender: null,
  status: "DECEASED",
  personType: "VICTIM",
  classification: "CASE_LINKED",
  riskLevel: "NONE",
  relevanceLevel: "HIGH",
  accessLevel: "INVESTIGATOR",
  sourceReliability: "HIGH",
  confidenceLevel: "HIGH",
  watchlistFlag: "VICTIM FILE",
  profileSummary: "Senior compliance investigator.",
  internalNotes: "ADMIN-ONLY operational note.",
  lastUpdatedLabel: "Recently reviewed",
  createdAt: new Date("2026-04-01T00:00:00Z"),
  updatedAt: new Date("2026-04-20T00:00:00Z"),
  aliases: [],
  behavioralProfile: null,
  digitalTraces: [],
  timelineEvents: [],
  evidenceLinks: [],
  analystNotes: [],
  caseAppearances: [],
  sourceConnections: [],
  targetConnections: [],
};

const params = () => Promise.resolve({ personId: "1" });

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
      (m as { mockReset: () => void }).mockReset();
    }
  });

  mocks.notFoundFn.mockImplementation(() => {
    throw new Error("NOT_FOUND");
  });
  mocks.globalPersonFindUnique.mockResolvedValue(SEED_PERSON);
  mocks.userCaseFindMany.mockResolvedValue([]);
});

describe("/bureau/people/[personId] — analyst-notes visibility filter", () => {
  it("INVESTIGATOR sessions filter analystNotes to non-INTERNAL only", async () => {
    mocks.authFn.mockResolvedValue({
      user: { id: "2", role: "INVESTIGATOR" },
    });

    // Render may throw if our SEED_PERSON shape diverges from the page's
    // JSX; the assertion is on Prisma call args which are recorded before
    // any render runs, so swallow render errors here.
    await BureauPersonProfilePage({ params: params() }).catch(() => {});

    expect(mocks.globalPersonFindUnique).toHaveBeenCalledOnce();
    const args = mocks.globalPersonFindUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: 1 });
    expect(args.include.analystNotes.where).toEqual({
      visibility: { not: "INTERNAL" },
    });
    expect(args.include.analystNotes.orderBy).toEqual({ sortOrder: "asc" });
  });

  it("ADMIN sessions receive analystNotes with no visibility filter", async () => {
    mocks.authFn.mockResolvedValue({
      user: { id: "1", role: "ADMIN" },
    });

    await BureauPersonProfilePage({ params: params() }).catch(() => {});

    expect(mocks.globalPersonFindUnique).toHaveBeenCalledOnce();
    const args = mocks.globalPersonFindUnique.mock.calls[0][0];
    expect(args.include.analystNotes.where).toBeUndefined();
    expect(args.include.analystNotes.orderBy).toEqual({ sortOrder: "asc" });
  });

  it("rejects unauthenticated requests via notFound()", async () => {
    mocks.authFn.mockResolvedValue(null);

    await expect(
      BureauPersonProfilePage({ params: params() })
    ).rejects.toThrow("NOT_FOUND");

    expect(mocks.globalPersonFindUnique).not.toHaveBeenCalled();
  });
});
