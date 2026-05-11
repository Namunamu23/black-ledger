import { describe, expect, it } from "vitest";
import { caseSerial } from "@/lib/case-serial";

describe("caseSerial", () => {
  it("zero-pads single-digit ids to three digits", () => {
    expect(caseSerial({ id: 1 })).toBe("BL-001");
    expect(caseSerial({ id: 7 })).toBe("BL-007");
    expect(caseSerial({ id: 9 })).toBe("BL-009");
  });

  it("zero-pads two-digit ids to three digits", () => {
    expect(caseSerial({ id: 14 })).toBe("BL-014");
    expect(caseSerial({ id: 99 })).toBe("BL-099");
  });

  it("renders three-digit ids as-is", () => {
    expect(caseSerial({ id: 100 })).toBe("BL-100");
    expect(caseSerial({ id: 999 })).toBe("BL-999");
  });

  it("does not truncate ids beyond three digits", () => {
    expect(caseSerial({ id: 1037 })).toBe("BL-1037");
  });

  it("accepts any object with an id field (structural typing)", () => {
    const caseFile = { id: 42, title: "Test", slug: "test" };
    expect(caseSerial(caseFile)).toBe("BL-042");
  });
});
