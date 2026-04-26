# BLACK LEDGER — WAVE 3 FIX PROTOCOL
# ─────────────────────────────────────────────────────────────────────────────
# Self-contained instructions for Claude Code to implement 4 targeted fixes.
# Read this file completely before touching any code.
# ─────────────────────────────────────────────────────────────────────────────

## CONTEXT

You are working on the Black Ledger codebase (Next.js 16, TypeScript strict,
Prisma 7, PostgreSQL on Neon). Four fixes are required. Do exactly what is
described and nothing else. After all fixes, run tsc and vitest and write a
report.

---

## FIX 1 — BUG-03: Stripe orphan-drop is no longer silent (RELIABILITY)

### Problem
In `app/api/webhooks/stripe/route.ts`, function `handleCheckoutCompleted`,
there are two early-return paths at roughly lines 115-119 and 126-131 where
the webhook receives a `checkout.session.completed` event it cannot recover
from (no matching Order, metadata missing or caseFile not found). Both paths
call `console.warn(...)` and return `undefined` — the event is silently dropped,
Stripe marks it delivered, and no trace remains that a customer may have paid
without receiving their code.

### Fix

**Step 1** — Read `app/api/webhooks/stripe/route.ts`.

**Step 2** — Find the first early-return path. It is inside the `else` branch
(no existing Order) and looks like:
```
if (!Number.isInteger(metadataCaseId) || !metadataEmail) {
  console.warn(`checkout.session.completed for unknown session ...`);
  return;
}
```
Replace the `console.warn` + `return` with `console.error` that includes ALL
available session fields useful for manual recovery, then throw so Stripe
receives a 500 and retries the event:
```ts
console.error(
  "[STRIPE-ORPHAN] checkout.session.completed — no Order found and metadata insufficient for recovery. " +
  "Manual investigation required. " +
  `session_id=${session.id} ` +
  `customer_email=${session.customer_details?.email ?? session.customer_email ?? "unknown"} ` +
  `amount_total=${session.amount_total ?? "unknown"} ` +
  `metadata=${JSON.stringify(session.metadata ?? {})}`
);
throw new Error(`STRIPE_ORPHAN:${session.id}`);
```
Throwing here causes the outer try/catch in `POST` to catch it and return HTTP
500, which tells Stripe to retry the event. This is correct behaviour — we want
retries, not silent drops.

