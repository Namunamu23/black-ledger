import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { createAccessCodeSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  // Rate-limit the admin GET — listing AccessCodes exposes which evidence
  // rows each code unlocks, plus redemption counts. A compromised admin
  // session iterating caseId values could map the entire game state.
  // 30/60s per (ip, route) is well above legitimate admin navigation.
  // (Batch 17.)
  const limit = await rateLimit(request, { limit: 30, windowMs: 60_000 });
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

  const { caseId } = await params;
  const parsedCaseId = Number(caseId);
  if (!Number.isInteger(parsedCaseId)) {
    return NextResponse.json({ message: "Invalid case id." }, { status: 400 });
  }

  const codes = await prisma.accessCode.findMany({
    where: { caseFileId: parsedCaseId },
    include: { redemptions: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ codes }, { status: 200 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const limit = await rateLimit(request, { limit: 60, windowMs: 60_000 });
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
    return NextResponse.json({ message: "Invalid case id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createAccessCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const caseFile = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
    select: { id: true },
  });
  if (!caseFile) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  // Validate unlocksTarget resolves to a row that belongs to THIS case.
  // Without this check, an admin could point an AccessCode at a row from
  // a different case and silently cross-contaminate content.
  const { type, id } = parsed.data.unlocksTarget;
  let targetExists = false;
  if (type === "record") {
    const row = await prisma.caseRecord.findUnique({
      where: { id },
      select: { caseFileId: true },
    });
    targetExists = row?.caseFileId === parsedCaseId;
  } else if (type === "person") {
    const row = await prisma.casePerson.findUnique({
      where: { id },
      select: { caseFileId: true },
    });
    targetExists = row?.caseFileId === parsedCaseId;
  } else if (type === "hint") {
    const row = await prisma.caseHint.findUnique({
      where: { id },
      select: { caseFileId: true },
    });
    targetExists = row?.caseFileId === parsedCaseId;
  } else if (type === "hidden_evidence") {
    const row = await prisma.hiddenEvidence.findUnique({
      where: { id },
      select: { caseFileId: true },
    });
    targetExists = row?.caseFileId === parsedCaseId;
  }

  if (!targetExists) {
    return NextResponse.json(
      { message: `${type} #${id} does not exist in this case.` },
      { status: 422 }
    );
  }

  try {
    // Wrap the create + audit in a transaction (Batch 17). AccessCodes
    // unlock hidden evidence and hints — the forensic trail of who minted
    // which code (and what target it points at) is part of game-integrity
    // monitoring. The code itself is intentionally NOT logged in the diff
    // (it's a redeemable secret that survives in the codes table).
    const created = await prisma.$transaction(async (tx) => {
      const accessCode = await tx.accessCode.create({
        data: {
          code: parsed.data.code,
          kind: parsed.data.kind,
          caseFileId: parsedCaseId,
          unlocksTarget: parsed.data.unlocksTarget,
          requiresStage: parsed.data.requiresStage ?? null,
        },
      });

      await tx.caseAudit.create({
        data: {
          caseFileId: parsedCaseId,
          userId,
          action: "CREATE_ACCESS_CODE",
          diff: {
            accessCodeId: accessCode.id,
            kind: parsed.data.kind,
            unlocksTarget: parsed.data.unlocksTarget,
            requiresStage: parsed.data.requiresStage ?? null,
          },
        },
      });

      return accessCode;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const maybe = error as { code?: string };
    if (maybe.code === "P2002") {
      return NextResponse.json(
        { message: "A code with that value already exists." },
        { status: 409 }
      );
    }
    throw error;
  }
}
