/**
 * Integration tests for the Stripe checkout endpoint and webhook handler.
 *
 * Strategy: mock prisma + lib/stripe + lib/resend via vi.hoisted + vi.mock.
 * No live Stripe network calls — the Stripe client is a fake whose method
 * shapes match the v22 SDK surfaces we use (checkout.sessions.create and
 * webhooks.constructEvent).
 *
 * STRIPE_PRICE_ID and STRIPE_WEBHOOK_SECRET are stubbed via process.env so
 * the route handlers don't short-circuit on the configured-check.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const caseFileFindUnique = vi.fn();
  const orderFindUnique = vi.fn();
  const orderFindFirst = vi.fn();
  const orderCount = vi.fn();
  const orderCreate = vi.fn();
  const orderUpdate = vi.fn();
  const orderUpdateMany = vi.fn();
  const activationCodeFindUnique = vi.fn();
  const activationCodeCreate = vi.fn();
  const activationCodeUpdate = vi.fn();
  const activationCodeUpdateMany = vi.fn();
  const userCaseDeleteMany = vi.fn();
  const userCaseUpdateMany = vi.fn();
  const processedStripeEventCreate = vi.fn();
  const transactionFn = vi.fn();
  const stripeSessionsCreate = vi.fn();
  const stripeConstructEvent = vi.fn();
  const resendSend = vi.fn();
  return {
    caseFileFindUnique,
    orderFindUnique,
    orderFindFirst,
    orderCount,
    orderCreate,
    orderUpdate,
    orderUpdateMany,
    activationCodeFindUnique,
    activationCodeCreate,
    activationCodeUpdate,
    activationCodeUpdateMany,
    userCaseDeleteMany,
    userCaseUpdateMany,
    processedStripeEventCreate,
    transactionFn,
    stripeSessionsCreate,
    stripeConstructEvent,
    resendSend,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    caseFile: { findUnique: mocks.caseFileFindUnique },
    order: {
      findUnique: mocks.orderFindUnique,
      findFirst: mocks.orderFindFirst,
      count: mocks.orderCount,
      create: mocks.orderCreate,
      update: mocks.orderUpdate,
      updateMany: mocks.orderUpdateMany,
    },
    activationCode: {
      findUnique: mocks.activationCodeFindUnique,
      create: mocks.activationCodeCreate,
      update: mocks.activationCodeUpdate,
      updateMany: mocks.activationCodeUpdateMany,
    },
    userCase: {
      deleteMany: mocks.userCaseDeleteMany,
      updateMany: mocks.userCaseUpdateMany,
    },
    processedStripeEvent: { create: mocks.processedStripeEventCreate },
    $transaction: mocks.transactionFn,
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: mocks.stripeSessionsCreate } },
    webhooks: { constructEvent: mocks.stripeConstructEvent },
  }),
}));

vi.mock("@/lib/resend", () => ({
  getResend: () => ({ emails: { send: mocks.resendSend } }),
  getResendFrom: () => "no-reply@theblackledger.app",
}));

import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { POST as webhookPOST } from "@/app/api/webhooks/stripe/route";
import { _resetForTesting as resetRateLimit } from "@/lib/rate-limit";

const ORIGINAL_ENV = { ...process.env };

beforeAll(() => {
  process.env.STRIPE_PRICE_ID = "price_test_123";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
      (m as { mockReset: () => void }).mockReset();
    }
  });
  resetRateLimit();

  // Default: the concurrency precondition (Fix 4 / Batch 4) reads `count: 1`
  // when no concurrent delivery has already won. Tests that exercise the
  // race override this in their own `mockResolvedValue`.
  mocks.orderUpdateMany.mockResolvedValue({ count: 1 });

  // Default: the per-recipient activation-email throttle (F-13, Batch 9 Fix 4)
  // sees zero recent sends. Tests that exercise the throttle threshold
  // override this with a count >= 3.
  mocks.orderCount.mockResolvedValue(0);

  // Default: the ProcessedStripeEvent insert (Batch 5 Fix 2) succeeds — i.e.
  // this is a first delivery, not a duplicate. Tests that exercise the
  // duplicate-redelivery branch override with a P2002 rejection.
  mocks.processedStripeEventCreate.mockResolvedValue({
    id: "evt_test_default",
    createdAt: new Date(),
  });

  // Default: $transaction runs the callback against the same fakes.
  // `order.create` is now exposed inside the tx callback for the
  // P1-5 recovery branch (handleCheckoutCompleted creates the Order
  // inline if findUnique returned null). `order.updateMany` was added
  // for the concurrency precondition (Batch 4 Fix 4). `userCase` and
  // `activationCode.update*` were added for the F-02 charge.refunded
  // handler (Batch 9 Fix 2).
  mocks.transactionFn.mockImplementation(async (callback: any) => {
    return await callback({
      activationCode: {
        create: mocks.activationCodeCreate,
        update: mocks.activationCodeUpdate,
        updateMany: mocks.activationCodeUpdateMany,
      },
      order: {
        create: mocks.orderCreate,
        update: mocks.orderUpdate,
        updateMany: mocks.orderUpdateMany,
      },
      userCase: {
        deleteMany: mocks.userCaseDeleteMany,
        updateMany: mocks.userCaseUpdateMany,
      },
    });
  });
});

function makeCheckoutRequest(body: unknown, ip = "checkout-ip") {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
  });
}

function makeWebhookRequest(body: string, signature = "t=1,v1=fake") {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
  });
}

describe("POST /api/checkout", () => {
  it("returns 404 when the case is not PUBLISHED", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 7,
      slug: "alder-street-review",
      title: "Alder Street Review",
      workflowStatus: "DRAFT",
      isActive: true,
    });

    const response = await checkoutPOST(
      makeCheckoutRequest(
        { caseId: 7, email: "buyer@example.com" },
        "checkout-unpub-ip"
      )
    );

    expect(response.status).toBe(404);
    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it("returns { url } and creates a PENDING Order for a valid published case", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 7,
      slug: "alder-street-review",
      title: "Alder Street Review",
      workflowStatus: "PUBLISHED",
      isActive: true,
    });
    mocks.stripeSessionsCreate.mockResolvedValue({
      id: "cs_test_abc",
      url: "https://stripe.test/checkout/cs_test_abc",
    });
    mocks.orderCreate.mockResolvedValue({ id: 1 });

    const response = await checkoutPOST(
      makeCheckoutRequest(
        { caseId: 7, email: "Buyer@Example.com" },
        "checkout-ok-ip"
      )
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { url: string };
    expect(json.url).toBe("https://stripe.test/checkout/cs_test_abc");

    expect(mocks.stripeSessionsCreate).toHaveBeenCalledOnce();
    const sessionArgs = mocks.stripeSessionsCreate.mock.calls[0][0];
    expect(sessionArgs.mode).toBe("payment");
    expect(sessionArgs.customer_email).toBe("buyer@example.com");
    expect(sessionArgs.metadata).toEqual({
      caseId: "7",
      email: "buyer@example.com",
    });

    expect(mocks.orderCreate).toHaveBeenCalledOnce();
    const orderArgs = mocks.orderCreate.mock.calls[0][0];
    expect(orderArgs.data).toMatchObject({
      stripeSessionId: "cs_test_abc",
      email: "buyer@example.com",
      caseFileId: 7,
    });
  });

  it("POST /api/checkout returns 409 when a COMPLETE order already exists for this email + case (A6)", async () => {
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 7,
      slug: "alder-street-review",
      title: "Alder Street Review",
      workflowStatus: "PUBLISHED",
      isActive: true,
    });
    mocks.orderFindFirst.mockResolvedValue({ id: 99 });

    const response = await checkoutPOST(
      makeCheckoutRequest(
        { caseId: 7, email: "buyer@example.com" },
        "checkout-dup-ip"
      )
    );

    expect(response.status).toBe(409);
    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects an invalid signature with 400", async () => {
    mocks.stripeConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const response = await webhookPOST(
      makeWebhookRequest('{"type":"checkout.session.completed"}')
    );

    expect(response.status).toBe(400);
    expect(mocks.orderFindUnique).not.toHaveBeenCalled();
    expect(mocks.transactionFn).not.toHaveBeenCalled();
  });

  it("checkout.session.completed mints an ActivationCode and marks the Order COMPLETE", async () => {
    mocks.stripeConstructEvent.mockReturnValue({
      id: "evt_test_1",
      type: "checkout.session.completed",
      // livemode false because tests set STRIPE_SECRET_KEY=sk_test_*; the
      // handler's mode-mismatch guard (Batch 4 Fix 6) compares this against
      // the secret prefix and rejects mismatched events with 400.
      livemode: false,
      data: {
        object: {
          id: "cs_test_complete",
          payment_intent: "pi_test_1",
        },
      },
    });
    mocks.orderFindUnique.mockResolvedValue({
      id: 11,
      stripeSessionId: "cs_test_complete",
      status: "PENDING",
      email: "buyer@example.com",
      caseFileId: 7,
      caseFile: { id: 7, slug: "alder-street-review", title: "Alder Street Review" },
    });
    mocks.activationCodeFindUnique.mockResolvedValue(null);
    mocks.activationCodeCreate.mockResolvedValue({ id: 99, code: "ALDER-XYZ12345" });
    mocks.orderUpdate.mockResolvedValue({
      id: 11,
      activationCode: { code: "ALDER-XYZ12345" },
      caseFile: { title: "Alder Street Review" },
    });
    mocks.resendSend.mockResolvedValue({ id: "email_1" });

    const response = await webhookPOST(
      makeWebhookRequest('{"type":"checkout.session.completed"}')
    );

    expect(response.status).toBe(200);
    expect(mocks.transactionFn).toHaveBeenCalledOnce();
    expect(mocks.activationCodeCreate).toHaveBeenCalledOnce();
    const codeArgs = mocks.activationCodeCreate.mock.calls[0][0];
    expect(codeArgs.data.caseFileId).toBe(7);
    expect(codeArgs.data.source).toBe("PURCHASE");

    // Concurrency precondition (Batch 4 Fix 4): the PENDING → COMPLETE flip
    // happens via updateMany inside the tx, gated on status === PENDING.
    expect(mocks.orderUpdateMany).toHaveBeenCalledOnce();
    const claimArgs = mocks.orderUpdateMany.mock.calls[0][0];
    expect(claimArgs.where).toEqual({ id: 11, status: "PENDING" });
    expect(claimArgs.data.status).toBe("COMPLETE");

    // Two updates: first inside the tx writing payment_intent + code link,
    // second post-email recording emailSentAt (BUG-05).
    expect(mocks.orderUpdate).toHaveBeenCalledTimes(2);
    const updateArgs = mocks.orderUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 11 });
    expect(updateArgs.data.stripePaymentIntent).toBe("pi_test_1");
    expect(updateArgs.data.activationCodeId).toBe(99);

    const emailUpdateArgs = mocks.orderUpdate.mock.calls[1][0];
    expect(emailUpdateArgs.where).toEqual({ id: 11 });
    expect(emailUpdateArgs.data.emailSentAt).toBeInstanceOf(Date);

    expect(mocks.resendSend).toHaveBeenCalledOnce();
    const emailArgs = mocks.resendSend.mock.calls[0][0];
    expect(emailArgs.to).toBe("buyer@example.com");
    expect(emailArgs.text).toContain("ALDER-XYZ12345");
  });

  it("is idempotent — a second checkout.session.completed for the same session is a no-op", async () => {
    mocks.stripeConstructEvent.mockReturnValue({
      id: "evt_test_2",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { id: "cs_test_complete", payment_intent: "pi_test_1" } },
    });
    mocks.orderFindUnique.mockResolvedValue({
      id: 11,
      stripeSessionId: "cs_test_complete",
      status: "COMPLETE",
      email: "buyer@example.com",
      caseFileId: 7,
      caseFile: { id: 7, slug: "alder-street-review", title: "Alder Street Review" },
    });

    const response = await webhookPOST(
      makeWebhookRequest('{"type":"checkout.session.completed"}')
    );

    expect(response.status).toBe(200);
    expect(mocks.transactionFn).not.toHaveBeenCalled();
    expect(mocks.activationCodeCreate).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it("recovers an orphan session by creating the Order inside the same transaction (P1-5 recovery happy path)", async () => {
    // Pre-condition: /api/checkout's prisma.order.create failed after
    // Stripe accepted the session, so the local Order row never landed.
    // The webhook delivery hits this scenario and must rebuild the Order
    // from session metadata, then mint the ActivationCode atomically.
    mocks.stripeConstructEvent.mockReturnValue({
      id: "evt_test_recovery",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: "cs_test_orphan",
          payment_intent: "pi_test_recovery",
          metadata: { caseId: "7", email: "buyer@example.com" },
        },
      },
    });
    // Order.findUnique returns null — this is the orphan scenario.
    mocks.orderFindUnique.mockResolvedValue(null);
    // Recovery path resolves the case via metadata.caseId.
    mocks.caseFileFindUnique.mockResolvedValue({
      id: 7,
      slug: "alder-street-review",
      title: "Alder Street Review",
    });
    mocks.activationCodeFindUnique.mockResolvedValue(null);
    mocks.activationCodeCreate.mockResolvedValue({
      id: 99,
      code: "ALDERSTREETREVIEW-XYZ12345",
    });
    // Recovery Order.create returns the synthesized row from inside the tx.
    mocks.orderCreate.mockResolvedValue({
      id: 555,
      stripeSessionId: "cs_test_orphan",
      caseFileId: 7,
      email: "buyer@example.com",
      status: "PENDING",
    });
    mocks.orderUpdate.mockResolvedValue({
      id: 555,
      activationCode: { code: "ALDERSTREETREVIEW-XYZ12345" },
      caseFile: { title: "Alder Street Review" },
    });
    mocks.resendSend.mockResolvedValue({ id: "email_recovery" });

    const response = await webhookPOST(
      makeWebhookRequest('{"type":"checkout.session.completed"}')
    );

    expect(response.status).toBe(200);

    // Critical: the recovery Order.create ran INSIDE the $transaction,
    // not as a separate pre-tx write. transactionFn fires exactly once
    // and the Order.create + ActivationCode.create + Order.update all
    // happened during it.
    expect(mocks.transactionFn).toHaveBeenCalledOnce();
    expect(mocks.orderCreate).toHaveBeenCalledOnce();
    const createArgs = mocks.orderCreate.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      stripeSessionId: "cs_test_orphan",
      email: "buyer@example.com",
      caseFileId: 7,
      status: "PENDING",
    });

    expect(mocks.activationCodeCreate).toHaveBeenCalledOnce();
    expect(mocks.activationCodeCreate.mock.calls[0][0].data).toMatchObject({
      caseFileId: 7,
      source: "PURCHASE",
    });

    // Concurrency precondition (Batch 4 Fix 4): the PENDING → COMPLETE flip
    // happens via updateMany inside the tx, gated on status === PENDING.
    expect(mocks.orderUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.orderUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 555, status: "PENDING" },
      data: { status: "COMPLETE" },
    });

    // Two updates: payment_intent + code link inside tx, then emailSentAt
    // post-email (BUG-05).
    expect(mocks.orderUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.orderUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: 555 },
      data: {
        stripePaymentIntent: "pi_test_recovery",
        activationCodeId: 99,
      },
    });
    expect(mocks.orderUpdate.mock.calls[1][0]).toMatchObject({
      where: { id: 555 },
    });
    expect(mocks.orderUpdate.mock.calls[1][0].data.emailSentAt).toBeInstanceOf(Date);

    expect(mocks.resendSend).toHaveBeenCalledOnce();
    expect(mocks.resendSend.mock.calls[0][0].to).toBe("buyer@example.com");
  });

  it("returns 200 (acked-orphan) and logs STRIPE-ORPHAN when session metadata is insufficient (BUG-03 + Batch 17)", async () => {
    // Pre-condition: orphan session AND metadata is empty / corrupted.
    //
    // Pre-BUG-03: dropped silently.
    // BUG-03 fix: threw → outer catch returned 500 so Stripe retried — but
    //   Stripe then retried for ~3 days on a permanently-unrecoverable event,
    //   spamming logs with dozens of identical [STRIPE-ORPHAN] lines.
    // Batch 17 fix: still throw + log the alertable [STRIPE-ORPHAN] line,
    //   but the outer catch now detects the STRIPE_ORPHAN: prefix and
    //   returns 200 to Stripe so retries stop. Operator still sees the
    //   original log line for manual investigation, plus a
    //   [STRIPE-ORPHAN-FINAL] ack-line emitted by the outer catch.
    mocks.stripeConstructEvent.mockReturnValue({
      id: "evt_test_no_meta",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: "cs_test_no_meta",
          payment_intent: "pi_test_no_meta",
          // metadata intentionally omitted
        },
      },
    });
    mocks.orderFindUnique.mockResolvedValue(null);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await webhookPOST(
        makeWebhookRequest('{"type":"checkout.session.completed"}')
      );
      // Batch 17: return 200 to stop the Stripe retry storm.
      expect(response.status).toBe(200);
      const body = (await response.json()) as { received: boolean; orphan?: boolean };
      expect(body.received).toBe(true);
      expect(body.orphan).toBe(true);

      // First call is the structured [STRIPE-ORPHAN] alert from
      // handleCheckoutCompleted; second is the [STRIPE-ORPHAN-FINAL] ack
      // emitted by the outer catch before returning 200.
      const orphanCall = errorSpy.mock.calls.find((args) =>
        String(args[0]).includes("[STRIPE-ORPHAN]")
      );
      expect(orphanCall).toBeDefined();
      const orphanMsg = String(orphanCall?.[0]);
      expect(orphanMsg).toContain("cs_test_no_meta");
      expect(orphanMsg.toLowerCase()).toContain("metadata");

      const ackCall = errorSpy.mock.calls.find((args) =>
        String(args[0]).includes("[STRIPE-ORPHAN-FINAL]")
      );
      expect(ackCall).toBeDefined();
    } finally {
      errorSpy.mockRestore();
    }

    // No tx, no code, no email — recovery declined.
    expect(mocks.transactionFn).not.toHaveBeenCalled();
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.activationCodeCreate).not.toHaveBeenCalled();
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it("throttles the activation email when 3+ sends to the same address in 1h (F-13)", async () => {
    // Pre-condition: three recent COMPLETE orders to this email already had
    // emailSentAt stamped within the last hour. The fourth purchase mints
    // the code as usual but skips the email and records emailLastError.
    mocks.stripeConstructEvent.mockReturnValue({
      id: "evt_throttle",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: "cs_throttle",
          payment_intent: "pi_throttle",
        },
      },
    });
    mocks.orderFindUnique.mockResolvedValue({
      id: 77,
      stripeSessionId: "cs_throttle",
      status: "PENDING",
      email: "victim@example.com",
      caseFileId: 7,
      caseFile: { id: 7, slug: "alder-street-review", title: "Alder Street Review" },
    });
    mocks.activationCodeFindUnique.mockResolvedValue(null);
    mocks.activationCodeCreate.mockResolvedValue({ id: 555, code: "ALDER-XYZTHRO0" });
    mocks.orderUpdate.mockResolvedValue({
      id: 77,
      activationCode: { code: "ALDER-XYZTHRO0" },
      caseFile: { title: "Alder Street Review" },
    });
    // Throttle threshold met: 3 recent sends to this address.
    mocks.orderCount.mockResolvedValue(3);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const response = await webhookPOST(
        makeWebhookRequest('{"type":"checkout.session.completed"}')
      );

      expect(response.status).toBe(200);

      // Code is still minted (entitlement is preserved; only the email is
      // skipped) and Order is still flipped to COMPLETE.
      expect(mocks.activationCodeCreate).toHaveBeenCalledOnce();

      // Throttle counted on the normalized buyer email.
      expect(mocks.orderCount).toHaveBeenCalledOnce();
      const countArgs = mocks.orderCount.mock.calls[0][0];
      expect(countArgs.where.email).toBe("victim@example.com");
      expect(countArgs.where.status).toBe("COMPLETE");

      // Email was NOT sent.
      expect(mocks.resendSend).not.toHaveBeenCalled();

      // emailLastError was recorded so the operator sees the throttled
      // order in the support inbox UI. The first orderUpdate call is the
      // payment_intent + activationCodeId write inside the tx; the second
      // is this throttle's emailLastError write.
      expect(mocks.orderUpdate).toHaveBeenCalledTimes(2);
      const errArgs = mocks.orderUpdate.mock.calls[1][0];
      expect(errArgs.where).toEqual({ id: 77 });
      expect(errArgs.data.emailLastError).toMatch(/Throttled/);

      // Warn line emitted for monitoring.
      const throttleLog = warnSpy.mock.calls.find((args) =>
        String(args[0]).includes("[EMAIL-THROTTLE]")
      );
      expect(throttleLog).toBeDefined();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe("charge.refunded handler (F-02)", () => {
  it("full refund — Order → REFUNDED, code revoked, UserCase soft-revoked, no deleteMany", async () => {
    mocks.stripeConstructEvent.mockReturnValue({
      id: "evt_refund_full",
      type: "charge.refunded",
      livemode: false,
      data: {
        object: {
          id: "ch_test_full",
          payment_intent: "pi_test_refund_full",
          amount: 3000,
          amount_refunded: 3000,
        },
      },
    });
    mocks.orderFindFirst.mockResolvedValue({
      id: 42,
      caseFileId: 7,
      activationCode: { id: 99, claimedByUserId: 11 },
    });

    const response = await webhookPOST(
      makeWebhookRequest('{"type":"charge.refunded"}')
    );

    expect(response.status).toBe(200);
    expect(mocks.transactionFn).toHaveBeenCalledOnce();

    // Order flip to REFUNDED via updateMany with status precondition.
    const orderCall = mocks.orderUpdateMany.mock.calls.find((args) =>
      args[0]?.data?.status === "REFUNDED"
    );
    expect(orderCall).toBeDefined();
    expect(orderCall?.[0].where).toMatchObject({
      id: 42,
      status: { in: ["COMPLETE", "PARTIALLY_REFUNDED"] },
    });

    // ActivationCode revoke via updateMany with revokedAt: null precondition.
    expect(mocks.activationCodeUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.activationCodeUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 99, revokedAt: null },
    });
    expect(
      mocks.activationCodeUpdateMany.mock.calls[0][0].data.revokedAt
    ).toBeInstanceOf(Date);

    // UserCase soft-revoke via updateMany; deleteMany must NOT be called.
    expect(mocks.userCaseUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.userCaseUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 11, caseFileId: 7, revokedAt: null },
    });
    expect(
      mocks.userCaseUpdateMany.mock.calls[0][0].data.revokedAt
    ).toBeInstanceOf(Date);
    expect(mocks.userCaseDeleteMany).not.toHaveBeenCalled();
  });

  it("partial refund — Order → PARTIALLY_REFUNDED, entitlement preserved", async () => {
    mocks.stripeConstructEvent.mockReturnValue({
      id: "evt_refund_partial",
      type: "charge.refunded",
      livemode: false,
      data: {
        object: {
          id: "ch_test_partial",
          payment_intent: "pi_test_refund_partial",
          amount: 3000,
          amount_refunded: 500,
        },
      },
    });
    mocks.orderFindFirst.mockResolvedValue({
      id: 43,
      caseFileId: 7,
      activationCode: { id: 100, claimedByUserId: 12 },
    });

    const response = await webhookPOST(
      makeWebhookRequest('{"type":"charge.refunded"}')
    );

    expect(response.status).toBe(200);

    // Partial branch: no transaction, just the single status flip.
    expect(mocks.transactionFn).not.toHaveBeenCalled();
    expect(mocks.orderUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.orderUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 43, status: { in: ["COMPLETE"] } },
      data: { status: "PARTIALLY_REFUNDED" },
    });

    // Entitlement intact.
    expect(mocks.activationCodeUpdate).not.toHaveBeenCalled();
    expect(mocks.activationCodeUpdateMany).not.toHaveBeenCalled();
    expect(mocks.userCaseUpdateMany).not.toHaveBeenCalled();
    expect(mocks.userCaseDeleteMany).not.toHaveBeenCalled();
  });

  it("idempotent full refund — second delivery matches zero rows everywhere, no errors", async () => {
    mocks.stripeConstructEvent.mockReturnValue({
      id: "evt_refund_full_again",
      type: "charge.refunded",
      livemode: false,
      data: {
        object: {
          id: "ch_test_full_again",
          payment_intent: "pi_test_refund_idempotent",
          amount: 3000,
          amount_refunded: 3000,
        },
      },
    });
    mocks.orderFindFirst.mockResolvedValue({
      id: 44,
      caseFileId: 7,
      activationCode: { id: 101, claimedByUserId: 13 },
    });
    // Re-delivery: every precondition matches zero rows.
    mocks.orderUpdateMany.mockResolvedValue({ count: 0 });
    mocks.activationCodeUpdateMany.mockResolvedValue({ count: 0 });
    mocks.userCaseUpdateMany.mockResolvedValue({ count: 0 });

    const response = await webhookPOST(
      makeWebhookRequest('{"type":"charge.refunded"}')
    );

    // No exception, transaction still ran, all updateMany calls were fired
    // but each found zero matching rows. Status code must remain 200.
    expect(response.status).toBe(200);
    expect(mocks.transactionFn).toHaveBeenCalledOnce();
    expect(mocks.orderUpdateMany).toHaveBeenCalled();
    expect(mocks.activationCodeUpdateMany).toHaveBeenCalled();
    expect(mocks.userCaseUpdateMany).toHaveBeenCalled();
    expect(mocks.userCaseDeleteMany).not.toHaveBeenCalled();
  });

  it("partial then full — second event flips PARTIALLY_REFUNDED → REFUNDED and revokes", async () => {
    // First: a partial-refund event arrives. Order ends up PARTIALLY_REFUNDED.
    mocks.stripeConstructEvent.mockReturnValueOnce({
      id: "evt_partial_first",
      type: "charge.refunded",
      livemode: false,
      data: {
        object: {
          id: "ch_partial_first",
          payment_intent: "pi_seq",
          amount: 3000,
          amount_refunded: 500,
        },
      },
    });
    mocks.orderFindFirst.mockResolvedValueOnce({
      id: 45,
      caseFileId: 7,
      activationCode: { id: 102, claimedByUserId: 14 },
    });

    let response = await webhookPOST(
      makeWebhookRequest('{"type":"charge.refunded"}')
    );

    expect(response.status).toBe(200);
    expect(mocks.transactionFn).not.toHaveBeenCalled();
    const partialOrderCall = mocks.orderUpdateMany.mock.calls.find(
      (args) => args[0]?.data?.status === "PARTIALLY_REFUNDED"
    );
    expect(partialOrderCall).toBeDefined();

    // Second: an additional refund completes the original charge — full refund.
    mocks.stripeConstructEvent.mockReturnValueOnce({
      id: "evt_full_after_partial",
      type: "charge.refunded",
      livemode: false,
      data: {
        object: {
          id: "ch_full_after_partial",
          payment_intent: "pi_seq",
          amount: 3000,
          amount_refunded: 3000,
        },
      },
    });
    mocks.orderFindFirst.mockResolvedValueOnce({
      id: 45,
      caseFileId: 7,
      activationCode: { id: 102, claimedByUserId: 14 },
    });

    response = await webhookPOST(
      makeWebhookRequest('{"type":"charge.refunded"}')
    );

    expect(response.status).toBe(200);
    expect(mocks.transactionFn).toHaveBeenCalledOnce();

    // The full-refund branch matched on { COMPLETE, PARTIALLY_REFUNDED } so
    // the second event flips PARTIALLY_REFUNDED → REFUNDED.
    const refundOrderCall = mocks.orderUpdateMany.mock.calls.find((args) =>
      args[0]?.data?.status === "REFUNDED"
    );
    expect(refundOrderCall).toBeDefined();
    expect(refundOrderCall?.[0].where.status.in).toContain("PARTIALLY_REFUNDED");

    expect(mocks.activationCodeUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.userCaseUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.userCaseDeleteMany).not.toHaveBeenCalled();
  });
});
