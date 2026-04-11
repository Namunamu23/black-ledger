import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supportSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = supportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    await prisma.supportMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        message: parsed.data.message,
      },
    });

    return NextResponse.json(
      { message: "Your message has been sent." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Support route error:", error);

    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}