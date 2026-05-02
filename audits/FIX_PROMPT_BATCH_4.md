# BATCH 4 — FIX PROMPT (post-2026-05-01-godmode-audit pair)

You are a fresh Claude Code session running on Opus 4.7. Your only job in this session is to apply the seven fixes below, surgically, one commit per fix, in the order listed. No scope creep, no migrations, no schema changes, no `npm install`, no fixes that aren't on this list. When all seven commits are on tree, write `audits/BATCH_4_REPORT.md` and `audits/BATCH_4_OBSERVATIONS.md` and stop.

Read this entire prompt first. Then read the two audit dossiers it references. Then begin.

---

## 1. Operating principles (read twice)

1. **One commit per fix.** Subjects are pre-written below — use them verbatim. Never bundle two fixes into one commit. Never split one fix across multiple commits.
2. **No scope creep.** If you spot a real issue while applying a fix, capture it as a one-liner in `audits/BATCH_4_OBSERVATIONS.md` for the next batch. Do not fix it now.
3. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` must exit clean, `npx vitest run` must still pass at the same count or higher. If either fails, stop, restore via `git reset --hard HEAD~1` if needed, and surface the failure rather than guess at a fix.
4. **No migrations.** Every fix in this batch is no-schema-change. If you find yourself reaching for `prisma migrate`, stop — that fix belongs in Batch 5.
5. **Approve nothing that mutates state outside this batch.** No `npm install`, no `npm audit fix`, no `git push`, no migrations, no env changes. Reads and the seven listed writes only.
6. **Ground truth = source code.** This prompt cites file:line based on commit `dd07e57c416afb065d7866802e580778bb185f97`. Re-confirm against the actual file before each edit; if line numbers drift after intervening commits, find the right location by content not line number.
7. **Skip CaseAudit writes for revoke and similar actions.** They were marked as deferred in the prior audit reports; do not add them in this batch.

---

## 2. Pre-flight

```
git rev-parse HEAD                  # should be dd07e57 (or later if commits have landed since)
git status                          # working tree must be clean
npx tsc --noEmit                    # baseline: must exit clean
npx vitest run                      # baseline: 21 files / 161 tests
```

If any of the four fail, stop and report. Do not begin commits.

Confirm both audit dossiers exist on the repo at `audits/2026-05-01-godmode-audit.md` and `audits/2026-05-01-godmode-audit-cowork.md`. Read both before starting; the fixes below come from the union of their findings.

---

## 3. The seven fixes

### Fix 1 — `fix(security): narrow Prisma select on /bureau/database to stop RSC payload leaking case solutions and internalNotes`

**Severity:** P0 — defeats the product's core "discover the solution" mechanic. Any signed-in investigator can `View Source` on `/bureau/database` and read every case's solution + every `GlobalPerson.internalNotes`.

**File:** `app/bureau/database/page.tsx` lines 14–26.

**Current code (the bug):**
```ts
const people = await prisma.globalPerson.findMany({
  include: {
    aliases: true,
    caseAppearances: {
      include: {
        caseFile: true,                   // ← unselected: returns ALL CaseFile fields,
                                          // including solutionSuspect / solutionMotive /
                                          // solutionEvidence / debrief* — all of which
                                          // get serialized into the RSC payload sent
                                          // to the browser.
      },
    },
  },
  orderBy: { bureauId: "asc" },
});
```

**Why TypeScript doesn't save you:** `<GlobalPeopleSearch people={people} />` (line 149) passes `people` to a `"use client"` component (`components/bureau/GlobalPeopleSearch.tsx:1`). Next.js serializes the entire JS object into the RSC payload regardless of the destination's TypeScript prop type. The `PersonSearchItem` type at `GlobalPeopleSearch.tsx:6-37` documents what the client component reads — it does **not** filter what gets serialized.

**Replacement code:**
```ts
const people = await prisma.globalPerson.findMany({
  // Explicit select — every field listed here crosses the server→client
  // boundary into the <GlobalPeopleSearch> client component's RSC payload.
  // Do NOT add a field here without checking that the client component reads
  // it; do NOT switch any nested relation back to `include`. The matching
  // PersonSearchItem type in components/bureau/GlobalPeopleSearch.tsx is
  // the authoritative shape contract for what the client renders.
  select: {
    id: true,
    bureauId: true,
    firstName: true,
    lastName: true,
    fullName: true,
    dateOfBirth: true,
    knownLocation: true,
    status: true,
    personType: true,
    classification: true,
    riskLevel: true,
    relevanceLevel: true,
    profileSummary: true,
    gender: true,
    accessLevel: true,
    sourceReliability: true,
    confidenceLevel: true,
    watchlistFlag: true,
    aliases: { select: { alias: true } },
    caseAppearances: {
      select: {
        role: true,
        caseFile: { select: { title: true, slug: true } },
      },
    },
  },
  orderBy: { bureauId: "asc" },
});
```

**Sweep mandate (still part of Fix 1 — same commit):**
1. `git grep -nE "include:\\s*\\{[^}]*caseFile:\\s*true" app/` — list every site that uses the unsafe pattern.
2. For every match: read the file. If it's a server component that **renders the data itself and never passes the Prisma object across to a `"use client"` component**, it is safe — leave it alone, document in `BATCH_4_OBSERVATIONS.md`. If it passes the data to a client component (directly or via prop drilling), narrow the same way. Per audit dossier `audits/2026-05-01-godmode-audit.md` §3 P0-1 confidence note, `app/bureau/people/[personId]/page.tsx` is known-safe under this rule. Verify that claim by reading the file; do not assume.
3. Also `git grep -nE "include:\\s*\\{[^}]*aliases:\\s*true|include:\\s*\\{[^}]*caseAppearances:\\s*true" app/` — same triage.

**Verification:**
- `npx tsc --noEmit` clean (the client component's `PersonSearchItem` type already documents the narrower shape; TypeScript should compile).
- `npx vitest run` still 161 tests passing.
- Read the file post-edit. Confirm the `select` block contains zero of: `solutionSuspect`, `solutionMotive`, `solutionEvidence`, `debriefOverview`, `debriefWhatHappened`, `debriefWhyItWorked`, `debriefClosing`, `debriefSectionTitle`, `debriefIntro`, `internalNotes`.

**Commit subject:** `fix(security): narrow Prisma select on /bureau/database to stop RSC payload leak`

---

### Fix 2 — `fix(admin): allow hidden_evidence as AccessCode unlocksTarget`

**Severity:** P1 — half-shipped feature. The redeem route, workspace renderer, and Prisma `HiddenEvidence` model are all wired for `type === "hidden_evidence"`, but the admin POST validator rejects it.

**Files:** `lib/validators.ts:275-284` and `app/api/admin/cases/[caseId]/access-codes/route.ts:62-81`.

**Current validator:**
```ts
unlocksTarget: z.object({
  type: z.enum(["record", "person", "hint"]),
  id: z.number().int().positive(),
}),
```

**Replacement validator:**
```ts
unlocksTarget: z.object({
  type: z.enum(["record", "person", "hint", "hidden_evidence"]),
  id: z.number().int().positive(),
}),
```

**Current ownership check** (`app/api/admin/cases/[caseId]/access-codes/route.ts:62-81`) handles `record`, `person`, `hint`. Add a fourth branch:

```ts
} else if (type === "hidden_evidence") {
  const row = await prisma.hiddenEvidence.findUnique({
    where: { id },
    select: { caseFileId: true },
  });
  targetExists = row?.caseFileId === parsedCaseId;
}
```

Place it as a sibling of the existing three branches, before the `if (!targetExists)` 422 return.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` 161 tests.
- Mental trace: `POST /api/admin/cases/<id>/access-codes` with body `{ code, kind, unlocksTarget: { type: "hidden_evidence", id }, ... }` now passes Zod and reaches the ownership check, which validates against `prisma.hiddenEvidence.findUnique`.

