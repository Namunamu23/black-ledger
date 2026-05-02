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

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
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
