# BATCH 5 — FIX PROMPT (payment & refund correctness; one migration)

You are a fresh Claude Code session running on Opus 4.7. Apply the five fixes below, surgically, one commit per fix, in the order listed, plus a final report commit. No scope creep. No fixes that aren't on this list. When all six commits are on tree, stop.

This batch differs from Batch 4 in one important way: **fix #1 ships a Prisma migration**. The migration file is created during the fix session, but it is **NOT applied** to any database. The operator runs `npx prisma migrate deploy` against Neon after review, mirroring how Batch 3's `tokenVersion` migration was handled.

Read this entire prompt first. Then read the two audit dossiers and the Batch 4 report. Then begin.

---

## 1. Operating principles (read twice)

1. **One commit per fix.** Subjects are pre-written below — use them verbatim.
2. **Migration discipline.** Run `npx prisma generate` so the local types compile, but **never** `npx prisma migrate dev`, `npx prisma migrate deploy`, `npx prisma db push`, or any command that opens a database connection. The migration SQL is hand-written into `prisma/migrations/.../migration.sql` and committed; it is applied later by the operator.
3. **No scope creep.** Capture out-of-scope discoveries in `audits/BATCH_5_OBSERVATIONS.md` for the next batch.
4. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` passing at the same count or higher. If either fails, stop and report.
5. **No installs, no env changes, no pushes.** No `npm install`, no `npm audit fix`, no `git push`. Reads and the six listed writes only.
6. **Ground truth = source code.** This prompt cites file:line based on commit `6f85434` (Batch 4 head). Re-confirm against the actual file before each edit.
7. **Skip Order.userId.** Claude Code's 2026-05-01 audit P1-2 recommended adding `Order.userId` for the refund handler. We're deliberately skipping that — User is reachable via `Order.activationCode.claimedByUserId`. One less column on the migration. Document the decision in observations.

---

## 2. Pre-flight

```
git rev-parse HEAD                  # should be 6f85434 or later
git status                          # working tree clean
npx tsc --noEmit                    # baseline: clean
npx vitest run                      # baseline: 21 files / 161 tests
```

If any fail, stop. Confirm `audits/2026-05-01-godmode-audit.md`, `audits/2026-05-01-godmode-audit-cowork.md`, `audits/BATCH_4_REPORT.md`, and `audits/BATCH_4_OBSERVATIONS.md` exist on tree. Read them.

Confirm `prisma/migrations/migration_lock.toml` says `provider = "postgresql"` (it does, per Batch 3).

---

## 3. The five fixes

### Fix 1 — `feat(schema): add ProcessedStripeEvent + Order index for idempotency and performance`

**Severity:** P2 (idempotency hardening) + P2 (Order index, deferred from prior batches).

**What this commit does:** Adds a new model + an index on an existing model + the matching migration SQL + regenerates Prisma client types. **Does not** apply the migration to any database — that's the operator's job post-review.

**Files touched:**
- `prisma/schema.prisma`
- `prisma/migrations/20260501000000_add_processed_stripe_event_and_order_index/migration.sql` (new)

**Schema additions** (`prisma/schema.prisma`):

Add the `ProcessedStripeEvent` model anywhere after the existing models (place it near the bottom of the file, after `Order`, for readability):

```prisma
// Records each Stripe webhook event.id that has been processed. The
// webhook handler inserts a row at the very top of POST; on a P2002
// (unique constraint violation), the event is a duplicate redelivery
// and the handler returns 200 immediately. This is a stronger
// idempotency primitive than the COMPLETE-status check — it covers
// every event type, not just checkout.session.completed, and it
// catches concurrent redeliveries that race past the existing
// updateMany precondition (Batch 4 Fix 4).
model ProcessedStripeEvent {
  id        String   @id
  createdAt DateTime @default(now())
}
```

Add the index inside the existing `Order` model. Find the closing brace of `model Order { ... }` (currently lines ~470-484) and add `@@index` immediately before the closing brace:

```prisma
model Order {
  // ... existing fields unchanged ...

  // Index for the duplicate-purchase guard at app/api/checkout/route.ts:60-67.
  // The guard runs on every checkout attempt; without this index it does a
  // sequential scan as Order grows.
  @@index([caseFileId, email, status])
}
```

**Migration SQL** (`prisma/migrations/20260501000000_add_processed_stripe_event_and_order_index/migration.sql`):

Create the directory and file with this exact content (the order matters — table creation before any later operations on it):

```sql
-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_caseFileId_email_status_idx" ON "Order"("caseFileId", "email", "status");
```

**After both file edits**, run `npx prisma generate` so the local generated client gets the new `ProcessedStripeEvent` model on the Prisma Client. The generated client lives at `generated/prisma/` and is gitignored, so this command produces no committable files — it only updates types so subsequent commits compile.

**Verification:**
- `npx prisma generate` exits clean.
- `npx tsc --noEmit` clean (no code yet references the new model — types compile because the model now exists in the generated client).
- `npx vitest run` 161 tests passing.
- `git status` shows two changed files: `prisma/schema.prisma` and `prisma/migrations/20260501000000_add_processed_stripe_event_and_order_index/migration.sql` (new). Nothing else.

**Commit subject:** `feat(schema): add ProcessedStripeEvent + Order index for idempotency and performance`

---

### Fix 2 — `fix(stripe): record event.id as processed inside webhook for hard cross-delivery idempotency`

**Severity:** P2 (Claude Code audit P2-3) — supplements Batch 4 Fix 4's `updateMany` precondition with a stronger event-id-level guard that covers every event type, not just `checkout.session.completed`.

**File:** `app/api/webhooks/stripe/route.ts:57-83`. Insert a new block AFTER the livemode mode-mismatch guard (Batch 4 Fix 6, currently at lines 57-79) and BEFORE the `console.log("Stripe webhook received: ...")` statement.

**Insert this block:**

```ts
// Hard idempotency: record the event.id as processed in a unique-keyed table.
// If the row already exists, this is a duplicate redelivery — return 200
// immediately without touching any business logic. This supplements the
// updateMany precondition in handleCheckoutCompleted (Batch 4 Fix 4), which
// is specific to the COMPLETE flip; ProcessedStripeEvent covers every event
// type (refunds, expiries, async-payment-failures, future events) the same way.
try {
  await prisma.processedStripeEvent.create({
    data: { id: event.id },
  });
} catch (error) {
  const maybe = error as { code?: string };
  if (maybe.code === "P2002") {
    console.log(`Stripe webhook duplicate event.id=${event.id} ignored.`);
    return NextResponse.json({ received: true }, { status: 200 });
  }
  // Anything else (DB unreachable, etc.) we surface as 500 so Stripe retries.
  console.error("ProcessedStripeEvent insert failure:", error);
  return NextResponse.json(
    { message: "Idempotency tracking unavailable." },
    { status: 500 }
  );
}
```

**Verification:**
- `npx tsc --noEmit` clean (depends on Fix 1's `prisma generate` having run — verify the type is available at `prisma.processedStripeEvent`).
- `npx vitest run` — `tests/api/stripe.test.ts` mocks the prisma client. The new `processedStripeEvent.create` call needs a mock. Add it in this same commit:
  - Top-of-file mock declarations (around line 18-33): add `const processedStripeEventCreate = vi.fn();`
  - `mocks` const: add `processedStripeEventCreate,`
  - The `vi.mock("@/lib/prisma", ...)` block: add `processedStripeEvent: { create: mocks.processedStripeEventCreate },` to the prisma proxy.
  - The `beforeEach` reset block: ensure the new mock is reset (the existing pattern likely uses `Object.values(mocks).forEach(m => m.mockReset())` — verify and follow whatever the file does).
  - Default behaviour: `mocks.processedStripeEventCreate.mockResolvedValue({ id: "evt_test_x", createdAt: new Date() });` so non-duplicate test paths pass.
- Mental trace: first delivery of event X → row created → switch runs → success. Second delivery of event X → P2002 → 200 returned, switch never runs. Third delivery of any unrelated event Y → row created → switch runs.

**Commit subject:** `fix(stripe): record event.id as processed inside webhook for hard cross-delivery idempotency`

---

### Fix 3 — `fix(checkout): pass Stripe idempotencyKey + reuse recent PENDING session URL to prevent double charges`

**Severity:** P1 — Claude Code audit P1-1 (Cowork audit P1-4). Two concurrent first-time POSTs to `/api/checkout` for the same `(caseId, email)` both pass the COMPLETE-only guard, both create Stripe sessions, both can be paid → double charge. Most likely to fire on the first sale of every kit.

**File:** `app/api/checkout/route.ts`.

**Top of file**, add the `crypto` import (for hashing the email into the idempotencyKey):

```ts
import { createHash } from "crypto";
```

Place it alphabetically with the other imports (after `import { CaseWorkflowStatus } from "@/lib/enums";`).

**Locate** the existing duplicate-purchase guard (lines 60-76, ending with `if (existingOrder) { return 409; }`).

**After that block but before the `const appUrl = ...` line (line 78)**, insert a new PENDING-session short-circuit:

```ts
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
```

**Modify the `getStripe().checkout.sessions.create({...})` call** (currently lines 81-98) to accept an `idempotencyKey` as the second argument:

```ts
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
```

**Modify the `prisma.order.create(...)` call** (currently lines 107-113) to handle the P2002 race where two concurrent requests get the same Stripe session via idempotencyKey:

```ts
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
```

**Verification:**
- `npx tsc --noEmit` clean. The `crypto.createHash` import is Node-only — `/api/checkout` does not have an explicit `runtime = "nodejs"` declaration today, but Prisma usage already locks it to Node by default. No change needed.
- `npx vitest run` — `tests/api/stripe.test.ts` does not currently test `/api/checkout` (its tests target the webhook). The route may be exercised by `scripts/test-stripe-e2e.ts`; that script is run manually, not part of `vitest run`. Existing 161 tests should still pass; if any does, update its mocks in this commit.
- Mental trace under the race: tx-A and tx-B both POST simultaneously. Both PENDING-lookup → no match. Both compute the SAME idempotencyKey. Both call `checkout.sessions.create({...}, { idempotencyKey: K })`. Stripe sees the second call's K, returns the same `session.id`. Both attempt `prisma.order.create({ stripeSessionId: session.id, ... })`. Race winner succeeds; loser P2002s and is caught. Both return the same URL. Buyer pays once. Webhook receives one event. One ActivationCode minted.

**Commit subject:** `fix(checkout): pass Stripe idempotencyKey + reuse recent PENDING session URL`

---

### Fix 4 — `feat(stripe): handle charge.refunded — revoke ActivationCode and delete UserCase`

**Severity:** P1 — Claude Code audit P1-2, Cowork audit P1-2. Closes the legal-vs-code drift on Terms of Service §7's refund commitment. Today, Stripe-side refunds leave the application's entitlement state untouched — refunded customers keep access.

**File:** `app/api/webhooks/stripe/route.ts`.

**Add a new switch arm** to the event-type switch (currently lines 60-74 — adjust if the line shifted after Fix 2). Place it AFTER the `checkout.session.async_payment_failed` arm:

```ts
case "charge.refunded":
  await handleChargeRefunded(event.data.object as Stripe.Charge);
  break;
