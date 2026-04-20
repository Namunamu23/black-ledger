import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, _resetForTesting } from "@/lib/rate-limit";

function makeRequest(ip: string, path = "/api/test"): Request {
  return new Request(`http://localhost${path}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("rateLimit (in-memory backend)", () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it("first N requests within the window succeed", async () => {
    const opts = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) {
      const result = await rateLimit(makeRequest("1.1.1.1"), opts);
      expect(result.success).toBe(true);
      expect(result.retryAfterSeconds).toBe(0);
    }
  });

  it("request N+1 within the same window returns success: false with a positive retryAfter", async () => {
    const opts = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) {
      await rateLimit(makeRequest("2.2.2.2"), opts);
    }
    const result = await rateLimit(makeRequest("2.2.2.2"), opts);
    expect(result.success).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("after the window resets, requests succeed again", async () => {
    vi.useFakeTimers();
    try {
      const opts = { limit: 3, windowMs: 1000 };
      for (let i = 0; i < 3; i++) {
        const r = await rateLimit(makeRequest("3.3.3.3"), opts);
        expect(r.success).toBe(true);
      }
      const exhausted = await rateLimit(makeRequest("3.3.3.3"), opts);
      expect(exhausted.success).toBe(false);

      // Advance time well past the full-bucket refill point.
      vi.advanceTimersByTime(1500);

      const recovered = await rateLimit(makeRequest("3.3.3.3"), opts);
      expect(recovered.success).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("different IPs have independent buckets", async () => {
    const opts = { limit: 2, windowMs: 60_000 };
    await rateLimit(makeRequest("4.4.4.4"), opts);
    await rateLimit(makeRequest("4.4.4.4"), opts);
    const exhausted = await rateLimit(makeRequest("4.4.4.4"), opts);
    expect(exhausted.success).toBe(false);

    const otherIp = await rateLimit(makeRequest("5.5.5.5"), opts);
    expect(otherIp.success).toBe(true);
    const otherIpAgain = await rateLimit(makeRequest("5.5.5.5"), opts);
    expect(otherIpAgain.success).toBe(true);
    const otherIpExhausted = await rateLimit(makeRequest("5.5.5.5"), opts);
    expect(otherIpExhausted.success).toBe(false);
  });
});
