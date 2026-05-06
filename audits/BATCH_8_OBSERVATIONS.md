# BATCH 8 — OBSERVATIONS

Things noticed while applying Batch 8 that are out of scope for this
batch. Per the prompt, F-02 / F-13 / F-14 are explicitly deferred to
Batch 9; F-04 / F-05 are operator actions. Sentry / CSP nonce / layout
perf carried forward unchanged from Batch 7's observations. R2
ContentLength (Fix 6 first half) is documented in detail because it
required a contingent revert.

## 1. F-02 partial-refund handler (P1) deferred to Batch 9

The 2026-05-06 audit's F-02 finding: the existing `charge.refunded`
handler at `app/api/webhooks/stripe/route.ts:371-435` flips
`Order.status` to `REFUNDED` and revokes the activation code on ANY
refund event, even a $1-of-$30 partial refund. A buyer who's solved
the case can request a $1 partial refund and lose entitlement.

**Operator decision (2026-05-06):** Recommendation B was chosen —
partial refunds should flag the Order as `PARTIALLY_REFUNDED` (a new
`OrderStatus` enum value) but keep entitlement active. Only an event
where `charge.amount_refunded === charge.amount` revokes. Entitlement
revocation marks `UserCase` as inactive (preserves theory submissions
and progress) rather than `deleteMany`.

**Required scope (Batch 9):**
- Schema migration: add `OrderStatus.PARTIALLY_REFUNDED`. Either
  `UserCase.revokedAt: DateTime?` OR an explicit `inactive: Boolean
  @default(false)` flag — pick one. The schema migration is destructive
  in the rollback direction so deploy ordering matters (additive
  migration first, code that reads the new column second).
- Webhook branch: add the `if (charge.amount_refunded < charge.amount)
  → mark PARTIALLY_REFUNDED, do NOT revoke code, do NOT touch
  UserCase; else (full refund) → existing flow`.
- Tests: 4-5 new cases — full refund happy path (existing), partial
  refund preserves entitlement, full refund after partial revokes,
  refund of already-revoked is a no-op, refund delivery race against
  itself is idempotent.
- The `bureau/cases/[slug]` workspace page should respect the new
  inactive flag if chosen — gate behind a "this case has been
  refunded; contact support" notice rather than a 404.

Larger work, separate batch.

## 2. F-13 per-recipient activation-email throttle (P2) deferred to Batch 9

The 2026-05-06 audit's F-13 finding: the activation-code email send in
`app/api/webhooks/stripe/route.ts:285-321` fires at any rate that
Stripe webhooks can produce. An attacker controlling stolen Stripe
tokens (or simply a card-cycling abuse pattern) can mint many paid
checkouts targeting the same victim email — Resend dispatches each
one as a transactional email, polluting the victim's inbox and
risking Resend account reputation if recipients mark them as spam.

**Operator decision (2026-05-06):** Ship the interim throttle (3 emails
per hour to the same normalized email). Architectural fix
(account-before-checkout) is recorded as a backlog ticket in CLAUDE.md
with revisit triggers; today's interim throttle is the right cost-
benefit at current volume.

**Required scope (Batch 9):**
- In the email-send block, immediately before `getResend().emails.send`:
  ```ts
  const recentSends = await prisma.order.count({
    where: {
      email: buyerEmail.trim().toLowerCase(),
      createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
      status: OrderStatus.COMPLETE,
      emailSentAt: { not: null },
    },
  });
  if (recentSends >= 3) {
    await prisma.order.update({
      where: { id: updatedOrder.id },
      data: { emailLastError: "Throttled: 3+ emails in last hour" },
    });
    console.warn(`[EMAIL-THROTTLE] Skipped activation email for ${buyerEmail}; ${recentSends} sends in last 1h`);
    return;
  }
  ```
- 1 new test: stub 3 prior COMPLETE orders → assert send is skipped,
  emailLastError is recorded, and the activation code is still minted
  (the throttle blocks the EMAIL, not the entitlement).
- Operator-facing recovery: the "support inbox" already shows
  `Order.emailLastError`; throttled buyers contact support and the
  operator can manually re-send via the support reply endpoint.

## 3. F-14 oneTimePerUser column drop (P2) deferred to Batch 9

The 2026-05-06 audit's F-14 finding: the `AccessCode.oneTimePerUser`
boolean column is functionally a no-op because the schema already
declares `@@unique([accessCodeId, userId])` on `AccessCodeRedemption`
unconditionally. Setting `oneTimePerUser=false` does nothing — the
unique constraint enforces one-per-user regardless.

**Operator decision (2026-05-06):** Drop the column. The `@@unique`
constraint is the truth.

