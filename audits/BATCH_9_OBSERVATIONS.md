# BATCH 9 — OBSERVATIONS

Things noticed while applying Batch 9 that are out of scope for this
batch, plus operator-action items that survive past the fix series.
F-04 (Privacy §6 lawyer brief) carries forward unchanged. Sentry,
CSP nonce, layout perf carry forward unchanged from Batch 8's
observations.

## 1. Operator deploy ordering — migration first, code second

This batch contains the first schema migration since Batch 5. The
sequencing matters:

1. **Apply the migration to production Neon FIRST:**
   ```
   npx prisma migrate deploy
   ```
   (Reads `DIRECT_URL` from `.env.local`. The Batch 9 migration
   `20260507052527_add_partially_refunded_and_user_case_revoked_at`
   is the only one pending.)

2. **THEN push the code:**
   ```
   git push
   ```
   Vercel auto-deploys; new code finds the new schema already in
   place.

**Why this order matters.** Fix 2's new `charge.refunded` handler
writes to `UserCase.revokedAt` and reads/writes the
`OrderStatus.PARTIALLY_REFUNDED` enum value. If the new code deploys
before the schema is migrated, every full-refund webhook delivery
fails with `column "revokedAt" of relation "UserCase" does not
exist` — Stripe retries the delivery with backoff, so eventually one
attempt lands after the migration applies and succeeds. Data is not
lost, but the window of webhook failures shows up as `[REFUND]`
errors in the Vercel logs.

**Recovery if reversed by mistake.** New code is live but Neon
doesn't have the new column. Run `npx prisma migrate deploy`
immediately. Failed Stripe webhook deliveries auto-retry for ~3 days;
once the column exists, the next retry succeeds. Same outcome,
slightly noisier ops experience.

**Within Claude Code in this batch:** Fix 1 ran `npx prisma migrate
dev` which generated the migration SQL AND applied it to whatever
`DATABASE_URL` points to in `.env.local` (the dev branch on Neon for
this project). The committed migration file is the source of truth
for production; the `migrate deploy` step replays it against
production Neon.

## 2. Batch 9b scope — single-commit follow-up to drop AccessCode.oneTimePerUser

Fix 5 removed all CODE references to `AccessCode.oneTimePerUser` but
intentionally left the column in `prisma/schema.prisma` and the
production database. The destructive `DROP COLUMN` migration ships
in its own batch so it's clean and isolated.

**Required scope (Batch 9b):**
- One commit. Exactly one new migration:
  ```sql
  ALTER TABLE "AccessCode" DROP COLUMN "oneTimePerUser";
  ```
- Drop the field from `prisma/schema.prisma` model `AccessCode`.
- Update `scripts/test-full-flow.ts` — 4 references to remove:
  - line 1067: HTTP body field in the create-code POST (Zod already
    strips this, so removing it is purely cosmetic for the script).
  - line 1086: same field on the duplicate-code-409 POST.
  - line 1322 comment: remove the "oneTimePerUser pre-check" reference.
  - line 1329: `oneTimePerUser: false` in a direct
    `prisma.accessCode.create` call (this would BREAK if the column
    is dropped first — must be deleted in lockstep with the migration).
- No tests need to change (Batch 9 already removed the only fixture
  reference).
