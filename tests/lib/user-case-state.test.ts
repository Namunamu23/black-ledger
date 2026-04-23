import { describe, it, expect } from "vitest";
import {
  transitionUserCase,
  nextUserCaseStatus,
  type UserCaseEvent,
} from "@/lib/user-case-state";

describe("transitionUserCase — NOT_STARTED", () => {
  it("ACTIVATE → ACTIVE", () => {
    expect(transitionUserCase("NOT_STARTED", "ACTIVATE")).toBe("ACTIVE");
  });

  // The remaining 5 events from NOT_STARTED have no defined transition;
  // each must surface as the discriminated error object so wiring bugs
  // (e.g. a checkpoint route firing before activation) cannot silently
  // pass.
  it("CHECKPOINT_PASS → error", () => {
    const r = transitionUserCase("NOT_STARTED", "CHECKPOINT_PASS");
    expect(typeof r === "object" && "error" in r).toBe(true);
  });
  it("CHECKPOINT_FINAL_PASS → error", () => {
    const r = transitionUserCase("NOT_STARTED", "CHECKPOINT_FINAL_PASS");
    expect(typeof r === "object" && "error" in r).toBe(true);
  });
  it("THEORY_INCORRECT → error", () => {
    const r = transitionUserCase("NOT_STARTED", "THEORY_INCORRECT");
    expect(typeof r === "object" && "error" in r).toBe(true);
  });
  it("THEORY_PARTIAL → error", () => {
    const r = transitionUserCase("NOT_STARTED", "THEORY_PARTIAL");
    expect(typeof r === "object" && "error" in r).toBe(true);
  });
  it("THEORY_CORRECT → error", () => {
    const r = transitionUserCase("NOT_STARTED", "THEORY_CORRECT");
    expect(typeof r === "object" && "error" in r).toBe(true);
  });
});

describe("transitionUserCase — ACTIVE", () => {
  it("ACTIVATE → ACTIVE (idempotent)", () => {
    expect(transitionUserCase("ACTIVE", "ACTIVATE")).toBe("ACTIVE");
  });
  it("CHECKPOINT_PASS → ACTIVE", () => {
    expect(transitionUserCase("ACTIVE", "CHECKPOINT_PASS")).toBe("ACTIVE");
  });
  it("CHECKPOINT_FINAL_PASS → FINAL_REVIEW", () => {
    expect(transitionUserCase("ACTIVE", "CHECKPOINT_FINAL_PASS")).toBe(
      "FINAL_REVIEW"
    );
  });
  it("THEORY_INCORRECT → ACTIVE", () => {
    expect(transitionUserCase("ACTIVE", "THEORY_INCORRECT")).toBe("ACTIVE");
  });
  it("THEORY_PARTIAL → FINAL_REVIEW", () => {
    expect(transitionUserCase("ACTIVE", "THEORY_PARTIAL")).toBe("FINAL_REVIEW");
  });
  it("THEORY_CORRECT → SOLVED", () => {
    expect(transitionUserCase("ACTIVE", "THEORY_CORRECT")).toBe("SOLVED");
  });
});

describe("transitionUserCase — FINAL_REVIEW (no regressions)", () => {
  it("ACTIVATE → FINAL_REVIEW", () => {
    expect(transitionUserCase("FINAL_REVIEW", "ACTIVATE")).toBe("FINAL_REVIEW");
  });
  it("CHECKPOINT_PASS → FINAL_REVIEW", () => {
    expect(transitionUserCase("FINAL_REVIEW", "CHECKPOINT_PASS")).toBe(
      "FINAL_REVIEW"
    );
  });
  it("CHECKPOINT_FINAL_PASS → FINAL_REVIEW", () => {
    expect(transitionUserCase("FINAL_REVIEW", "CHECKPOINT_FINAL_PASS")).toBe(
      "FINAL_REVIEW"
    );
  });
  it("THEORY_INCORRECT → FINAL_REVIEW", () => {
    expect(transitionUserCase("FINAL_REVIEW", "THEORY_INCORRECT")).toBe(
      "FINAL_REVIEW"
    );
  });
  it("THEORY_PARTIAL → FINAL_REVIEW", () => {
    expect(transitionUserCase("FINAL_REVIEW", "THEORY_PARTIAL")).toBe(
      "FINAL_REVIEW"
    );
  });
  it("THEORY_CORRECT → SOLVED", () => {
    expect(transitionUserCase("FINAL_REVIEW", "THEORY_CORRECT")).toBe("SOLVED");
  });
});

describe("transitionUserCase — SOLVED is terminal", () => {
  const events: UserCaseEvent[] = [
    "ACTIVATE",
    "CHECKPOINT_PASS",
    "CHECKPOINT_FINAL_PASS",
    "THEORY_INCORRECT",
    "THEORY_PARTIAL",
    "THEORY_CORRECT",
  ];
  for (const ev of events) {
    it(`${ev} → SOLVED`, () => {
      expect(transitionUserCase("SOLVED", ev)).toBe("SOLVED");
    });
  }
});

describe("transitionUserCase — error path", () => {
  it("returns { error } for an unknown event string", () => {
    // Cast to UserCaseEvent so the call type-checks; runtime lookup will
    // miss the TRANSITIONS table and hit the error branch.
    const r = transitionUserCase("ACTIVE", "UNKNOWN" as UserCaseEvent);
    expect(typeof r === "object" && "error" in r).toBe(true);
    if (typeof r === "object") {
      expect(r.error).toContain("ACTIVE");
      expect(r.error).toContain("UNKNOWN");
    }
  });
});

describe("nextUserCaseStatus — deprecated alias", () => {
  it("CORRECT from FINAL_REVIEW → SOLVED", () => {
    expect(nextUserCaseStatus("FINAL_REVIEW", "CORRECT")).toBe("SOLVED");
  });
  it("PARTIAL from ACTIVE → FINAL_REVIEW", () => {
    expect(nextUserCaseStatus("ACTIVE", "PARTIAL")).toBe("FINAL_REVIEW");
  });
  it("INCORRECT from ACTIVE → ACTIVE", () => {
    expect(nextUserCaseStatus("ACTIVE", "INCORRECT")).toBe("ACTIVE");
  });
  it("CORRECT from SOLVED → SOLVED (terminal)", () => {
    expect(nextUserCaseStatus("SOLVED", "CORRECT")).toBe("SOLVED");
  });
  it("INCORRECT from SOLVED → SOLVED (terminal)", () => {
    expect(nextUserCaseStatus("SOLVED", "INCORRECT")).toBe("SOLVED");
  });
});
