/**
 * Integration tests for the support inbox admin endpoints.
 * Strategy: Prisma mock via vi.hoisted + vi.mock, consistent with the
 * other route tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authFn: vi.fn(),
  supportMessageFindUnique: vi.fn(),
  supportMessageUpdate: vi.fn(),
  resendSend: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportMessage: {
      findUnique: mocks.supportMessageFindUnique,
      update: mocks.supportMessageUpdate,
    },
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

vi.mock("@/lib/resend", () => ({
  getResend: () => ({ emails: { send: mocks.resendSend } }),
  getResendFrom: () => "no-reply@theblackledger.app",
}));

import { PATCH as statusPATCH } from "@/app/api/admin/support/[id]/status/route";
import { POST as replyPOST } from "@/app/api/admin/support/[id]/reply/route";

const params = () => Promise.resolve({ id: "7" });

function makePatchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/support/7/status", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function makeReplyRequest(body: unknown) {
  return new Request("http://localhost/api/admin/support/7/reply", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const SEED_MESSAGE = {
  id: 7,
  name: "Investigator A",
  email: "a@example.com",
  message: "Cannot activate code.",
  status: "NEW",
  createdAt: new Date(),
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof (m as { mockReset?: () => void }).mockReset === "function") {
      (m as { mockReset: () => void }).mockReset();
    }
  });

  mocks.authFn.mockResolvedValue({
    user: { id: "1", role: "ADMIN" },
  });
});

describe("PATCH /api/admin/support/[id]/status", () => {
  it("updates the row when given a valid status value", async () => {
    mocks.supportMessageFindUnique.mockResolvedValue(SEED_MESSAGE);
    mocks.supportMessageUpdate.mockResolvedValue({
      ...SEED_MESSAGE,
      status: "HANDLED",
    });

    const response = await statusPATCH(
      makePatchRequest({ status: "HANDLED" }),
      { params: params() }
    );

    expect(response.status).toBe(200);
    expect(mocks.supportMessageUpdate).toHaveBeenCalledOnce();
    const updateArgs = mocks.supportMessageUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 7 });
    expect(updateArgs.data).toEqual({ status: "HANDLED" });
  });

  it("returns 422 for an invalid status value", async () => {
    const response = await statusPATCH(
      makePatchRequest({ status: "deleted" }),
      { params: params() }
    );

    expect(response.status).toBe(422);
    expect(mocks.supportMessageUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/support/[id]/reply", () => {
  it("returns 422 for an empty body", async () => {
    const response = await replyPOST(makeReplyRequest({ body: "" }), {
      params: params(),
    });

    expect(response.status).toBe(422);
    // Should not even reach the message lookup.
    expect(mocks.supportMessageFindUnique).not.toHaveBeenCalled();
  });

  it("sends a Resend email, marks the message HANDLED, and returns { sent: true }", async () => {
    mocks.supportMessageFindUnique.mockResolvedValue(SEED_MESSAGE);
    mocks.resendSend.mockResolvedValue({ id: "email_1" });
    mocks.supportMessageUpdate.mockResolvedValue({
      ...SEED_MESSAGE,
      status: "HANDLED",
    });

    const response = await replyPOST(
      makeReplyRequest({ body: "Thanks, looking into it." }),
      { params: params() }
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { sent: boolean };
    expect(json.sent).toBe(true);

    expect(mocks.resendSend).toHaveBeenCalledOnce();
    const emailArgs = mocks.resendSend.mock.calls[0][0];
    expect(emailArgs.to).toBe(SEED_MESSAGE.email);
    expect(emailArgs.text).toContain("Thanks, looking into it.");

    expect(mocks.supportMessageUpdate).toHaveBeenCalledOnce();
    const updateArgs = mocks.supportMessageUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 7 });
    expect(updateArgs.data).toEqual({ status: "HANDLED" });
  });

  it("returns 502 { sent: false } when Resend throws", async () => {
    mocks.supportMessageFindUnique.mockResolvedValue(SEED_MESSAGE);
    mocks.resendSend.mockRejectedValue(new Error("transport down"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await replyPOST(
        makeReplyRequest({ body: "Thanks, looking into it." }),
        { params: params() }
      );

      expect(response.status).toBe(502);
      const json = (await response.json()) as {
        sent: boolean;
        reason?: string;
      };
      expect(json.sent).toBe(false);
      expect(json.reason).toContain("Email transport error");
    } finally {
      errorSpy.mockRestore();
    }

    expect(mocks.supportMessageUpdate).not.toHaveBeenCalled();
  });
});
