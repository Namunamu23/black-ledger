import { describe, it, expect } from "vitest";
import { evaluateTheorySubmission } from "@/lib/case-evaluation";

const baseSolution = {
  solutionMotive: "Insurance fraud cover-up",
  solutionEvidence: "Lighter found at the scene",
};

describe("evaluateTheorySubmission — substring matcher hardening", () => {
  it("does NOT mark suspect correct when player submits a single first name that is merely a substring of the full name", () => {
    const result = evaluateTheorySubmission({
      suspectName: "anya",
      motive: "",
      evidenceSummary: "",
      solutionSuspect: "Anya Volkov",
      ...baseSolution,
    });

    expect(result.suspectCorrect).toBe(false);
  });

  it("DOES mark suspect correct when player submits a registered alias verbatim", () => {
    const result = evaluateTheorySubmission({
      suspectName: "Mr. Volkov",
      motive: baseSolution.solutionMotive,
      evidenceSummary: baseSolution.solutionEvidence,
      solutionSuspect: "Anya Volkov|Mr. Volkov",
      ...baseSolution,
    });

    expect(result.suspectCorrect).toBe(true);
  });

  it("does NOT match anything when the submission is empty, regardless of candidate text", () => {
    const result = evaluateTheorySubmission({
      suspectName: "",
      motive: "",
      evidenceSummary: "",
      solutionSuspect: "Anya Volkov",
      ...baseSolution,
    });

    expect(result.suspectCorrect).toBe(false);
    expect(result.motiveCorrect).toBe(false);
    expect(result.evidenceCorrect).toBe(false);
  });

  it("does NOT allow a 2-character submission to match anything (min length guard)", () => {
    const result = evaluateTheorySubmission({
      suspectName: "an",
      motive: "in",
      evidenceSummary: "li",
      solutionSuspect: "Anya Volkov",
      ...baseSolution,
    });

    expect(result.suspectCorrect).toBe(false);
    expect(result.motiveCorrect).toBe(false);
    expect(result.evidenceCorrect).toBe(false);
  });
});
