/**
 * POST /api/admin/support/[id]/reply
 *
 * Send an email reply to the original sender of a SupportMessage.
 *
 * TODO: wire an email transport. As of this commit there is no
 * transport library installed (no nodemailer / resend / etc.). Until
 * one is added, the route validates the body, confirms the message
 * exists, and returns 200 { sent: false, reason: "email transport not
 * configured" } so the admin UI can surface the truth without erroring.
 *
 * When a transport is added, persist the reply in a SupportReply table
 * (model not yet in schema) and call the transport from inside this
 * handler.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { supportReplySchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId)) {
    return NextResponse.json({ message: "Invalid id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = supportReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const message = await prisma.supportMessage.findUnique({
    where: { id: parsedId },
  });
  if (!message) {
    return NextResponse.json(
      { message: "Support message not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      sent: false,
      reason: "email transport not configured",
    },
    { status: 200 }
  );
}
