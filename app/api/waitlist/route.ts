import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { waitlistSchema } from "@/lib/validators";

export async function POST(request: Request) {
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
      return NextResponse.json(
        { message: "That email is already on the waitlist." },
        { status: 409 }
      );
    }

    console.error("Waitlist route error:", error);

    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}