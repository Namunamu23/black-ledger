/**
 * Token-bucket rate limiter with two backends:
 *
 *   - Dev / default: an in-memory Map<string, Bucket>. The map is bounded
 *     to MAX_TRACKED_KEYS entries; once full, the oldest entry by insertion
 *     order is evicted before a new bucket is created. This is good enough
 *     for local development and survives process restarts as a clean slate.
 *
 *   - Prod: Upstash Redis via @upstash/ratelimit, enabled automatically
 *     when both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are
 *     set in the environment. Rate limit state is shared across all
 *     serverless invocations.
 *
 * The bucket key is `${ip}:${pathname}` — independent buckets per IP per
 * route. The IP is read from x-forwarded-for first (leftmost value when
 * multiple are present), then x-real-ip, then "unknown".
 *
 * The function is async because the Upstash backend requires a network
 * round-trip; the in-memory backend is synchronous internally but still
 * returns a Promise so callers do not need to branch on the backend.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Bucket = { tokens: number; lastRefill: number };

const MAX_TRACKED_KEYS = 500;
const buckets = new Map<string, Bucket>();

const useUpstash =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

const upstashInstances = new Map<string, Ratelimit>();

function getUpstashInstance(limit: number, windowMs: number): Ratelimit {
  const key = `${limit}:${windowMs}`;
  let instance = upstashInstances.get(key);
  if (!instance) {
    const seconds = Math.max(1, Math.ceil(windowMs / 1000));
    instance = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.tokenBucket(limit, `${seconds} s`, limit),
      analytics: false,
      prefix: "bl-ratelimit",
    });
    upstashInstances.set(key, instance);
  }
  return instance;
}

function consumeFromMemory(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
    bucket = { tokens: limit, lastRefill: now };
    buckets.set(key, bucket);
  } else {
    const elapsed = now - bucket.lastRefill;
    const refill = (elapsed * limit) / windowMs;
    bucket.tokens = Math.min(limit, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { success: true, retryAfterSeconds: 0 };
  }

  const tokensNeeded = 1 - bucket.tokens;
  const msUntilToken = (tokensNeeded * windowMs) / limit;
  return {
    success: false,
    retryAfterSeconds: Math.max(1, Math.ceil(msUntilToken / 1000)),
  };
}

function extractIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function rateLimit(
  request: Request,
  options: { limit: number; windowMs: number }
): Promise<{ success: boolean; retryAfterSeconds: number }> {
  const ip = extractIp(request);
  const url = new URL(request.url);
  const key = `${ip}:${url.pathname}`;

  if (useUpstash) {
    const instance = getUpstashInstance(options.limit, options.windowMs);
    const result = await instance.limit(key);
    const msUntilReset = Math.max(0, result.reset - Date.now());
    return {
      success: result.success,
      retryAfterSeconds: Math.max(1, Math.ceil(msUntilReset / 1000)),
    };
  }

  return consumeFromMemory(key, options.limit, options.windowMs);
}

/**
 * Test-only helper. Clears the in-memory bucket map so each test starts
 * with a fresh bucket per IP/path. Throws if called outside the test
 * environment to prevent accidental invocation in production code.
 */
export function _resetForTesting(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "_resetForTesting is for test environments only and must not be called in production."
    );
  }
  buckets.clear();
}
