import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { requireSessionJson } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { deleteAccountSchema } from "@/lib/validators";
import { UserRole } from "@/lib/enums";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  // Tight rate limit. Account deletion is a high-impact one-time action;
  // 3/60s is enough for retry-after-typo, far less than enough for abuse.
  const limit = await rateLimit(request, { limit: 3, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { message: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const sessionOrErr = await requireSessionJson();
  if (sessionOrErr instanceof NextResponse) return sessionOrErr;
  const userId = Number(sessionOrErr.user.id);

  const body = await request.json().catch(() => null);
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, passwordHash: true },
  });

  if (!user) {
    // Session was valid (tokenVersion check passed) but the User row is
    // gone — treat as already-deleted and return success.
    return NextResponse.json({ message: "Account deleted." }, { status: 200 });
  }

  // Refuse admin self-deletion via this endpoint. Admin deletion is a
  // low-frequency, high-risk operation that needs operator review (transfer
  // of CaseAudit ownership, confirmation of no in-flight admin work). The
  // Privacy Policy commitment is still met — admins email support for
  // manual deletion. CaseAudit.userId is RESTRICT-FK'd, so a programmatic
  // admin delete would also fail at the DB layer for any admin who has
  // ever audited a case.
  if (user.role === UserRole.ADMIN) {
    return NextResponse.json(
      {
        message:
          "Admin accounts cannot be self-deleted. Contact support@theblackledger.app.",
      },
      { status: 403 }
    );
  }

  const passwordMatches = await compare(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    return NextResponse.json(
      { message: "Incorrect password." },
      { status: 401 }
    );
  }

  // Cascade-delete. Schema cascades handle:
  //   User → UserCase (cascade, also drops UserCaseEvent)
  //   User → TheorySubmission (cascade)
  //   User → CheckpointAttempt (cascade)
  //   User → AccessCodeRedemption (cascade)
  //   User → ActivationCode.claimedByUserId (SetNull — preserves the code
  //                                          row but un-claims it)
  //
  // Order has no FK to User by design (Batch 5 deferred Order.userId), so
  // financial records persist after user deletion — Order.email remains as
  // the buyer-of-record identifier, satisfying tax-retention obligations
  // documented in the Privacy Policy §8.
  //
  // We also explicitly stamp `revokedAt` on every activation code the user
  // had claimed BEFORE deleting. Without this, the SetNull cascade leaves
  // codes with `claimedAt` set + `claimedByUserId` null, which the activate
  // route treats as "unclaimed" and lets a fresh account re-redeem (the
  // re-claim loop documented as Batch 6 Observation 2 and re-flagged in the
  // 2026-05-06 audit as F-03).
  //
  // Both writes are wrapped in a single transaction so a partial failure
  // (DB hiccup mid-delete) leaves the user's data intact rather than the
  // codes pre-revoked but the user still present.
  await prisma.$transaction([
    prisma.activationCode.updateMany({
      where: { claimedByUserId: userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return NextResponse.json({ message: "Account deleted." }, { status: 200 });
}
