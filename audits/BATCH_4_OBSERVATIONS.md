# BATCH 4 — OBSERVATIONS

Things noticed while applying Batch 4 that were out of scope. Triage as you
see fit; no action taken on any of these.

## 1. Operator action required after Fix 3 lands in production

Fix 3 (`2c824c5`) replaces the `payment_intent.payment_failed` switch arm
with `checkout.session.async_payment_failed`. The handler has no effect
until the Stripe Dashboard webhook subscription is updated:

- **Production webhook endpoint** (Live mode, once Live activation is done):
  - **Subscribe to:** `checkout.session.async_payment_failed`
  - **Optional but recommended:** `checkout.session.async_payment_succeeded`
    (the existing `handleCheckoutCompleted` automatically handles
    delayed-success because Stripe also re-fires `checkout.session.completed`
    on async success, so this is purely belt-and-suspenders).
  - **Unsubscribe:** `payment_intent.payment_failed` (no longer routed by code).
- **Sandbox webhook endpoint** (do this first, then verify with a test
  delayed-payment scenario before flipping the live mode subscription).

Until the dashboard is updated, the new handler does nothing — failed
async payments will continue to leave Order rows stuck PENDING. After
the dashboard subscription is flipped, future async-payment failures
will mark the Order FAILED and the existing
`PENDING > 24h → FAILED` cron (deferred per CLAUDE.md follow-ups) is
still required for stuck-PENDING cleanup.

## 2. Fix 1 sweep — three sites with wasteful `include` that are not security leaks

The Fix 1 sweep flagged eight sites that use `include: { caseFile: true }`.
Six are confirmed safe (server-only render or API responses that project
specific fields), but three have a wasteful Prisma read pattern that
could be tightened to a `select` for performance and as defense-in-depth
against future refactors:

- **`app/bureau/cases/[slug]/records/[recordId]/page.tsx:30-38`** —
  `prisma.userCase.findFirst({ ..., include: { caseFile: true } })` but
  the only field read is `ownedCase.caseFileId`. The full `caseFile`
  scalar bag (~16 columns including `solutionSuspect/Motive/Evidence/
  debrief*/internalNotes`) is loaded into the server's memory and
  immediately discarded. Not a security leak (no client component) but
  a free latency win. Replace with `select: { caseFileId: true, currentStage: true }`.
- **`app/api/cases/activate/route.ts:36-39`** —
  `prisma.activationCode.findUnique({ ..., include: { caseFile: true } })`
  but only `caseFile.isActive`, `caseFile.title`, and `caseFile.slug` are
  read. The handler returns `{ message, slug }` to the client; the rest
  of `caseFile` is loaded then dropped. Replace with
  `include: { caseFile: { select: { isActive: true, title: true, slug: true } } }`.
- **`app/api/cases/[slug]/theory/route.ts:44-52`** —
  `prisma.userCase.findFirst({ ..., include: { caseFile: true } })` reads
  `caseFile.maxStage`, `caseFile.solutionSuspect`, `caseFile.solutionMotive`,
  `caseFile.solutionEvidence`. The handler returns no `caseFile` data to
  the client. Replace with
  `include: { caseFile: { select: { maxStage: true, solutionSuspect: true, solutionMotive: true, solutionEvidence: true } } }`.

None is a security issue (the data does not cross to a client
component), but the pattern is the same one Fix 1 closed at the RSC
boundary. A future contributor who copy-pastes one of these into a
new page that *does* pass the result to a client component reopens the
P0. A "no `caseFile: true` in `include` blocks; always `select` the
exact fields" project rule + a one-off sweep would make the leak class
structurally impossible.

## 3. Fix 4 — test mocks needed updating; the prompt said they wouldn't

The prompt's verification section for Fix 4 said:

> the existing `tests/api/stripe.test.ts:100-198` covers the success
> path; the new precondition is a strict refinement — when no
> concurrency exists, behavior is identical.

That's true at the route-handler level, but the test file mocks
`prisma.$transaction` with a hand-rolled proxy that exposes only
`activationCode.create`, `order.create`, and `order.update`. The new
`tx.order.updateMany` call landed against an undefined function and
threw. I added `orderUpdateMany` to the hoisted-mock declaration, the
`vi.mock("@/lib/prisma")` proxy, and the `transactionFn`
implementation, with a default `mockResolvedValue({ count: 1 })` so the
no-concurrency case is the default.

Two existing assertions also moved: the success-path tests asserted on
`orderUpdate.mock.calls[0][0].data.status === "COMPLETE"`, but Fix 4
moves the status flip to `updateMany`, so the assertion was split
across the two mock objects. Documented in BATCH_4_REPORT.md Fix 4
"Anomalies".

