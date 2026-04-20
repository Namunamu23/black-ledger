import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

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