**Commit subject:** `fix(admin): allow hidden_evidence as AccessCode unlocksTarget`

---

### Fix 3 — `fix(stripe): subscribe to checkout.session.async_payment_failed instead of payment_intent.payment_failed`

**Severity:** P1 — `payment_intent.payment_failed` looks up Order by `stripePaymentIntent`, which is only written by the success path. Async payment failures (the typical late-rejection pattern) leave Order rows stuck PENDING forever.

**File:** `app/api/webhooks/stripe/route.ts:60-74` (switch) and `:284-294` (handler).

**Replacement switch arm** at lines 67-69:

```ts
case "checkout.session.async_payment_failed":
  await handleCheckoutAsyncPaymentFailed(event.data.object as Stripe.Checkout.Session);
  break;
```

**Replacement handler** (replace `handlePaymentFailed` at lines 284-294 — delete the old, add the new):

```ts
async function handleCheckoutAsyncPaymentFailed(session: Stripe.Checkout.Session) {
  // Look up the Order via session id (always indexed) rather than
  // payment_intent (only written by the success path). This closes the
  // "PENDING orders accumulate forever" failure mode of the prior
  // payment_intent.payment_failed subscription.
  const order = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true, status: true },
  });
  if (!order || order.status === OrderStatus.COMPLETE) return;
  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.FAILED },
  });
}
```

