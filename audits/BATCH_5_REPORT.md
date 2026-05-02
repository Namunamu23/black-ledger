# BATCH 5 — FIX REPORT

Five fixes applied surgically to `main`, one commit per fix, on a
previously clean tree. No pushes to remote. **One Prisma migration
authored but NOT applied to any database** — operator runs
`npx prisma migrate deploy` against Neon after review (mirrors the
Batch 3 `tokenVersion` migration handling). No `npm install` /
`npm audit fix`. No env changes.

## Pre-flight tree state

- `git rev-parse HEAD` at start: `80717ac` (`docs(audit): batch 5 fix
  prompt (payment & refund correctness)`). Sits one commit above
  `6f85434` (Batch 4 head, which the prompt cites file:line against).
  The Batch 5 prompt commit is purely the dossier write — code state
  is identical to `6f85434`.
- `git status`: working tree clean.
- Pre-flight `npx tsc --noEmit`: passed (no output).
- Pre-flight `npx vitest run`: 21 files, 161 tests passed.
- Both 2026-05-01 audit dossiers (`audits/2026-05-01-godmode-audit.md`
  and `audits/2026-05-01-godmode-audit-cowork.md`), the Batch 4 report
  (`audits/BATCH_4_REPORT.md`), and the Batch 4 observations
  (`audits/BATCH_4_OBSERVATIONS.md`) all present and read in full
  before starting. Batch 3 report consulted for migration discipline
  (mirror its hand-write-and-defer-apply pattern).
- `prisma/migrations/migration_lock.toml` confirmed
  `provider = "postgresql"`.

## Migration apply notes (read before deploying)

A new Prisma migration was created at:

```
prisma/migrations/20260501000000_add_processed_stripe_event_and_order_index/migration.sql
```

Contents:

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

Apply against Neon with:

```
npx prisma migrate deploy
```

This requires `DIRECT_URL` (or `DATABASE_URL` as fallback per
`prisma.config.ts`) to point at the production Neon DB. Both
operations are additive — no existing rows are altered, no DDL
removes anything. Failure modes if applied out of order: none (the
index touches an existing column set; the table is brand new). No
down-migration needed (Prisma does not generate them).

`npx prisma generate` was run locally during Fix 1 so the local types
compile (the regenerated client at `generated/prisma/` is gitignored;
no committable artifact). Until the migration is applied to Neon,
**deploying the new code will 500** on the first webhook event the
production handler receives — the `prisma.processedStripeEvent.create`
call will fail with `relation "ProcessedStripeEvent" does not exist`,
the catch arm logs and returns 500, Stripe retries. This is a hard
operator-action sequencing requirement: **migrate first, then deploy
code**.

## Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `a0a0ece` | feat(schema): add ProcessedStripeEvent + Order index for idempotency and performance |
| 2 | `9cb1be1` | fix(stripe): record event.id as processed inside webhook for hard cross-delivery idempotency |
| 3 | `c12084c` | fix(checkout): pass Stripe idempotencyKey + reuse recent PENDING session URL |
| 4 | `2bb40ec` | feat(stripe): handle charge.refunded — revoke activation code and delete UserCase |
| 5 | `4b8e2d4` | feat(ops): nightly cron sweeps stuck PENDING orders to FAILED |

## Per-fix results

### Fix 1 — `a0a0ece` Schema + migration: ProcessedStripeEvent + Order index

- **Applied:** yes. Two file changes in one commit.
  - `prisma/schema.prisma` — appended `@@index([caseFileId, email, status])`
    inside the existing `Order` model (with the prompt's exact comment
    locating the index against `app/api/checkout/route.ts:60-67`).
    Added `model ProcessedStripeEvent { id String @id; createdAt
    DateTime @default(now()) }` immediately after the `Order` block,
    with the prompt's exact rationale comment.
  - `prisma/migrations/20260501000000_add_processed_stripe_event_and_order_index/migration.sql`
    — new file, two statements: `CREATE TABLE ProcessedStripeEvent`
    + `CREATE INDEX Order_caseFileId_email_status_idx`. Order matters
    only insofar as the index references an existing column set; both
    statements are additive and safe to apply in either order.
  - `npx prisma generate` ran clean — exit 0, "✔ Generated Prisma
    Client (7.8.0) to .\generated\prisma in 138ms". The generated
    client now exposes `prisma.processedStripeEvent.create` and the
    `Order_caseFileId_email_status_idx` is materialized in the index
    metadata. No DB connection was opened.
