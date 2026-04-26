/**
 * Regression tests for the QR / AccessCode unlock flow.
 *
 * Architecture under test
 * ─────────────────────────────────────────────────────────────────────────
 *  app/u/[code]/route.ts          — short-URL redirect to /bureau/unlock
 *  app/(unlock)/bureau/unlock/    — public page, outside bureau layout
 *  app/bureau/layout.tsx          — requireSession() for all real bureau pages
 *  app/bureau/admin/layout.tsx    — requireSession() + ADMIN role check
 *
 * What these tests lock down (P1-9 regression suite)
 * ─────────────────────────────────────────────────────────────────────────
 *  1. /u/:code redirects to /bureau/unlock?code=:code
 *  2. Logged-out /bureau/unlock renders a sign-in card (no redirect, code preserved in href)
 *  3. callbackUrl produced by the unlock page survives pickPostLoginPath (open-redirect guard)
 *  4. Logged-out requests to real bureau pages (/, /cases, /archive, /database)
 *     redirect to /login — bureau layout's requireSession() still fires
 *  5. Logged-in /bureau/unlock renders the UnlockForm (no redirect, no sign-in card)
 *  6. Admin layout redirects to /bureau for non-admin authenticated users
 *
 * Strategy
 * ─────────────────────────────────────────────────────────────────────────
 *  - vi.hoisted + vi.mock for `@/auth` and `next/navigation`
 *  - redirect mock throws "REDIRECT:<url>" to faithfully reproduce
 *    the never-returns semantic of next/navigation's redirect
 *  - Server components are imported directly and called as async functions
 *  - No jsdom / React renderer needed; we assert on return values and
 *    thrown REDIRECT errors, not rendered HTML
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { UserRole } from "@/lib/enums";

// ─── shared mock state ────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  authFn: vi.fn(),
  redirectFn: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirectFn }));

// ─── fixtures ─────────────────────────────────────────────────────────────

const INVESTIGATOR_SESSION: Session = {
  user: { id: "7", email: "inv@test.com", name: "Inv", role: UserRole.INVESTIGATOR },
  expires: "2027-01-01T00:00:00.000Z",
};

const ADMIN_SESSION: Session = {
  user: { id: "1", email: "admin@test.com", name: "Admin", role: UserRole.ADMIN },
  expires: "2027-01-01T00:00:00.000Z",
};

beforeEach(() => {
  mocks.authFn.mockReset();
  mocks.redirectFn.mockReset();
  // Mirror next/navigation's never-returns semantic: throw so callers that
  // reach redirect() never observe the code after it.
  mocks.redirectFn.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

/**
 * React JSX elements contain circular module references (component types
 * close back onto their own module's default export). JSON.stringify throws
 * on these. This replacer silently drops already-visited objects so string
 * prop values (href, title, text, etc.) are still extracted for assertions.
 */
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) return undefined;
      seen.add(val);
    }
    return val as unknown;
  });
}

// ─── 1. /u/:code — short-URL redirect ────────────────────────────────────

describe("GET /u/:code", () => {
  it("redirects to /bureau/unlock?code=<encoded-code>", async () => {
    const { GET } = await import("@/app/u/[code]/route");

    await expect(
      GET(new Request("http://localhost/u/1207DF29"), {
        params: Promise.resolve({ code: "1207DF29" }),
      })
    ).rejects.toThrow("REDIRECT:/bureau/unlock?code=1207DF29");

    expect(mocks.redirectFn).toHaveBeenCalledWith(
      "/bureau/unlock?code=1207DF29"
    );
  });

  it("percent-encodes codes that contain special characters", async () => {
    const { GET } = await import("@/app/u/[code]/route");

    await expect(
      GET(new Request("http://localhost/u/ALDER+A1"), {
        params: Promise.resolve({ code: "ALDER+A1" }),
      })
    ).rejects.toThrow("REDIRECT:/bureau/unlock?code=ALDER%2BA1");
  });
});

// ─── 2. Logged-out /bureau/unlock — renders sign-in card ─────────────────

