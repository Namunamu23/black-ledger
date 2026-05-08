# BATCH 9 — FIX PROMPT (partial-refund handling + email throttle + Terms rewrite + oneTimePerUser cleanup)

You are a fresh Claude Code session running on Opus 4.7. Apply the seven fixes below, surgically, one commit per fix, in order, plus a final report commit. No scope creep. **One additive schema migration.** No new dependencies.

This batch closes four findings from `audits/2026-05-06-godmode-audit.md` that Batch 8 explicitly deferred because they require a migration or a product/prose change: F-02 (partial refunds revoking full entitlement, P1), F-13 (per-recipient activation-email throttle, P2), F-14 (`oneTimePerUser` column is a no-op — stop writing it; column drop deferred to a follow-up batch), F-05 (Terms §7 rewrite to specify the manual refund-via-support flow). All four product decisions were locked in chat 2026-05-06; the operator chose recommendation B for partial refunds (preserve entitlement on partial; soft-revoke on full via `UserCase.revokedAt`, never delete progress).

The 2026-05-06 audit dossier was independently verified after it was filed: 52/52 findings real, zero hallucinations. The fix locations cited below are taken from the audit and re-confirmed against HEAD before this prompt was written.

Read this entire prompt first. Then read `audits/2026-05-06-godmode-audit.md` Phase 2 (the forensic findings — focus on F-02, F-13, F-14, F-05), `audits/BATCH_8_REPORT.md` for the post-Batch-8 baseline, and `audits/BATCH_8_OBSERVATIONS.md` for the deferred items now landing here. Then begin.

---

## 1. Operator deploy ordering (READ THIS FIRST — this batch contains a migration)

This batch contains **one additive schema migration** that adds `OrderStatus.PARTIALLY_REFUNDED` (new enum value) and `UserCase.revokedAt: DateTime?` (new nullable column). Both changes are **backwards-compatible with the old code** — old code does not produce the new enum value and does not write the new column, so old code continues to work fine after the migration runs.

**Production deploy sequence (the operator does this AFTER Claude Code finishes the batch and reports success):**

1. **Apply the migration to production Neon FIRST:**
   ```
   npx prisma migrate deploy
   ```
   (Reads `DIRECT_URL` from `.env.local`. Applies any pending migrations to production. The migration generated in Fix 1 is the only one pending.)

2. **THEN push the code:**
   ```
   git push
   ```
   Vercel auto-deploys; new code finds the new schema already in place.

3. **Verify in production** per the BATCH_9 verification checklist (in the report Claude Code will write).

**Why this order matters.** The new `charge.refunded` handler writes to `UserCase.revokedAt`. If the new code deploys before the column exists, every full-refund webhook fails with `column "revokedAt" of relation "UserCase" does not exist`. Stripe retries with backoff; eventually one delivery lands after the migration applies and succeeds — but the window of failure is operationally ugly. Migration first is cleaner.

**If you reverse the order by mistake.** New code is live but Neon doesn't have the new column. Run `npx prisma migrate deploy` immediately. Failed Stripe webhook deliveries auto-retry; once the column exists, the next retry succeeds. No data loss. Just a brief window of webhook failures in the Vercel logs.

**Within Claude Code itself (in this batch):** Fix 1 runs `npx prisma migrate dev --name add_partially_refunded_and_user_case_revoked_at` which generates the migration SQL AND applies it to whatever `DATABASE_URL` points to in `.env.local`. If `DATABASE_URL` is your dev branch on Neon, the migration is applied there. If it's a separate dev DB, applied there. Either way the migration file is committed and the operator's `migrate deploy` step ensures production Neon is in sync.

---

## 2. Operating principles (read twice)

