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
      case "checkout.session.async_payment_failed":
        await handleCheckoutAsyncPaymentFailed(event.data.object as Stripe.Checkout.Session);
        break;
      default:
        // Ignore unhandled event types — Stripe will keep delivering the
        // ones we subscribed to in the dashboard.
        break;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_COMPLETED_BY_CONCURRENT_DELIVERY") {
      // Another concurrent invocation already completed this Order and sent
      // the email. Idempotent return — do not re-mint a code or re-send the email.
      return NextResponse.json({ received: true }, { status: 200 });
    }
    console.error(`Stripe webhook handler error (${event.type}):`, error);
    return NextResponse.json(
      { message: "Handler failure." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const existingOrder = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
    include: { caseFile: { select: { id: true, slug: true, title: true } } },
  });

  // Idempotency: webhook re-delivery after a successful run is a no-op.
  // The first run set status to COMPLETE; subsequent deliveries should
  // not mint a second activation code or send a second email.
  if (existingOrder?.status === OrderStatus.COMPLETE) {
    return;
  }

  // Resolve the case file + buyer email, either from the existing Order
  // or from session metadata (recovery path for the rare case where
  // /api/checkout's Stripe session create succeeded but the immediately
  // following prisma.order.create failed — e.g. transient DB outage).
  // Without this branch, the customer pays Stripe and never gets a code;
  // recovery synthesizes the Order from the metadata that /api/checkout
  // attached at session-create time.
  let caseFile: { id: number; slug: string; title: string };
  let buyerEmail: string;

  if (existingOrder) {
    caseFile = existingOrder.caseFile;
    buyerEmail = existingOrder.email;
  } else {
    const metadataCaseId = Number(session.metadata?.caseId);
    const metadataEmail = session.metadata?.email;
    if (!Number.isInteger(metadataCaseId) || !metadataEmail) {
      console.error(
        "[STRIPE-ORPHAN] checkout.session.completed — no Order found and metadata insufficient for recovery. " +
        "Manual investigation required. " +
        `session_id=${session.id} ` +
        `customer_email=${session.customer_details?.email ?? session.customer_email ?? "unknown"} ` +
        `amount_total=${session.amount_total ?? "unknown"} ` +
        `metadata=${JSON.stringify(session.metadata ?? {})}`
      );
      throw new Error(`STRIPE_ORPHAN:${session.id}`);
    }

    const recoveredCase = await prisma.caseFile.findUnique({
      where: { id: metadataCaseId },
      select: { id: true, slug: true, title: true },
    });
    if (!recoveredCase) {
      console.error(
        "[STRIPE-ORPHAN] checkout.session.completed — Order recovery failed: caseFile not found. " +
        "Manual investigation required. " +
        `session_id=${session.id} ` +
        `metadata_caseId=${metadataCaseId} ` +
        `buyer_email=${metadataEmail}`
      );
      throw new Error(`STRIPE_ORPHAN_NO_CASE:${session.id}`);
    }

    console.warn(
      `checkout.session.completed for unknown session ${session.id}; recovering Order from metadata (caseId=${metadataCaseId})`
    );

    caseFile = recoveredCase;
    buyerEmail = metadataEmail;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  let code = buildPurchaseCode(caseFile.slug);
  for (let attempt = 0; attempt < 3; attempt++) {
    const collision = await prisma.activationCode.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!collision) break;
    code = buildPurchaseCode(caseFile.slug);
  }

  // The recovery Order.create lives INSIDE this $transaction so that the
  // recovery, the ActivationCode mint, and the Order.update either all
  // commit or all roll back. Splitting the recovery create into a
  // pre-transaction write would re-introduce the orphan-pay window the
  // recovery branch is meant to close.
  const updatedOrder = await prisma.$transaction(async (tx) => {
    const orderRow = existingOrder
      ? existingOrder
      : await tx.order.create({
          data: {
            stripeSessionId: session.id,
            email: buyerEmail,
            caseFileId: caseFile.id,
            status: OrderStatus.PENDING,
          },
        });

    // Concurrency precondition: only one transaction can flip PENDING → COMPLETE.
    // Without this gate, two near-simultaneous Stripe redeliveries of the same
    // checkout.session.completed event both pass the COMPLETE check above
    // (because both read status === PENDING), both enter this transaction, and
    // both mint a fresh ActivationCode — leaking a second valid orphaned code
    // and sending a duplicate Resend email. The updateMany returning count: 0
    // is the only safe signal that another invocation already won.
    const claimed = await tx.order.updateMany({
      where: { id: orderRow.id, status: OrderStatus.PENDING },
      data: { status: OrderStatus.COMPLETE },
    });
    if (claimed.count === 0) {
      throw new Error("ALREADY_COMPLETED_BY_CONCURRENT_DELIVERY");
    }

    const activationCode = await tx.activationCode.create({
      data: {
        code,
        caseFileId: caseFile.id,
        source: ActivationCodeSource.PURCHASE,
      },
    });

    return tx.order.update({
      where: { id: orderRow.id },
      data: {
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
  // Deep-link includes ?activate=CODE so the activation form is pre-filled
  // when the user lands on the bureau page after clicking the email link.
  const bureauUrl = `${appUrl}/bureau?activate=${encodeURIComponent(updatedOrder.activationCode.code)}`;
  const registerUrl = `${appUrl}/register`;
  const code1 = updatedOrder.activationCode.code;
  const caseTitle = updatedOrder.caseFile.title;

  try {
    await getResend().emails.send({
      from: getResendFrom(),
      to: buyerEmail,
      subject: "Your Black Ledger activation code",
      text: [
        `Your kit for "${caseTitle}" is ready to play.`,
        "",
        `Activation code: ${code1}`,
        "",
        "To activate your case:",
        `1. Create a free account (or sign in if you already have one): ${registerUrl}`,
        `2. Then use this link — it will pre-fill your code: ${bureauUrl}`,
        "",
        "If you have any trouble, reply to this email.",
      ].join("\n"),
      html: `
        <div style="font-family: ui-sans-serif, system-ui, sans-serif; color:#0f172a; line-height:1.6;">
          <p>Your kit for <strong>${escapeHtml(caseTitle)}</strong> is ready to play.</p>
          <p style="font-size:18px; margin-bottom:4px;">Activation code:</p>
          <p style="margin-top:0;">
            <code style="background:#f1f5f9; padding:6px 12px; border-radius:6px; font-family:ui-monospace, monospace; font-size:16px;">${escapeHtml(code1)}</code>
          </p>
          <p><strong>To activate your case:</strong></p>
          <ol style="padding-left:20px;">
            <li>
              <a href="${escapeHtml(registerUrl)}">Create a free account</a>
              (or sign in if you already have one)
            </li>
            <li>
              Click this link — it will take you straight to the bureau with your code pre-filled:<br/>
              <a href="${escapeHtml(bureauUrl)}">${escapeHtml(bureauUrl)}</a>
            </li>
          </ol>
          <p style="color:#64748b; font-size:12px;">If you have any trouble, reply to this email.</p>
        </div>
      `,
    });
    // Record successful send
    await prisma.order.update({
      where: { id: updatedOrder.id },
      data: { emailSentAt: new Date() },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Resend send failure for order", updatedOrder.id, ":", errorMessage);
    // Record failure — don't throw; the Order is COMPLETE and the code is minted.
    // Support can query: prisma.order.findMany({ where: { emailSentAt: null, emailLastError: { not: null } } })
    await prisma.order.update({
      where: { id: updatedOrder.id },
      data: { emailLastError: errorMessage.slice(0, 500) },
    }).catch(() => {
      // Best-effort: if this update also fails, just log it.
      console.error("Could not record emailLastError for order", updatedOrder.id);
    });
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

async function handleCheckoutAsyncPaymentFailed(session: Stripe.Checkout.Session) {
  // Look up the Order via session id (always indexed) rather than
  // payment_intent (only written by the success path). This closes the
  // "PENDING orders accumulate forever" failure mode of the prior
  // payment_intent.payment_failed subscription, where the lookup key
  // was never set on a never-succeeded order.
  const order = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
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