**Operator action documented in BATCH_4_OBSERVATIONS.md (do not perform — the operator does this in Stripe Dashboard):** subscribe the production webhook endpoint to `checkout.session.async_payment_failed` (and ideally `checkout.session.async_payment_succeeded` for completeness — the latter routes to the existing `handleCheckoutCompleted` automatically because Stripe also re-fires `checkout.session.completed` on async-success), unsubscribe from `payment_intent.payment_failed`. Until the dashboard subscription changes, the new handler does nothing.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` 161 tests. (The existing `tests/api/stripe.test.ts` covers signature verification and `checkout.session.completed`; nothing tests the failed-payment branch — this is fine, no test needs updating.)
- Mental trace: a `checkout.session.async_payment_failed` event with `session.id = X` arrives → handler finds Order by stripeSessionId X → if PENDING, marks FAILED → if already COMPLETE (rare race), leaves alone.

**Commit subject:** `fix(stripe): use checkout.session.async_payment_failed for async failures`

---

### Fix 4 — `fix(stripe): close webhook concurrent-delivery race with updateMany precondition`

**Severity:** P1 — Stripe occasionally redelivers `checkout.session.completed` within hundreds of milliseconds. The current idempotency check (`if (existingOrder?.status === COMPLETE) return` at line 95) is correct for sequential redelivery but races on concurrent redelivery: both invocations read PENDING, both pass the gate, both enter the `$transaction`, and under PostgreSQL READ COMMITTED isolation neither aborts — net result: two ActivationCodes minted, two emails sent.

**File:** `app/api/webhooks/stripe/route.ts:170-202` (the `$transaction` inside `handleCheckoutCompleted`) and `:75-81` (the outer catch in `POST`).

**Replacement transaction body** at lines 170-202:

```ts
const updatedOrder = await prisma.$transaction(async (tx) => {
  const orderRow = existingOrder
    ? existingOrder
    : await tx.order.create({
        data: {
          stripeSessionId: session.id,
          email: buyerEmail,
          caseFileId: caseFile.id,
          status: OrderStatus.PENDING,
        },
      });

  // Concurrency precondition: only one transaction can flip PENDING → COMPLETE.
  // Without this gate, two near-simultaneous Stripe redeliveries of the same
  // checkout.session.completed event both pass the COMPLETE check at line 95
  // (because both read status === PENDING), both enter this transaction, and
  // both mint a fresh ActivationCode — leaking a second valid orphaned code
  // and sending a duplicate Resend email. The updateMany returning count: 0
  // is the only safe signal that another invocation already won.
  const claimed = await tx.order.updateMany({
    where: { id: orderRow.id, status: OrderStatus.PENDING },
    data: { status: OrderStatus.COMPLETE },
  });
  if (claimed.count === 0) {
    throw new Error("ALREADY_COMPLETED_BY_CONCURRENT_DELIVERY");
  }

  const activationCode = await tx.activationCode.create({
    data: {
      code,
      caseFileId: caseFile.id,
      source: ActivationCodeSource.PURCHASE,
    },
  });

  return tx.order.update({
    where: { id: orderRow.id },
    data: {
      stripePaymentIntent: paymentIntentId,
      activationCodeId: activationCode.id,
    },
    include: {
      activationCode: { select: { code: true } },
      caseFile: { select: { title: true } },
    },
  });
});
```

Note the `data: { status: OrderStatus.COMPLETE }` is removed from the final `tx.order.update` because it's already set by the precondition `updateMany`.

**Replacement outer catch** at lines 75-81:

```ts
} catch (error) {
  if (error instanceof Error && error.message === "ALREADY_COMPLETED_BY_CONCURRENT_DELIVERY") {
    // Another concurrent invocation already completed this Order and sent
    // the email. Idempotent return — do not re-mint a code or re-send the email.
    return NextResponse.json({ received: true }, { status: 200 });
  }
  console.error(`Stripe webhook handler error (${event.type}):`, error);
  return NextResponse.json(
    { message: "Handler failure." },
    { status: 500 }
  );
}
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` 161 tests (the existing `tests/api/stripe.test.ts:100-198` covers the success path; the new precondition is a strict refinement — when no concurrency exists, behavior is identical).
- Mental trace under concurrent redelivery: tx-A enters first, runs `updateMany` (count: 1), mints code, updates Order, commits. tx-B enters second, runs `updateMany` (count: 0 because Order is now COMPLETE), throws `ALREADY_COMPLETED_BY_CONCURRENT_DELIVERY`, transaction rolls back, outer catch returns 200. Net: one code, one email. Correct.

**Commit subject:** `fix(stripe): close webhook concurrent-delivery race with updateMany precondition`

---

### Fix 5 — `fix(privacy): make /api/register and /api/waitlist uniform-200 to prevent email enumeration`

**Severity:** P2 — Both routes leak account / waitlist membership at the rate-limit ceiling (3/60s/IP — trivial to scan a list). Mirrors `/api/forgot-password`'s deliberate uniform-200 design.

**File 1:** `app/api/register/route.ts:32-42`.

**Replacement** (replace the `if (existing)` block):
```ts
if (existing) {
  // Silent absorb. Returning 409 with "An account with this email already
  // exists" lets an attacker enumerate registered emails at the rate-limit
  // ceiling (3/60s/IP). Mirrors /api/forgot-password's uniform-200 design.
  // The legitimate user who innocently registers twice gets the same shape
  // they'd get on first registration; if they cannot then sign in, the
  // password-reset flow is the recovery path. A future batch may add an
  // email-of-record ("someone tried to register with this email") to close
  // the UX gap; this batch is the correct privacy posture.
  return NextResponse.json({ message: "Account created." }, { status: 201 });
}
```

**File 2:** `app/api/waitlist/route.ts:42-46`.

**Replacement** (the `if (maybeError.code === "P2002")` block):
```ts
if (maybeError.code === "P2002") {
  // Silent absorb — duplicate waitlist signups are no-ops, not errors.
  // Returning 409 leaks waitlist membership at the rate-limit ceiling
  // (3/60s/IP). Mirror /api/register and /api/forgot-password's stance.
  return NextResponse.json(
    { message: "You're on the waitlist." },
    { status: 201 }
  );
}
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — check `tests/api/register.test.ts` for any test that asserts on the 409. If a test exists, update its assertion to expect 201 in the same commit (the test is now wrong; the message is "Account created.").
- If `tests/api/register.test.ts` does NOT have a 409 test, leave the file alone.
- No existing test covers the waitlist 409 path; nothing to update there.