This is the same shape as the Fix 6 test-mock fix the prompt explicitly
allowed in-batch; recording here so the next-batch author knows the
pattern (mocks of mock-proxy `tx` callbacks are fragile to schema
changes).

## 4. Fix 5 curly apostrophe in waitlist route

The waitlist route uses `"You’re on the waitlist."` with a curly
right-single-quotation-mark (U+2019) rather than the ASCII apostrophe
that the prompt's replacement code shows
(`"You're on the waitlist."`). I preserved the existing curly
apostrophe in both the success branch (line 35-38) and the new
silent-absorb branch (line 42-50) so the two responses are
byte-for-byte identical — that's a hard requirement for the
enumeration defense to be airtight, otherwise the response body length
or the rendered character would still discriminate.

If the operator wants to normalize to ASCII apostrophes across the
codebase, that's a separate cosmetic commit.

## 5. Fix 7's wider diff than necessary

The overview PATCH route did not previously have an outer `try-catch`
around its `prisma.$transaction(...)`. Wrapping the existing block
re-indented every line of the transaction body by one level. The
functional change is minimal (a try-catch boundary plus a P2002 → 409
branch); the diff size is dominated by the indentation shift.

If git's `--ignore-space-change` rendering looks cleaner during review,
use it; the actual logic change is small.

## 6. New rate-limit branches added in Batch 2 still untested

Carried forward from `BATCH_2_OBSERVATIONS.md` §3 — neither
`/api/checkout/status` nor `/api/admin/uploads/blurhash` has a test
covering the 429 path. Same for Fix 3's P2002 catch in
`/api/admin/cases` POST (Batch 2) and Fix 7's P2002 catches in
this batch. None of these are urgent but a small "race-against-mock"
style test for each would lock the new behavior in.

## 7. Out-of-scope items the audit flagged but Batch 4 deliberately skipped

Listing for Batch 5/6 scoping. The 2026-05-01 audits' P1 set still has
these open after Batch 4:

- **P1 (audit `2026-05-01-godmode-audit.md` §3 P1-1):** BuyButton
  double-charge race — no Stripe `idempotencyKey` on
  `getStripe().checkout.sessions.create`, no PENDING-Order short-circuit.
  Pure-code fix; no migration. Defer to Batch 5 alongside the refund
  flow because both touch checkout/webhook surface.
- **P1 (audit P1-2):** `Order.userId` link missing + no
  `charge.refunded` / `charge.dispute.created` handler. Refunded
  customers keep entitlement. Schema migration plus handler. Larger
  work; Batch 5.
- **P1 (audit P1-3):** Activation-code email goes to attacker-supplied
  address. Architectural choice (require account-creation pre-checkout
  vs. token-link delivery). Needs product input; Batch 6.
- **P1 (audit P1-6):** `AccessCodeRedemption` unique-key vs
  `oneTimePerUser=false` flag is a no-op. Product call: drop the column
  or drop the unique constraint. Batch 6.
- **P1 (audit P1-7) / Cowork audit P1-1:** Privacy Policy promises
  account deletion that has no implementation in code. Add
  `DELETE /api/me` (no migration; cascades exist). Batch 6.
- **Cowork audit P1-2:** Terms of Service promises a 7-day refund
  mechanism with no enforcement. Same surface as P1-2 above.
- **P2 (audit P2-3):** Stripe webhook does not record processed
  `event.id` for cross-delivery idempotency. Fix 4 closed the
  concurrent-delivery race via `updateMany` precondition; an explicit
  `ProcessedStripeEvent` table would make the invariant explicit
  rather than implicit. Batch 5 alongside the other webhook work.
- **P2 (audit P2-5):** Admin mutation routes lack rate limits (16+
  routes). Mechanical batch; deferred.
- **P2 (audit P2-8):** `/bureau/database` loads every `GlobalPerson`
  unbounded — Fix 1 closed the leak surface but did not add pagination.
  Performance issue at scale.
- **P2 (audit P2-12) / cowork audit P2-5:** `Order` missing
  `@@index([caseFileId, email, status])`. One-line schema change plus
  migration. Batch 5.
- **P2 (cowork audit P2-1):** Google Fonts embedding without Privacy
  Policy disclosure. Either add §5 disclosure of Google as a font-CDN
  processor, or replace `next/font/google` with `next/font/local`.
  Operational launch task.
- **All P3 items:** carried forward from `CLAUDE.md` follow-ups
  (`assertSafeEnv` non-Neon coverage, `unarchive-case.ts` hardcoded
  `CASE_ID`, dotenv runtime cost, `tsconfig target ES2017`,
  `engines.node`, `RevokeButton` ignored field, etc.). Defer.
- **CaseAudit-on-revoke** (cowork audit P3-12) and the other
  CaseAudit gaps — explicitly deferred per the Batch 4 prompt §1.7.

End of observations.
