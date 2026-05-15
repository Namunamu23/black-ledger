import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

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

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const userId = Number(guard.user.id);

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

    // Wrap the create + audit in a transaction (Batch 17). This is the
    // legacy single-code generation path; the modern batch route at
    // ../codes/route.ts uses action="GENERATE_ACTIVATION_CODES". The two
    // distinct actions let the operator distinguish surface in the
    // forensic trail. The generated `code` value is NOT in the diff —
    // it's a redeemable secret that lives in the activation_code table
    // until claim and shouldn't be duplicated into an audit log.
    const created = await prisma.$transaction(async (tx) => {
      const activationCode = await tx.activationCode.create({
        data: {
          code,
          caseFileId: caseFile.id,
        },
      });

      await tx.caseAudit.create({
        data: {
          caseFileId: caseFile.id,
          userId,
          action: "GENERATE_ACTIVATION_CODE_LEGACY",
          diff: { activationCodeId: activationCode.id },
        },
      });

      return activationCode;
    });

    return NextResponse.json(
      {
        message: `Activation code created: ${created.code}`,
        code: created.code,
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