import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { revokeCodeSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; codeId: string }> }
) {
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

  const existing = await prisma.activationCode.findUnique({
    where: { id: parsedCodeId },
  });
  if (!existing || existing.caseFileId !== parsedCaseId) {
    return NextResponse.json(
      { message: "Activation code not found." },
      { status: 404 }
    );
  }

  if (existing.revokedAt !== null) {
    return NextResponse.json({ message: "Already revoked" }, { status: 409 });
  }

  await prisma.activationCode.update({
    where: { id: parsedCodeId },
    data: { revokedAt: new Date(parsed.data.revokedAt) },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
