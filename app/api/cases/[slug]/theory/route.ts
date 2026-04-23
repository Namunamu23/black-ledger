import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { theorySubmissionSchema } from "@/lib/validators";
import { evaluateTheorySubmission } from "@/lib/case-evaluation";
import {
  transitionUserCase,
  type UserCaseEvent,
} from "@/lib/user-case-state";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limit = await rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { message: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const { slug } = await params;

  const session = await auth();
  const userId = Number((session?.user as { id?: string } | undefined)?.id);

  if (!session?.user || !Number.isInteger(userId)) {
    return NextResponse.json(
      { message: "You must be logged in to submit a theory." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = theorySubmissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid submission." },
        { status: 400 }
      );
    }

    const ownedCase = await prisma.userCase.findFirst({
      where: {
        userId,
        caseFile: { slug },
      },
      include: {
        caseFile: true,
      },
    });

    if (!ownedCase) {
      return NextResponse.json(
        { message: "You do not own this case." },
        { status: 403 }
      );
    }

    if (ownedCase.currentStage < ownedCase.caseFile.maxStage) {
      return NextResponse.json(
        { message: "Theory submission unlocks only at the final stage." },
        { status: 400 }
      );
    }

    const evaluation = evaluateTheorySubmission({
      suspectName: parsed.data.suspectName,
      motive: parsed.data.motive,
      evidenceSummary: parsed.data.evidenceSummary,
      solutionSuspect: ownedCase.caseFile.solutionSuspect,
      solutionMotive: ownedCase.caseFile.solutionMotive,
      solutionEvidence: ownedCase.caseFile.solutionEvidence,
    });

    const currentStatus = ownedCase.status;
    const eventMap: Record<string, UserCaseEvent> = {
      CORRECT: "THEORY_CORRECT",
      PARTIAL: "THEORY_PARTIAL",
      INCORRECT: "THEORY_INCORRECT",
    };
    const event: UserCaseEvent =
      eventMap[evaluation.resultLabel] ?? "THEORY_INCORRECT";
    const transitionResult = transitionUserCase(currentStatus, event);
    const newStatus =
      typeof transitionResult === "string" ? transitionResult : currentStatus;

    const becameSolvedNow =
      newStatus === "SOLVED" && currentStatus !== "SOLVED";
    const completedAt = becameSolvedNow
      ? ownedCase.completedAt ?? new Date()
      : ownedCase.completedAt;

    await prisma.$transaction(async (tx) => {
      await tx.theorySubmission.create({
        data: {
          userId,
          caseFileId: ownedCase.caseFileId,
          suspectName: parsed.data.suspectName,
          motive: parsed.data.motive,
          evidenceSummary: parsed.data.evidenceSummary,
          suspectCorrect: evaluation.suspectCorrect,
          motiveCorrect: evaluation.motiveCorrect,
          evidenceCorrect: evaluation.evidenceCorrect,
          score: evaluation.score,
          resultLabel: evaluation.resultLabel,
          feedback: evaluation.feedback,
        },
      });

      await tx.userCase.update({
        where: { id: ownedCase.id },
        data: {
          status: newStatus,
          completedAt,
          lastViewedAt: new Date(),
        },
      });

      await tx.userCaseEvent.create({
        data: {
          userCaseId: ownedCase.id,
          type: event,
          payload: {
            suspectName: parsed.data.suspectName,
            score: evaluation.score,
            resultLabel: evaluation.resultLabel,
          },
        },
      });
    });

    return NextResponse.json(
      {
        message: "Theory submitted successfully.",
        resultLabel: evaluation.resultLabel,
        feedback: evaluation.feedback,
        score: evaluation.score,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Theory submission error:", error);

    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}