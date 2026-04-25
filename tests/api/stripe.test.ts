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
  const orderCreate = vi.fn();
  const orderUpdate = vi.fn();
  const activationCodeFindUnique = vi.fn();
  const activationCodeCreate = vi.fn();
  const transactionFn = vi.fn();
  const stripeSessionsCreate = vi.fn();
  const stripeConstructEvent = vi.fn();
  const resendSend = vi.fn();
  return {
    caseFileFindUnique,
    orderFindUnique,
    orderCreate,
    orderUpdate,
    activationCodeFindUnique,
    activationCodeCreate,
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
      create: mocks.orderCreate,
      update: mocks.orderUpdate,
    },
    activationCode: {
      findUnique: mocks.activationCodeFindUnique,
      create: mocks.activationCodeCreate,
    },
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

  // Default: $transaction runs the callback against the same fakes
  mocks.transactionFn.mockImplementation(async (callback: any) => {
    return await callback({
      activationCode: { create: mocks.activationCodeCreate },
      order: { update: mocks.orderUpdate },
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

    expect(mocks.orderUpdate).toHaveBeenCalledOnce();
    const updateArgs = mocks.orderUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 11 });
    expect(updateArgs.data.status).toBe("COMPLETE");
    expect(updateArgs.data.stripePaymentIntent).toBe("pi_test_1");
    expect(updateArgs.data.activationCodeId).toBe(99);

    expect(mocks.resendSend).toHaveBeenCalledOnce();
    const emailArgs = mocks.resendSend.mock.calls[0][0];
    expect(emailArgs.to).toBe("buyer@example.com");
    expect(emailArgs.text).toContain("ALDER-XYZ12345");
  });

  it("is idempotent — a second checkout.session.completed for the same session is a no-op", async () => {
    mocks.stripeConstructEvent.mockReturnValue({
      id: "evt_test_2",
      type: "checkout.session.completed",
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
});