**Step 3** — Find the second early-return path. It is the one that fires when
`caseFile.findUnique` returns null for the recovered caseId:
```
if (!recoveredCase) {
  console.warn(`checkout.session.completed recovery for ${session.id}: caseFile #${...} from metadata not found`);
  return;
}
```
Apply the same treatment — upgrade to `console.error` with structured fields
and throw:
```ts
console.error(
  "[STRIPE-ORPHAN] checkout.session.completed — Order recovery failed: caseFile not found. " +
  "Manual investigation required. " +
  `session_id=${session.id} ` +
  `metadata_caseId=${metadataCaseId} ` +
  `buyer_email=${metadataEmail}`
);
throw new Error(`STRIPE_ORPHAN_NO_CASE:${session.id}`);
```

**Step 4** — In the outer `POST` catch block (which already catches all handler
errors and returns HTTP 500), confirm the existing error log still fires:
```ts
console.error(`Stripe webhook handler error (${event.type}):`, error);
return NextResponse.json({ message: "Handler failure." }, { status: 500 });
```
If this already exists, leave it exactly as-is. Do not change it.

**Step 5** — No test changes needed. The existing Stripe tests do not cover
these error paths.

---

## FIX 2 — BUG-05: Track email send outcome on the Order row (RELIABILITY)

### Problem
When Resend fails to deliver the activation code email, the failure is only
logged to `console.error`. There is no persistent record on the Order row of
whether email succeeded or failed, so the support team has no way to query the
database for customers who need a manual resend.

### Fix — Part A: Schema (Prisma)

**Step 1** — Read `prisma/schema.prisma`. Find the `Order` model.

**Step 2** — Add two nullable fields to the `Order` model, immediately after
the `activationCodeId` field:
```prisma
emailSentAt    DateTime?
emailLastError String?
```

**Step 3** — Read `prisma/prisma.config.ts` to confirm it loads `.env.local`
before `.env` (it should already do this from a previous fix).

**Step 4** — Run the migration:
```
npx prisma migrate dev --name add_order_email_tracking
```
If the migration succeeds, continue to Part B.
If the migration FAILS (e.g. no DB connection), note the error in the report
under "Skipped / Blocked" and still apply the code changes in Part B so they
are ready when the migration is run manually.

### Fix — Part B: Webhook

**Step 5** — Read `app/api/webhooks/stripe/route.ts` again (it may have
changed from FIX 1).

**Step 6** — Find the email send block near the bottom of
`handleCheckoutCompleted`. It currently looks like:
```ts
try {
  await getResend().emails.send({ ... });
} catch (error) {
  console.error("Resend send failure:", error);
  // Don't throw — ...
}
```

**Step 7** — Replace the entire try/catch block with one that records the
outcome on the Order row:
```ts
try {
  await getResend().emails.send({
    from: getResendFrom(),
    to: buyerEmail,
    subject: "Your Black Ledger activation code",
    text: [ /* keep exactly as before */ ].join("\n"),
    html: `/* keep exactly as before */`,
  });
  // Record successful send
  await prisma.order.update({
    where: { id: updatedOrder.id },
    data: { emailSentAt: new Date() },
  });
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("Resend send failure for order", updatedOrder.id, ":", errorMessage);
  // Record failure — don't throw; the Order is COMPLETE and the code is minted.
  // Support can query: prisma.order.findMany({ where: { emailSentAt: null, emailLastError: { not: null } } })
  await prisma.order.update({
    where: { id: updatedOrder.id },
    data: { emailLastError: errorMessage.slice(0, 500) },
  }).catch(() => {
    // Best-effort: if this update also fails, just log it.
    console.error("Could not record emailLastError for order", updatedOrder.id);
  });
}
```

IMPORTANT: Keep all the existing email content (subject, text, html) EXACTLY
as it was. Only wrap it in the new try/catch structure above. Do not alter any
email copy.

---

## FIX 3 — SEC-09: Middleware redirects preserve callbackUrl (UX / SECURITY)

### Problem
In `middleware.ts`, two redirect branches send unauthenticated users to
`/login` without a `callbackUrl` parameter. After login, the player lands on
the bureau dashboard instead of the page they were trying to reach. This is a
UX problem and a mild security concern (the redirect destination is lost).

The two affected branches are:
1. `/bureau/admin*` — no session → redirect to `/login`
2. `/bureau/*` — no session → redirect to `/login`

### Fix

**Step 1** — Read `middleware.ts`.

**Step 2** — Find the `/bureau/admin` branch. The no-session redirect looks
exactly like:
```ts
if (!session?.user) {
  return NextResponse.redirect(new URL("/login", req.url));
}
```
Replace with:
```ts
if (!session?.user) {
  const callbackUrl = encodeURIComponent(
    req.nextUrl.pathname + req.nextUrl.search
  );
  return NextResponse.redirect(
    new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
  );
}
```

**Step 3** — Find the `/bureau/*` branch (the other no-session redirect). It
is the second occurrence of the same pattern:
```ts
if (!session?.user) {
  return NextResponse.redirect(new URL("/login", req.url));
}
```
Apply the same replacement as Step 2.

**Step 4** — Do NOT touch the redirect at line 47 that sends non-admin users
from `/bureau/admin` to `/bureau` — that redirect is correct as-is.

**Step 5** — Do NOT change any other part of the file. The CSRF gate, the
auth-API JSON 401 responses, and all other carve-outs must remain exactly as
they are.

**Step 6** — No test needed for this change.

---

## FIX 4 — A1: Theory route does not write a submission when already SOLVED (DATA)

### Problem
`app/api/cases/[slug]/theory/route.ts` runs the full theory evaluation and
writes a `TheorySubmission` row even when `ownedCase.status === "SOLVED"`.
Since SOLVED is a terminal state, no state transition can occur. The result is
a steadily growing pile of redundant rows in `TheorySubmission` for players
who resubmit after solving their case.

### Fix

**Step 1** — Read `app/api/cases/[slug]/theory/route.ts`.

**Step 2** — Find the block that checks `ownedCase.currentStage < maxStage`
(approximately line 61-66). It looks like:
```ts
if (ownedCase.currentStage < ownedCase.caseFile.maxStage) {
  return NextResponse.json(
    { message: "Theory submission unlocks only at the final stage." },
    { status: 400 }
  );
}
```

**Step 3** — Immediately AFTER that block (and before the `evaluateTheorySubmission`
call), insert an early return for the SOLVED case:
```ts
if (ownedCase.status === "SOLVED") {
  return NextResponse.json(
    { message: "This case is already solved." },
    { status: 200 }
  );
}
```

This returns 200 (not an error — the player is not doing anything wrong) with
a short informational message. Nothing is written to the database.

**Step 4** — Add one regression test to `tests/api/theory.test.ts`:
- Test name: `"returns 200 without writing a submission when the case is already SOLVED (A1)"`
- Mock setup: `userCaseFindFirst` resolves with a `userCase` that has
  `status: "SOLVED"` and `currentStage` equal to `caseFile.maxStage`
- Assert: response status is 200
- Assert: `theorySubmissionCreate` (or `prisma.$transaction`) was NOT called

---

## AFTER ALL FIXES

1. Run `npx tsc --noEmit`. Fix any type errors before proceeding.
2. Run `npx vitest run`. All tests must pass (expect 143 or more).
3. Write a report to `docs/WAVE3-FIXES-REPORT.md` with the following sections:

```
# Wave 3 Fixes Report — {date}

## Summary
{one sentence per fix: what was changed and in what file(s)}

## BUG-03 — Stripe Orphan-Drop Alerting
- File modified: ...
- Exact change made: ...
- tsc: clean / errors

## BUG-05 — Order Email Tracking
- Schema change: emailSentAt + emailLastError added to Order model (yes/no)
- Migration result: succeeded / failed (paste error if failed)
- File modified: ...
- Exact change made: ...
- tsc: clean / errors

## SEC-09 — callbackUrl in Middleware Redirects
- File modified: ...
- Exact change made: ...
- tsc: clean / errors

## A1 — Theory Route SOLVED Guard
- File modified: ...
- Test added: yes/no — {test name}
- Exact change made: ...
- tsc: clean / errors

## Test Results
{paste full vitest output}

## Skipped / Blocked
{anything that could not be applied and why}
```