**Required scope (Batch 9):**
- Migration to DROP COLUMN `oneTimePerUser` from `AccessCode`. This is
  destructive in the rollback direction — deploy ordering matters.
  Order of operations: (1) ship code that doesn't reference the
  column; (2) ship the migration. Otherwise an in-flight server still
  trying to write the column would fail.
- Code references to remove:
  - `lib/validators.ts` — drop the `oneTimePerUser` field from
    AccessCode create/update schemas.
  - `app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx`
    — drop the `oneTimePerUser` checkbox + state + form-data field.
  - `app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodesPanel.tsx`
    type `AccessCodeWithCount` — drop the field.
  - `app/api/admin/cases/[caseId]/access-codes/route.ts` GET — drop
    the `oneTimePerUser` from the select / forwarded shape.
  - `app/api/access-codes/redeem/route.ts` — confirm no conditional
    branches on the field (today the redemption path relies on the
    `@@unique` constraint, so removing a no-op should be fine; verify
    by reading the route end-to-end).
  - Tests in `tests/api/access-codes-redeem.test.ts` — drop any
    `oneTimePerUser` references.
- Migration SQL: `ALTER TABLE "AccessCode" DROP COLUMN
  "oneTimePerUser";` — Postgres will fail this if any in-flight write
  references the column, which is why code change ships first.

## 4. F-04 Privacy Policy §6 factual error — operator action

Audit notes that Privacy Policy §6 (third-party processors) has two
factual issues:
- Stripe Payments Europe Ltd (the EU entity) handles cards from EU
  buyers, not just Stripe Inc. (the US entity). Disclosure should
  list both.
- Cloudflare R2 region/jurisdiction disclosure is vague — R2 storage
  region is configurable per bucket and the current Privacy Policy
  doesn't reflect what region we actually use.

**Action:** Brief the Georgian lawyer (already on the launch-blockers
list) specifically on these two points before re-shipping the §6
revision. Do NOT have Claude rewrite §6 in code without lawyer
input — the audit caught the mistake and a one-shot Claude rewrite
risks introducing different mistakes. Wait for legal review.

## 5. F-05 Terms §7 rewrite deferred to Batch 9 per operator instruction

Audit finding: Terms of Service §7 promises a "7-day refund window
if activation code not redeemed" but no customer-facing flow exists
yet. The `ActivationCode.claimedAt` timestamp is the right server-
side enforcement key, but the operator has decided to keep the manual
flow ("email support@..., we'll process it") rather than build a
self-serve `POST /api/refund-request`.

**Operator decision (2026-05-06):** Rewrite §7 to specify the manual
flow and the required information (purchase email + order number or
activation code + brief reason). The wording change ships in Batch 9
alongside the F-13 throttle; both are doc/email-flow changes that
benefit from being grouped.

**Note:** The CLAUDE.md backlog entry from Fix 11 records both the
manual-flow specifics and the conditions under which the architectural
self-serve refund flow should be revisited (50–100 monthly orders OR
support burden becoming a problem).

## 6. R2 Content-Length cap (Fix 6 first half) — SDK exact-match semantics

