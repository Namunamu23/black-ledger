/**
 * Unit tests for the three auth guard helpers.
 *
 * Strategy: vi.mock the underlying `auth` export and the `redirect`
 * function from next/navigation. The redirect mock throws so the
 * never-returns semantic of next/navigation's redirect is faithfully
 * reproduced — callers that reach `redirect()` should never observe
 * code after it.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { UserRole } from "@/lib/enums";

const mocks = vi.hoisted(() => ({
  authFn: vi.fn(),
  redirectFn: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirectFn }));

import {
  requireSession,
  requireAdmin,
  getOptionalSession,
} from "@/lib/auth-helpers";

const ADMIN_SESSION: Session = {
  user: {
    id: "1",
    email: "admin@blackledger.com",
    name: "Admin",
    role: UserRole.ADMIN,
  },
  expires: "2027-01-01T00:00:00.000Z",
};

const INVESTIGATOR_SESSION: Session = {
  user: {
    id: "2",
    email: "test@blackledger.com",
    name: "Investigator",
    role: UserRole.INVESTIGATOR,
  },
  expires: "2027-01-01T00:00:00.000Z",
};

beforeEach(() => {
  mocks.authFn.mockReset();
  mocks.redirectFn.mockReset();
  // Mirror next/navigation's never-returns semantic by throwing.
  mocks.redirectFn.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

describe("requireSession", () => {
  it("redirects to /login when there is no session", async () => {
    mocks.authFn.mockResolvedValue(null);

    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.redirectFn).toHaveBeenCalledWith("/login");
  });

  it("returns the session when authenticated", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);

    const result = await requireSession();
    expect(result).toBe(INVESTIGATOR_SESSION);
    expect(mocks.redirectFn).not.toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  it("returns a 403 NextResponse when there is no session", async () => {
    mocks.authFn.mockResolvedValue(null);

    const result = await requireAdmin();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns a 403 NextResponse when the session is INVESTIGATOR", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);

    const result = await requireAdmin();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns the session when role is ADMIN", async () => {
    mocks.authFn.mockResolvedValue(ADMIN_SESSION);

    const result = await requireAdmin();
    expect(result).toBe(ADMIN_SESSION);
  });
});

describe("getOptionalSession", () => {
  it("returns null when there is no session", async () => {
    mocks.authFn.mockResolvedValue(null);

    const result = await getOptionalSession();
    expect(result).toBeNull();
  });

  it("returns the session when authenticated", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);

    const result = await getOptionalSession();
    expect(result).toBe(INVESTIGATOR_SESSION);
  });
});
