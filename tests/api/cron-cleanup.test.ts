/**
 * Integration tests for GET /api/cron/cleanup-pending-orders.
 *
 * Strategy: Prisma mocked via vi.hoisted + vi.mock. CRON_SECRET + Vercel
 * cron user-agent are validated; all other variants must 4xx without
 * touching prisma.order.updateMany.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      updateMany: mocks.orderUpdateMany,
    },
  },
}));

import { GET as cronCleanup } from "@/app/api/cron/cleanup-pending-orders/route";

const VERCEL_UA = "vercel-cron/1.0";
const SECRET = "test-cron-secret-xyz";

function makeRequest(opts: {
  authHeader?: string;
  userAgent?: string;
}): Request {
  const headers: Record<string, string> = {};
  if (opts.authHeader !== undefined) {
    headers["authorization"] = opts.authHeader;
  }
  if (opts.userAgent !== undefined) {
    headers["user-agent"] = opts.userAgent;
  }
  return new Request("http://localhost/api/cron/cleanup-pending-orders", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  mocks.orderUpdateMany.mockReset();
  mocks.orderUpdateMany.mockResolvedValue({ count: 0 });
  vi.stubEnv("CRON_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/cleanup-pending-orders", () => {
  it("returns 503 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const res = await cronCleanup(
      makeRequest({ authHeader: `Bearer ${SECRET}`, userAgent: VERCEL_UA })
    );

    expect(res.status).toBe(503);
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 403 when the authorization header is missing", async () => {
    const res = await cronCleanup(makeRequest({ userAgent: VERCEL_UA }));

    expect(res.status).toBe(403);
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 403 when the bearer secret does not match", async () => {
    const res = await cronCleanup(
      makeRequest({ authHeader: "Bearer wrong-secret", userAgent: VERCEL_UA })
    );

    expect(res.status).toBe(403);
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 403 when the user-agent is not vercel-cron/1.0", async () => {
    const res = await cronCleanup(
      makeRequest({
        authHeader: `Bearer ${SECRET}`,
        userAgent: "curl/8.0.1",
      })
    );

    expect(res.status).toBe(403);
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 200 and calls updateMany when the bearer secret + UA match", async () => {
    mocks.orderUpdateMany.mockResolvedValue({ count: 4 });

    const res = await cronCleanup(
      makeRequest({ authHeader: `Bearer ${SECRET}`, userAgent: VERCEL_UA })
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { swept: number };
    expect(json.swept).toBe(4);
    expect(mocks.orderUpdateMany).toHaveBeenCalledOnce();
  });
});
