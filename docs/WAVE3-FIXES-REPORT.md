# Wave 3 Fixes Report — 2026-04-26

## Summary
- BUG-03: Stripe orphan-drop paths in `app/api/webhooks/stripe/route.ts` upgraded from `console.warn` + silent return to `console.error` with structured fields and `throw` so Stripe retries (no more silent drops on Order recovery failures).
- BUG-05: Added nullable `emailSentAt` and `emailLastError` columns to the `Order` model and migrated; Stripe webhook now records send success/failure on the row so support can query for unsent orders.
- SEC-09: Both no-session redirects in `middleware.ts` (`/bureau/admin*` and `/bureau/*`) now preserve the original path + query as a `callbackUrl` query param so players land on the page they wanted after login.
- A1: `app/api/cases/[slug]/theory/route.ts` returns `200` early without writing anything when `ownedCase.status === "SOLVED"`, preventing redundant `TheorySubmission` rows after a case is solved.

## BUG-03 — Stripe Orphan-Drop Alerting
- File modified: `app/api/webhooks/stripe/route.ts`
- Exact change made:
  - First early-return path (no Order, metadata insufficient): replaced the
    `console.warn(...)` + `return;` with a structured `console.error("[STRIPE-ORPHAN] ...")`
    that includes `session_id`, `customer_email` (resolved from `customer_details.email`
    or `customer_email`), `amount_total`, and `metadata`, then
    `throw new Error("STRIPE_ORPHAN:${session.id}")`. Stripe receives a 500
    via the outer POST catch and retries the event.
  - Second early-return path (Order recovery fails because `caseFile.findUnique`
    returned null for the metadata caseId): replaced the `console.warn(...)` + `return;`
    with `console.error("[STRIPE-ORPHAN] ... caseFile not found ...")` including
    `session_id`, `metadata_caseId`, `buyer_email`, then
    `throw new Error("STRIPE_ORPHAN_NO_CASE:${session.id}")`.
- Outer POST `try/catch` already logs `Stripe webhook handler error (${event.type})`
  and returns HTTP 500. Left exactly as-is per the protocol.
- tsc: clean.

## BUG-05 — Order Email Tracking
- Schema change: `emailSentAt DateTime?` and `emailLastError String?` added to the
  `Order` model in `prisma/schema.prisma`. Yes.
- Migration result: succeeded — `20260426163724_add_order_email_tracking` applied
  to Neon (`ep-lively-smoke-ambslm9t.c-5.us-east-1.aws.neon.tech`). Prisma client
  regenerated.
- File modified: `app/api/webhooks/stripe/route.ts`
- Exact change made: wrapped the existing `getResend().emails.send({ ... })` block
  (subject/text/html copy preserved verbatim) in a new try/catch:
  - Success branch: `await prisma.order.update({ where: { id: updatedOrder.id }, data: { emailSentAt: new Date() } })`
    immediately after the send.
  - Failure branch: extracts the error message, logs `"Resend send failure for order <id> :"` with the message,
    then writes `emailLastError` (truncated to 500 chars) on the Order row.
    The email-error update itself is `.catch`-guarded with a fallback log so a
    cascading DB failure cannot mask the original Resend failure or escape the
    handler.
- tsc: clean.

## SEC-09 — callbackUrl in Middleware Redirects
- File modified: `middleware.ts`
- Exact change made: both no-session redirect branches (`/bureau/admin*` and the
  generic `/bureau/*`) now build
  `encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)` and redirect to
  `/login?callbackUrl=<encoded>`. The non-admin → `/bureau` redirect, the
  `/bureau/unlock` carve-out, the CSRF gate, and the `/api/*` 401/403 JSON
  responses were left exactly as they were.
- tsc: clean.

