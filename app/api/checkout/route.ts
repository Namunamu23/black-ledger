import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validators";
import { CaseWorkflowStatus } from "@/lib/enums";

export const runtime = "nodejs";

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

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { message: "Checkout is not configured." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 422 }
    );
  }

  const { caseId, email } = parsed.data;

  const caseFile = await prisma.caseFile.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      slug: true,
      title: true,
      workflowStatus: true,
      isActive: true,
    },
  });
  if (
    !caseFile ||
    !caseFile.isActive ||
    caseFile.workflowStatus !== CaseWorkflowStatus.PUBLISHED
  ) {
    return NextResponse.json({ message: "Case not found." }, { status: 404 });
  }

  // Duplicate-purchase guard: if a COMPLETE order already exists for this
  // email + case, the buyer already received an activation code. Return 409
  // rather than charging them again.
  const existingOrder = await prisma.order.findFirst({
    where: {
      caseFileId: caseId,
      email: { equals: email, mode: "insensitive" },
      status: "COMPLETE",
    },
    select: { id: true },
  });
  if (existingOrder) {
    return NextResponse.json(
      {
        message:
          "We couldn't start checkout. If you've already purchased this case, please check your inbox or contact support.",
      },
      { status: 409 }
    );
  }

  // PENDING-session short-circuit: if a Stripe Checkout session was already
  // created for this (caseId, email) in the last 15 minutes and is still
  // open, reuse its URL instead of creating a second session. Catches the
  // common "user double-clicks Continue" / "user refreshes" pattern. The
  // idempotencyKey on the create() call below is the second layer of defense
  // for the rarer concurrent-first-POST race.
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const recentPending = await prisma.order.findFirst({
    where: {
      caseFileId: caseId,
      email: { equals: email, mode: "insensitive" },
      status: "PENDING",
      createdAt: { gte: fifteenMinutesAgo },
    },
    select: { stripeSessionId: true },
    orderBy: { createdAt: "desc" },
  });

  if (recentPending) {
    try {
      const existingSession = await getStripe().checkout.sessions.retrieve(
        recentPending.stripeSessionId
      );
      if (existingSession.url && existingSession.status === "open") {
        return NextResponse.json({ url: existingSession.url }, { status: 200 });
      }
    } catch {
      // Stripe session expired, deleted, or unreachable — fall through and
      // create a new one. The idempotencyKey below ensures concurrent
      // requests still converge on the same Stripe session.
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    // Stripe-side idempotency: same (case, email, 15-minute bucket) → same
    // session. Closes the race where two concurrent first-time POSTs both pass
    // the PENDING short-circuit above (because both observe no PENDING row
    // yet) and both call Stripe — the idempotencyKey makes Stripe return
    // the same session for both, so only one Order/ActivationCode pair
    // downstream. The email is hashed (16-hex truncation of SHA-256) so the
    // key doesn't carry plaintext PII into Stripe's idempotency log.
    const emailHash = createHash("sha256")
      .update(email)
      .digest("hex")
      .slice(0, 16);
    const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
    const idempotencyKey = `checkout-case-${caseId}-${emailHash}-${bucket}`;

    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: email,
        // Require explicit acceptance of the published Terms of Service before
        // the customer can pay. The TOS URL is configured at the account level
        // in the Stripe Dashboard (Settings → Public Details). Without that
        // dashboard config, this flag will cause Stripe to reject the session.
        consent_collection: {
          terms_of_service: "required",
        },
        metadata: {
          caseId: String(caseId),
          email,
        },
        success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/cases/${caseFile.slug}`,
      },
      { idempotencyKey }
    );

    if (!session.url || !session.id) {
      return NextResponse.json(
        { message: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }

    // Persist the Order. Under the concurrent-first-POST race, two requests
    // will both reach this point with the SAME stripeSessionId (because the
    // idempotencyKey gave them the same Stripe session). Order.stripeSessionId
    // is unique — the second create P2002s. Catch and return the already-created
    // session URL; the buyer's experience is unchanged (same Stripe page, one
    // charge, one ActivationCode at webhook time).
    try {
      await prisma.order.create({
        data: {
          stripeSessionId: session.id,
          email,
          caseFileId: caseId,
        },
      });
    } catch (error) {
      const maybe = error as { code?: string };
      if (maybe.code !== "P2002") throw error;
      // Race winner already wrote the Order — fine to proceed, return URL.
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Checkout route error:", error);
    return NextResponse.json(
      { message: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