The audit's F-11 recommended adding `ContentLength: MAX_UPLOAD_BYTES`
to the `PutObjectCommand` in `app/api/admin/uploads/sign/route.ts`,
intending to cap admin uploads at 5 MB at the cryptographic-signature
layer (so a stolen presigned URL couldn't push a 5 GB file).

**Verification result:** The AWS SDK v3
`@aws-sdk/s3-request-presigner` (the package this route uses) signs
`ContentLength` as an exact-match constraint, not as a "≤ max" range.
The signed URL embeds `Content-Length` as a parameter; R2 returns
`403 SignatureDoesNotMatch` if the actual upload's `Content-Length`
header differs from the signed value, in either direction. Setting
`ContentLength: 5_000_000` would block a legitimate 480 KB hero image
upload exactly as completely as it would block a 5 GB attack upload.

**Decision:** Reverted the F-11 portion of Fix 6 before commit.
Only the F-12 Sharp pixel-limit half landed.

**Alternative paths for a future batch:**
- **Cloudflare R2 lifecycle rule** — set a max object size at the
  bucket level via the R2 dashboard (operator action, no code).
  Not enforceable cryptographically (the upload still completes;
  the lifecycle rule deletes oversized objects asynchronously) but
  enforceable on storage cost.
- **Switch to `S3.createPresignedPost`** — different SDK API
  (`@aws-sdk/s3-presigned-post`, not currently in package.json) that
  supports `Conditions: [["content-length-range", 0, MAX_BYTES]]` as
  a signed range constraint. Closes the cryptographic enforcement
  gap. Requires `npm install @aws-sdk/s3-presigned-post` (so a
  separate batch with explicit install permission), plus changes to
  `components/admin/ImageUploader.tsx` (POST instead of PUT,
  multipart form instead of raw body). Larger refactor.
- **Server-side proxy upload** — accept the upload at a Next API
  route, validate `Content-Length` in code, then forward to R2.
  Removes the presigned-PUT pattern entirely. Eats Vercel function
  bandwidth + execution time.

For now: the existing `components/admin/ImageUploader.tsx`
client-side 5 MB pre-check is the only enforcement. An admin (or a
session hijacker with admin cookies, since the URL is presigned for
15 min after issuance) can still PUT past this limit. The Sharp
pixel-cap half of Fix 6 contains the memory-blowup vector even when
the upload itself succeeds.

## 7. Carry-forward items still deferred (unchanged from Batch 7)

Re-confirmed during Batch 8's reading pass; not actioned in this batch:

- **Sentry / structured logging** — every `catch` block in
  `app/api/**` calls `console.error`. Vercel function logs are not
  searchable across requests, not aggregated, not alertable.
  Requires `npm install @sentry/nextjs` or similar; needs a separate
  batch with explicit install permission.
- **CSP nonce migration** — current CSP allows `'unsafe-inline'` and
  `'unsafe-eval'` in `script-src` for Framer Motion. Multi-week
  refactor of every motion call to pass nonces; defer until other
  launch-blockers close.
- **`app/layout.tsx` calling `auth()` on every render** — `auth()`
  fires the DB tokenVersion check on every page including marketing
  pages, which is invisible at indie traffic but becomes the
  bottleneck under any viral spike. Fix shape: lazy `Navbar` client
  component fetching `/api/me` projection on mount/hover, or
  marketing-route fast-path. Multi-day refactor with regression
  risk on the auth flow.
- **Forgot-password timing leak** — `app/api/forgot-password/route.ts`
  takes ~10ms on user-not-found vs ~200-400ms on user-exists (Resend
  round-trip). Same shape as the login leak Batch 7 closed. Clean
  fix is `next/server`'s `after()` to defer the Resend send past
  response, but the existing test asserts
  `expect(resendSendFn).toHaveBeenCalled()` synchronously — defer
  to a batch with explicit "tests may change" permission.
- **`/bureau/database` unbounded findMany** — pagination + search.
  UX-touching refactor; perf batch.
- **Pre-existing odd indentation in `app/api/admin/cases/route.ts`
  `data: {}` block** — cosmetic only.
- **`unarchive-case.ts` hard-codes `CASE_ID = 3`** — operator-only
  script, low priority.
- **`RevokeButton` still POSTs the now-ignored `revokedAt` field**
  — server stamps; cosmetic only.
- **`assertSafeEnv` only matches Neon hosts** — robust enough for
  current deployment, but if we ever switch hosts the check breaks
  silently.
- **`CaseAudit` not written for: workflow PATCH, batch-generate,
  revoke, AccessCode create** — audit-trail gap; defer to a
  CaseAudit-coverage batch.

## 8. Operational launch blockers (NOT engineering work, parallel track)

Carried forward unchanged from CLAUDE.md and prior observations — not
actionable from this codebase. Not affected by Batch 8:

- Resend DKIM/SPF/DMARC for `theblackledger.app` (DNS records in
  Namecheap; ~30-45 min in the Resend dashboard).
- Stripe Live activation wizard (business type, ID verification,
  bank, public details mirrored from sandbox; TOS+Privacy URLs need
  to be re-set in Live mode).
- Georgian lawyer review of `/privacy` and `/terms` (now also
  including the §6 factual corrections from F-04).
- Optional: register Individual Entrepreneur (IE) entity in Georgia
  for liability separation and the 1% small-business tax band.
- Stripe Dashboard webhook subscription change from
  `payment_intent.payment_failed` → `checkout.session.async_payment_failed`
  pending until Stripe Live activation (Batch 4 follow-up).
- Stripe Dashboard `charge.refunded` subscription is configured per
  Batch 5 — verified at time of writing.

## 9. Operational note: x-real-ip contract verification

Fix 2 depends on the Vercel platform contract that `x-real-ip` is
edge-set to the verified client IP and CANNOT be forged by clients.
The Vercel docs at https://vercel.com/docs/edge-network/headers
document this behavior. As of 2026 the contract holds. If Vercel
ever changes this — or if the project moves to a different host
without an equivalent edge-set header — Fix 2 needs revisit. Suggest
adding a one-line "verify x-real-ip is non-forgeable on $host"
checkpoint to any future hosting-migration runbook.

End of observations.