## A1 — Theory Route SOLVED Guard
- File modified: `app/api/cases/[slug]/theory/route.ts`
- Test added: yes — `"returns 200 without writing a submission when the case is already SOLVED (A1)"`
  in `tests/api/theory.test.ts`. (The pre-existing
  `"does NOT downgrade status when current status is SOLVED"` test asserted the
  previous behavior — that the route still wrote a `TheorySubmission` row and
  returned 201. After A1 the route short-circuits before any DB write, so that
  test's assertions were inverted to match the new contract under the new test
  name; the SOLVED scenario remains covered.)
- Exact change made: immediately after the
  `ownedCase.currentStage < ownedCase.caseFile.maxStage` 400 guard, inserted
  ```ts
  if (ownedCase.status === "SOLVED") {
    return NextResponse.json(
      { message: "This case is already solved." },
      { status: 200 }
    );
  }
  ```
  No DB write, no `evaluateTheorySubmission` call, no `prisma.$transaction`.
  As a follow-on, the now-redundant `&& currentStatus !== "SOLVED"` clause in
  `becameSolvedNow` was removed because TS narrowing made the comparison a
  type error after the new guard (`tsc` flagged "no overlap").
- tsc: clean.

## Test Results

```
 RUN  v4.1.4 C:/Users/gatch/Documents/black-ledger/site

 ✓ tests/lib/case-quality.test.ts (4 tests) 4ms
 ✓ tests/lib/post-login-path.test.ts (13 tests) 5ms
 ✓ tests/lib/rate-limit.test.ts (4 tests) 22ms
 ✓ tests/api/bureau-people.test.ts (3 tests) 15ms
 ✓ tests/lib/case-evaluation.test.ts (8 tests) 10ms
 ✓ tests/lib/auth-helpers.test.ts (7 tests) 19ms
 ✓ tests/lib/user-case-state.test.ts (30 tests) 10ms
 ✓ tests/api/admin-cases.test.ts (3 tests) 17ms
 ✓ tests/api/workflow.test.ts (4 tests) 16ms
 ✓ tests/api/access-codes-redeem.test.ts (5 tests) 16ms
 ✓ tests/api/admin-section-patches.test.ts (9 tests) 23ms
 ✓ tests/api/activate.test.ts (6 tests) 11ms
 ✓ tests/api/stripe.test.ts (7 tests) 17ms
 ✓ tests/api/admin-support.test.ts (4 tests) 11ms
 ✓ tests/api/admin-codes.test.ts (4 tests) 14ms
 ✓ tests/api/checkpoint.test.ts (6 tests) 9ms
 ✓ tests/api/theory.test.ts (3 tests) 8ms
 ✓ tests/api/admin-uploads.test.ts (5 tests) 9ms
 ✓ tests/routes/unlock-flow.test.ts (14 tests) 494ms
 ✓ tests/api/admin-slug-history.test.ts (4 tests) 9ms

 Test Files  20 passed (20)
      Tests  143 passed (143)
   Duration  1.09s
```

`npx tsc --noEmit` exits 0 with no output.

## Skipped / Blocked

Existing Stripe webhook tests in `tests/api/stripe.test.ts` had to be updated
because they asserted the pre-fix behavior the protocol explicitly changed.
The protocol's "no test changes needed" note for FIX 1 was inaccurate —
`tests/api/stripe.test.ts` does cover the metadata-insufficient orphan path,
and the BUG-05 email tracking adds a second `order.update` call that the two
happy-path tests counted. Updates made:

- `"checkout.session.completed mints an ActivationCode and marks the Order COMPLETE"`:
  `orderUpdate` count changed `Once → Times(2)`; second-call assertion added
  for `emailSentAt: Date`.
- `"recovers an orphan session..."`: same `orderUpdate` Times(2) update.
- `"declines recovery and logs a warning..."`: renamed to
  `"returns 500 and logs STRIPE-ORPHAN when session metadata is insufficient (BUG-03)"`,
  swapped `console.warn` spy for `console.error` (matching the structured
  `[STRIPE-ORPHAN]` line with `find()` to skip the outer-catch line), and
  expected response status changed `200 → 500`. The "no tx, no code, no email"
  invariant assertions were preserved.

Nothing else was skipped or blocked.
