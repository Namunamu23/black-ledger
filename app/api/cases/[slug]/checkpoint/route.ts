import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkpointAnswerSchema } from "@/lib/validators";

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
    const body = await request.json();
    const parsed = checkpointAnswerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid answer." },
        { status: 400 }
      );
    }

    const userCase = await prisma.userCase.findFirst({
      where: {
        userId,
        caseFile: { slug },
      },
      include: {
        caseFile: {
          include: {
            checkpoints: true,
          },
        },
      },
    });

    if (!userCase) {
      return NextResponse.json(
        { message: "You do not own this case." },
        { status: 403 }
      );
    }

    if (userCase.currentStage >= userCase.caseFile.maxStage) {
      return NextResponse.json(
        { message: "All progression checkpoints are already complete." },
        { status: 200 }
      );
    }

    const checkpoint = userCase.caseFile.checkpoints.find(
      (item) => item.stage === userCase.currentStage
    );

    if (!checkpoint) {
      return NextResponse.json(
        { message: "No checkpoint exists for this stage." },
        { status: 400 }
      );
    }

    const submitted = normalize(parsed.data.answer);
    const accepted = checkpoint.acceptedAnswers
      .split("|")
      .map((item) => normalize(item));

    const isCorrect = accepted.some(
      (candidate) =>
        submitted === candidate ||
        submitted.includes(candidate) ||
        candidate.includes(submitted)
    );

    await prisma.checkpointAttempt.create({
      data: {
        userId,
        caseFileId: userCase.caseFileId,
        stage: userCase.currentStage,
        answer: parsed.data.answer,
        isCorrect,
      },
    });

    if (!isCorrect) {
      return NextResponse.json(
        { message: "That answer does not unlock the next stage yet." },
        { status: 400 }
      );
    }

    const nextStage = userCase.currentStage + 1;
    const finalStageUnlocked = nextStage >= userCase.caseFile.maxStage;

    await prisma.userCase.update({
      where: { id: userCase.id },
      data: {
        currentStage: nextStage,
        status: finalStageUnlocked ? "FINAL_REVIEW" : "ACTIVE",
        firstOpenedAt: userCase.firstOpenedAt ?? new Date(),
        lastViewedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        message: checkpoint.successMessage,
        currentStage: nextStage,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Checkpoint route error:", error);

    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}