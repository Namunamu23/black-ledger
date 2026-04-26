import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validators";
import { CaseWorkflowStatus } from "@/lib/enums";

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
          "An activation code for this case has already been sent to this email address. Check your inbox or contact support.",
      },
      { status: 409 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      metadata: {
        caseId: String(caseId),
        email,
      },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cases/${caseFile.slug}`,
    });

    if (!session.url || !session.id) {
      return NextResponse.json(
        { message: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }

    await prisma.order.create({
      data: {
        stripeSessionId: session.id,
        email,
        caseFileId: caseId,
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Checkout route error:", error);
    return NextResponse.json(
      { message: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