**Commit subject:** `fix(privacy): make /api/register and /api/waitlist uniform-201 to prevent email enumeration`

---

### Fix 6 — `fix(security): validate event.livemode on Stripe webhook to catch test/live misconfiguration`

**Severity:** P2 — defense-in-depth. If `STRIPE_WEBHOOK_SECRET` is misconfigured (test secret on a live deploy, or vice versa), the handler today would silently process events from the wrong mode. Once Stripe Live mode flips, this becomes a code-mint vector.

**File:** `app/api/webhooks/stripe/route.ts:55` (immediately after signature verification, before `console.log` at line 57).

**Insert new check** between the existing signature-verification block and the `console.log("Stripe webhook received: ...")` line:

```ts
// Defense in depth: cross-check that the event's livemode flag matches
// the Stripe key the handler is using. Misconfiguration (test secret on
// live deploy or vice versa) would otherwise silently process events
// from the wrong mode — particularly dangerous after Stripe Live flips,
// because a leaked test webhook secret would mint live ActivationCodes.
const isTestKey = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
const expectLive = !isTestKey;
if (event.livemode !== expectLive) {
  console.error(
    `[STRIPE-MODE-MISMATCH] event.livemode=${event.livemode} ` +
    `expected=${expectLive} event.id=${event.id} ` +
    `event.type=${event.type}`
  );
  return NextResponse.json(
    { message: "Event mode mismatch." },
    { status: 400 }
  );
}
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — the existing stripe webhook tests use mocked events; check whether the test mocks set `livemode` consistently with `STRIPE_SECRET_KEY`. If they don't, the tests will fail. In that case, fix the mocks in the same commit by adding `livemode: false` to the test events (since tests run with no STRIPE_SECRET_KEY → `isTestKey === false` → `expectLive === true`... wait, that fails too).

Actually, the test environment likely has `STRIPE_SECRET_KEY` unset entirely. In that case `isTestKey === false` and `expectLive === true`, but the test fixtures probably have `livemode: false`. The mismatch would fail every existing test.

**Test-fix patch (apply in the same commit):** add a leading guard that skips the check when `STRIPE_SECRET_KEY` is unset (test environment):
```ts
if (process.env.STRIPE_SECRET_KEY) {
  const isTestKey = process.env.STRIPE_SECRET_KEY.startsWith("sk_test_");
  const expectLive = !isTestKey;
  if (event.livemode !== expectLive) {
    console.error(...);
    return NextResponse.json({ message: "Event mode mismatch." }, { status: 400 });
  }
}
```

This preserves the production guarantee (production always has STRIPE_SECRET_KEY set) and avoids breaking the test suite. Use this guarded form.

**Commit subject:** `fix(security): validate event.livemode on Stripe webhook to catch mode misconfiguration`

---

### Fix 7 — `fix(admin): catch P2002 on slug update in legacy PUT and overview PATCH`

**Severity:** P2 — bad admin UX. Two concurrent admin saves with the same slug both pass the precheck, the second hits the `tx.caseFile.update` and throws P2002, which currently bubbles to a 500.

**File 1:** `app/api/admin/cases/[caseId]/route.ts:482-489` (the outer catch of the legacy aggregate PUT).

**Replacement:**
```ts
} catch (error) {
  const maybe = error as { code?: string };
  if (maybe.code === "P2002") {
    // Concurrent admin save raced past the slug pre-check. Return 409 with
    // a reload hint instead of a generic 500. Mirrors Batch 2's pattern in
    // app/api/admin/cases/route.ts:57-66.
    return NextResponse.json(
      {
        message:
          "Another admin save changed this case while you were editing. Please reload and try again.",
      },
      { status: 409 }
    );
  }
  console.error("Admin case update error:", error);

  return NextResponse.json(
    { message: "Something went wrong while updating the case." },
    { status: 500 }
  );
}
```

**File 2:** `app/api/admin/cases/[caseId]/overview/route.ts`. The overview PATCH route does not have an outer try-catch wrapping the `$transaction`. Wrap the existing `prisma.$transaction(...)` block (lines 76-102) in a try-catch that catches P2002 → 409 and rethrows everything else:

```ts
try {
  await prisma.$transaction(async (tx) => {
    // ... existing transaction body unchanged ...
  });
} catch (error) {
  const maybe = error as { code?: string };
  if (maybe.code === "P2002") {
    return NextResponse.json(
      {
        message:
          "Another admin save changed this case while you were editing. Please reload and try again.",
      },
      { status: 409 }
    );
  }
  throw error;
}

