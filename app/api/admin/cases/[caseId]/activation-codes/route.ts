import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

function generateCode(prefix: string) {
  const cleanPrefix = prefix
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();

  const randomPart = randomBytes(4).toString("hex").toUpperCase();

  return `${cleanPrefix}-${randomPart}`;
}

export async function POST(
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

    let code = generateCode(caseFile.slug);

    while (
      await prisma.activationCode.findUnique({
        where: { code },
      })
    ) {
      code = generateCode(caseFile.slug);
    }

    await prisma.activationCode.create({
      data: {
        code,
        caseFileId: caseFile.id,
      },
    });

    return NextResponse.json(
      {
        message: `Activation code created: ${code}`,
        code,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Generate activation code error:", error);

    return NextResponse.json(
      { message: "Something went wrong while creating the activation code." },
      { status: 500 }
    );
  }
}