/**
 * Regression tests for Batch 10 — auth pages redirect already-signed-in
 * users away from their forms via redirectIfAuthenticated().
 *
 * Architecture under test
 * ─────────────────────────────────────────────────────────────────────────
 *  app/login/page.tsx           — redirects to pickPostLoginPath(callbackUrl)
 *  app/register/page.tsx        — redirects to pickPostLoginPath(callbackUrl)
 *  app/forgot-password/page.tsx — redirects to /bureau (no callbackUrl)
 *  app/reset-password/page.tsx  — redirects to /bureau (token NOT preserved)
 *  lib/auth-helpers.ts          — redirectIfAuthenticated(callbackUrl?)
 *
 * Strategy mirrors tests/routes/unlock-flow.test.ts:
 *  - vi.hoisted + vi.mock for `@/auth` and `next/navigation`
 *  - redirect mock throws "REDIRECT:<url>" to faithfully reproduce
 *    the never-returns semantic of next/navigation's redirect
 *  - Pages are imported as async server components and called directly
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Session } from "next-auth";
import { UserRole } from "@/lib/enums";

const mocks = vi.hoisted(() => ({
  authFn: vi.fn(),
  redirectFn: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirectFn }));

const INVESTIGATOR_SESSION: Session = {
  user: { id: "7", email: "inv@test.com", name: "Inv", role: UserRole.INVESTIGATOR },
  expires: "2027-01-01T00:00:00.000Z",
};

beforeEach(() => {
  mocks.authFn.mockReset();
  mocks.redirectFn.mockReset();
  mocks.redirectFn.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

// ─── /login ───────────────────────────────────────────────────────────────

describe("LoginPage redirect-if-authenticated", () => {
  it("redirects signed-in users to /bureau when no callbackUrl is provided", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);
    const { default: LoginPage } = await import("@/app/login/page");

    await expect(
      LoginPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("REDIRECT:/bureau");
    expect(mocks.redirectFn).toHaveBeenCalledWith("/bureau");
  });

  it("honors a sanitized same-origin callbackUrl when signed in", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);
    const { default: LoginPage } = await import("@/app/login/page");

    await expect(
      LoginPage({
        searchParams: Promise.resolve({ callbackUrl: "/bureau/unlock?code=ABC" }),
      })
    ).rejects.toThrow("REDIRECT:/bureau/unlock?code=ABC");
    expect(mocks.redirectFn).toHaveBeenCalledWith("/bureau/unlock?code=ABC");
  });

  it("rejects an off-origin callbackUrl and falls back to /bureau", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);
    const { default: LoginPage } = await import("@/app/login/page");

    await expect(
      LoginPage({
        searchParams: Promise.resolve({ callbackUrl: "https://evil.com/steal" }),
      })
    ).rejects.toThrow("REDIRECT:/bureau");
    expect(mocks.redirectFn).toHaveBeenCalledWith("/bureau");
  });

  it("renders normally for anonymous visitors", async () => {
    mocks.authFn.mockResolvedValue(null);
    const { default: LoginPage } = await import("@/app/login/page");

    const result = await LoginPage({ searchParams: Promise.resolve({}) });
    expect(mocks.redirectFn).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

// ─── /register ────────────────────────────────────────────────────────────

describe("RegisterPage redirect-if-authenticated", () => {
  it("redirects signed-in users to /bureau when no callbackUrl is provided", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);
    const { default: RegisterPage } = await import("@/app/register/page");

    await expect(
      RegisterPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("REDIRECT:/bureau");
  });

  it("renders normally for anonymous visitors", async () => {
    mocks.authFn.mockResolvedValue(null);
    const { default: RegisterPage } = await import("@/app/register/page");

    const result = await RegisterPage({ searchParams: Promise.resolve({}) });
    expect(mocks.redirectFn).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

// ─── /forgot-password ─────────────────────────────────────────────────────

describe("ForgotPasswordPage redirect-if-authenticated", () => {
  it("redirects signed-in users to /bureau (no callbackUrl support)", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);
    const { default: ForgotPasswordPage } = await import(
      "@/app/forgot-password/page"
    );

    await expect(ForgotPasswordPage()).rejects.toThrow("REDIRECT:/bureau");
  });

  it("renders normally for anonymous visitors", async () => {
    mocks.authFn.mockResolvedValue(null);
    const { default: ForgotPasswordPage } = await import(
      "@/app/forgot-password/page"
    );

    const result = await ForgotPasswordPage();
    expect(mocks.redirectFn).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

// ─── /reset-password ──────────────────────────────────────────────────────

describe("ResetPasswordPage redirect-if-authenticated", () => {
  // The reset token in ?token= is intentionally NOT preserved through the
  // redirect — a signed-in user clicking a reset email link is in an unusual
  // state, and dropping them at /bureau is safer than walking them through a
  // reset flow they don't need. They can sign out manually if they want to
  // use the token.
  it("redirects signed-in users to /bureau (token NOT preserved)", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);
    const { default: ResetPasswordPage } = await import(
      "@/app/reset-password/page"
    );

    await expect(ResetPasswordPage()).rejects.toThrow("REDIRECT:/bureau");
  });

  it("renders normally for anonymous visitors", async () => {
    mocks.authFn.mockResolvedValue(null);
    const { default: ResetPasswordPage } = await import(
      "@/app/reset-password/page"
    );

    const result = await ResetPasswordPage();
    expect(mocks.redirectFn).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
