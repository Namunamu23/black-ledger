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
  const rateLimitFn = vi.fn();
  return {
    userCaseFindFirst,
    userCaseUpdate,
    theorySubmissionCreate,
    userCaseEventCreate,
    transactionFn,
    authFn,
    rateLimitFn,
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

// Bypass the token-bucket rate limiter in this test file. The route's real
// limit is 10/60s per (ip, route); without this mock, the 11th POST in the
// file hits the limit and the response body becomes the rate-limit error
// shape instead of the sealed-verdict shape. We are testing the verdict
// logic here, not the rate-limit policy — that's covered separately in
// tests/lib/rate-limit.test.ts.
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimitFn,
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
    mocks.rateLimitFn.mockReset();

    mocks.rateLimitFn.mockResolvedValue({ success: true });

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

  it("returns 200 without writing a submission when the case is already SOLVED (A1)", async () => {
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
        evidenceSummary: "absolutely no evidence at all here for this entire case",
      }),
      { params: params() }
    );

    expect(response.status).toBe(200);
    expect(mocks.theorySubmissionCreate).not.toHaveBeenCalled();
    expect(mocks.transactionFn).not.toHaveBeenCalled();
    expect(mocks.userCaseUpdate).not.toHaveBeenCalled();
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
        evidenceSummary:
          "The lighter was found at the scene of the fire near the body",
      }),
      { params: params() }
    );

    expect(response.status).toBe(201);

    const updateArgs = mocks.userCaseUpdate.mock.calls[0][0];
    expect(updateArgs.data.status).toBe("SOLVED");
    expect(updateArgs.data.completedAt).toBeInstanceOf(Date);
  });

  it("returns 410 and writes nothing when the UserCase has been refunded (F-02)", async () => {
    mocks.userCaseFindFirst.mockResolvedValue({
      id: 42,
      status: "FINAL_REVIEW",
      currentStage: 3,
      caseFileId: 7,
      completedAt: null,
      revokedAt: new Date("2026-05-06T10:00:00Z"),
      caseFile: { id: 7, slug: "alder-street-review", maxStage: 3, ...SOLUTION },
    });

    const response = await POST(
      makeRequest({
        suspectName: "Anya Volkov",
        motive: "She committed insurance fraud as a cover-up scheme",
        evidenceSummary:
          "The lighter was found at the scene of the fire near her car",
      }),
      { params: params() }
    );

    expect(response.status).toBe(410);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain("refunded");
    expect(mocks.theorySubmissionCreate).not.toHaveBeenCalled();
    expect(mocks.userCaseUpdate).not.toHaveBeenCalled();
    expect(mocks.transactionFn).not.toHaveBeenCalled();
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
        motive: "completely unrelated motive text that meets minimum length",
        evidenceSummary:
          "totally unrelated evidence text that does not match the case at all",
      }),
      { params: params() }
    );

    expect(mocks.transactionFn).toHaveBeenCalledOnce();
    expect(mocks.theorySubmissionCreate).toHaveBeenCalledOnce();
    expect(mocks.userCaseUpdate).toHaveBeenCalledOnce();
  });
});

/**
 * Sealed publicVerdict regression suite (Batch 13 brute-force defense).
 *
 * Why these tests exist:
 *
 * Pre-Batch-13, the API response on a graded theory submission included
 * per-component diagnostic flags (suspectCorrect / motiveCorrect /
 * evidenceCorrect) plus prose feedback that named which component was right
 * or wrong ("You were correct on suspect, but improve motive."). A player at
 * the final stage could iterate the suspect field with junk motive/evidence
 * text and enumerate the correct suspect in N submissions, where N = number
 * of suspects in the case. This is a brute-force oracle.
 *
 * The Batch 13 fix sealed the response so that:
 *   1. The response body shape is exactly { message, publicVerdict, feedback }
 *      — no per-component flags, no score, no resultLabel.
 *   2. `publicVerdict` is a binary signal — "CASE_CLOSED" or
 *      "REVISION_REQUIRED" — and nothing else (no "PARTIAL", no "CORRECT").
 *   3. `feedback` is non-diagnostic — for any non-CORRECT outcome the same
 *      sealed string is returned regardless of which (if any) components
 *      individually matched. Internal flags are preserved on the database row
 *      for analytics and admin views only.
 *
 * A future refactor that reintroduces any of these leaks would silently
 * reopen the brute-force window and pass CI. These tests are the guardrail.
 *
 * Related closure: Batch 16 commit 98fb771 sealed a regression on
 * /bureau/archive that re-leaked per-component diagnostic prose from stored
 * pre-Batch-13 TheorySubmission rows. The archive-render seal is verified
 * via a source-pattern test at the bottom of this file.
 */
