import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json(
      { message: "Unauthorized." },
      { status: 403 }
    );
  }

  const { caseId } = await params;
  const parsedCaseId = Number(caseId);

  if (!Number.isInteger(parsedCaseId)) {
    return NextResponse.json(
      { message: "Invalid case id." },
      { status: 400 }
    );
  }

  try {
    const caseFile = await prisma.caseFile.findUnique({
      where: { id: parsedCaseId },
    });

    if (!caseFile) {
      return NextResponse.json(
        { message: "Case not found." },
        { status: 404 }
      );
    }

    const updated = await prisma.caseFile.update({
      where: { id: caseFile.id },
      data: {
        isActive: !caseFile.isActive,
      },
    });

    return NextResponse.json(
      {
        message: `Case is now ${updated.isActive ? "active" : "inactive"}.`,
        isActive: updated.isActive,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Toggle case status error:", error);

    return NextResponse.json(
      { message: "Something went wrong while updating case status." },
      { status: 500 }
    );
  }
}