/**
 * Lazy singleton Resend client. Mirrors lib/stripe.ts — defers the env
 * check to first call so importing this module never throws at load time
 * (tests, build).
 */

import { Resend } from "resend";

const globalForResend = globalThis as unknown as {
  resend: Resend | undefined;
};

export function getResend(): Resend {
  if (globalForResend.resend) return globalForResend.resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  const client = new Resend(apiKey);
  if (process.env.NODE_ENV !== "production") {
    globalForResend.resend = client;
  }
  return client;
}

export function getResendFrom(): string {
  return process.env.RESEND_FROM ?? "no-reply@theblackledger.app";
}
