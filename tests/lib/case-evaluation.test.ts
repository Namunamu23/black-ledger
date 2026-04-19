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

  it("matches motive by Jaccard threshold even when only one candidate token appears in the submission", () => {
    // Candidate tokens (after filter): {insurance, fraud}
    // Submission tokens (after filter): {insurance}
    // intersection = 1, union = 2, Jaccard = 0.5 ≥ 0.34 → full match.
    // Only one candidate token appears, so the 2-token rule does NOT trigger;
    // this proves the Jaccard branch independently passes.
    const result = evaluateTheorySubmission({
      suspectName: "Anya Volkov",
      motive: "insurance",
      evidenceSummary: "",
      solutionSuspect: "Anya Volkov",
      solutionMotive: "insurance fraud",
      solutionEvidence: "",
    });

    expect(result.motiveCorrect).toBe(true);
    expect(result.motivePartial).toBe(false);
  });

  it("awards motive PARTIAL credit when exactly one candidate keyword appears and Jaccard is below threshold", () => {
    // Candidate tokens: {insurance, fraud, cover, scheme}
    // Submission tokens: {they, wanted, insurance, money}
    // intersection = 1 (insurance), union = 7, Jaccard ≈ 0.143 < 0.34
    // 1 candidate token in submission → not 2-token rule → PARTIAL.
    const result = evaluateTheorySubmission({
      suspectName: "Anya Volkov",
      motive: "they wanted insurance money",
      evidenceSummary: "",
      solutionSuspect: "Anya Volkov",
      solutionMotive: "insurance fraud cover-up scheme",
      solutionEvidence: "",
    });

    expect(result.motiveCorrect).toBe(false);
    expect(result.motivePartial).toBe(true);
  });

  it("matches evidence when at least two candidate keyword tokens appear in the submission", () => {
    // Candidate tokens: {lighter, found, scene}
    // Submission tokens: {found, lighter, near, body}
    // intersection = {found, lighter} → ≥ 2 → full match by the 2-token rule.
    const result = evaluateTheorySubmission({
      suspectName: "Anya Volkov",
      motive: "",
      evidenceSummary: "I found the lighter near the body",
      solutionSuspect: "Anya Volkov",
      solutionMotive: "",
      solutionEvidence: "Lighter found at the scene",
    });

    expect(result.evidenceCorrect).toBe(true);
  });

  it("returns CORRECT and full score on a realistic complete submission", () => {
    const result = evaluateTheorySubmission({
      suspectName: "Anya Volkov",
      motive:
        "She committed insurance fraud as a cover-up for the embezzlement",
      evidenceSummary: "The lighter was found at the scene of the fire",
      solutionSuspect: "Anya Volkov|Mr. Volkov",
      solutionMotive: "Insurance fraud cover-up",
      solutionEvidence: "Lighter found at the scene",
    });

    expect(result.suspectCorrect).toBe(true);
    expect(result.motiveCorrect).toBe(true);
    expect(result.evidenceCorrect).toBe(true);
    expect(result.score).toBe(3);
    expect(result.resultLabel).toBe("CORRECT");
  });
});