```

**Add the new handler function** at the bottom of the file, after `handleCheckoutAsyncPaymentFailed`:

```ts
async function handleChargeRefunded(charge: Stripe.Charge) {
  // Find the Order via stripePaymentIntent (set by handleCheckoutCompleted's
  // success transaction, Batch 4 Fix 4). For refunds on never-completed
  // Orders, the lookup returns null and we no-op — there's nothing to revoke.
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!paymentIntentId) {
    console.warn(
      `[REFUND] charge.refunded missing payment_intent id; charge.id=${charge.id}`
    );
    return;
  }

  const order = await prisma.order.findFirst({
    where: { stripePaymentIntent: paymentIntentId },
    include: {
      activationCode: { select: { id: true, claimedByUserId: true } },
    },
  });

  if (!order) {
    console.warn(
      `[REFUND] No Order matched stripePaymentIntent=${paymentIntentId}; ` +
        `charge.id=${charge.id} amount_refunded=${charge.amount_refunded}`
    );
    return;
  }

  // Single transaction: mark Order REFUNDED, revoke ActivationCode, and
  // (if the code was already claimed) delete the UserCase to revoke the
  // bureau entitlement. We deliberately do NOT touch TheorySubmission or
  // CheckpointAttempt rows — those have historical value and the user is
  // no longer reading them. Schema cascades on UserCase already remove
  // dependent UserCaseEvent rows.
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.REFUNDED },
    });

    if (order.activationCode) {
      await tx.activationCode.update({
        where: { id: order.activationCode.id },
        data: { revokedAt: new Date() },
      });

      if (order.activationCode.claimedByUserId !== null) {
        await tx.userCase.deleteMany({
          where: {
            userId: order.activationCode.claimedByUserId,
            caseFileId: order.caseFileId,
          },
        });
      }
    }
  });

  console.log(
    `[REFUND] Order #${order.id} refunded; ` +
      `code revoked=${order.activationCode ? "yes" : "no"}; ` +
      `userCase deleted=${order.activationCode?.claimedByUserId ? "yes" : "no"}`
  );
}
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — no test currently exercises `charge.refunded`. New behaviour is uncovered (acceptable; Batch 4 Fix 3's `async_payment_failed` was also added without test coverage). Existing 161 tests must still pass.
- Mental trace — happy refund: Stripe fires `charge.refunded` for a `pi_X` whose Order is COMPLETE with claimed ActivationCode → ProcessedStripeEvent inserts new event.id (Fix 2) → switch routes to `handleChargeRefunded` → finds Order → transaction marks Order REFUNDED, sets `revokedAt`, deletes UserCase → returns. Customer's bureau dashboard no longer shows the case. Customer can still sign in, but `/api/cases/activate` with the revoked code returns 410 (Batch 1 Fix 5 stamp-server-side, Wave 1 SEC-01 revokedAt guard).
- Mental trace — refund on orphan Order: payment_intent has no matching Order → `[REFUND]` warning logged → handler returns. No DB changes. Stripe keeps retrying for ~3 days; the warning persists in logs as the operator's signal.

**Operator action documented in BATCH_5_OBSERVATIONS.md:** subscribe the production webhook endpoint to `charge.refunded` in the Stripe Dashboard. Until that subscription is enabled, the new handler does nothing.

**Commit subject:** `feat(stripe): handle charge.refunded — revoke activation code and delete UserCase`

---

### Fix 5 — `feat(ops): nightly cron sweeps stuck PENDING orders to FAILED`

**Severity:** P3 (operability) — closes the "PENDING orders accumulate forever" failure mode that Batch 4 Fix 3 (`async_payment_failed`) reduces but does not eliminate. Mostly an inbox-cleanliness fix for the operator.

**Files:**
- `app/api/cron/cleanup-pending-orders/route.ts` (new)
- `vercel.json` (new — verify it doesn't already exist; if it does, add to the existing file)
- `.env.example` (modified — document the new env var)

**Endpoint** at `app/api/cron/cleanup-pending-orders/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/lib/enums";

// Vercel Cron calls this endpoint with `Authorization: Bearer ${CRON_SECRET}`.
// The route MUST verify that header before doing any work — otherwise any
// signed-in (or unsigned) caller could trigger the sweep on demand.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { message: "Cron is not configured." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  // Mark every PENDING Order older than 24 hours as FAILED. The window
  // is wider than the typical Stripe Checkout session expiry (3 hours by
  // default per Stripe docs) — we only want to sweep clearly-abandoned
  // sessions, not active ones.
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.order.updateMany({
    where: {
      status: OrderStatus.PENDING,
      createdAt: { lt: twentyFourHoursAgo },
    },
    data: {
      status: OrderStatus.FAILED,
    },
  });

  console.log(`[CRON] cleanup-pending-orders swept ${result.count} orders`);
  return NextResponse.json({ swept: result.count }, { status: 200 });
}
```

**Cron config** at `vercel.json` (new file at repo root, **same directory as `package.json`**):

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-pending-orders",
      "schedule": "0 4 * * *"
    }
  ]
}
```

`0 4 * * *` is daily at 04:00 UTC. Vercel free-tier cron supports daily granularity.

**`.env.example` addition** — append a new section after the existing Resend block:

```
# Vercel Cron — used by /api/cron/cleanup-pending-orders.
# Generate with the same one-liner as AUTH_SECRET. Set this on Vercel
# (Settings → Environment Variables) and Vercel Cron will send it as
# `Authorization: Bearer ${CRON_SECRET}` on every scheduled invocation.
CRON_SECRET=
```

**Middleware update** — `middleware.ts` currently runs the CSRF gate on every state-mutating `/api/*` request. Cron uses GET, so CSRF doesn't apply. But middleware also has the `/api/admin/*` and `/api/cases/*` auth blocks — neither catches `/api/cron/*`, so the route is reachable without those gates. Verify by re-reading `middleware.ts`. If the middleware does not intercept `/api/cron/*` (it should not — there's no matching prefix), no change needed. If a future middleware change adds a gate for `/api/cron/*`, that's a regression and would belong in a different fix.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — no test currently covers cron routes. New behaviour is uncovered. Existing 161 tests must still pass.
- Mental trace — Vercel Cron fires at 04:00 UTC daily → GET to `/api/cron/cleanup-pending-orders` with `Authorization: Bearer ${CRON_SECRET}` → header matches → updateMany returns count → 200 with `{ swept: N }`. Anyone else hitting the route without the header → 403.

**Operator actions documented in BATCH_5_OBSERVATIONS.md:**
1. Generate a `CRON_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
2. Add `CRON_SECRET` to Vercel (Settings → Environment Variables → Production).
3. Confirm cron registration in Vercel dashboard after first deploy: Settings → Cron Jobs.

**Commit subject:** `feat(ops): nightly cron sweeps stuck PENDING orders to FAILED`

---

## 4. Final verification gate

After all five fix commits are on tree:

```
git log --oneline -5                # confirm five fix commits in the order above
git status                          # working tree clean
npx tsc --noEmit                    # exit clean
npx vitest run                      # 161 tests passing
npm run build                       # clean (only the documented middleware → proxy notice + pg SSL informational)
git diff main~5 main --stat         # confirm only authorized files touched
```

Expected files touched (and only these):

```
app/api/checkout/route.ts                              (Fix 3)
app/api/cron/cleanup-pending-orders/route.ts           (Fix 5, new)
app/api/webhooks/stripe/route.ts                       (Fixes 2 + 4)
prisma/migrations/20260501000000_add_processed_stripe_event_and_order_index/migration.sql  (Fix 1, new)
prisma/schema.prisma                                   (Fix 1)
tests/api/stripe.test.ts                               (Fix 2 mock additions)
.env.example                                           (Fix 5)
vercel.json                                            (Fix 5, new)
```

If any other file is in the diff, scope crept. Restore it before declaring done.

---

## 5. Required output

Write `audits/BATCH_5_REPORT.md` matching the structure of `audits/BATCH_4_REPORT.md`. Include: per-commit hash, subject, file diff, tsc/vitest results, mental-trace verification, anomalies. Pre-flight tree state at top.

Write `audits/BATCH_5_OBSERVATIONS.md` with: any leads found while applying the batch that weren't fixed, the operator action items (apply migration via `npx prisma migrate deploy`, set `CRON_SECRET` env var on Vercel, subscribe to `charge.refunded` in Stripe Dashboard), and the explicit "Order.userId deferred" decision with one-paragraph rationale.

Then commit both files in a sixth commit:

**Commit subject:** `docs(audit): batch 5 report + observations`

Then stop. Do not push. Do not run migrations. Do not start Batch 6.

---

## 6. Begin

Read both audit dossiers under `audits/`. Read `BATCH_3_REPORT.md` and `BATCH_4_REPORT.md` for house style. Then start with Fix 1's pre-flight, schema edit, migration write, and `prisma generate`. Commit. Verify. Move to Fix 2. Continue through Fix 5. Write the two report files in commit 6. Done.
