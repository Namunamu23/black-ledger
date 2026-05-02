/**
 * Integration tests for DELETE /api/me — account deletion.
 *
 * Strategy: Prisma + bcryptjs + auth() mocked via vi.hoisted + vi.mock,
 * matching the patterns in tests/api/register.test.ts (mock setup) and
 * tests/api/checkpoint.test.ts (auth mock through @/auth, not
 * @/lib/auth-helpers — requireSessionJson calls auth() internally).
 * In-memory rate-limit bucket reset between tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  authFn: vi.fn(),
  userFindUnique: vi.fn(),
  userDelete: vi.fn(),
  compareFn: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      delete: mocks.userDelete,
    },
  },
}));

vi.mock("bcryptjs", () => ({
  compare: mocks.compareFn,
}));

import { DELETE as deleteMe } from "@/app/api/me/route";
import { _resetForTesting as resetRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  body: unknown,
  ip = "test-ip"
): Request {
  return new Request("http://localhost/api/me", {
    method: "DELETE",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
  });
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
      (m as { mockReset: () => void }).mockReset();
    }
  });

  resetRateLimit();

  // Default: signed-in INVESTIGATOR
  mocks.authFn.mockResolvedValue({
    user: { id: "42", email: "user@test.com", role: "INVESTIGATOR" },
  });

  // Default: row exists, INVESTIGATOR, password hash present
  mocks.userFindUnique.mockResolvedValue({
    id: 42,
    role: "INVESTIGATOR",
    passwordHash: "hashed-password-xyz",
  });

  // Default: password matches
  mocks.compareFn.mockResolvedValue(true);

  // Default: delete succeeds
  mocks.userDelete.mockResolvedValue({ id: 42 });
});

// ===========================================================================

describe("DELETE /api/me", () => {
  it("returns 401 when not signed in (auth() returns null)", async () => {
    mocks.authFn.mockResolvedValue(null);

    const res = await deleteMe(
      makeRequest({ password: "p", confirmation: "delete my account" })
    );

    expect(res.status).toBe(401);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.userDelete).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is invalid (missing password or wrong confirmation phrase)", async () => {
    const res1 = await deleteMe(
      makeRequest({ confirmation: "delete my account" })
    );
    expect(res1.status).toBe(400);

    const res2 = await deleteMe(
      makeRequest({ password: "secret", confirmation: "yes please" })
    );
    expect(res2.status).toBe(400);

    expect(mocks.userDelete).not.toHaveBeenCalled();
  });

  it("returns 401 when the password does not match", async () => {
    mocks.compareFn.mockResolvedValue(false);

    const res = await deleteMe(
      makeRequest({
        password: "wrong-password",
        confirmation: "delete my account",
      })
    );

    expect(res.status).toBe(401);
    const json = (await res.json()) as { message: string };
    expect(json.message).toMatch(/incorrect password/i);
    expect(mocks.userDelete).not.toHaveBeenCalled();
  });

  it("returns 403 when the user role is ADMIN (admin self-deletion refused)", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 42,
      role: "ADMIN",
      passwordHash: "hashed-password-xyz",
    });

    const res = await deleteMe(
      makeRequest({ password: "secret", confirmation: "delete my account" })
    );

    expect(res.status).toBe(403);
    expect(mocks.compareFn).not.toHaveBeenCalled();
    expect(mocks.userDelete).not.toHaveBeenCalled();
  });

  it("returns 200 and calls user.delete when the password matches", async () => {
    const res = await deleteMe(
      makeRequest({ password: "secret", confirmation: "delete my account" })
    );

    expect(res.status).toBe(200);
    expect(mocks.userDelete).toHaveBeenCalledOnce();
    expect(mocks.userDelete.mock.calls[0]![0]).toEqual({ where: { id: 42 } });
  });

  it("returns 200 without calling delete when the user row is already gone", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const res = await deleteMe(
      makeRequest({ password: "secret", confirmation: "delete my account" })
    );

    expect(res.status).toBe(200);
    expect(mocks.compareFn).not.toHaveBeenCalled();
    expect(mocks.userDelete).not.toHaveBeenCalled();
  });

  it("returns 429 once the rate limit (3/60s) is exhausted", async () => {
    // Default valid body — first 3 requests succeed (200), 4th 429s.
    const body = { password: "secret", confirmation: "delete my account" };

    for (let i = 0; i < 3; i++) {
      const res = await deleteMe(makeRequest(body));
      expect(res.status).toBe(200);
    }

    const res = await deleteMe(makeRequest(body));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});
