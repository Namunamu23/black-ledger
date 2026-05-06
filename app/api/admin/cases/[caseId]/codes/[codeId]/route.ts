import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { revokeCodeSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; codeId: string }> }
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

  const { caseId, codeId } = await params;
  const parsedCaseId = Number(caseId);
  const parsedCodeId = Number(codeId);
  if (!Number.isInteger(parsedCaseId) || !Number.isInteger(parsedCodeId)) {
    return NextResponse.json(
      { message: "Invalid id." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = revokeCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  // Atomic: only revoke if not already revoked AND the code belongs to this
  // case. count===0 means either the code doesn't exist, the case ownership
  // doesn't match, OR it's already revoked. Distinguish those cases via a
  // follow-up findUnique only on miss, to give the admin a clear 404-vs-409
  // (and avoid leaking the existence of codes belonging to other cases).
  const result = await prisma.activationCode.updateMany({
    where: {
      id: parsedCodeId,
      caseFileId: parsedCaseId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  if (result.count === 0) {
    const exists = await prisma.activationCode.findUnique({
      where: { id: parsedCodeId },
      select: { id: true, caseFileId: true, revokedAt: true },
    });
    if (!exists || exists.caseFileId !== parsedCaseId) {
      return NextResponse.json(
        { message: "Activation code not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ message: "Already revoked" }, { status: 409 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
