import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  const limit = await rateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { message: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }
  return handlers.POST(request);
}
