import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getResend, getResendFrom } from "@/lib/resend";
import { ActivationCodeSource, OrderStatus } from "@/lib/enums";

export const runtime = "nodejs";

const RANDOM_PART_LENGTH = 8;

function randomTail(): string {
  return randomBytes(8)
    .toString("base64url")
    .replace(/[-_]/g, "X")
    .slice(0, RANDOM_PART_LENGTH)
    .toUpperCase();
}

function buildPurchaseCode(slug: string): string {
  const prefix = slug.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16);
  return `${prefix}-${randomTail()}`;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { message: "Webhook is not configured." },
      { status: 503 }
    );
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { message: "Missing signature." },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe webhook signature failure:", message);
    return NextResponse.json(
      { message: "Invalid signature." },
      { status: 400 }
    );
  }

  console.log(`Stripe webhook received: ${event.type} ${event.id}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        // Ignore unhandled event types — Stripe will keep delivering the
        // ones we subscribed to in the dashboard.
        break;
    }
  } catch (error) {
    console.error(`Stripe webhook handler error (${event.type}):`, error);
    return NextResponse.json(
      { message: "Handler failure." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const order = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
    include: { caseFile: { select: { id: true, slug: true, title: true } } },
  });

  if (!order) {
    console.warn(
      `checkout.session.completed for unknown session ${session.id}`
    );
    return;
  }

  if (order.status === OrderStatus.COMPLETE) {
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  let code = buildPurchaseCode(order.caseFile.slug);
  for (let attempt = 0; attempt < 3; attempt++) {
    const collision = await prisma.activationCode.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!collision) break;
    code = buildPurchaseCode(order.caseFile.slug);
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const activationCode = await tx.activationCode.create({
      data: {
        code,
        caseFileId: order.caseFileId,
        source: ActivationCodeSource.PURCHASE,
      },
    });

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.COMPLETE,
        stripePaymentIntent: paymentIntentId,
        activationCodeId: activationCode.id,
      },
      include: {
        activationCode: { select: { code: true } },
        caseFile: { select: { title: true } },
      },
    });
  });

  if (!updatedOrder.activationCode) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const unlockUrl = `${appUrl}/bureau/unlock`;
  const code1 = updatedOrder.activationCode.code;
  const caseTitle = updatedOrder.caseFile.title;

  try {
    await getResend().emails.send({
      from: getResendFrom(),
      to: order.email,
      subject: "Your Black Ledger activation code",
      text: [
        `Your kit for "${caseTitle}" is ready to play.`,
        "",
        `Activation code: ${code1}`,
        "",
        `Sign in to the bureau and redeem at: ${unlockUrl}`,
        "",
        "If you have any trouble, reply to this email.",
      ].join("\n"),
      html: `
        <div style="font-family: ui-sans-serif, system-ui, sans-serif; color:#0f172a; line-height:1.6;">
          <p>Your kit for <strong>${escapeHtml(caseTitle)}</strong> is ready to play.</p>
          <p style="font-size:18px;">Activation code:
            <code style="background:#f1f5f9; padding:4px 8px; border-radius:6px; font-family:ui-monospace, monospace;">${escapeHtml(code1)}</code>
          </p>
          <p>
            Sign in to the bureau and redeem at:
            <a href="${unlockUrl}">${unlockUrl}</a>
          </p>
          <p style="color:#64748b; font-size:12px;">If you have any trouble, reply to this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Resend send failure:", error);
    // Don't throw — the Order is already COMPLETE and the code minted.
    // Player can recover via the success page or by contacting support.
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const order = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true, status: true },
  });
  if (!order || order.status !== OrderStatus.PENDING) return;
  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.FAILED },
  });
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
  const order = await prisma.order.findFirst({
    where: { stripePaymentIntent: intent.id },
    select: { id: true, status: true },
  });
  if (!order || order.status === OrderStatus.COMPLETE) return;
  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.FAILED },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