1. **One commit per fix.** Subjects pre-written below — use verbatim.
2. **One migration in this batch.** The migration is **additive only**. Do NOT drop the `AccessCode.oneTimePerUser` column in this batch — that's a destructive change, deferred to a follow-up batch (call it Batch 9b) so the column-drop migration ships clean and isolated. Fix 5 stops *writing* to the column; the column itself stays in schema.prisma untouched.
3. **No new dependencies.** No `npm install`, no `npm audit fix`. Use only what's already in `package.json`.
4. **No scope creep.** Capture out-of-scope discoveries in `audits/BATCH_9_OBSERVATIONS.md`. F-04 (Privacy §6 lawyer brief) is operator action, not code — do not edit `app/privacy/page.tsx` in this batch.
5. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` passing at the same count or higher. If either fails, stop and report.
6. **No env changes, no pushes, no deploys.** The operator runs `prisma migrate deploy` and `git push` after the batch is complete and verified.
7. **Ground truth = source code at HEAD.** This prompt cites locations against the post-Batch-8 state. Re-confirm against the actual file before each edit; if line numbers drift after any intervening commits, find the right location by content not by line number.

---

## 3. Pre-flight

```
git rev-parse HEAD                  # should be at or after Batch 8's last commit (cbbadba)
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 23 files / 177 tests
```

If any fail, stop. Confirm `audits/2026-05-06-godmode-audit.md`, `audits/BATCH_8_REPORT.md`, and `audits/BATCH_8_OBSERVATIONS.md` are on tree.

---

## 4. The seven fixes

### Fix 1 — `feat(schema): add OrderStatus.PARTIALLY_REFUNDED + UserCase.revokedAt`

**Severity:** Schema enabler for F-02 (P1) — no logic in this commit, just the migration.

**Files:**
- `prisma/schema.prisma` (edit)
- `prisma/migrations/<timestamp>_add_partially_refunded_and_user_case_revoked_at/migration.sql` (generated)
- `generated/prisma/**` (auto-regenerated by `prisma generate`; commit if it changes)

**Schema edits.**

In the `OrderStatus` enum (around line 53-58 of `prisma/schema.prisma`), add `PARTIALLY_REFUNDED`:

```prisma
enum OrderStatus {
  PENDING
  COMPLETE
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}
```

In the `UserCase` model (around line 162-178), add `revokedAt`:

```prisma
model UserCase {
  id            Int       @id @default(autoincrement())
  userId        Int
  caseFileId    Int
  currentStage  Int       @default(1)
  status        UserCaseStatus @default(ACTIVE)
  activatedAt   DateTime  @default(now())
  firstOpenedAt DateTime?
  lastViewedAt  DateTime?
  completedAt   DateTime?
  revokedAt     DateTime?

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  caseFile CaseFile @relation(fields: [caseFileId], references: [id], onDelete: Cascade)
  events   UserCaseEvent[]

  @@unique([userId, caseFileId])
}
```

The position of `revokedAt` (after `completedAt`) mirrors the ordering pattern on `ActivationCode` for consistency.

**Generate the migration.**

```
npx prisma migrate dev --name add_partially_refunded_and_user_case_revoked_at
```

This will:
1. Detect the schema diff (one ADD VALUE on the enum + one ADD COLUMN).
2. Generate the SQL file under `prisma/migrations/<timestamp>_add_partially_refunded_and_user_case_revoked_at/migration.sql`.
3. Apply the migration to whatever `DATABASE_URL` points to (your dev DB).
4. Run `prisma generate` to update the generated client.

**Inspect the generated SQL.** It should look approximately like:

```sql
-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "UserCase" ADD COLUMN "revokedAt" TIMESTAMP(3);
```

`ALTER TYPE ADD VALUE` cannot run inside a transaction in Postgres < 12, but Neon runs Postgres 17 so this is fine. The Prisma migration runner will emit each statement separately if needed.

**Verification:**
- `npx tsc --noEmit` — passes only after `prisma generate` updates the client. Prisma now knows about `OrderStatus.PARTIALLY_REFUNDED` and `UserCase.revokedAt`.
- `npx vitest run` — 177 still passing (no logic changes yet, just schema-level additions; existing code doesn't reference the new fields).
- The migration SQL on disk uses `ADD VALUE` for the enum (additive, safe) and `ADD COLUMN ... TIMESTAMP(3)` (no NOT NULL constraint, no default required).

**Commit subject:** `feat(schema): add OrderStatus.PARTIALLY_REFUNDED + UserCase.revokedAt`

---

### Fix 2 — `fix(webhook): partial refunds preserve entitlement; full refunds soft-revoke UserCase`

**Severity:** P1. F-02 from the 2026-05-06 audit. The current `handleChargeRefunded` at `app/api/webhooks/stripe/route.ts:371-435` flips Order to `REFUNDED` and `deleteMany` UserCase on **any** refund event — partial or full. A $1 goodwill partial refund on a $30 case currently nukes the customer's entitlement. The operator chose recommendation B (2026-05-06): partial refunds flag the Order as `PARTIALLY_REFUNDED` and leave entitlement alone; only full refunds (`amount_refunded === amount`) soft-revoke the UserCase via `revokedAt` (preserve TheorySubmission/CheckpointAttempt history; never `deleteMany`).

**File:** `app/api/webhooks/stripe/route.ts:371-435` only. Replace the entire `handleChargeRefunded` function.

**Current state** (verified at HEAD):

```ts
async function handleChargeRefunded(charge: Stripe.Charge) {
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

**Replacement:**

```ts
async function handleChargeRefunded(charge: Stripe.Charge) {
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

  // Branch on full vs partial refund (F-02, 2026-05-06 audit, recommendation B).
  // Stripe fires charge.refunded for ANY refund — partial or full. A partial
  // refund (e.g. $5 goodwill credit on a $30 charge) should NOT revoke
  // entitlement; only flag the Order so operators can see "this customer
  // received a partial credit" in the support inbox.
  const isFullRefund = charge.amount_refunded === charge.amount;

  if (!isFullRefund) {
    // Partial refund — flag the Order, preserve entitlement and progress.
    // Idempotent via the status precondition: a re-delivered partial-refund
    // event finds status PARTIALLY_REFUNDED already and is a no-op (the
    // updateMany below matches zero rows on retry).
    const result = await prisma.order.updateMany({
      where: { id: order.id, status: { in: [OrderStatus.COMPLETE] } },
      data: { status: OrderStatus.PARTIALLY_REFUNDED },
    });
    console.log(
      `[REFUND] Order #${order.id} partial refund ` +
        `(${charge.amount_refunded}/${charge.amount}); ` +
        `entitlement preserved; status updated rows=${result.count}.`
    );
    return;
  }

  // Full refund — soft-revoke entitlement.
  //   1. Mark Order REFUNDED (idempotent via status precondition).
  //   2. Revoke ActivationCode (idempotent via revokedAt precondition).
  //   3. Soft-revoke UserCase via revokedAt (preserves TheorySubmission +
  //      CheckpointAttempt history for the customer's read-only view per
  //      the workspace banner; idempotent via revokedAt precondition).
  // We deliberately do NOT deleteMany — the prior implementation destroyed
  // progress alongside revoking access, which made support conversations
  // ("where did my case go?") harder than necessary.
  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { id: order.id, status: { in: [OrderStatus.COMPLETE, OrderStatus.PARTIALLY_REFUNDED] } },
      data: { status: OrderStatus.REFUNDED },
    });

    if (order.activationCode) {
      await tx.activationCode.updateMany({
        where: { id: order.activationCode.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (order.activationCode.claimedByUserId !== null) {
        await tx.userCase.updateMany({
          where: {
            userId: order.activationCode.claimedByUserId,
            caseFileId: order.caseFileId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }
    }
  });

  console.log(
    `[REFUND] Order #${order.id} full refund; ` +
      `code revoked=${order.activationCode ? "yes" : "no"}; ` +
      `userCase soft-revoked=${order.activationCode?.claimedByUserId ? "yes" : "no"}`
  );
}
```

Three semantic changes from the prior version:
1. **Partial-refund branch** added at the top.
2. **`updateMany` with preconditions** replaces unconditional `update` for full-refund path. Prevents clobbering an earlier `revokedAt` on duplicate webhook delivery (Stripe retries can deliver the same event multiple times despite `ProcessedStripeEvent` idempotency at the higher layer).
3. **`userCase.updateMany({ data: { revokedAt } })`** replaces `userCase.deleteMany`. Preserves progress.

**Verification:**
- `npx tsc --noEmit` clean.
- **Add 4 new tests** at `tests/api/stripe.test.ts` under a new `describe("charge.refunded handler (F-02)")` block:
  1. **Full refund** — `charge.amount_refunded === charge.amount` → Order → REFUNDED, ActivationCode → revoked, UserCase → revokedAt set, `prisma.userCase.deleteMany` is NOT called.
  2. **Partial refund** — `charge.amount_refunded < charge.amount` → Order → PARTIALLY_REFUNDED, ActivationCode unchanged, UserCase unchanged.
  3. **Idempotent full refund** — second delivery of the same charge.refunded event → updateMany matches zero rows everywhere (status already REFUNDED, revokedAt already set), no errors, no double-revoke.
  4. **Partial then full** — first event partial → PARTIALLY_REFUNDED. Second event full → status flips to REFUNDED, code revoked, UserCase revoked.
- 177 → 181 (4 new tests).

**Commit subject:** `fix(webhook): partial refunds preserve entitlement; full refunds soft-revoke UserCase`

---

### Fix 3 — `feat(bureau): banner + read-only mode for revoked UserCase`

**Severity:** P1 follow-on to Fix 2. Now that `UserCase.revokedAt` is populated for refunded customers, the workspace must (a) show a clear banner explaining the refund and (b) prevent further submissions from going through. Without this, a refunded customer might still see their case workspace and try to submit theories or advance checkpoints — confusing UX and potentially confusing analytics.

**Files:**
- `app/bureau/cases/[slug]/page.tsx` — render banner if `ownedCase.revokedAt` is set
- `app/api/cases/[slug]/theory/route.ts` — return 410 if revoked
- `app/api/cases/[slug]/checkpoint/route.ts` — return 410 if revoked

**Workspace banner.** The page already destructures `ownedCase` at line ~166 (`const { caseFile, currentStage, status } = ownedCase;`). Extend that destructure to include `revokedAt`, then render the banner near the top of the main return body (after the case-header card, before the rest of the workspace content).

Banner placement: insert immediately after the closing `</Card>` of the case header (around the first major closing tag in the return). Use the existing UI primitives.

```tsx
{ownedCase.revokedAt ? (
  <Card variant="dossier" padding="lg" className="mt-6 border-amber-700/60 bg-amber-950/20">
    <div className="flex flex-col gap-2 text-amber-100">
      <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300">
        Case Refunded
      </span>
      <h2 className="text-lg font-semibold text-white">
        This case has been refunded.
      </h2>
      <p className="text-sm leading-6 text-amber-200/80">
        Your progress is preserved here for your records, but the case is no
        longer playable. New theories and checkpoint answers cannot be
        submitted. If you believe this was a mistake, contact{" "}
        <a
          href="mailto:support@theblackledger.app"
          className="text-amber-300 underline hover:text-amber-200"
        >
          support@theblackledger.app
        </a>
        .
      </p>
    </div>
  </Card>
) : null}
```

The submission forms at the bottom of the page (TheorySubmissionForm, CheckpointForm) should also conditionally render — pass `disabled={Boolean(ownedCase.revokedAt)}` or wrap in `{!ownedCase.revokedAt && (...)}`. The simpler path is the wrap; the API gates below catch any client that bypasses the UI conditional.

**API gates.** In both `app/api/cases/[slug]/theory/route.ts` and `app/api/cases/[slug]/checkpoint/route.ts`, add an early-return after the ownership check (where `ownedCase`/`userCase` is confirmed to exist) and before any logic that depends on stage/status. The check shape:

```ts
if (ownedCase.revokedAt !== null) {
  return NextResponse.json(
    { message: "This case has been refunded and is no longer playable." },
    { status: 410 }
  );
}
```

Status 410 (Gone) is the right code: the resource existed, the client previously had access, and the access has been intentionally and permanently removed. Same shape as the activation route's revoked-code 410.

**In theory route** (`app/api/cases/[slug]/theory/route.ts:46-75`), insert the new check between the ownership check (line 56-61, "You do not own this case.") and the maxStage gate (line 63-68):

```ts
if (!ownedCase) {
  return NextResponse.json(
    { message: "You do not own this case." },
    { status: 403 }
  );
}

// F-02 (2026-05-06 audit): refunded UserCase is read-only.
if (ownedCase.revokedAt !== null) {
  return NextResponse.json(
    { message: "This case has been refunded and is no longer playable." },
    { status: 410 }
  );
}

if (ownedCase.currentStage < ownedCase.caseFile.maxStage) {
  ...
```

**In checkpoint route** (`app/api/cases/[slug]/checkpoint/route.ts:109-121`), insert between the ownership check (line 109-114) and the maxStage check (line 116-121):

```ts
if (!userCase) {
  return NextResponse.json(
    { message: "You do not own this case." },
    { status: 403 }
  );
}

// F-02 (2026-05-06 audit): refunded UserCase is read-only.
if (userCase.revokedAt !== null) {
  return NextResponse.json(
    { message: "This case has been refunded and is no longer playable." },
    { status: 410 }
  );
}

if (userCase.currentStage >= userCase.caseFile.maxStage) {
  ...
```

**Verification:**
- `npx tsc --noEmit` clean — Prisma's UserCase type now includes `revokedAt`; the conditional reads compile.
- **Add 2 new tests:**
  1. `tests/api/theory.test.ts` — UserCase with `revokedAt: new Date()` → POST returns 410 "This case has been refunded..."
  2. `tests/api/checkpoint.test.ts` — same shape — UserCase with `revokedAt: new Date()` → POST returns 410.
- 181 → 183 (2 new tests).
- Manual smoke: in dev, set `UPDATE "UserCase" SET "revokedAt" = NOW() WHERE id = <some-id>` directly via Prisma Studio or psql, navigate to `/bureau/cases/<slug>`, confirm banner renders + submission forms disabled (or absent).

**Commit subject:** `feat(bureau): banner + read-only mode for revoked UserCase`

---

### Fix 4 — `fix(webhook): per-recipient activation-email throttle (3/hour)`

**Severity:** P2. F-13 from the 2026-05-06 audit. Today an attacker controlling stolen Stripe tokens can mint many paid checkouts targeting the same victim email — each one fires a Resend email from `no-reply@theblackledger.app`. Three risks: (a) Resend account reputation suffers if recipients mark them as spam, (b) Resend may suspend the account for high bounce/complaint rate, (c) the victim experiences inbox harassment funded by the attacker. Operator decided 2026-05-06: ship the interim throttle (3 emails per normalized email per hour). The architectural fix (account-before-checkout, token-link delivery) is a separate backlog ticket.

**File:** `app/api/webhooks/stripe/route.ts` only. The send block lives inside `handleCheckoutCompleted` around lines 270-330 (after the `$transaction` closes and after `if (!updatedOrder.activationCode) return;`).

**Insert the throttle check** immediately before the `try { await getResend().emails.send(...) }` block. It runs AFTER the activation code is minted in the transaction (so the customer always gets a code; only the email send is gated) and BEFORE the actual Resend call.

```ts
// Per-recipient throttle: at most 3 activation emails per hour to the same
// normalized email. F-13 (2026-05-06 audit). The activation code is already
// minted; if the email is throttled, the customer can recover it via support
// (operator can manually resend via /api/admin/support/[id]/reply). Defends
// against paid-spam-relay attacks where an attacker mints many paid checkouts
// to a victim's email.
const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);
const recentSendsToBuyer = await prisma.order.count({
  where: {
    email: buyerEmail.trim().toLowerCase(),
    status: OrderStatus.COMPLETE,
    emailSentAt: { gt: ONE_HOUR_AGO },
  },
});

if (recentSendsToBuyer >= 3) {
  await prisma.order.update({
    where: { id: updatedOrder.id },
    data: {
      emailLastError: `Throttled: ${recentSendsToBuyer} activation emails to this address in last 1h`,
    },
  });
  console.warn(
    `[EMAIL-THROTTLE] Skipped activation email for ${buyerEmail}; ` +
      `${recentSendsToBuyer} sends in last 1h. Order #${updatedOrder.id} has the activation code; ` +
      `customer must contact support to receive it.`
  );
  return;
}

try {
  await getResend().emails.send({
    ...
```

**Notes on the count query.** We count Orders where `status === COMPLETE` AND `emailSentAt` is non-null AND within the last hour. We use `emailSentAt` rather than `createdAt` because `emailSentAt` is set only on successful Resend delivery — that's the count we want (emails actually sent), not orders created. A throttled order will not have `emailSentAt` set, so it won't count toward future throttle checks (which is the right behavior — a throttled email shouldn't gate further legitimate sends).

**Verification:**
- `npx tsc --noEmit` clean.
- **Add 1 new test** at `tests/api/stripe.test.ts`:
  - Setup: stub `prisma.order.count` to return `3` for the throttle query.
  - Action: simulate `checkout.session.completed` for the same email.
  - Assert: `getResend().emails.send` is NOT called; `prisma.order.update` is called with `emailLastError: "Throttled: ..."`.
- 183 → 184 (1 new test).
- Mental trace: legitimate buyer makes their first purchase → `recentSendsToBuyer === 0` → email sent. Same buyer makes a 4th purchase within an hour → `recentSendsToBuyer === 3` → throttled, code minted but email skipped, `emailLastError` recorded. Operator sees the throttled order in the support inbox UI (the existing `emailLastError` rendering) and can manually resend.

**Commit subject:** `fix(webhook): per-recipient activation-email throttle (3/hour)`

---

### Fix 5 — `chore(access-codes): stop writing AccessCode.oneTimePerUser; column drop deferred`

**Severity:** P2 (cleanup of F-14 from the 2026-05-06 audit). The `AccessCode.oneTimePerUser` Boolean is functionally a no-op because `AccessCodeRedemption` declares `@@unique([accessCodeId, userId])` unconditionally. Operator decided 2026-05-06 to drop the column. This commit removes all *code* references; the column itself stays in `prisma/schema.prisma` for now and gets dropped in a follow-up batch (Batch 9b) so the destructive migration ships clean and isolated.

**Why split the work.** Dropping the column today would mean the same migration that adds `OrderStatus.PARTIALLY_REFUNDED` and `UserCase.revokedAt` ALSO drops `oneTimePerUser`. Mixing additive + destructive changes in one migration complicates rollback and deploy ordering. Cleaner to ship the additive migration alone (Batch 9), verify in prod, then ship the column drop alone (Batch 9b — operator-run, single-step).

**Files:**
- `lib/validators.ts` — drop the field from `createAccessCodeSchema`
- `app/api/admin/cases/[caseId]/access-codes/route.ts` — drop from create + GET serialization
- `app/bureau/admin/cases/[caseId]/access-codes/page.tsx` — drop from initial-codes serialization
- `app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodesPanel.tsx` — drop from `AccessCodeWithCount` type
- `app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx` — drop the form state, the checkbox UI, and the body field
- `app/api/access-codes/redeem/route.ts` — drop the `if (accessCode.oneTimePerUser) { ... }` conditional (the unique constraint + P2002 catch already handle re-redemption; the conditional is a no-op)
- `tests/api/access-codes-redeem.test.ts` — drop any tests that exercise `oneTimePerUser` branching

**`lib/validators.ts:275-284`** — current:

```ts
export const createAccessCodeSchema = z.object({
  code: z.string().trim().min(1).max(64),
  kind: z.enum(["BUREAU_REF", "ARTIFACT_QR", "WITNESS_TIP", "AUDIO_FILE"]),
  unlocksTarget: z.object({
    type: z.enum(["record", "person", "hint", "hidden_evidence"]),
    id: z.number().int().positive(),
  }),
  requiresStage: z.number().int().min(0).nullable().optional(),
  oneTimePerUser: z.boolean().optional(),
});
```

Drop the last field:

```ts
export const createAccessCodeSchema = z.object({
  code: z.string().trim().min(1).max(64),
  kind: z.enum(["BUREAU_REF", "ARTIFACT_QR", "WITNESS_TIP", "AUDIO_FILE"]),
  unlocksTarget: z.object({
    type: z.enum(["record", "person", "hint", "hidden_evidence"]),
    id: z.number().int().positive(),
  }),
  requiresStage: z.number().int().min(0).nullable().optional(),
});
```

**`app/api/admin/cases/[caseId]/access-codes/route.ts`** — current create call (around line 110-119):

```ts
const created = await prisma.accessCode.create({
  data: {
    code: parsed.data.code,
    kind: parsed.data.kind,
    caseFileId: parsedCaseId,
    unlocksTarget: parsed.data.unlocksTarget,
    requiresStage: parsed.data.requiresStage ?? null,
    oneTimePerUser: parsed.data.oneTimePerUser ?? false,
  },
});
```

Drop the `oneTimePerUser` line. Prisma will use the schema default (`false`) automatically:

```ts
const created = await prisma.accessCode.create({
  data: {
    code: parsed.data.code,
    kind: parsed.data.kind,
    caseFileId: parsedCaseId,
    unlocksTarget: parsed.data.unlocksTarget,
    requiresStage: parsed.data.requiresStage ?? null,
  },
});
```

In the GET handler at the same file (around line 22-26), the `findMany` includes the full row by default — `oneTimePerUser` is in the response. Leave it; it doesn't cost anything to keep returning it, and the panel type is dropping the field next so callers don't read it. (Alternative: add a `select` projection to drop it explicitly — slightly cleaner but adds a churn cost. Skip.)

**`app/bureau/admin/cases/[caseId]/access-codes/page.tsx`** — the initial-codes serialization (around line 50-60) currently includes `oneTimePerUser`:

```ts
const initialCodes: AccessCodeWithCount[] = codes.map((c) => ({
  id: c.id,
  code: c.code,
  kind: c.kind,
  unlocksTarget: c.unlocksTarget,
  requiresStage: c.requiresStage,
  oneTimePerUser: c.oneTimePerUser,
  retiredAt: c.retiredAt ? c.retiredAt.toISOString() : null,
  createdAt: c.createdAt.toISOString(),
  redemptions: c.redemptions,
}));
```

Drop the `oneTimePerUser` line:

```ts
const initialCodes: AccessCodeWithCount[] = codes.map((c) => ({
  id: c.id,
  code: c.code,
  kind: c.kind,
  unlocksTarget: c.unlocksTarget,
  requiresStage: c.requiresStage,
  retiredAt: c.retiredAt ? c.retiredAt.toISOString() : null,
  createdAt: c.createdAt.toISOString(),
  redemptions: c.redemptions,
}));
```

**`AccessCodesPanel.tsx`** — drop `oneTimePerUser` from the `AccessCodeWithCount` exported type (around line 7-17):

```ts
export type AccessCodeWithCount = {
  id: number;
  code: string;
  kind: string;
  unlocksTarget: unknown;
  requiresStage: number | null;
  retiredAt: string | null;
  createdAt: string;
  redemptions: { id: number }[];
};
```

If `AccessCodeList.tsx` reads `oneTimePerUser` (which it might — it's the panel's render component), grep and remove. Read `app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodeList.tsx` first to see if it references the field; if it does, drop the reference and any "One-time" badge or label that the field gates.

**`CreateAccessCodeForm.tsx`** — drop the form state, the checkbox JSX, and the body field. Specifically:

- Line ~38: drop `const [oneTimePerUser, setOneTimePerUser] = useState(true);`
- Line ~85-89: drop the `oneTimePerUser` field from the POST body in the fetch call.
- Lines ~219-227: drop the entire `<label className="flex items-end gap-3 ...">...<input type="checkbox" ... />One-time per user</label>` block, including its container `<div>` if it's only that field.

**`app/api/access-codes/redeem/route.ts`** — drop the `if (accessCode.oneTimePerUser) { ... }` block (lines 119-134):

Current:

```ts
if (accessCode.oneTimePerUser) {
  const existing = await prisma.accessCodeRedemption.findFirst({
    where: { accessCodeId: accessCode.id, userId },
  });
  if (existing) {
    const content = await resolveContent(accessCode.unlocksTarget);
    return NextResponse.json(
      {
        alreadyRedeemed: true,
        unlocksTarget: accessCode.unlocksTarget,
        content,
      },
      { status: 200 }
    );
  }
}
```

Drop the entire block. The next block (`try { await prisma.accessCodeRedemption.create(...) } catch (error) { ... if (maybe.code === "P2002") { ... } }`) handles re-redemption uniformly via the unique-constraint catch path — which is exactly what the `oneTimePerUser` block was duplicating. The existing P2002 catch returns the same `alreadyRedeemed: true` shape with the resolved content, so client behavior is unchanged.

**Tests at `tests/api/access-codes-redeem.test.ts`** — read the file first; drop any test that explicitly drives `oneTimePerUser=true` vs `oneTimePerUser=false` branching. The unique-constraint test (one attempting to redeem twice → expects `alreadyRedeemed: true`) stays.

**Verification:**
- `npx tsc --noEmit` clean — TypeScript catches any missed references.
- `npx vitest run` — count may drop slightly if a oneTimePerUser-specific test is removed. Acceptable. Confirm none of the removed tests covered behavior we still want.
- Mental trace: an admin creates a new AccessCode via the form. The form posts the body without `oneTimePerUser`. Validator accepts it. Route's create call doesn't pass `oneTimePerUser`; Prisma writes the schema default `false`. New row appears in the list with `oneTimePerUser=false` (invisible to the UI now). A user redeems the code; succeeds. The same user attempts to redeem again; P2002 catch returns `alreadyRedeemed: true`. Behavior is identical to before for the user; the admin no longer sees a meaningless toggle.

**Commit subject:** `chore(access-codes): stop writing AccessCode.oneTimePerUser; column drop deferred`

---

### Fix 6 — `docs(legal): rewrite Terms §7 to manual refund-via-support flow`

**Severity:** P1 product follow-through (F-05). Operator chose 2026-05-06 to keep the manual refund flow rather than build `/api/refund-request`. The current Terms §7 already says "email support@... with your purchase email and the order or session reference" but doesn't include the third required field (a brief reason) and doesn't call out the manual-processing nature explicitly. Tighten it.

**File:** `app/terms/page.tsx` only. Replace the section 7 block (around lines 185-230 today).

**Current state:**

```tsx
<section>
  <h2 className="mb-4 text-xl font-semibold text-white">
    7. Refund Policy
  </h2>
  <p className="mb-4">
    Because Black Ledger sells digital products, our refund
    policy is:
  </p>
  <ul className="list-disc space-y-2 pl-6">
    <li>
      You may request a full refund within{" "}
      <strong className="text-white">7 days</strong> of purchase{" "}
      <strong className="text-white">
        if you have not redeemed the activation code
      </strong>
      . Once an activation code is redeemed against an account,
      the case file is considered delivered and the sale is final.
    </li>
    <li>
      To request a refund, email{" "}
      <a
        href="mailto:support@theblackledger.app"
        className="text-amber-400 underline hover:text-amber-300"
      >
        support@theblackledger.app
      </a>{" "}
      with your purchase email and the order or session reference.
      We will verify the unredeemed status of the activation
      code and process the refund through Stripe to the original
      payment method.
    </li>
    <li>
      Outside of the 7-day window, or once the activation code
      has been redeemed, refunds are at our sole discretion and
      are typically not granted.
    </li>
    <li>
      If a transaction is determined to be fraudulent, we may
      refund and revoke the activation code at any time.
    </li>
  </ul>
  <p className="mt-4">
    Statutory consumer rights, where applicable, are not affected
    by this policy.
  </p>
</section>
```

**Replacement:**

```tsx
<section>
  <h2 className="mb-4 text-xl font-semibold text-white">
    7. Refund Policy
  </h2>
  <p className="mb-4">
    Because Black Ledger sells digital products (activation codes
    that unlock case files), our refund policy is as follows:
  </p>
  <ul className="list-disc space-y-2 pl-6">
    <li>
      You may request a full refund within{" "}
      <strong className="text-white">7 days</strong> of purchase{" "}
      <strong className="text-white">
        if you have not redeemed the activation code
      </strong>
      . Once an activation code is redeemed against an account,
      the case file is considered delivered and the sale is final.
    </li>
    <li>
      To request a refund within the 7-day window, email{" "}
      <a
        href="mailto:support@theblackledger.app"
        className="text-amber-400 underline hover:text-amber-300"
      >
        support@theblackledger.app
      </a>
      . Please include in your email:
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>the email address you used at checkout;</li>
        <li>
          your order number or activation code (the activation
          code was sent to you in the purchase confirmation email);
          and
        </li>
        <li>a brief reason for the refund request.</li>
      </ol>
    </li>
    <li>
      We process refund requests manually. We will verify the
      unredeemed status of the activation code, and if the
      request is within the 7-day window and the code is
      unredeemed, we will process the refund through Stripe to
      the original payment method. Once a refund has been
      processed, the activation code is automatically revoked
      and any associated bureau access is marked as refunded.
    </li>
    <li>
      Outside of the 7-day window, or once the activation code
      has been redeemed, refunds are at our sole discretion and
      are typically not granted.
    </li>
    <li>
      In the case of a partial refund (for example, a goodwill
      credit on a damaged physical kit component), bureau access
      to the case remains active. Only a full refund revokes
      access.
    </li>
    <li>
      If a transaction is determined to be fraudulent, we may
      refund and revoke the activation code at any time.
    </li>
  </ul>
  <p className="mt-4">
    Statutory consumer rights, where applicable, are not affected
    by this policy.
  </p>
</section>
```

Three substantive additions:
1. **Required information** is now a clear three-item nested list (email at checkout, order number or activation code, brief reason). Operator-friendly.
2. **Manual processing** language ("We process refund requests manually") sets correct expectations.
3. **Partial-refund clause** documents the new Fix 2 behavior — partial refunds preserve access; only full refunds revoke. Customers reading the Terms learn the actual policy that ships in this batch.

**Verification:**
- No TypeScript implications.
- `npx vitest run` — 184 unchanged.
- Manual smoke: navigate to `/terms` in dev, scroll to section 7, verify formatting renders cleanly (numbered list inside the bulleted list).

**Commit subject:** `docs(legal): rewrite Terms §7 to manual refund-via-support flow`

---

### Fix 7 — `docs(audit): batch 9 report + observations`

**Severity:** Administrative. Mirror the `BATCH_8_REPORT.md` and `BATCH_8_OBSERVATIONS.md` structure.

**Files:**
- `audits/BATCH_9_REPORT.md` (new)
- `audits/BATCH_9_OBSERVATIONS.md` (new)

**Required content for `BATCH_9_REPORT.md`:**
- Pre-flight tree state (HEAD SHA, working tree clean, tsc + vitest counts).
- Per-commit table (hash, subject).
- Per-fix detail block (applied yes/no/partial, files touched, diff stats, tsc + vitest deltas, mental trace, anomalies).
- Final verification gate: `git log --oneline -7`, `git status`, `npx tsc --noEmit`, `npx vitest run` (177 → 184 expected: +4 from Fix 2 charge.refunded, +2 from Fix 3 revoked-UserCase gates, +1 from Fix 4 throttle, plus any test removals from Fix 5), `npm run build` clean, `git diff <base> main --stat` showing only authorized files.

**Required content for `BATCH_9_OBSERVATIONS.md`:**
1. **Operator deploy ordering reminder** — explicit "run `npx prisma migrate deploy` BEFORE `git push`" callout. The migration must apply to production Neon before the new code lands. Skip-the-step recovery: run `prisma migrate deploy` ASAP after push; failed Stripe webhooks auto-retry.
2. **Batch 9b scope** — single-commit follow-up batch to drop `AccessCode.oneTimePerUser`. Migration only (no code changes since Fix 5 already removed all code references). Operator-run after Batch 9 is verified in prod.
3. **F-04 Privacy §6 lawyer brief still pending** — operator action, not code. Stripe Payments Europe Ltd disclosure for EU buyers + Cloudflare R2 region/jurisdiction disclosure.
4. **Carry-forward items** unchanged from Batch 8: Sentry/structured logging, CSP nonce migration, `app/layout.tsx` `auth()` on every render, forgot-password timing leak, R2 ContentLength alternative paths, error.tsx absence in route groups, etc.

**Commit subject:** `docs(audit): batch 9 report + observations`

Then stop. Do not push. Do not start Batch 9b.

---

## 5. Final verification gate

After all seven commits are on tree:

```
git log --oneline -7                # confirm 7 commits in order
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 184 tests passing (177 baseline + 7 new — adjust if Fix 5 removed any)
npm run build                       # clean
git diff <pre-batch-SHA> main --stat
```

Expected files touched:

```
prisma/schema.prisma                                                        (Fix 1)
prisma/migrations/<timestamp>_add_partially_refunded_and_user_case_revoked_at/migration.sql  (Fix 1, new)
generated/prisma/**                                                         (Fix 1, regenerated)
app/api/webhooks/stripe/route.ts                                            (Fix 2 + Fix 4)
tests/api/stripe.test.ts                                                    (Fix 2 + Fix 4)
app/bureau/cases/[slug]/page.tsx                                            (Fix 3)
app/api/cases/[slug]/theory/route.ts                                        (Fix 3)
app/api/cases/[slug]/checkpoint/route.ts                                    (Fix 3)
tests/api/theory.test.ts                                                    (Fix 3)
tests/api/checkpoint.test.ts                                                (Fix 3)
lib/validators.ts                                                           (Fix 5)
app/api/admin/cases/[caseId]/access-codes/route.ts                          (Fix 5)
app/bureau/admin/cases/[caseId]/access-codes/page.tsx                       (Fix 5)
app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodesPanel.tsx (Fix 5)
app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx (Fix 5)
app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodeList.tsx (Fix 5, only if it referenced oneTimePerUser)
app/api/access-codes/redeem/route.ts                                        (Fix 5)
tests/api/access-codes-redeem.test.ts                                       (Fix 5)
app/terms/page.tsx                                                          (Fix 6)
audits/BATCH_9_REPORT.md                                                    (Fix 7, new)
audits/BATCH_9_OBSERVATIONS.md                                              (Fix 7, new)
```

If any other file is in the diff, restore it before declaring done.

---

## 6. Begin

Read `audits/2026-05-06-godmode-audit.md` Phase 2 (focus on F-02, F-13, F-14, F-05). Read `audits/BATCH_8_REPORT.md` for house style and the just-shipped baseline. Read `audits/BATCH_8_OBSERVATIONS.md` (the observations cover what was deferred and why).

Then start with Fix 1's schema edit + `prisma migrate dev`. Commit (the schema, the generated migration SQL, and any regenerated client). Verify `tsc` clean. Move to Fix 2's webhook handler rewrite + 4 new tests. Continue through Fix 6. Write the two report files in Fix 7.

When you finish, surface the operator-action callout prominently in your closing message: **"Run `npx prisma migrate deploy` against production Neon BEFORE `git push`."** That step is outside Claude Code's authority and the operator must do it manually.

Done.
