import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/lib/enums";

// Vercel Cron calls this endpoint with `Authorization: Bearer ${CRON_SECRET}`.
// The route MUST verify that header before doing any work — otherwise any
// signed-in (or unsigned) caller could trigger the sweep on demand.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { message: "Cron is not configured." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(authHeader);

  // Constant-time comparison. Buffers must be the same length for
  // timingSafeEqual; the length pre-check handles that without leaking
  // timing itself (the length is observable to an attacker via
  // content-length, but the secret bytes are not).
  if (
    gotBuf.length !== expectedBuf.length ||
    !timingSafeEqual(gotBuf, expectedBuf)
  ) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  // Defense in depth: confirm the request actually came from Vercel cron.
  // User-Agent is trivially forgeable, so this only blocks unsophisticated
  // probes — but it raises the bar at zero cost. The console.warn lets
  // ops notice if Vercel ever changes its UA string in a future platform
  // update (we'd see a flood of 403s with a new UA value to investigate
  // rather than silent successful 403s).
  const userAgent = request.headers.get("user-agent");
  if (userAgent !== "vercel-cron/1.0") {
    console.warn(
      `[CRON] Rejecting cleanup-pending-orders with unexpected user-agent: ${userAgent ?? "(none)"}`
    );
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  // Mark every PENDING Order older than 24 hours as FAILED. The window
  // is wider than the typical Stripe Checkout session expiry (3 hours by
  // default per Stripe docs) — we only want to sweep clearly-abandoned
  // sessions, not active ones.
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.order.updateMany({
    where: {
      status: OrderStatus.PENDING,
      createdAt: { lt: twentyFourHoursAgo },
    },
    data: {
      status: OrderStatus.FAILED,
    },
  });

  console.log(`[CRON] cleanup-pending-orders swept ${result.count} orders`);
  return NextResponse.json({ swept: result.count }, { status: 200 });
}