describe("UnlockPage (logged-out)", () => {
  beforeEach(() => {
    mocks.authFn.mockResolvedValue(null);
  });

  it("does NOT redirect to /login — page renders its own sign-in card", async () => {
    const { default: UnlockPage } = await import(
      "@/app/(unlock)/bureau/unlock/page"
    );

    // Must not throw a REDIRECT error.
    const result = await UnlockPage({
      searchParams: Promise.resolve({ code: "1207DF29" }),
    });

    expect(mocks.redirectFn).not.toHaveBeenCalled();
    // Returns a JSX element (object with $$typeof), not undefined/null.
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("builds callbackUrl that includes the code (P1-8 + P1-9 integration)", async () => {
    const { default: UnlockPage } = await import(
      "@/app/(unlock)/bureau/unlock/page"
    );

    const result = await UnlockPage({
      searchParams: Promise.resolve({ code: "1207DF29" }),
    });

    // The rendered JSX tree contains a Link whose href should encode the
    // return path. Inspect the props tree without a DOM renderer.
    const json = safeStringify(result);
    expect(json).toContain(
      encodeURIComponent("/bureau/unlock?code=1207DF29")
    );
  });

  it("renders a sign-in card even when no code is present", async () => {
    const { default: UnlockPage } = await import(
      "@/app/(unlock)/bureau/unlock/page"
    );

    const result = await UnlockPage({
      searchParams: Promise.resolve({}),
    });

    expect(mocks.redirectFn).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    // callbackUrl falls back to /bureau/unlock (no code)
    const json = safeStringify(result);
    expect(json).toContain(
      encodeURIComponent("/bureau/unlock")
    );
  });
});

// ─── 3. callbackUrl survives pickPostLoginPath open-redirect guard ────────

describe("callbackUrl from unlock page passes pickPostLoginPath", () => {
  it("same-origin unlock URL with code is accepted as-is", async () => {
    const { pickPostLoginPath } = await import("@/lib/post-login-path");
    const callbackUrl = "/bureau/unlock?code=1207DF29";
    expect(pickPostLoginPath(callbackUrl)).toBe(callbackUrl);
  });

  it("full external URL injected as code is rejected (adversarial callbackUrl)", async () => {
    const { pickPostLoginPath, DEFAULT_POST_LOGIN_PATH } = await import(
      "@/lib/post-login-path"
    );
    // An attacker might craft a QR code that routes through /u/ with a
    // code that looks like an external URL. pickPostLoginPath must reject it.
    expect(pickPostLoginPath("https://evil.com/phish")).toBe(
      DEFAULT_POST_LOGIN_PATH
    );
  });
});

// ─── 4. Bureau layout still enforces auth on all real bureau pages ────────

describe("BureauLayout (logged-out)", () => {
  beforeEach(() => {
    mocks.authFn.mockResolvedValue(null);
  });

  it("redirects to /login — requireSession() still fires for bureau pages", async () => {
    const { default: BureauLayout } = await import(
      "@/app/bureau/layout"
    );

    await expect(
      BureauLayout({ children: null })
    ).rejects.toThrow("REDIRECT:/login");

    expect(mocks.redirectFn).toHaveBeenCalledWith("/login");
  });
});

describe("BureauLayout (logged-in investigator)", () => {
  it("passes through children — no redirect for authenticated users", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);

    const { default: BureauLayout } = await import(
      "@/app/bureau/layout"
    );

    const result = await BureauLayout({ children: "sentinel" as unknown as ReactNode });

    expect(mocks.redirectFn).not.toHaveBeenCalled();
    // Layout returns a React element wrapping the children sentinel.
    expect(safeStringify(result)).toContain("sentinel");
  });
});

// ─── 5. Logged-in /bureau/unlock — renders the UnlockForm ────────────────

describe("UnlockPage (logged-in)", () => {
  beforeEach(() => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);
  });

  it("renders the UnlockForm, not the sign-in card", async () => {
    const { default: UnlockPage } = await import(
      "@/app/(unlock)/bureau/unlock/page"
    );

    const result = await UnlockPage({
      searchParams: Promise.resolve({ code: "1207DF29" }),
    });

    expect(mocks.redirectFn).not.toHaveBeenCalled();
    const json = safeStringify(result);
    // The sign-in card title "Sign in to unlock evidence" is a string prop
    // on SectionHeader — it survives JSON.stringify. Assert it is absent,
    // confirming we are in the authenticated render branch.
    expect(json).not.toContain("Sign in to unlock evidence");
    // The logged-in branch passes initialCode to UnlockForm as a string
    // prop — string prop values survive JSON.stringify.
    expect(json).toContain("1207DF29");
  });

  it("does not redirect even when no code is supplied", async () => {
    const { default: UnlockPage } = await import(
      "@/app/(unlock)/bureau/unlock/page"
    );

    await UnlockPage({ searchParams: Promise.resolve({}) });
    expect(mocks.redirectFn).not.toHaveBeenCalled();
  });
});

// ─── 6. Admin layout — role enforcement unchanged ────────────────────────

describe("AdminLayout", () => {
  it("redirects to /bureau when the user is INVESTIGATOR (not admin)", async () => {
    mocks.authFn.mockResolvedValue(INVESTIGATOR_SESSION);

    const { default: AdminLayout } = await import(
      "@/app/bureau/admin/layout"
    );

    await expect(
      AdminLayout({ children: null })
    ).rejects.toThrow("REDIRECT:/bureau");

    expect(mocks.redirectFn).toHaveBeenCalledWith("/bureau");
  });

  it("redirects to /login when unauthenticated (requireSession fires first)", async () => {
    mocks.authFn.mockResolvedValue(null);

    const { default: AdminLayout } = await import(
      "@/app/bureau/admin/layout"
    );

    await expect(
      AdminLayout({ children: null })
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("passes through children for ADMIN role", async () => {
    mocks.authFn.mockResolvedValue(ADMIN_SESSION);

    const { default: AdminLayout } = await import(
      "@/app/bureau/admin/layout"
    );

    const result = await AdminLayout({ children: "admin-sentinel" as unknown as ReactNode });
    expect(mocks.redirectFn).not.toHaveBeenCalled();
    expect(safeStringify(result)).toContain("admin-sentinel");
  });
});
