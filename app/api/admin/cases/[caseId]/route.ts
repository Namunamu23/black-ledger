import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminCaseContentSchema } from "@/lib/validators";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
  }

  const { caseId } = await params;
  const parsedCaseId = Number(caseId);

  if (!Number.isInteger(parsedCaseId)) {
    return NextResponse.json({ message: "Invalid case id." }, { status: 400 });
  }

  const caseFile = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
    include: {
      people: { orderBy: { sortOrder: "asc" } },
      records: { orderBy: { sortOrder: "asc" } },
      hints: { orderBy: [{ unlockStage: "asc" }, { sortOrder: "asc" }] },
      checkpoints: { orderBy: { stage: "asc" } },
    },
  });

  if (!caseFile) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  return NextResponse.json(caseFile);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
  }

  const { caseId } = await params;
  const parsedCaseId = Number(caseId);

  if (!Number.isInteger(parsedCaseId)) {
    return NextResponse.json({ message: "Invalid case id." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = adminCaseContentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existing = await prisma.caseFile.findUnique({
      where: { id: parsedCaseId },
    });

    if (!existing) {
      return NextResponse.json({ message: "Case not found." }, { status: 404 });
    }

    const slugConflict = await prisma.caseFile.findFirst({
      where: {
        slug: data.slug,
        NOT: { id: parsedCaseId },
      },
    });

    if (slugConflict) {
      return NextResponse.json(
        { message: "Another case already uses that slug." },
        { status: 409 }
      );
    }

    const invalidUnlockStage =
      [...data.people, ...data.records, ...data.hints].some(
        (item) => item.unlockStage > data.maxStage
      ) ||
      data.checkpoints.some((item) => item.stage >= data.maxStage);

    if (invalidUnlockStage) {
      return NextResponse.json(
        {
          message:
            "Unlock stages must not exceed maxStage, and checkpoint stages must be lower than maxStage.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.caseFile.update({
        where: { id: parsedCaseId },
        data: {
          title: data.title,
          slug: data.slug,
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
          isActive: data.isActive,
        },
      }),

      prisma.casePerson.deleteMany({
        where: { caseFileId: parsedCaseId },
      }),
      prisma.caseRecord.deleteMany({
        where: { caseFileId: parsedCaseId },
      }),
      prisma.caseHint.deleteMany({
        where: { caseFileId: parsedCaseId },
      }),
      prisma.caseCheckpoint.deleteMany({
        where: { caseFileId: parsedCaseId },
      }),

      prisma.casePerson.createMany({
        data: data.people.map((item) => ({
          caseFileId: parsedCaseId,
          ...item,
        })),
      }),

      prisma.caseRecord.createMany({
        data: data.records.map((item) => ({
          caseFileId: parsedCaseId,
          ...item,
        })),
      }),

      prisma.caseHint.createMany({
        data: data.hints.map((item) => ({
          caseFileId: parsedCaseId,
          ...item,
        })),
      }),

      prisma.caseCheckpoint.createMany({
        data: data.checkpoints.map((item) => ({
          caseFileId: parsedCaseId,
          ...item,
        })),
      }),
    ]);

    return NextResponse.json(
      { message: "Case content updated successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin case update error:", error);

    return NextResponse.json(
      { message: "Something went wrong while updating the case." },
      { status: 500 }
    );
  }
}