describe("Sealed publicVerdict response (Batch 13 brute-force defense)", () => {
  beforeEach(() => {
    mocks.userCaseFindFirst.mockReset();
    mocks.userCaseUpdate.mockReset();
    mocks.theorySubmissionCreate.mockReset();
    mocks.transactionFn.mockReset();
    mocks.authFn.mockReset();
    mocks.rateLimitFn.mockReset();

    mocks.rateLimitFn.mockResolvedValue({ success: true });

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

    mocks.userCaseFindFirst.mockResolvedValue({
      id: 42,
      status: "FINAL_REVIEW",
      currentStage: 3,
      caseFileId: 7,
      completedAt: null,
      revokedAt: null,
      caseFile: {
        id: 7,
        slug: "alder-street-review",
        maxStage: 3,
        ...SOLUTION,
      },
    });
  });

  it("response body has exactly { message, publicVerdict, feedback } — no diagnostic flags leak", async () => {
    const response = await POST(
      makeRequest({
        suspectName: "Wrong Person",
        motive:
          "completely unrelated motive text that meets the minimum length requirement",
        evidenceSummary:
          "totally unrelated evidence text that does not match the case at all",
      }),
      { params: params() }
    );

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(Object.keys(body).sort()).toEqual([
      "feedback",
      "message",
      "publicVerdict",
    ]);

    // Per-component diagnostic flags are stored on the TheorySubmission row
    // (see route.ts lines 118-122) but must never appear in the API response.
    expect(body).not.toHaveProperty("suspectCorrect");
    expect(body).not.toHaveProperty("motiveCorrect");
    expect(body).not.toHaveProperty("evidenceCorrect");
    expect(body).not.toHaveProperty("motivePartial");
    expect(body).not.toHaveProperty("evidencePartial");
    expect(body).not.toHaveProperty("score");
    expect(body).not.toHaveProperty("resultLabel");
  });

  it("publicVerdict is exactly 'CASE_CLOSED' on a fully correct submission", async () => {
    const response = await POST(
      makeRequest({
        suspectName: "Anya Volkov",
        motive: "She committed insurance fraud as a cover-up scheme",
        evidenceSummary:
          "The lighter was found at the scene of the fire near the body",
      }),
      { params: params() }
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { publicVerdict: string };
    expect(body.publicVerdict).toBe("CASE_CLOSED");
  });

  it("publicVerdict is exactly 'REVISION_REQUIRED' on a fully incorrect submission", async () => {
    const response = await POST(
      makeRequest({
        suspectName: "Wrong Person",
        motive:
          "completely unrelated motive text that meets the minimum length requirement",
        evidenceSummary:
          "totally unrelated evidence text that does not match the case at all",
      }),
      { params: params() }
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { publicVerdict: string };
    expect(body.publicVerdict).toBe("REVISION_REQUIRED");
  });

  it("publicVerdict on a PARTIAL-graded internal result is still 'REVISION_REQUIRED' externally (no 'PARTIAL' leak)", async () => {
    // A suspect-correct submission with a partial motive match grades to
    // internal resultLabel = "PARTIAL". The sealed API must still report
    // "REVISION_REQUIRED" — leaking "PARTIAL" would tell the player their
    // suspect is correct and reopen the brute-force window.
    const response = await POST(
      makeRequest({
        suspectName: "Anya Volkov",
        motive:
          "She acted out of insurance pressure and personal panic that day",
        evidenceSummary:
          "totally unrelated evidence text with zero overlap to the file",
      }),
      { params: params() }
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { publicVerdict: string };
    expect(body.publicVerdict).toBe("REVISION_REQUIRED");
    expect(body.publicVerdict).not.toBe("PARTIAL");
    expect(body.publicVerdict).not.toBe("CORRECT");
    expect(body.publicVerdict).not.toBe("INCORRECT");
  });

  it("feedback string is byte-identical across non-correct submissions with different internal correctness patterns (the brute-force invariant)", async () => {
    // Submission A: suspect correct, motive + evidence wrong.
    const responseA = await POST(
      makeRequest({
        suspectName: "Anya Volkov",
        motive:
          "absolutely no overlap whatsoever with the case at hand right here",
        evidenceSummary:
          "totally unrelated evidence summary with zero token overlap whatsoever",
      }),
      { params: params() }
    );
    const bodyA = (await responseA.json()) as { feedback: string };

    // Re-prime the find mock for the second call.
    mocks.userCaseFindFirst.mockResolvedValue({
      id: 42,
      status: "FINAL_REVIEW",
      currentStage: 3,
      caseFileId: 7,
      completedAt: null,
      revokedAt: null,
      caseFile: {
        id: 7,
        slug: "alder-street-review",
        maxStage: 3,
        ...SOLUTION,
      },
    });

    // Submission B: suspect wrong, motive + evidence wrong (different pattern).
    const responseB = await POST(
      makeRequest({
        suspectName: "Completely Different Person",
        motive:
          "another unrelated motive theory with no shared tokens to the file",
        evidenceSummary:
          "another unrelated evidence summary that bears no resemblance at all",
      }),
      { params: params() }
    );
    const bodyB = (await responseB.json()) as { feedback: string };

    // The brute-force defense: same sealed string regardless of which (if any)
    // per-component flags fired internally. If this assertion fails, the
    // feedback prose is once again branching on internal correctness and the
    // brute-force window is open.
    expect(bodyA.feedback).toBe(bodyB.feedback);
  });

  it("feedback string contains no per-component diagnostic phrasing", async () => {
    const response = await POST(
      makeRequest({
        suspectName: "Wrong Person",
        motive:
          "completely unrelated motive text that meets the minimum length requirement",
        evidenceSummary:
          "totally unrelated evidence text that does not match the case at all",
      }),
      { params: params() }
    );

    const body = (await response.json()) as { feedback: string };

    // The sealed string may MENTION suspect/motive/evidence as part of the
    // generic closure-standard description (e.g. "...a complete chain of
    // suspect, motive, and supporting evidence."). What it must NEVER do is
    // confirm or deny correctness on any specific component. These regexes
    // target the diagnostic phrasings the pre-Batch-13 buildFeedback used.
    expect(body.feedback).not.toMatch(/correct\s+on\s+(?:the\s+)?(suspect|motive|evidence)/i);
    expect(body.feedback).not.toMatch(/(suspect|motive|evidence)\s+(?:is|was)\s+(correct|right|wrong|incorrect)/i);
    expect(body.feedback).not.toMatch(/you\s+(?:got|had|named|identified)\s+the\s+(suspect|motive|evidence)/i);
    expect(body.feedback).not.toMatch(/(?:improve|refine|strengthen|fix|adjust|reconsider)\s+(?:the\s+|your\s+)?(suspect|motive|evidence)/i);
    expect(body.feedback).not.toMatch(/your\s+(suspect|motive|evidence)\s+(?:is|was|needs)/i);
  });

  it("does not write any per-component flag into the API response even when internal evaluation populated them", async () => {
    // A correct submission populates every internal flag to true (see
    // case-evaluation.ts return value). The API response must still strip
    // them. This guards against a future careless `return NextResponse.json(evaluation)`.
    const response = await POST(
      makeRequest({
        suspectName: "Anya Volkov",
        motive: "She committed insurance fraud as a cover-up scheme",
        evidenceSummary:
          "The lighter was found at the scene of the fire near the body",
      }),
      { params: params() }
    );

    const body = await response.json();
    expect(body).not.toHaveProperty("suspectCorrect");
    expect(body).not.toHaveProperty("motiveCorrect");
    expect(body).not.toHaveProperty("evidenceCorrect");
    expect(body).not.toHaveProperty("score");
    expect(body).not.toHaveProperty("resultLabel");
  });
});

/**
 * Bureau Archive sealed-render guard (Batch 16 regression fix).
 *
 * The /bureau/archive page (`app/bureau/archive/page.tsx`) renders past
 * TheorySubmission rows. The Batch 13 brute-force fix sealed the *API*
 * response, but the stored `feedback` column on TheorySubmission still
 * holds the sealed string (and would hold pre-Batch-13 diagnostic prose if
 * any old rows survived a hypothetical schema rollback). The Batch 16 fix
 * (commit 98fb771) ensured the archive page only renders `submission.feedback`
 * when `resultLabel === "CORRECT"` (i.e. when the row was a clean closure
 * and the stored prose is the closure-standard message). For non-correct
 * rows the page renders a hardcoded constant string instead, so no stored
 * prose can leak.
 *
 * This test is a source-pattern guard rather than a render test because the
 * archive page is an async RSC and a full render harness adds more weight
 * than the assertion needs. The invariant we care about — "every reference
 * to `submission.feedback` in the archive page must be inside an
 * isClosed-style conditional" — is a structural property of the source code,
 * not a runtime behaviour. A regression here is a `git diff` worth catching.
 */
describe("/bureau/archive sealed-feedback render guard (Batch 16)", () => {
  it("submission.feedback only appears inside an isClosed-style ternary in the archive page source", async () => {
    const { readFile } = await import("node:fs/promises");
    const archiveSourceUrl = new URL(
      "../../app/bureau/archive/page.tsx",
      import.meta.url
    );
    const source = await readFile(archiveSourceUrl, "utf8");

    const occurrences = [...source.matchAll(/submission\.feedback/g)];

    // If this fails: the seal has been removed entirely. The CORRECT branch
    // also needs to render submission.feedback to surface the closure-
    // standard prose to the player; zero occurrences means the whole render
    // path was deleted by accident.
    expect(occurrences.length).toBeGreaterThan(0);

    for (const match of occurrences) {
      const matchIndex = match.index ?? 0;
      // Inspect the ~250 chars preceding each occurrence for the guard.
      const contextStart = Math.max(0, matchIndex - 250);
      const context = source.slice(contextStart, matchIndex);

      // Accept either the named-boolean shorthand (`isClosed ?`) or the
      // inline comparison (`resultLabel === "CORRECT" ?`). Both express the
      // same seal.
      const hasGuard =
        /isClosed\s*\?/.test(context) ||
        /resultLabel\s*===\s*["']CORRECT["']\s*\?/.test(context);

      expect(
        hasGuard,
        `submission.feedback at offset ${matchIndex} is rendered without a CORRECT-state guard — the Batch 16 seal has regressed`
      ).toBe(true);
    }
  });
});
