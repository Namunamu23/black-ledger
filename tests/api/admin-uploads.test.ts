/**
 * Integration tests for the upload pipeline endpoints.
 *
 * Strategy: vi.mock the AWS SDK presigner so /sign returns a deterministic
 * fake URL. For /blurhash, vi.stubGlobal("fetch", …) to make the image
 * fetch fail — the route must swallow the error and respond with
 * 200 { blurhash: null }.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authFn: vi.fn(),
  getSignedUrlMock: vi.fn(),
  putObjectCommandCtor: vi.fn(),
  s3ClientCtor: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mocks.getSignedUrlMock,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: mocks.s3ClientCtor,
  PutObjectCommand: mocks.putObjectCommandCtor,
}));

import { POST as signPOST } from "@/app/api/admin/uploads/sign/route";
import { POST as blurhashPOST } from "@/app/api/admin/uploads/blurhash/route";
import { _resetForTesting as resetRateLimit } from "@/lib/rate-limit";

const ORIGINAL_ENV = { ...process.env };

function makeRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "test-ip",
    },
  });
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
      (m as { mockReset: () => void }).mockReset();
    }
  });

  mocks.authFn.mockResolvedValue({
    user: { id: "1", role: "ADMIN" },
  });

  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.R2_BUCKET_NAME = "blackledger-test";
  process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";

  resetRateLimit();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("POST /api/admin/uploads/sign", () => {
  it("returns { uploadUrl, publicUrl, key } for a valid image payload", async () => {
    mocks.getSignedUrlMock.mockResolvedValue(
      "https://pub-test.r2.dev/SIGNED?token=abc"
    );

    const response = await signPOST(
      makeRequest("/api/admin/uploads/sign", {
        filename: "Hero Photo.JPG",
        contentType: "image/jpeg",
        context: "hero",
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      uploadUrl: string;
      publicUrl: string;
      key: string;
    };
    expect(body.uploadUrl).toBe("https://pub-test.r2.dev/SIGNED?token=abc");
    expect(body.key.startsWith("uploads/hero/")).toBe(true);
    expect(body.key.endsWith("hero-photo.jpg")).toBe(true);
    expect(body.publicUrl).toBe(`https://pub-test.r2.dev/${body.key}`);
    expect(mocks.getSignedUrlMock).toHaveBeenCalledOnce();
  });

  it("rejects non-image contentType with 422", async () => {
    const response = await signPOST(
      makeRequest("/api/admin/uploads/sign", {
        filename: "evil.exe",
        contentType: "application/octet-stream",
        context: "hero",
      })
    );

    expect(response.status).toBe(422);
    expect(mocks.getSignedUrlMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown context with 422", async () => {
    const response = await signPOST(
      makeRequest("/api/admin/uploads/sign", {
        filename: "thing.png",
        contentType: "image/png",
        context: "evidence",
      })
    );

    expect(response.status).toBe(422);
    expect(mocks.getSignedUrlMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/uploads/blurhash", () => {
  it("returns { blurhash: null } when the image fetch fails (errors are swallowed)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const response = await blurhashPOST(
        makeRequest("/api/admin/uploads/blurhash", {
          publicUrl: "https://pub-test.r2.dev/uploads/hero/abc-photo.jpg",
        })
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { blurhash: string | null };
      expect(body.blurhash).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects an off-allowlist URL (SSRF guard) BEFORE issuing any fetch (P1-6 regression)", async () => {
    // If the SSRF guard is missing or moved, fetch would be invoked. The
    // mock asserts it is NOT — the host check must short-circuit first.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      const response = await blurhashPOST(
        makeRequest("/api/admin/uploads/blurhash", {
          publicUrl: "http://169.254.169.254/latest/meta-data/",
        })
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { blurhash: string | null };
      expect(body.blurhash).toBeNull();

      // Critical: the SSRF target host must never be reached.
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
