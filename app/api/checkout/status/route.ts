import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
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
    select: { status: true, email: true },
  });
  if (!order) {
    return NextResponse.json({ status: "PENDING", email: null }, { status: 200 });
  }

  return NextResponse.json(
    { status: order.status, email: order.email },
    { status: 200 }
  );
}
