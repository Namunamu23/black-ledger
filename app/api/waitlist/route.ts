import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { waitlistSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = await rateLimit(request, { limit: 3, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { message: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  try {
    const body = await request.json();
    const parsed = waitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    await prisma.waitlistEntry.create({
      data: {
        email: parsed.data.email,
      },
    });

    return NextResponse.json(
      { message: "You’re on the waitlist." },
      { status: 201 }
    );
  } catch (error) {
    const maybeError = error as { code?: string };

    if (maybeError.code === "P2002") {
      // Silent absorb — duplicate waitlist signups are no-ops, not errors.
      // Returning 409 leaks waitlist membership at the rate-limit ceiling
      // (3/60s/IP). Mirror /api/register and /api/forgot-password's stance.
      return NextResponse.json(
        { message: "You’re on the waitlist." },
        { status: 201 }
      );
    }

    console.error("Waitlist route error:", error);

    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}