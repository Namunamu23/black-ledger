import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { getResend, getResendFrom } from "@/lib/resend";

// Always-200 message — never disclose whether an email is registered.
const GENERIC_OK = "If that email is registered, a reset link has been sent.";

export async function POST(request: Request) {
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

  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      // Return 200 even on bad input to avoid email enumeration via error codes.
      return NextResponse.json({ message: GENERIC_OK }, { status: 200 });
    }

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      // Same 200 response — don't reveal whether the account exists.
      return NextResponse.json({ message: GENERIC_OK }, { status: 200 });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    try {
      await getResend().emails.send({
        from: getResendFrom(),
        to: email,
        subject: "Reset your Black Ledger password",
        text: [
          "You requested a password reset for your Black Ledger account.",
          "",
          `Reset your password here: ${resetUrl}`,
          "",
          "This link expires in 1 hour.",
          "If you did not request this, you can safely ignore this email — your password has not changed.",
        ].join("\n"),
        html: `
          <div style="font-family: ui-sans-serif, system-ui, sans-serif; color:#0f172a; line-height:1.6;">
            <p>You requested a password reset for your <strong>Black Ledger</strong> account.</p>
            <p>
              <a href="${resetUrl}" style="display:inline-block; background:#d97706; color:#fff; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:600;">Reset Password</a>
            </p>
            <p style="color:#475569; font-size:13px;">Or copy this link:<br/>
              <code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:12px;">${resetUrl}</code>
            </p>
            <p style="color:#94a3b8; font-size:12px;">This link expires in 1 hour. If you did not request this, you can safely ignore this email — your password has not changed.</p>
          </div>
        `,
      });
    } catch (emailError) {
      // Log but do not expose — return 200 so the client's "check your inbox"
      // message still shows. The user can try again if the email doesn't arrive.
      console.error("Forgot-password email send failure:", emailError);
    }

    return NextResponse.json({ message: GENERIC_OK }, { status: 200 });
  } catch (error) {
    console.error("Forgot-password route error:", error);
    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
