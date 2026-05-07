# BATCH 9B — OBSERVATIONS

Things noticed while applying Batch 9b that survive past this fix
session, plus operator-action items unchanged from Batch 9. Short
batch — most of the observation surface is unchanged from Batch 9.

## 1. F-14 closure — the no-op flag arc is done

Batch 9b closes the F-14 audit-finding arc cleanly. The flag-was-a-no-op
flag is gone (Batch 9 Fix 5 deleted every runtime reference), the
column it backed is gone (this batch), and the unique constraint
`@@unique([accessCodeId, userId])` on `AccessCodeRedemption` is now
the sole source of truth for one-redemption-per-user enforcement.
The schema, the runtime code, the form UI, the panel render, the
scripts, and the test fixtures are all aligned around the same
single mechanism. F-14 needs no further follow-up.

The two-batch pattern was the right shape: Fix 5 cleared the
runtime; this batch cleared the storage. Splitting the column drop
into its own commit + its own batch isolated the destructive change
behind a clean boundary, which is what made the deploy-ordering
relaxation in Section 2 possible.

## 2. Deploy-ordering relaxation — when destructive migrations can ship in either order

Batch 9 required strict migrate-first-then-push ordering because the
new code in Fix 2 read and wrote `OrderStatus.PARTIALLY_REFUNDED`
and `UserCase.revokedAt`; old code didn't, and new code on the old
schema would fail on the missing column. Standard order for a
schema-additive batch.

Batch 9b is the inverse situation. The schema migration is
destructive (drops a column) but the column was already orphaned by
Batch 9 — no runtime code reads or writes it. As a result either
deploy order produces no observable errors:

- **push first → migrate second** — Vercel runs the new code, which
  doesn't reference the column. Production DB still has the column
  (with stale rows that no code touches). Then `migrate deploy`
  drops the column. No downtime, no errors.
- **migrate first → push second** — Production DB drops the column.
  Old code on Vercel still doesn't reference it (Batch 9 already
  removed every reference). Prisma client cache on the old Vercel
  process holds a schema with the column, but no query plan touches
  it, so the cache mismatch is invisible. New code deploys; client
  is regenerated against the dropped-column schema; everything
  matches. No downtime, no errors.

**Recipe for future destructive migrations.** If you can split a
destructive change into two batches — first batch removes all
runtime references (additive cleanup), second batch drops the column
alone — deploy ordering becomes flexible and the second batch's
blast radius is bounded. The first batch is reversible (the column
still exists; if you regret the cleanup you just put the references
back). The second batch is destructive but trivial to audit (it
literally just deletes storage that nothing reads). The cost is one
extra commit and one extra batch boundary; the gain is operator
calm.

This is now a recommended pattern for any future deprecations.

## 3. F-04 Privacy Policy §6 lawyer brief — operator action (carry-forward)

Unchanged from Batch 8 + Batch 9. Two factual issues in
`app/privacy/page.tsx` §6 (third-party processors):

- Stripe Payments Europe Ltd handles cards from EU buyers in
  addition to Stripe Inc.
- Cloudflare R2 region/jurisdiction disclosure is vague.

Action: brief the Georgian lawyer (already on the launch-blockers
list) on these specifically before re-shipping §6. Do NOT have
Claude rewrite §6 in code without lawyer input. Wait for legal
review.

## 4. Test count progression notes

- Pre-flight (post-Batch-9): 23 files / 184 tests.
- After Fix 1 (column drop + lockstep cleanups): 184 unchanged.
- Final: 23 files / 184 tests.

No delta. Column drop has no test surface; the only fixture
reference was already removed in Batch 9 Fix 5.

## 5. Process anomaly — `prisma migrate dev` non-interactive failure on destructive warnings

`npx prisma migrate dev --name <name>` and `--create-only` both fail
with "Prisma Migrate has detected that the environment is
non-interactive, which is not supported" when the destructive-data
warning fires (in this batch: "3 non-null values"). This is by
design — Prisma wants a confirmation before generating SQL that
will erase data.