- Operator deploy ordering for Batch 9b: code first (which no longer
  references the column), THEN migration. The reverse order would
  leave in-flight server processes still attempting to write the
  column (Prisma doesn't update its schema cache mid-process), but
  since Fix 5 removed all writes, the column is effectively orphaned
  even before the migration runs — the order matters less than for
  Batch 9, but the standard "drop CODE references first, then drop
  COLUMN" rule still holds.

## 3. F-04 Privacy Policy §6 factual error — operator action (carry-forward)

Audit F-04 noted two factual issues in `app/privacy/page.tsx` §6
(third-party processors):
- Stripe Payments Europe Ltd (the EU entity) handles cards from EU
  buyers in addition to Stripe Inc. (the US entity). Disclosure
  should list both.
- Cloudflare R2 region/jurisdiction disclosure is vague — R2
  storage region is configurable per bucket and the current Privacy
  Policy doesn't reflect what region we actually use.

**Action:** Brief the Georgian lawyer (already on the launch-blockers
list) specifically on these two points before re-shipping the §6
revision. Do NOT have Claude rewrite §6 in code without lawyer input
— a one-shot rewrite risks introducing different mistakes. Wait for
legal review.

This is unchanged from Batch 8's observations and remains an open
operator action.

## 4. Test count progression notes

- Pre-flight (post-Batch-8): 23 files / 177 tests.
- After Fix 1 (schema): 177 (no logic change).
- After Fix 2 (charge.refunded rewrite): 181 (+4 new tests).
- After Fix 3 (revoked UserCase gates): 183 (+2 new tests).
- After Fix 4 (email throttle): 184 (+1 new test).
- After Fix 5 (oneTimePerUser cleanup): 184 (no removed tests; only
  the fixture field removal).
- After Fix 6 (Terms §7 rewrite): 184 (Markdown/JSX prose only).
- Final: 23 files / 184 tests.

Net delta: +7 over 6 fixes. The original prompt projected the same
delta in §5 ("184 tests passing"). No surprises.

## 5. Untested behavior that landed in this batch

- **Per-recipient throttle on a Stripe live deploy:** Fix 4 has unit
  test coverage for the threshold case. The end-to-end "third paid
  checkout to victim@... within an hour skips the email" assertion
  hasn't been run live — needs to wait for Stripe Live activation
  to validate. Sandbox testing requires looping multiple
  `stripe trigger checkout.session.completed` calls with a fixed
  buyer email + manually-stamped `emailSentAt` timestamps in Neon,
  which is tedious enough that it's deferred to a single live-deploy
  smoke test.
- **Refund banner + read-only forms in the bureau workspace:** Fix 3
  has API gate test coverage but no E2E that visits
  `/bureau/cases/<slug>` with a refunded UserCase. Manual smoke is
  straightforward (`UPDATE "UserCase" SET "revokedAt" = NOW() WHERE
  id = <id>` via psql; reload the page; observe the banner +
  suppressed forms; verify the form-bypass POSTs return 410). Worth
  running once Batch 9 is on prod.
- **The migration on production Neon:** Migration was generated and
  applied to the dev DB during Fix 1. Production application happens
  via `npx prisma migrate deploy` per Observation 1. Postgres 17
  supports `ALTER TYPE ADD VALUE` outside a transaction (NB: older
  Postgres versions <12 don't, which would have made this migration
  more complex; Neon is on 17 so it's fine).

## 6. Carry-forward items still deferred (unchanged from Batch 8)

Re-confirmed during Batch 9's reading pass; not actioned in this
batch:

- **Sentry / structured logging** — every `catch` block in
  `app/api/**` calls `console.error`. Vercel function logs are not
  searchable across requests, not aggregated, not alertable. Requires
  `npm install @sentry/nextjs` or similar; needs a separate batch
  with explicit install permission.
- **CSP nonce migration** — current CSP allows `'unsafe-inline'`
  and `'unsafe-eval'` in `script-src` for Framer Motion. Multi-week
  refactor of every motion call to pass nonces; defer until other
  launch-blockers close.
- **`app/layout.tsx` calling `auth()` on every render** — fires the
  DB tokenVersion check on every page including marketing pages.
  Invisible at indie traffic, but the bottleneck under any viral
  spike. Fix shape: lazy `Navbar` client component fetching `/api/me`
  projection on mount/hover, or marketing-route fast-path. Multi-day
  refactor with regression risk on the auth flow.
- **Forgot-password timing leak** — `app/api/forgot-password/route.ts`
  takes ~10ms on user-not-found vs ~200-400ms on user-exists (Resend
  round-trip). Same shape as the login leak Batch 7 closed. Clean
  fix is `next/server`'s `after()` to defer the Resend send past
  response, but the existing test asserts
  `expect(resendSendFn).toHaveBeenCalled()` synchronously — defer
  to a batch with explicit "tests may change" permission.
- **`/bureau/database` unbounded findMany** — pagination + search.
  UX-touching refactor; perf batch.
- **R2 ContentLength alternative paths** — Cloudflare lifecycle
  rule (operator action, no code) or `S3.createPresignedPost`
  (separate batch with explicit `npm install
  @aws-sdk/s3-presigned-post` permission). See Batch 8 Observation 6.
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

## 7. Operational launch blockers (NOT engineering work, parallel track)

Carried forward unchanged from CLAUDE.md and prior observations —
not actionable from this codebase. Not affected by Batch 9:

- Resend DKIM/SPF/DMARC for `theblackledger.app` (DNS records in
  Namecheap; ~30-45 min in the Resend dashboard).
- Stripe Live activation wizard (business type, ID verification,
  bank, public details mirrored from sandbox; TOS+Privacy URLs need
  to be re-set in Live mode). Stripe Dashboard webhook subscription
  change from `payment_intent.payment_failed` →
  `checkout.session.async_payment_failed` (Batch 4 follow-up) and
  `charge.refunded` (Batch 5) need verification on the live account
  during activation.
- Georgian lawyer review of `/privacy` and `/terms` (now also
  including the §6 factual corrections from F-04 and the §7 rewrite
  from this batch's Fix 6).
- Optional: register Individual Entrepreneur (IE) entity in Georgia
  for liability separation and the 1% small-business tax band.

## 8. Sandbox cleanup carried forward

Carry-forward from Batch 8: the test PENDING orders accumulated in
Neon during sandbox + consent verification are still present (and
the new Batch 5 cron sweeps them to FAILED automatically). Harmless
either way. No new test orders were created during Batch 9
(verification was unit-test-only).

End of observations.
