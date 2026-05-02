/**
 * Integration tests for:
 *   POST /api/register
 *   POST /api/forgot-password
 *   POST /api/reset-password
 *
 * Strategy: Prisma + Resend mocked via vi.hoisted + vi.mock.
 * In-memory rate-limit bucket reset between tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  resendSend: vi.fn(),
  hashFn: vi.fn(),
  compareFn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
      update: mocks.userUpdate,
    },
  },
}));

vi.mock("@/lib/resend", () => ({
  getResend: () => ({ emails: { send: mocks.resendSend } }),
  getResendFrom: () => "no-reply@test.com",
}));

// bcryptjs: hash returns a fixed string; compare is not used in these routes.
vi.mock("bcryptjs", () => ({
  hash: mocks.hashFn,
  compare: mocks.compareFn,
}));

import { POST as registerPOST } from "@/app/api/register/route";
import { POST as forgotPOST } from "@/app/api/forgot-password/route";
import { POST as resetPOST } from "@/app/api/reset-password/route";
import { _resetForTesting as resetRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url: string,
  body: unknown,
  ip = "test-ip"
): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
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

  // Default: hash succeeds
  mocks.hashFn.mockResolvedValue("hashed-password-xyz");
  // Default: Resend send succeeds
  mocks.resendSend.mockResolvedValue({ id: "email-id-1" });
});

// ===========================================================================
// POST /api/register
// ===========================================================================

describe("POST /api/register", () => {
  it("returns 201 and creates a user for valid input", async () => {
    mocks.userFindUnique.mockResolvedValue(null); // no existing user
    mocks.userCreate.mockResolvedValue({ id: 42, email: "new@test.com" });

    const res = await registerPOST(
      makeRequest("/api/register", {
        email: "new@test.com",
        password: "securePass1",
      })
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as { message: string };
    expect(json.message).toContain("created");

    expect(mocks.userCreate).toHaveBeenCalledOnce();
    const createCall = mocks.userCreate.mock.calls[0]![0] as {
      data: { email: string; role: string; passwordHash: string };
    };
    expect(createCall.data.email).toBe("new@test.com");
    expect(createCall.data.role).toBe("INVESTIGATOR");
    expect(createCall.data.passwordHash).toBe("hashed-password-xyz");
  });

  it("bcrypt is called with cost factor 12", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: 43 });

    await registerPOST(
      makeRequest("/api/register", {
        email: "cost@test.com",
        password: "securePass1",
      })
    );

    expect(mocks.hashFn).toHaveBeenCalledWith("securePass1", 12);
  });

  it("silently absorbs a duplicate email with 201 (no enumeration via 409)", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 7 }); // existing user

    const res = await registerPOST(
      makeRequest("/api/register", {
        email: "existing@test.com",
        password: "securePass1",
      })
    );

    // Mirrors /api/forgot-password's uniform-200 stance: an attacker
    // probing whether an email is registered cannot tell from the
    // response status whether the account already existed.
    expect(res.status).toBe(201);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    const res = await registerPOST(
      makeRequest("/api/register", {
        email: "not-an-email",
        password: "securePass1",
      })
    );

    expect(res.status).toBe(400);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for a password shorter than 8 characters", async () => {
    const res = await registerPOST(
      makeRequest("/api/register", {
        email: "short@test.com",
        password: "short",
      })
    );

    expect(res.status).toBe(400);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("normalises email to lowercase before the duplicate check", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: 44 });

    await registerPOST(
      makeRequest("/api/register", {
        email: "UPPER@TEST.COM",
        password: "securePass1",
      })
    );

    const findCall = mocks.userFindUnique.mock.calls[0]![0] as {
      where: { email: string };
    };
    expect(findCall.where.email).toBe("upper@test.com");
  });

  it("stores optional name when provided", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: 45 });

    await registerPOST(
      makeRequest("/api/register", {
        email: "named@test.com",
        password: "securePass1",
        name: "Investigator Jones",
      })
    );

    const createCall = mocks.userCreate.mock.calls[0]![0] as {
      data: { name: string | null };
    };
    expect(createCall.data.name).toBe("Investigator Jones");
  });

  it("stores null name when name is omitted", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: 46 });

    await registerPOST(
      makeRequest("/api/register", {
        email: "noname@test.com",
        password: "securePass1",
      })
    );

    const createCall = mocks.userCreate.mock.calls[0]![0] as {
      data: { name: string | null };
    };
    expect(createCall.data.name).toBeNull();
  });
});

// ===========================================================================
// POST /api/forgot-password
// ===========================================================================

describe("POST /api/forgot-password", () => {
  it("returns 200 with the generic message for a registered email", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 10 });

    const res = await forgotPOST(
      makeRequest("/api/forgot-password", { email: "user@test.com" })
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { message: string };
    expect(json.message).toContain("reset link");
  });

  it("returns 200 with the same generic message for an unregistered email (no enumeration)", async () => {
    mocks.userFindUnique.mockResolvedValue(null); // no account

    const res = await forgotPOST(
      makeRequest("/api/forgot-password", { email: "ghost@test.com" })
    );

    // Must be identical status + message — attacker cannot distinguish registered
    // vs unregistered via this endpoint.
    expect(res.status).toBe(200);
    const json = (await res.json()) as { message: string };
    expect(json.message).toContain("reset link");
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it("writes a reset token and expiry to the user record", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 11 });

    await forgotPOST(
      makeRequest("/api/forgot-password", { email: "user@test.com" })
    );

    expect(mocks.userUpdate).toHaveBeenCalledOnce();
    const updateCall = mocks.userUpdate.mock.calls[0]![0] as {
      where: { id: number };
      data: {
        passwordResetToken: string;
        passwordResetExpiresAt: Date;
      };
    };
    expect(updateCall.where.id).toBe(11);
    expect(typeof updateCall.data.passwordResetToken).toBe("string");
    expect(updateCall.data.passwordResetToken.length).toBe(64); // 32 bytes → 64 hex chars
    expect(updateCall.data.passwordResetExpiresAt).toBeInstanceOf(Date);
    // Expiry should be approximately 1 hour from now
    const diffMs =
      updateCall.data.passwordResetExpiresAt.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(55 * 60 * 1000);
    expect(diffMs).toBeLessThan(65 * 60 * 1000);
  });

  it("sends the reset email to the registered address", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 12 });

    await forgotPOST(
      makeRequest("/api/forgot-password", { email: "user@test.com" })
    );

    expect(mocks.resendSend).toHaveBeenCalledOnce();
    const sendCall = mocks.resendSend.mock.calls[0]![0] as {
      to: string;
      subject: string;
    };
    expect(sendCall.to).toBe("user@test.com");
    expect(sendCall.subject).toContain("password");
  });

  it("still returns 200 even when the email send fails", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 13 });
    mocks.resendSend.mockRejectedValue(new Error("SMTP timeout"));

    const res = await forgotPOST(
      makeRequest("/api/forgot-password", { email: "user@test.com" })
    );

    expect(res.status).toBe(200); // must not expose email failure
  });

  it("returns 200 for an invalid email input (no enumeration via 400)", async () => {
    const res = await forgotPOST(
      makeRequest("/api/forgot-password", { email: "not-an-email" })
    );

    expect(res.status).toBe(200);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// POST /api/reset-password
// ===========================================================================

describe("POST /api/reset-password", () => {
  const VALID_TOKEN = "a".repeat(64);
  const FUTURE_EXPIRY = new Date(Date.now() + 30 * 60 * 1000); // 30 min from now

  it("returns 200 and updates the password for a valid unexpired token", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 20,
      passwordResetExpiresAt: FUTURE_EXPIRY,
    });

    const res = await resetPOST(
      makeRequest("/api/reset-password", {
        token: VALID_TOKEN,
        password: "newSecurePass1",
      })
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { message: string };
    expect(json.message).toContain("sign in");
  });

  it("clears the reset token and expiry after a successful reset", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 21,
      passwordResetExpiresAt: FUTURE_EXPIRY,
    });

    await resetPOST(
      makeRequest("/api/reset-password", {
        token: VALID_TOKEN,
        password: "newSecurePass1",
      })
    );

    expect(mocks.userUpdate).toHaveBeenCalledOnce();
    const updateCall = mocks.userUpdate.mock.calls[0]![0] as {
      data: {
        passwordHash: string;
        passwordResetToken: null;
        passwordResetExpiresAt: null;
      };
    };
    expect(updateCall.data.passwordResetToken).toBeNull();
    expect(updateCall.data.passwordResetExpiresAt).toBeNull();
    expect(updateCall.data.passwordHash).toBe("hashed-password-xyz");
  });

  it("increments tokenVersion to invalidate existing JWT sessions", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 24,
      passwordResetExpiresAt: FUTURE_EXPIRY,
    });

    await resetPOST(
      makeRequest("/api/reset-password", {
        token: VALID_TOKEN,
        password: "newSecurePass1",
      })
    );

    expect(mocks.userUpdate).toHaveBeenCalledOnce();
    const updateCall = mocks.userUpdate.mock.calls[0]![0] as {
      data: { tokenVersion: { increment: number } };
    };
    expect(updateCall.data.tokenVersion).toEqual({ increment: 1 });
  });

  it("returns 400 for an expired token", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 22,
      passwordResetExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    });

    const res = await resetPOST(
      makeRequest("/api/reset-password", {
        token: VALID_TOKEN,
        password: "newSecurePass1",
      })
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { message: string };
    expect(json.message).toMatch(/invalid|expired/i);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for a token that does not exist in the database", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const res = await resetPOST(
      makeRequest("/api/reset-password", {
        token: VALID_TOKEN,
        password: "newSecurePass1",
      })
    );

    expect(res.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for a password shorter than 8 characters", async () => {
    const res = await resetPOST(
      makeRequest("/api/reset-password", {
        token: VALID_TOKEN,
        password: "short",
      })
    );

    expect(res.status).toBe(400);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("hashes the new password with cost factor 12", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 23,
      passwordResetExpiresAt: FUTURE_EXPIRY,
    });

    await resetPOST(
      makeRequest("/api/reset-password", {
        token: VALID_TOKEN,
        password: "newSecurePass1",
      })
    );

    expect(mocks.hashFn).toHaveBeenCalledWith("newSecurePass1", 12);
  });
});
