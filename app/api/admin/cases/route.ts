import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminCaseSchema } from "@/lib/validators";
import { requireAdmin } from "@/lib/auth-helpers";

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const parsed = adminCaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existing = await prisma.caseFile.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      return NextResponse.json(
        { message: "A case with that slug already exists." },
        { status: 409 }
      );
    }

    const createdCase = await prisma.caseFile.create({
  data: {
    slug: data.slug,
    title: data.title,
    summary: data.summary,
    players: data.players,
    duration: data.duration,
    difficulty: data.difficulty,
    maxStage: data.maxStage,
    solutionSuspect: data.solutionSuspect,
    solutionMotive: data.solutionMotive,
    solutionEvidence: data.solutionEvidence,
    debriefOverview: data.debriefOverview,
    debriefWhatHappened: data.debriefWhatHappened,
    debriefWhyItWorked: data.debriefWhyItWorked,
    debriefClosing: data.debriefClosing,
    workflowStatus: "DRAFT",
    publishedAt: null,
    isActive: true,
  },
});

    if (data.initialActivationCode) {
      await prisma.activationCode.create({
        data: {
          code: data.initialActivationCode,
          caseFileId: createdCase.id,
        },
      });
    }

    return NextResponse.json(
      { message: "Case created successfully." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin create case error:", error);

    return NextResponse.json(
      { message: "Something went wrong while creating the case." },
      { status: 500 }
    );
  }
}