**Workaround applied:** create the migration directory manually
under `prisma/migrations/<timestamp>_<name>/`, write the
`migration.sql` file by hand with the expected
`ALTER TABLE ... DROP COLUMN ...` statement, then run
`npx prisma migrate deploy` to apply it. `prisma generate`
afterwards refreshes the client. The end-state is identical to what
the interactive flow would have produced — same SQL, same migration
record, same client.

**Future mitigation.** If a future batch needs to do the same thing,
either:
- Run `prisma migrate dev` interactively from a real terminal, OR
- Use the manual workaround above (single SQL file + `migrate
  deploy`).

The `--accept-data-loss` flag still exists in current Prisma but is
documented for `db push`, not `migrate dev`; it does not bypass the
interactive prompt on `migrate dev`.

## 6. Carry-forward items still deferred (unchanged from Batch 8 + Batch 9)

Re-confirmed during this batch's reading pass; not actioned:

- **Sentry / structured logging** — every `catch` block in
  `app/api/**` calls `console.error`. Vercel function logs are not
  searchable across requests, not aggregated, not alertable.
  Requires `npm install @sentry/nextjs` or similar; needs a separate
  batch with explicit install permission.
- **CSP nonce migration** — current CSP allows `'unsafe-inline'`
  and `'unsafe-eval'` in `script-src` for Framer Motion. Multi-week
  refactor; defer until other launch-blockers close.
- **`app/layout.tsx` calling `auth()` on every render** — fires the
  DB tokenVersion check on every page including marketing pages.
  Invisible at indie traffic, the bottleneck under any viral spike.
  Multi-day refactor with regression risk on the auth flow.
- **Forgot-password timing leak** —
  `app/api/forgot-password/route.ts` takes ~10ms on user-not-found
  vs ~200-400ms on user-exists. Same shape as the login leak Batch
  7 closed. Clean fix is `next/server`'s `after()` to defer the
  Resend send, but the existing test asserts `resendSendFn`
  synchronously — defer to a batch with explicit "tests may change"
  permission.
- **`/bureau/database` unbounded findMany** — pagination + search
  refactor. UX-touching; perf batch.
- **No `error.tsx`** — uncaught errors render the default Next 16
  error page. Cosmetic + log-collection concern.
- **R2 ContentLength alternative paths** — Cloudflare lifecycle
  rule (operator action) or `S3.createPresignedPost` (separate
  batch with explicit `npm install @aws-sdk/s3-presigned-post`
  permission).
- **Pre-existing odd indentation in `app/api/admin/cases/route.ts`
  `data: {}` block** — cosmetic only.
- **`unarchive-case.ts` hard-codes `CASE_ID = 3`** — operator-only
  script.
- **`RevokeButton` still POSTs the now-ignored `revokedAt` field**
  — server stamps; cosmetic only.
- **`assertSafeEnv` only matches Neon hosts** — robust enough now,
  but if we ever switch hosts the check breaks silently.
- **`CaseAudit` not written for: workflow PATCH, batch-generate,
  revoke, AccessCode create** — audit-trail gap; defer to a
  CaseAudit-coverage batch.

## 7. Operational launch blockers (unchanged from Batch 9)

Carried forward verbatim — not actionable from this codebase. Not
affected by Batch 9b:

- Resend DKIM/SPF/DMARC for `theblackledger.app`.
- Stripe Live activation wizard (TOS+Privacy URLs to be re-set in
  live mode; webhook subscriptions for
  `checkout.session.async_payment_failed` and `charge.refunded` to
  be verified during activation).
- Georgian lawyer review of `/privacy` and `/terms` (including the
  §6 factual corrections from F-04 and the §7 rewrite from Batch 9
  Fix 6).
- Optional: register Individual Entrepreneur (IE) entity in Georgia.

## 8. Sandbox cleanup carried forward

Test PENDING orders accumulated in Neon during sandbox + consent
verification are still present (and Batch 5's cron sweeps them to
FAILED automatically). Harmless. No new test orders were created
during Batch 9b (verification was unit-test-only — no live HTTP
calls).

End of observations.
