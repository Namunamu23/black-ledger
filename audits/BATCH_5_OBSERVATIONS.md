# BATCH 5 — OBSERVATIONS

Things noticed while applying Batch 5 that were out of scope. Triage as you
see fit; no action taken on any of these.

## 1. Operator action items required after Batch 5 lands

Batch 5 touches three external systems beyond the code changes. Each
must happen on a specific schedule for the new code to be safe and
effective.

### 1a. Apply the Prisma migration to Neon (BEFORE deploying the code)

Fix 1 (`a0a0ece`) authors a new migration at
`prisma/migrations/20260501000000_add_processed_stripe_event_and_order_index/migration.sql`
but does not apply it. Operator runs:

```
npx prisma migrate deploy
```

with `DIRECT_URL` (or `DATABASE_URL` fallback per `prisma.config.ts`)
pointed at production Neon. Both statements are additive — no
existing rows altered, no DDL removes anything.

**Sequencing matters.** Vercel auto-deploys on push to main. Fix 2
(`9cb1be1`) calls `prisma.processedStripeEvent.create` on every
webhook entry. If the code deploys before the table exists, every
incoming webhook will fail with `relation "ProcessedStripeEvent" does
not exist`, the catch arm logs and returns 500, and Stripe retries on
exponential backoff for ~3 days. Mitigation: either (a) apply
migration *first* and *then* push to main, or (b) push and immediately
apply migration before the next webhook delivery (test mode is low
volume; live mode is the dangerous case once activated). Pattern (a)
is what Batch 3 did with `tokenVersion` and is the safer default.

### 1b. Add `CRON_SECRET` to Vercel Production env

Fix 5 (`4b8e2d4`) reads `process.env.CRON_SECRET`. Without it, the
route returns 503 and the cron job is a no-op. Steps:

1. Generate the secret:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Vercel Dashboard → Settings → Environment Variables → Production →
   add `CRON_SECRET = <generated>`. (Optional: also set in Preview
   for staging behaviour parity.)
3. After the next deploy lands, verify Vercel registered the cron job:
   Dashboard → Settings → Cron Jobs → confirm
   `/api/cron/cleanup-pending-orders` shows up with schedule
   `0 4 * * *`.
