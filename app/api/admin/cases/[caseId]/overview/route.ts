import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { overviewPatchSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function PATCH(
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
  const parsed = overviewPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const submittedKeys = Object.keys(data);

  if (submittedKeys.length === 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const existing = await prisma.caseFile.findUnique({
    where: { id: parsedCaseId },
  });
  if (!existing) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  const slugChanged =
    data.slug !== undefined && data.slug !== existing.slug;

  // Slug uniqueness check (and history-conflict check) only when the slug
  // is actually changing. Two failure modes both return 409:
  //   - another live CaseFile already uses this slug
  //   - another case's history already retired this slug as an oldSlug
  // History rows belonging to THIS case are not a conflict — admins may
  // self-revert a rename and the upsert below re-points the row.
  if (slugChanged) {
    const liveConflict = await prisma.caseFile.findFirst({
      where: { slug: data.slug, NOT: { id: parsedCaseId } },
    });
    if (liveConflict) {
      return NextResponse.json(
        { message: "Another case already uses that slug." },
        { status: 409 }
      );
    }
    const historyConflict = await prisma.caseSlugHistory.findFirst({
      where: { oldSlug: data.slug, NOT: { caseFileId: parsedCaseId } },
    });
    if (historyConflict) {
      return NextResponse.json(
        {
          message:
            "That slug was previously used by another case and is reserved.",
        },
        { status: 409 }
      );
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.caseFile.update({ where: { id: parsedCaseId }, data });

      if (slugChanged) {
        // Upsert (not create) so a self-revert (A → B → A) updates the
        // existing oldSlug row instead of throwing P2002 on the unique
        // index. The pre-checks above prevent stealing another case's
        // history row.
        await tx.caseSlugHistory.upsert({
          where: { oldSlug: existing.slug },
          update: { caseFileId: parsedCaseId },
          create: {
            caseFileId: parsedCaseId,
            oldSlug: existing.slug,
          },
        });
      }

      await tx.caseAudit.create({
        data: {
          caseFileId: parsedCaseId,
          userId,
          action: "UPDATE_OVERVIEW",
          diff: { caseFile: submittedKeys },
        },
      });
    });
  } catch (error) {
    const maybe = error as { code?: string };
    if (maybe.code === "P2002") {
      // Concurrent admin save raced past the slug pre-check. Return 409
      // with a reload hint instead of a generic 500. Mirrors the legacy
      // aggregate PUT's outer catch in this same case-id route family.
      return NextResponse.json(
        {
          message:
            "Another admin save changed this case while you were editing. Please reload and try again.",
        },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
