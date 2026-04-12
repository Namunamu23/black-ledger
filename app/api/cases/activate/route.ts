import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { activationCodeSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await auth();
  const userId = Number((session?.user as { id?: string } | undefined)?.id);

  if (!session?.user || !Number.isInteger(userId)) {
    return NextResponse.json(
      { message: "You must be logged in to activate a case." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = activationCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid activation code." },
        { status: 400 }
      );
    }

    const code = parsed.data.code;

    const activation = await prisma.activationCode.findUnique({
      where: { code },
      include: { caseFile: true },
    });

    if (!activation) {
      return NextResponse.json(
        { message: "Activation code not found." },
        { status: 404 }
      );
    }

    if (!activation.caseFile.isActive) {
      return NextResponse.json(
        { message: "This case is not currently active." },
        { status: 400 }
      );
    }

    const existingOwnership = await prisma.userCase.findUnique({
      where: {
        userId_caseFileId: {
          userId,
          caseFileId: activation.caseFileId,
        },
      },
    });

    if (existingOwnership) {
      return NextResponse.json(
        {
          message: `You already own "${activation.caseFile.title}".`,
          slug: activation.caseFile.slug,
        },
        { status: 200 }
      );
    }

    if (activation.claimedByUserId && activation.claimedByUserId !== userId) {
      return NextResponse.json(
        { message: "This activation code has already been used." },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.userCase.create({
        data: {
          userId,
          caseFileId: activation.caseFileId,
        },
      }),
      prisma.activationCode.update({
        where: { id: activation.id },
        data: {
          claimedByUserId: userId,
          claimedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json(
      {
        message: `Activated "${activation.caseFile.title}".`,
        slug: activation.caseFile.slug,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Activation route error:", error);

    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}