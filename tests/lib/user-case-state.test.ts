import { describe, it, expect } from "vitest";
import { nextUserCaseStatus } from "@/lib/user-case-state";

describe("nextUserCaseStatus", () => {
  describe("upward transitions", () => {
    it("NOT_STARTED → ACTIVE on an INCORRECT submission", () => {
      expect(nextUserCaseStatus("NOT_STARTED", "INCORRECT")).toBe("ACTIVE");
    });

    it("ACTIVE → FINAL_REVIEW on a PARTIAL submission", () => {
      expect(nextUserCaseStatus("ACTIVE", "PARTIAL")).toBe("FINAL_REVIEW");
    });

    it("FINAL_REVIEW → SOLVED on a CORRECT submission", () => {
      expect(nextUserCaseStatus("FINAL_REVIEW", "CORRECT")).toBe("SOLVED");
    });
  });

  describe("monotonicity — never moves down", () => {
    it("FINAL_REVIEW stays at FINAL_REVIEW on an INCORRECT submission", () => {
      expect(nextUserCaseStatus("FINAL_REVIEW", "INCORRECT")).toBe(
        "FINAL_REVIEW"
      );
    });

    it("FINAL_REVIEW stays at FINAL_REVIEW on a PARTIAL submission", () => {
      expect(nextUserCaseStatus("FINAL_REVIEW", "PARTIAL")).toBe(
        "FINAL_REVIEW"
      );
    });

    it("ACTIVE stays at ACTIVE on an INCORRECT submission", () => {
      expect(nextUserCaseStatus("ACTIVE", "INCORRECT")).toBe("ACTIVE");
    });
  });

  describe("SOLVED is terminal — the protection invariant", () => {
    it("SOLVED → SOLVED on a CORRECT submission", () => {
      expect(nextUserCaseStatus("SOLVED", "CORRECT")).toBe("SOLVED");
    });

    it("SOLVED → SOLVED on a PARTIAL submission", () => {
      expect(nextUserCaseStatus("SOLVED", "PARTIAL")).toBe("SOLVED");
    });

    it("SOLVED → SOLVED on an INCORRECT submission", () => {
      expect(nextUserCaseStatus("SOLVED", "INCORRECT")).toBe("SOLVED");
    });
  });
});
