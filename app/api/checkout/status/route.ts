import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limit = await rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { message: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { message: "Missing session_id." },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { stripeSessionId: sessionId },
    select: { status: true },
  });
  if (!order) {
    return NextResponse.json({ status: "PENDING" }, { status: 200 });
  }

  return NextResponse.json({ status: order.status }, { status: 200 });
}
