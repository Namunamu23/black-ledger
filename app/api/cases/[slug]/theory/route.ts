import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { theorySubmissionSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
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

    await prisma.theorySubmission.create({
      data: {
        userId,
        caseFileId: ownedCase.caseFileId,
        suspectName: parsed.data.suspectName,
        motive: parsed.data.motive,
        evidenceSummary: parsed.data.evidenceSummary,
      },
    });

    return NextResponse.json(
      { message: "Theory submitted successfully." },
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