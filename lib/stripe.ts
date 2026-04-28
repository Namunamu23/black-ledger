/**
 * Lazy singleton Stripe client. Mirrors the lib/prisma.ts pattern but
 * defers the env-var check to first call so importing this module from
 * a route file doesn't throw at module load when STRIPE_SECRET_KEY is
 * unset (tests, build).
 */

import Stripe from "stripe";

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

export function getStripe(): Stripe {
  if (globalForStripe.stripe) return globalForStripe.stripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  const client = new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia", // pin to SDK 22.x default; bump deliberately on SDK upgrade
  });
  if (process.env.NODE_ENV !== "production") {
    globalForStripe.stripe = client;
  }
  return client;
}
