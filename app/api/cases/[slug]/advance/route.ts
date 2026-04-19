import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const session = await auth();
  const userId = Number((session?.user as { id?: string } | undefined)?.id);

  if (!session?.user || !Number.isInteger(userId)) {
    return NextResponse.json(
      { message: "You must be logged in to continue." },
      { status: 401 }
    );
  }

  try {
    const userCase = await prisma.userCase.findFirst({
      where: {
        userId,
        caseFile: { slug },
      },
      include: {
        caseFile: true,
      },
    });

    if (!userCase) {
      return NextResponse.json(
        { message: "You do not own this case." },
        { status: 403 }
      );
    }

    if (userCase.currentStage >= userCase.caseFile.maxStage) {
      if (!userCase.completedAt) {
        await prisma.userCase.update({
          where: { id: userCase.id },
          data: {
            status: "FINAL_REVIEW",
            completedAt: new Date(),
            lastViewedAt: new Date(),
          },
        });
      }

      return NextResponse.json(
        {
          message: "All review stages are already unlocked.",
          currentStage: userCase.currentStage,
          complete: true,
        },
        { status: 200 }
      );
    }

    const nextStage = userCase.currentStage + 1;
    const isComplete = nextStage >= userCase.caseFile.maxStage;

    const updated = await prisma.userCase.update({
      where: { id: userCase.id },
      data: {
        currentStage: nextStage,
        status: isComplete ? "FINAL_REVIEW" : "ACTIVE",
        firstOpenedAt: userCase.firstOpenedAt ?? new Date(),
        lastViewedAt: new Date(),
        completedAt: isComplete ? new Date() : userCase.completedAt,
      },
    });

    return NextResponse.json(
      {
        message: isComplete
          ? "Final review stage unlocked."
          : `Stage ${updated.currentStage} unlocked.`,
        currentStage: updated.currentStage,
        complete: isComplete,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Advance route error:", error);

    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}