import { describe, it, expect } from "vitest";
import {
  evaluateCaseReadiness,
  type CaseContentForQualityCheck,
} from "@/lib/case-quality";

function makeCase(
  overrides: Partial<CaseContentForQualityCheck> = {}
): CaseContentForQualityCheck {
  return {
    title: "The Alder Street Review",
    slug: "alder-street-review",
    summary: "A short summary of the case.",
    players: "1-4",
    duration: "90-150 min",
    difficulty: "Moderate",
    maxStage: 3,
    solutionSuspect: "Anya Volkov",
    solutionMotive: "Insurance fraud cover-up",
    solutionEvidence: "Lighter found at the scene",
    debriefOverview: "Overview copy.",
    debriefWhatHappened: "What happened copy.",
    debriefWhyItWorked: "Why the theory worked copy.",
    debriefClosing: "Closing copy.",
    people: [{ unlockStage: 1 }, { unlockStage: 2 }],
    records: [{ unlockStage: 1 }],
    hints: [{ unlockStage: 1 }],
    checkpoints: [{ stage: 1 }, { stage: 2 }],
    ...overrides,
  };
}

describe("evaluateCaseReadiness", () => {
  it("reports a fully populated case as ready with no issues", () => {
    const result = evaluateCaseReadiness(makeCase());

    expect(result.isReady).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags missing required string fields", () => {
    const result = evaluateCaseReadiness(
      makeCase({ title: "  ", solutionSuspect: "" })
    );

    expect(result.isReady).toBe(false);
    expect(result.issues).toContain("Missing title.");
    expect(result.issues).toContain("Missing solution suspect.");
  });

  it("flags missing content collections and invalid stage numbers", () => {
    const result = evaluateCaseReadiness(
      makeCase({
        people: [],
        records: [],
        hints: [],
        checkpoints: [{ stage: 5 }],
        maxStage: 3,
      })
    );

    expect(result.isReady).toBe(false);
    expect(result.issues).toContain("No people added.");
    expect(result.issues).toContain("No records added.");
    expect(result.issues).toContain("No hints added.");
    expect(result.issues).toContain(
      "Some checkpoints use a stage equal to or greater than maxStage."
    );
  });

  it("flags unlock stages beyond maxStage", () => {
    const result = evaluateCaseReadiness(
      makeCase({
        maxStage: 2,
        people: [{ unlockStage: 5 }],
        checkpoints: [{ stage: 1 }],
      })
    );

    expect(result.isReady).toBe(false);
    expect(result.issues).toContain(
      "Some unlock stages are greater than maxStage."
    );
  });
});