return NextResponse.json({ ok: true }, { status: 200 });
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — `tests/api/admin-slug-history.test.ts` and `tests/api/admin-section-patches.test.ts` cover happy paths but not the P2002 race. Existing tests must still pass; the new branch is uncovered (acceptable — same as Batch 2's P2002 catch on case create).

**Commit subject:** `fix(admin): catch P2002 on slug update to return 409 instead of 500`

---

## 4. Final verification gate

After all seven commits are on tree:

```
git log --oneline -7                # confirm seven commits in the order above
git status                          # working tree clean
npx tsc --noEmit                    # exit clean
npx vitest run                      # 161 tests passing (or 162+ if you added a test)
npm run build                       # clean (only the documented middleware → proxy notice)
git diff main~7 main --stat         # confirm only authorized files touched
```

Expected files touched (and only these):

```
app/api/admin/cases/[caseId]/access-codes/route.ts
app/api/admin/cases/[caseId]/overview/route.ts
app/api/admin/cases/[caseId]/route.ts
app/api/register/route.ts
app/api/waitlist/route.ts
app/api/webhooks/stripe/route.ts
app/bureau/database/page.tsx
audits/BATCH_4_OBSERVATIONS.md     (new, this batch)
audits/BATCH_4_REPORT.md           (new, this batch)
lib/validators.ts
[possibly: components/bureau/GlobalPeopleSearch.tsx if Fix 1's sweep finds a sibling page; if so, add to the BATCH_4_REPORT.md]
[possibly: tests/api/register.test.ts if Fix 5's verification finds a 409-asserting test]
[possibly: tests/api/stripe.test.ts if Fix 6's verification finds livemode mismatches in test mocks]
```

If any other file is in the diff, you scope-crept. Restore it (`git restore <file>`) before declaring done.

---

## 5. Required output

Write `audits/BATCH_4_REPORT.md` matching the structure of `audits/BATCH_3_REPORT.md`. Include: per-commit hash, subject, file diff, tsc/vitest results, mental-trace verification, anomalies. Pre-flight tree state at top.

Write `audits/BATCH_4_OBSERVATIONS.md` with: any leads found during the Fix 1 RSC-pattern sweep that weren't fixed in this batch, anything you noticed in passing that belongs in Batch 5/6, the operator-action items (Stripe Dashboard subscription change for Fix 3, lawyer review reminder for Privacy Policy update is not required by this batch).

Then stop. Do not push. Do not run migrations. Do not start Batch 5.

---

## 6. Begin

Read the two audit dossiers under `audits/`. Read the prior batch reports for house style. Then start with Fix 1's pre-flight, sweep, and edit. Commit. Verify. Move to Fix 2. Continue through Fix 7. Write the two report files. Done.
