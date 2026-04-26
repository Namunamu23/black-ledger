import { NextResponse } from "next/server";
import { requireSessionJson } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { activationCodeSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
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

  const sessionOrErr = await requireSessionJson();
  if (sessionOrErr instanceof NextResponse) return sessionOrErr;
  const userId = Number(sessionOrErr.user.id);

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

    if (activation.revokedAt) {
      return NextResponse.json(
        { message: "This activation code has been revoked." },
        { status: 410 }
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

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.activationCode.updateMany({
        where: { id: activation.id, claimedByUserId: null },
        data: { claimedByUserId: userId, claimedAt: new Date() },
      });

      if (claimed.count === 0) {
        throw new Error("ALREADY_CLAIMED");
      }

      const newUserCase = await tx.userCase.create({
        data: { userId, caseFileId: activation.caseFileId },
      });

      await tx.userCaseEvent.create({
        data: {
          userCaseId: newUserCase.id,
          type: "ACTIVATE",
          payload: { caseFileId: activation.caseFileId },
        },
      });
    });

    return NextResponse.json(
      {
        message: `Activated "${activation.caseFile.title}".`,
        slug: activation.caseFile.slug,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_CLAIMED") {
      return NextResponse.json(
        { message: "This activation code has already been used." },
        { status: 409 }
      );
    }

    console.error("Activation route error:", error);

    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
