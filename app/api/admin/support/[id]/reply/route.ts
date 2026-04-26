// POST /api/admin/support/[id]/reply — sends a Resend email reply to the original sender.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { supportReplySchema } from "@/lib/validators";
import { getResend, getResendFrom } from "@/lib/resend";

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

  const appName = "Black Ledger";

  try {
    await getResend().emails.send({
      from: getResendFrom(),
      to: message.email,
      subject: `Re: Your message to ${appName}`,
      text: [
        `Hi ${message.name},`,
        "",
        parsed.data.body,
        "",
        "— The Black Ledger Team",
      ].join("\n"),
      html: `
        <div style="font-family: ui-sans-serif, system-ui, sans-serif; color:#0f172a; line-height:1.6;">
          <p>Hi ${escapeHtml(message.name)},</p>
          ${parsed.data.body
            .split("\n")
            .map((line) => `<p>${escapeHtml(line)}</p>`)
            .join("")}
          <p style="color:#64748b; font-size:12px;">— The Black Ledger Team</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Support reply send failure for message", message.id, ":", error);
    return NextResponse.json(
      { sent: false, reason: "Email transport error. See server logs." },
      { status: 502 }
    );
  }

  await prisma.supportMessage.update({
    where: { id: parsedId },
    data: { status: "HANDLED" },
  });

  return NextResponse.json({ sent: true }, { status: 200 });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