4. Manually invoke once to confirm wiring (Vercel Dashboard → Cron
   Jobs → Run, or `curl -H "Authorization: Bearer $CRON_SECRET"
   https://theblackledger.app/api/cron/cleanup-pending-orders`).
   Response should be `{ swept: 0 }` (no stuck PENDING orders right
   now per CLAUDE.md's Week 12 cleanup note).

### 1c. Subscribe production webhook to `charge.refunded`

Fix 4 (`2bb40ec`) adds the `charge.refunded` switch arm. The handler
does nothing until Stripe is configured to send the event. Steps:

1. **Sandbox first** (do this now, while still in test mode):
   - Stripe Dashboard → Developers → Webhooks → existing endpoint
     `https://theblackledger.app/api/webhooks/stripe` →
     Select events → Charge → check `charge.refunded`. Save.
   - Test by issuing a refund on a recent test-mode order:
     dashboard → Payments → find a `succeeded` charge → Refund. The
     refund webhook should arrive; verify
     `Order.status === REFUNDED` in Neon and confirm
     `[REFUND]` log line in Vercel function logs.
2. **Live mode** (do this when Stripe Live activation is complete,
   alongside the rest of the live-mode setup currently pending in
   `CLAUDE.md`'s Week 12 known follow-ups): same flow, in the live
   webhook endpoint.

The handler also tolerates `charge.refunded` events that don't match
any Order — those are logged as `[REFUND] No Order matched ...` warns
and no-op. Operator can use those log lines to detect orphaned
refunds and reconcile manually if needed.

## 2. Decision: Order.userId deferred — User reachable via activationCode.claimedByUserId

Claude Code's 2026-05-01 audit P1-2 recommended adding `Order.userId`
as part of the refund handler so the User is directly reachable from
the Order in `handleChargeRefunded`. We deliberately skipped that
column.

**Rationale.** `Order.activationCodeId` (set by
`handleCheckoutCompleted`'s success transaction, Batch 4 Fix 4) is
already a stable link to the issued ActivationCode, and
`ActivationCode.claimedByUserId` is set by
`app/api/cases/activate/route.ts` at the moment the user redeems the
code. So the refund handler reads:

```ts
order.activationCode.claimedByUserId
```

and gets either the redeeming User's id (if claimed) or `null` (if
not yet claimed). Both branches are correctly handled — the `null`
branch skips UserCase deletion because there's no UserCase to delete
yet (the code was never used). Adding `Order.userId` would have given
us:

- A second source of truth for the same fact (drift risk).
- One more column on a migration we'd rather keep minimal.
- A column that is `null` for every guest-checkout Order until
  activation-time, which is most of the lifecycle of any Order — so
  the column carries no information that isn't already on
  `ActivationCode.claimedByUserId`.

The audit's recommendation came from a "Order.userId would also
support things like 'show this user's refunded orders'" angle — that
query is `prisma.order.findMany({ where: { activationCode: {
claimedByUserId: userId }, status: REFUNDED }})` and is acceptable as
long as the schema retains the existing `Order → ActivationCode → User`
join chain. If a future product feature needs `Order.userId` for
account-deletion cascade convenience or simpler analytics, add it
then; until then it's premature.

If the audit's other consideration was "what about Orders made before
the user's account existed" — that case is the
attacker-supplied-email vector (P1-3 in the audit), which is being
addressed separately. Adding `Order.userId` does not fix it on its
own.

## 3. Webhook idempotency now has two complementary primitives — keep both

Batch 4 Fix 4 added a `tx.order.updateMany({ where: { status: PENDING
}})` precondition inside `handleCheckoutCompleted`. Batch 5 Fix 2
added `prisma.processedStripeEvent.create({ data: { id: event.id }})`
at the very top of POST. There's a tempting refactor to drop one and
keep the other.

Don't. They cover different races:

- **`updateMany` precondition** is granular to the COMPLETE flip and
  catches the case where two concurrent invocations both pass the
  `status === COMPLETE` short-circuit and both enter the transaction
  before either commits. It uses the row-level lock semantics of
  `UPDATE` to serialize. Limitation: only meaningful for
  `checkout.session.completed`.
- **`ProcessedStripeEvent` insert** is granular to event.id and
  catches duplicate redeliveries of *any* event type, including
  refunds, expiries, async-payment-failures, and future events.
  Limitation: doesn't protect against *different* events that affect
  the same Order (e.g. `checkout.session.completed` arriving twice
  is one event.id; an unrelated refund a week later is a different
  event.id and is correctly NOT deduped).

Together: a duplicate-redelivery `checkout.session.completed` is
caught by `ProcessedStripeEvent` (top-of-handler short-circuit, never
even reaches the switch). A truly novel concurrent-first-delivery
that races past `ProcessedStripeEvent` (vanishingly unlikely because
Stripe doesn't fire two distinct event.ids for the same logical
event) is still caught by `updateMany`. Belt-and-suspenders is the
right posture here.

## 4. The `/api/checkout` PENDING short-circuit isn't tested

Fix 3 added a PENDING-Order findFirst short-circuit and a
`sessions.retrieve` call that returns the existing URL when the
session is still open. The existing `tests/api/stripe.test.ts`
exercises three `/api/checkout` paths (404 on draft, 200 on first
purchase, 409 on completed-purchase) but doesn't cover:

- PENDING + open Stripe session → returns existing URL
- PENDING + Stripe `retrieve` throws → falls through and creates new
- PENDING + Stripe session `status === "expired"` → falls through
  and creates new
- Concurrent `(caseId, email)` first POSTs → idempotencyKey collapses
  to one Stripe session, second `prisma.order.create` P2002s, route
  returns 200 with the same URL

Adding these would require teaching the test mock about Stripe's
`sessions.retrieve` (currently only `create` is mocked) and about
multi-call `orderFindFirst` granularity (currently a single
`mockResolvedValue` is reused for both findFirst calls — the
COMPLETE check and the PENDING check). Not a blocker; flag for next
batch's test work.

## 5. The cron sweeper has no test, no Vercel-Cron header validation

The cron route at `app/api/cron/cleanup-pending-orders/route.ts`
checks `Authorization: Bearer ${CRON_SECRET}` but doesn't validate
the optional `User-Agent: vercel-cron/1.0` header that Vercel sends.
A determined attacker who exfiltrated `CRON_SECRET` somehow could
trigger the sweep at any time, but the worst-case impact is "marks
some PENDING orders FAILED" — no monetary loss, no data loss, just
slightly faster status-flip than the daily cron. Not worth tightening
beyond the bearer token at this stage.

Also no test. Same shape as Fix 4's untested handler. The route is
small enough that mental tracing covers it.

## 6. Other rate-limit and CSP gaps still open from prior audits

Carried forward unchanged from `BATCH_2_OBSERVATIONS.md` §3 and
`BATCH_4_OBSERVATIONS.md` §6 — not actioned in Batch 5:

- `/api/checkout/status` and `/api/admin/uploads/blurhash` rate-limit
  branches still untested (Batch 2 added them, no race-against-mock
  tests).
- `/api/admin/cases` POST and `/api/admin/cases/[caseId]` PUT P2002
  catches still untested (Batch 2 + Batch 4).
- `/api/cron/*` is now a route prefix that does not match any
  middleware branch. Future middleware changes that add a generic
  `/api/*` auth gate would break cron. Document that constraint
  inline if and when the middleware shape changes.

## 7. Out-of-scope items the audit flagged but Batch 5 deliberately skipped

Listing for Batch 6+ scoping. The 2026-05-01 audits' P1 set still has
these open after Batch 5:

- **P1 (audit `2026-05-01-godmode-audit.md` §3 P1-3):** Activation-code
  email goes to attacker-supplied address. Architectural choice
  (require account-creation pre-checkout vs. token-link delivery).
  Needs product input; Batch 6.
- **P1 (audit P1-6):** `AccessCodeRedemption` unique-key vs
  `oneTimePerUser=false` flag is a no-op. Product call: drop the
  column or drop the unique constraint. Batch 6.
- **P1 (audit P1-7) / Cowork audit P1-1:** Privacy Policy promises
  account deletion that has no implementation in code. Add
  `DELETE /api/me` with re-auth gate (no migration; cascades exist).
  Batch 6.
- **Cowork audit P1-2:** Terms of Service promises a 7-day refund
  mechanism. Batch 5 closed the **Stripe-side** half of this (the
  refund webhook handler now revokes entitlement). The **product-side
  half** — a customer-facing "Request a refund" flow with the 7-day
  window enforced via `claimedAt` lookup — is still open. Either
  (a) build the customer-facing flow, or (b) clarify the policy to
  say "request via support email."
- **P2 (audit P2-5):** Admin mutation routes lack rate limits.
  Mechanical batch; deferred.
- **P2 (audit P2-7):** Role demotion does not propagate to existing
  JWT sessions (tokenVersion only bumps on password reset).
  Hypothetical until a second admin exists.
- **P2 (audit P2-8):** `/bureau/database` loads every `GlobalPerson`
  unbounded. Performance + RSC payload size. Batch 4 closed the leak
  surface; pagination still pending.
- **P2 (audit P2-9):** `runtime = "nodejs"` not pinned on every API
  route. Mechanical sweep, ~24 files. Batch 5 added the pinned
  declaration on the new cron route as a one-off; the rest is
  deferred.
- **P2 (audit P2-10) / cowork audit P2-12:** CSP allows `'unsafe-inline'`
  and `'unsafe-eval'` in `script-src`. Move to nonce-based.
  Multi-batch effort.
- **P2 (audit P2-11) / cowork audit P2-13:** Forgot-password timing
  leak + login lookup not constant-time. Standard
  bcrypt-against-fake-hash pattern + out-of-band Resend send.
  Operational, deferred.
- **P2 (cowork audit P2-1):** Google Fonts embedding without Privacy
  Policy disclosure. Either disclose `fonts.gstatic.com` in §5 of
  `/privacy` or replace `next/font/google` with `next/font/local`.
  Operational launch task.
- **P2 (cowork audit P2-6):** Legacy single-code generator at
  `/api/admin/cases/[caseId]/activation-codes` has unbounded collision
  retry. Either add a 3-attempt cap (mirror the newer batch route)
  or delete the legacy route. Cosmetic-ish.
- **P2 (cowork audit P2-7):** Initial activation code creation in
  admin case POST silently 500s on collision after creating the
  CaseFile. Wrap both writes in a `$transaction`.
- **P2 (cowork audit P2-8):** `app/layout.tsx` calls `auth()` on every
  page render. Postgres round-trip per request. Edge cases for
  marketing-page traffic spikes.
- **P2 (cowork audit P2-9):** No structured logging / no Sentry.
  Operational; install before live customer traffic.
- **All P3 items:** carried forward from `CLAUDE.md` follow-ups
  (`assertSafeEnv` non-Neon coverage, `unarchive-case.ts` hardcoded
  `CASE_ID`, dotenv runtime cost, `tsconfig target ES2017`,
  `engines.node`, `RevokeButton` ignored field, `revokeCodeSchema`
  passthrough dead-branch, `RevealedEvidence` legacy tooltip strings,
  Stripe/Resend client caching in production, `lucide-react ^1.8.0`
  pin verification, etc.). Defer.

End of observations.