- **Diff:** 2 files, +28 / -0.
- `tsc --noEmit`: passed.
- `vitest run`: 21 files / 161 tests passed (no code yet references
  the new model — types compile because the model now exists in the
  generated client).
- **Mental trace:** Operator runs `npx prisma migrate deploy` against
  Neon → migration applies cleanly (additive only) → `Order.findFirst`
  for the duplicate-purchase guard hits the new composite index
  instead of seq-scanning Order; `processedStripeEvent.create` will
  succeed against a fresh table on the first webhook delivery
  post-migration.
- **Anomalies:** none. Migration timestamp (`20260501000000`) follows
  Prisma's lexicographic ordering — sits later than the prior latest
  (`20260427210000_add_user_token_version`) and earlier than today's
  date, both acceptable.

### Fix 2 — `9cb1be1` Record event.id processed inside webhook

- **Applied:** yes. Two file edits in one commit.
  - `app/api/webhooks/stripe/route.ts:80-103` — inserted the hard
    idempotency block AFTER the livemode mode-mismatch guard
    (Batch 4 Fix 6) and BEFORE the
    `console.log("Stripe webhook received: ...")` line. Block does
    `prisma.processedStripeEvent.create({ data: { id: event.id }})`
    inside try/catch; on `P2002`, logs duplicate and returns
    `{received: true}` 200; on any other error, logs and returns 500
    so Stripe retries. Comment captures the rationale (covers every
    event type, supplements Batch 4 Fix 4's `updateMany`
    precondition).
  - `tests/api/stripe.test.ts` — three small mock-shape additions
    needed to keep the existing 161 tests passing:
    - Hoisted block: added `processedStripeEventCreate = vi.fn()`.
    - `mocks` const: added the new fn alongside the others.
    - `vi.mock("@/lib/prisma", ...)`: added
      `processedStripeEvent: { create: mocks.processedStripeEventCreate }`
      to the prisma proxy.
    - `beforeEach`: existing
      `Object.values(mocks).forEach(m => m.mockReset())` already
      resets the new mock (no change needed). Added a default
      `mockResolvedValue({ id: "evt_test_default", createdAt: new Date() })`
      so non-duplicate paths (every existing test) succeed without
      override.
- **Diff:** 2 files, +35 / -0.
- `tsc --noEmit`: passed (the type is available at
  `prisma.processedStripeEvent` because Fix 1 ran `prisma generate`).
- `vitest run`: 21 files / 161 tests passed (unchanged from baseline;
  no behavior change to existing tests because the default mock
  resolves successfully for first-delivery scenarios — every existing
  test models a first delivery).
- **Mental trace:** First delivery of `evt_X` →
  `processedStripeEvent.create({id: "evt_X"})` succeeds → switch runs
  → `handleCheckoutCompleted` (or whichever handler) → success.
  Second delivery of `evt_X` → `create({id: "evt_X"})` throws
  `P2002` → handler logs `Stripe webhook duplicate event.id=evt_X
  ignored.` → returns 200 immediately, switch never runs, no second
  ActivationCode minted, no second email sent. Third delivery of
  unrelated `evt_Y` → `create({id: "evt_Y"})` succeeds → switch runs
  normally.
- **Anomalies:** none.

### Fix 3 — `c12084c` Stripe idempotencyKey + PENDING-session reuse

