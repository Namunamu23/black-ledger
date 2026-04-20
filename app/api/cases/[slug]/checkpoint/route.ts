import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkpointAnswerSchema } from "@/lib/validators";
import { normalizeIdentity, tokenize } from "@/lib/text-utils";

const CHECKPOINT_JACCARD_THRESHOLD = 0.45;
const MIN_NORMALIZED_LENGTH = 3;

/**
 * Match a player's checkpoint answer against the pipe-separated accepted
 * answers for the current stage.
 *
 * Returns true when the normalized submission either equals any candidate
 * exactly (after lowercasing, whitespace collapse, punctuation strip), OR
 * when its token set has a Jaccard similarity ≥ 0.45 with any candidate's
 * token set. Submissions whose normalized form is shorter than 3 characters
 * are rejected outright — substrings of accepted answers (e.g. "log" against
 * "badge access log") cannot pass.
 */
function matchesAcceptedAnswer(
  submission: string,
  acceptedAnswers: string
): boolean {
  const normalizedSubmission = normalizeIdentity(submission);
  if (normalizedSubmission.length < MIN_NORMALIZED_LENGTH) return false;

  const candidates = acceptedAnswers
    .split("|")
    .map((c) => normalizeIdentity(c))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === normalizedSubmission) return true;
  }

  const submissionTokens = tokenize(submission);
  if (submissionTokens.size === 0) return false;

  for (const candidate of candidates) {
    const candidateTokens = tokenize(candidate);
    if (candidateTokens.size === 0) continue;

    const intersection = new Set(
      [...submissionTokens].filter((t) => candidateTokens.has(t))
    );
    const union = new Set([...submissionTokens, ...candidateTokens]);
    const jaccard = intersection.size / union.size;

    if (jaccard >= CHECKPOINT_JACCARD_THRESHOLD) return true;
  }

  return false;
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

    const isCorrect = matchesAcceptedAnswer(
      parsed.data.answer,
      checkpoint.acceptedAnswers
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