import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

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
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      // Silent absorb. Returning 409 with "An account with this email already
      // exists" lets an attacker enumerate registered emails at the rate-limit
      // ceiling (3/60s/IP). Mirrors /api/forgot-password's uniform-200 design.
      // The legitimate user who innocently registers twice gets the same shape
      // they'd get on first registration; if they cannot then sign in, the
      // password-reset flow is the recovery path. A future batch may add an
      // email-of-record ("someone tried to register with this email") to close
      // the UX gap; this batch is the correct privacy posture.
      return NextResponse.json({ message: "Account created." }, { status: 201 });
    }

    const passwordHash = await hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name && name.trim().length > 0 ? name.trim() : null,
        role: "INVESTIGATOR",
      },
    });

    return NextResponse.json({ message: "Account created." }, { status: 201 });
  } catch (error) {
    console.error("Register route error:", error);
    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
