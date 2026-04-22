import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { redeemAccessCodeSchema } from "@/lib/validators";

type UnlocksTarget = { type: string; id: number };

async function resolveContent(unlocksTarget: unknown) {
  const target = unlocksTarget as UnlocksTarget;

  if (target?.type === "record") {
    const record = await prisma.caseRecord.findUnique({
      where: { id: target.id },
    });
    return { type: "record", record };
  }

  if (target?.type === "person") {
    const person = await prisma.casePerson.findUnique({
      where: { id: target.id },
    });
    return { type: "person", person };
  }

  if (target?.type === "hint") {
    const hint = await prisma.caseHint.findUnique({
      where: { id: target.id },
    });
    return { type: "hint", hint };
  }

  return { type: target?.type ?? "unknown", raw: unlocksTarget };
}

export async function POST(request: Request) {
  const limit = await rateLimit(request, { limit: 5, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { message: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const session = await auth();
  const userId = Number((session?.user as { id?: string } | undefined)?.id);

  if (!session?.user || !Number.isInteger(userId)) {
    return NextResponse.json(
      { message: "You must be logged in to redeem a code." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = redeemAccessCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const accessCode = await prisma.accessCode.findUnique({
    where: { code: parsed.data.code },
  });

  if (!accessCode) {
    return NextResponse.json({ message: "Code not found." }, { status: 404 });
  }

  if (accessCode.retiredAt && accessCode.retiredAt <= new Date()) {
    return NextResponse.json(
      { message: "This code has been retired." },
      { status: 410 }
    );
  }

  if (accessCode.requiresStage !== null) {
    const userCase = await prisma.userCase.findFirst({
      where: { userId, caseFileId: accessCode.caseFileId },
    });

    if (!userCase) {
      return NextResponse.json(
        { message: "You have not activated this case." },
        { status: 403 }
      );
    }

    if (userCase.currentStage < accessCode.requiresStage) {
      return NextResponse.json(
        { message: "You have not reached the required stage yet." },
        { status: 403 }
      );
    }
  }

  if (accessCode.oneTimePerUser) {
    const existing = await prisma.accessCodeRedemption.findFirst({
      where: { accessCodeId: accessCode.id, userId },
    });
    if (existing) {
      const content = await resolveContent(accessCode.unlocksTarget);
      return NextResponse.json(
        {
          alreadyRedeemed: true,
          unlocksTarget: accessCode.unlocksTarget,
          content,
        },
        { status: 200 }
      );
    }
  }

  try {
    await prisma.accessCodeRedemption.create({
      data: {
        accessCodeId: accessCode.id,
        userId,
        caseFileId: accessCode.caseFileId,
      },
    });
  } catch (error) {
    // P2002 = unique constraint violation on (accessCodeId, userId).
    // Race condition: a concurrent request created the redemption first,
    // OR the user is replaying a non-oneTimePerUser code. Either way the
    // user already has the unlock — surface it as alreadyRedeemed instead
    // of a 500.
    const maybe = error as { code?: string };
    if (maybe.code === "P2002") {
      const content = await resolveContent(accessCode.unlocksTarget);
      return NextResponse.json(
        {
          alreadyRedeemed: true,
          unlocksTarget: accessCode.unlocksTarget,
          content,
        },
        { status: 200 }
      );
    }
    throw error;
  }

  const content = await resolveContent(accessCode.unlocksTarget);

  return NextResponse.json(
    {
      alreadyRedeemed: false,
      unlocksTarget: accessCode.unlocksTarget,
      content,
    },
    { status: 200 }
  );
}