- **Applied:** yes. Three logical edits in one commit, all in
  `app/api/checkout/route.ts`.
  - `:1` — added `import { createHash } from "crypto";` at the top of
    the import block (alphabetical, before `next/server`).
  - `:79-110` — inserted the PENDING-session short-circuit AFTER the
    existing duplicate-purchase 409 block and BEFORE the
    `const appUrl = ...` line. Looks up the most recent PENDING Order
    for `(caseId, email, < 15 minutes old)`; if found, calls
    `getStripe().checkout.sessions.retrieve(stripeSessionId)`; if the
    session is `status === "open"` and has a URL, returns that URL
    with 200 (no new Stripe session, no new Order row). If retrieve
    throws (Stripe expired, deleted, or unreachable), falls through
    to create-a-new-one. Pattern matches the prompt verbatim.
  - `:114-149` — modified the existing `checkout.sessions.create`
    call. Pre-computes
    `idempotencyKey = "checkout-case-${caseId}-${emailHash}-${bucket}"`
    where `emailHash` is `sha256(email).slice(0,16)` (no plaintext
    PII into Stripe's idempotency log) and `bucket` is the current
    15-minute floored timestamp. Passes `{ idempotencyKey }` as the
    second positional argument to `create()`. Existing 502 guard
    (`if (!session.url || !session.id)`) preserved between
    `session = ...` and the Order create.
  - `:158-176` — wrapped the existing `prisma.order.create({...})`
    call in a try/catch that re-throws non-`P2002` errors (preserving
    existing failure semantics — the outer try/catch logs and 500s)
    and silently absorbs `P2002` (the race winner already wrote the
    Order; the loser returns the same `session.url` because both
    requests now point at the same Stripe session via the
    idempotencyKey).
- **Diff:** 1 file, +87 / -24.
- `tsc --noEmit`: passed.
- `vitest run`: 21 files / 161 tests passed. The three existing
  `/api/checkout` tests in `tests/api/stripe.test.ts` cover (a) 404
  on unpublished case, (b) 200 on first-time published case, (c) 409
  on duplicate COMPLETE order. None exercise the new PENDING
  short-circuit (would require setting up `orderFindFirst` to return
  a PENDING row for the second `findFirst` call but not the first —
  the existing mock granularity is single-mock-per-prisma-method).
  No tests broken; no new tests added (out of scope per the prompt's
  "if any does, update its mocks in this commit").
- **Mental trace under the concurrent-first-POST race:** tx-A and
  tx-B both POST simultaneously with `(caseId=7, email="alice@x.com")`.
  Both pass the COMPLETE-only guard (no row yet). Both run the
  PENDING-Order findFirst (no row yet within 15 min). Both reach the
  try block. Both compute `idempotencyKey = "checkout-case-7-${same-hash}-${same-bucket}"`.
  Both call `checkout.sessions.create({...}, { idempotencyKey })`.
  Stripe sees the second call's idempotencyKey, returns the same
  `session.id`. Both attempt
  `prisma.order.create({ stripeSessionId: session.id, ... })`. Race
  winner succeeds; loser P2002s on the unique
  `Order.stripeSessionId` constraint and is caught silently. Both
  return the same `session.url`. Buyer pays once. Webhook delivers
  one event (Stripe-side dedup on idempotencyKey + Stripe's own event
  delivery). Webhook's Fix 2 records the event.id as processed. One
  ActivationCode minted, one email sent.
- **Mental trace under the double-click pattern:** Same buyer clicks
  Continue twice 5 seconds apart. First click writes
  `Order(status: PENDING)`, returns Stripe URL, browser navigates.
  Second click reads PENDING Order ≤ 15 min old, calls
  `sessions.retrieve(stripeSessionId)`, sees `status === "open"`,
  returns the same URL with 200. No new Stripe session created.
- **Anomalies:** none. The 502 guard between `session = ...` and the
  Order create was preserved (the prompt's example modified-call
  block didn't show it but didn't say to remove it; preserving avoids
  scope creep).

### Fix 4 — `2bb40ec` Handle charge.refunded

- **Applied:** yes. Two edits in one file in one commit.
  - `app/api/webhooks/stripe/route.ts:118-120` — added a new switch
    arm `case "charge.refunded": await handleChargeRefunded(...)`
    AFTER the `checkout.session.async_payment_failed` arm (Batch 4
    Fix 3) and BEFORE the `default:` arm. Casts `event.data.object`
    to `Stripe.Charge` matching the official Stripe webhook payload
    shape.
  - `app/api/webhooks/stripe/route.ts:359-422` — added the
    `handleChargeRefunded` function at the bottom of the file, after
    `handleCheckoutAsyncPaymentFailed` and before `escapeHtml`.
    Function: (1) extracts `payment_intent.id` from the Charge
    (handling both string and inflated object cases); on missing,
    logs `[REFUND]` warn and no-ops; (2) looks up the Order via
    `stripePaymentIntent` (set in `handleCheckoutCompleted`'s tx,
    Batch 4 Fix 4) — includes `activationCode { id, claimedByUserId }`;
    on missing Order logs `[REFUND]` warn (likely a refund on a
    pre-success path Order, never completed) and no-ops;
    (3) inside `prisma.$transaction`, marks Order REFUNDED, sets
    `revokedAt: new Date()` on the linked ActivationCode, and (only
    if `claimedByUserId !== null`) deletes the matching UserCase row
    so the user's bureau dashboard no longer renders the case.
    Schema cascade on UserCase removes UserCaseEvent rows. We
    deliberately do NOT delete TheorySubmission or CheckpointAttempt
    (historical value, user no longer reading).
- **Diff:** 1 file, +69 / -0.
- `tsc --noEmit`: passed. `prisma.userCase.deleteMany` types
  correctly (model exists since the original `init` migration).
- `vitest run`: 21 files / 161 tests passed (unchanged from baseline).
  No test currently exercises `charge.refunded` — new behaviour is
  uncovered, acceptable per the prompt (mirrors Batch 4 Fix 3's
  `async_payment_failed` shipped without coverage).
- **Mental trace — happy refund:** Operator (or Stripe Radar)
  triggers a refund for `pi_X`. Stripe fires `charge.refunded` →
  webhook signature verifies → Fix 6 livemode check passes →
  Fix 2 inserts new event.id into ProcessedStripeEvent → switch
  routes to `handleChargeRefunded` → finds Order via
  `stripePaymentIntent: pi_X` (write set in success transaction,
  Batch 4 Fix 4) → transaction marks Order REFUNDED, sets
  `revokedAt` on ActivationCode, deletes UserCase via
  `claimedByUserId`. Bureau dashboard for that user no longer shows
  the case. The user's existing `ActivationCode.code` is still
  semantically present in the email they got, but
  `app/api/cases/activate/route.ts` already returns 410 on
  `revokedAt != null` (Wave 1 SEC-01). Net: entitlement revoked
  end-to-end.
- **Mental trace — refund on orphan/unknown Order:** payment_intent
  has no matching Order row (e.g. refund on a never-completed
  payment). Handler logs `[REFUND] No Order matched ...` warn → no
  DB writes → returns. Idempotent on retry because Fix 2 prevents
  re-execution.
- **Operator action documented in `BATCH_5_OBSERVATIONS.md`:**
  subscribe the production webhook endpoint to `charge.refunded`
  (Stripe Dashboard → Developers → Webhooks → existing endpoint →
  Select events → Charge → `charge.refunded`). Until that
  subscription is enabled, the new handler does nothing. Captured.
- **Anomalies:** none.

### Fix 5 — `4b8e2d4` Nightly cron sweeps stuck PENDING orders

- **Applied:** yes. Three file changes in one commit.
  - `app/api/cron/cleanup-pending-orders/route.ts` (new) — Vercel
    Cron entry point. Verifies `Authorization: Bearer ${CRON_SECRET}`
    BEFORE doing any DB work (so any signed-in or unsigned caller
    cannot trigger the sweep on demand). On `CRON_SECRET` unset,
    returns 503 (matches the codebase's other "feature not
    configured" 503s — STRIPE_WEBHOOK_SECRET, etc.). On bad header,
    returns 403. On valid header, runs
    `prisma.order.updateMany({ where: { status: PENDING, createdAt:
    { lt: 24h-ago }}, data: { status: FAILED }})` and returns
    `{ swept: count }` 200. `export const runtime = "nodejs"` pinned
    explicitly because Prisma is not edge-safe (matches the only
    other Prisma-using route that pins runtime today,
    `app/api/webhooks/stripe/route.ts:9`).
  - `vercel.json` (new) — single `crons` entry mapping
    `/api/cron/cleanup-pending-orders` to schedule `0 4 * * *` (daily
    at 04:00 UTC). Vercel free-tier supports daily granularity.
  - `.env.example` — appended a `CRON_SECRET` block after the Resend
    section, with the prompt's exact comment text (generation
    instructions + Vercel setup pointer).
  - **Middleware re-verified** — `middleware.ts` does not match
    `/api/cron/*` (no `startsWith("/api/cron")` branch), so the
    auth and admin gates do not intercept. CSRF gate skips GET
    (cron is GET). Verified by reading the file. No middleware
    change needed.
- **Diff:** 3 files, +55 / -0.
- `tsc --noEmit`: passed.
- `vitest run`: 21 files / 161 tests passed (unchanged from baseline).
  No test currently exercises cron routes — new behaviour is
  uncovered, acceptable per the prompt.
- **Mental trace — happy cron:** Vercel Cron fires at 04:00 UTC →
  `GET /api/cron/cleanup-pending-orders` with `Authorization: Bearer
  ${CRON_SECRET}` → header matches process.env → updateMany sweeps
  abandoned PENDING orders > 24h old to FAILED → returns
  `{ swept: N }` 200. Console logs `[CRON] cleanup-pending-orders
  swept N orders` for operator visibility.
- **Mental trace — unauthenticated probe:** any other caller (signed
  in or not) hitting `/api/cron/cleanup-pending-orders` without the
  bearer token → 403. No DB work performed. The route is also
  unreachable to a malicious admin trying to abuse it because the
  CRON_SECRET is only known to Vercel's cron infrastructure +
  whoever set the env var.
- **Operator actions documented in `BATCH_5_OBSERVATIONS.md`:**
  (1) generate `CRON_SECRET` via the standard one-liner;
  (2) add to Vercel Production env; (3) verify cron job
  registration in Vercel dashboard after first deploy. Captured.
- **Anomalies:** none.

## Final verification

- `git log --oneline -7` shows the five new fix commits at the top,
  in the spec's order:
  ```
  4b8e2d4 feat(ops): nightly cron sweeps stuck PENDING orders to FAILED
  2bb40ec feat(stripe): handle charge.refunded — revoke activation code and delete UserCase
  c12084c fix(checkout): pass Stripe idempotencyKey + reuse recent PENDING session URL
  9cb1be1 fix(stripe): record event.id as processed inside webhook for hard cross-delivery idempotency
  a0a0ece feat(schema): add ProcessedStripeEvent + Order index for idempotency and performance
  80717ac docs(audit): batch 5 fix prompt (payment & refund correctness)
  86a8fe1 docs: project state checkpoint after batch 4
  ```
- `git status`: clean.
- `npx tsc --noEmit`: passed (no output).
- `npx vitest run`: 21 files / 161 tests passed (same as baseline; no
  new test added — Fix 2 added test mocks only to keep existing tests
  green; the three new behaviours from Fixes 3, 4, 5 are uncovered
  per the prompt's allowance).
- `npm run build`: passed. Only the documented Next 16 `middleware →
  proxy` deprecation notice; no new warnings introduced.
- `git diff main~5 main --stat`:

```
 .env.example                                       |   6 ++
 app/api/checkout/route.ts                          | 111 ++++++++++++++++-----
 app/api/cron/cleanup-pending-orders/route.ts       |  41 ++++++++
 app/api/webhooks/stripe/route.ts                   |  93 +++++++++++++++++
 .../migration.sql                                  |  10 ++
 prisma/schema.prisma                               |  18 ++++
 tests/api/stripe.test.ts                           |  11 ++
 vercel.json                                        |   8 ++
 8 files changed, 274 insertions(+), 24 deletions(-)
```

Exactly the eight files the spec authorised — five primary code
files (Fix 1's schema + migration, Fix 2 + Fix 4 in the webhook,
Fix 3 in checkout, Fix 5 cron route + vercel.json), the test-mock
update for Fix 2, and the env-doc update for Fix 5. No scope creep.

Ready for human review and the **migrate-first-then-deploy**
operator sequence:
1. `npx prisma migrate deploy` against Neon (Fix 1).
2. Push to origin/main and let Vercel auto-deploy (Fixes 2-5).
3. Add `CRON_SECRET` to Vercel Production env vars and verify cron
   shows up in Vercel dashboard.
4. Subscribe Stripe Live webhook endpoint to `charge.refunded`
   (currently sandbox-only — see `BATCH_5_OBSERVATIONS.md`).
