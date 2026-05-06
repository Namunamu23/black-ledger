# BATCH 8 — FIX REPORT

Eleven surgical fixes applied to `main`, one commit per fix, on a
previously clean tree, plus this report. **No migrations** — schema is
untouched. **No new dependencies** — `package.json` and
`package-lock.json` not modified. **No env changes**, no pushes to
remote. Closes 10 of the 12 quick wins from §3.4 of
`audits/2026-05-06-godmode-audit.md` plus a backlog-tickets commit;
3 verified P1s land here (F-01 cron timing oracle, F-03 user-delete
re-claim loop, F-06 X-Forwarded-For rate-limit bypass) and 7 P2/P3
defense-in-depth items.

## Pre-flight tree state

- `git rev-parse HEAD` at start: `76a30ac` (`docs: extend week 16
  entry with batch 7 details`). Sits two commits above `e964593`
  (the post-Batch-7 seed-script refactor) and is the natural
  starting point for Batch 8.
- `git status`: working tree had two untracked audit files
  (`audits/2026-05-06-godmode-audit.md` and
  `audits/FIX_PROMPT_BATCH_8.md`). Per the Batch 7 pattern, these
  were committed first as `7a2ecb5 docs(audit): batch 8 fix prompt
  + 2026-05-06 godmode audit dossier` so the working tree was clean
  before the fix series began.
- Pre-flight `npx tsc --noEmit`: passed (no output).
- Pre-flight `npx vitest run`: 22 files, 168 tests passed.
- 2026-05-06 audit dossier (`audits/2026-05-06-godmode-audit.md`),
  Batch 7 report (`audits/BATCH_7_REPORT.md`), and Batch 7
  observations (`audits/BATCH_7_OBSERVATIONS.md`) all present and
  read in full before starting.

## Commits

| #  | Hash      | Subject |
|----|-----------|---------|
| 0  | `7a2ecb5` | docs(audit): batch 8 fix prompt + 2026-05-06 godmode audit dossier (prep) |
| 1  | `a4ce3f8` | fix(security): cron route hardening — timingSafeEqual + User-Agent check |
| 2  | `17d57bc` | fix(security): rate-limit IP source reads x-real-ip first to defeat X-Forwarded-For spoofing |
| 3  | `c6294fc` | fix(security): revoke claimed activation codes on user-delete to close re-claim loop |
| 4  | `f01cf19` | fix(checkout): drop 15-min bucket from Stripe idempotencyKey to prevent stale-tab double-charge |
| 5  | `b2dbd34` | fix(admin): atomic updateMany on activation-code revoke (close read-then-write race) |
| 6  | `66be06e` | fix(security): R2 upload pipeline hardening — Sharp pixel limit (Content-Length cap deferred) |
| 7  | `bbe17b5` | fix(email): add Reply-To: support@... to activation-code email |
| 8  | `2af557f` | fix(checkout): explicit toLowerCase on Order.email at every write site |
| 9  | `344748d` | fix(checkpoint): move CheckpointAttempt write inside the stage-advance transaction |
| 10 | `f857fb9` | feat(admin): include hidden_evidence in CreateAccessCodeForm and access-codes page |
| 11 | `62e4a72` | docs(backlog): record deferred Batch 9 product items + revisit triggers in CLAUDE.md |
| 12 | _this commit_ | docs(audit): batch 8 report + observations |

## Per-fix results

### Fix 1 — `a4ce3f8` cron route hardening — timingSafeEqual + User-Agent check

- **Applied:** yes. 2 file changes in one commit.
  - `app/api/cron/cleanup-pending-orders/route.ts`: imported
    `timingSafeEqual` from `crypto`, replaced the plain `!==`
    Bearer-secret comparison with a length-pre-check + `timingSafeEqual`
    pair (the length pre-check is required because `timingSafeEqual`
    rejects mismatched-length buffers — a length difference is
    observable via `Content-Length` anyway, but the secret bytes are
    constant-time-compared). Added a follow-up `User-Agent !==
    "vercel-cron/1.0"` reject with a `console.warn` so ops notice if
    Vercel ever changes the UA string.
  - `tests/api/cron-cleanup.test.ts` (new): 5 cases covering missing
    `CRON_SECRET` (503), missing auth header (403), wrong secret (403),
    wrong UA (403), and the happy path (200 + `prisma.order.updateMany`
    called once). `vi.stubEnv` + `vi.unstubAllEnvs` pattern matches
    other tests using ad-hoc env vars.
- **Diff:** 2 files, +135 / −2.
- `tsc --noEmit`: passed.
- `vitest run`: 168 → 173 (+5).
- **Mental traces:**
  - **Vercel cron:** Authorization `Bearer <CRON_SECRET>` matches via
    constant-time compare; UA `vercel-cron/1.0` matches; sweep runs.
  - **Plain probe:** UA `curl/8.0.1` (or any other) → 403 with no DB
    work. The `console.warn` lets ops grep `[CRON]` and spot Vercel
    UA-string changes early.
  - **Byte-by-byte timing extract:** `timingSafeEqual` runs in
    constant time relative to the secret bytes; no first-mismatch
    short-circuit.
- **Anomalies:** none.

### Fix 2 — `17d57bc` rate-limit IP source reads x-real-ip first to defeat X-Forwarded-For spoofing

- **Applied:** yes. 2 file changes in one commit.
  - `lib/rate-limit.ts`: rewrote `extractIp`. In production
    (`process.env.NODE_ENV === "production"`) the function reads
    only `x-real-ip` (Vercel's edge-set, non-forgeable header) and
    falls through to `"unknown"` if absent. In any other environment
    (test, dev) `x-real-ip` is still preferred, but the leftmost
    `x-forwarded-for` token is honored as a fallback so existing
    tests that pass `x-forwarded-for` for per-IP isolation continue
    to work without modification.
  - `tests/lib/rate-limit.test.ts`: added two cases under a new
    `describe("rateLimit IP extraction (F-06 hardening)")` block.
    Case 1 confirms test-mode honors `x-forwarded-for` (preserves the
    existing test-isolation pattern). Case 2 stubs
    `NODE_ENV="production"`, then asserts that two requests with
    different spoofed `x-forwarded-for` but the same `x-real-ip`
    share a bucket (the spoof can't buy fresh quota), and that
    requests with no `x-real-ip` collapse to a single `"unknown"`
    bucket regardless of `x-forwarded-for`.
- **Diff:** 2 files, +101 / −5.
- `tsc --noEmit`: passed.
- `vitest run`: 173 → 175 (+2).
- **Mental trace:** Vercel always sets `x-real-ip` in production, so
  the rate-limit bucket key `${ip}:${pathname}` keys on the verified
  client IP. An attacker spoofing `X-Forwarded-For: 1.2.3.<random>`
  per request hits the same `x-real-ip` bucket every time — quota
  exhausts after `limit` requests. The bucket key shape is
  unchanged, so Upstash buckets re-key transparently (old forgeable
  keys age out per their window; new real keys take over).
- **Anomalies:** none. The test-mode fallback is a deliberate carve-
  out — the existing rate-limit test (`makeRequest(ip)` with
  `x-forwarded-for`) continues to work without test changes.

### Fix 3 — `c6294fc` revoke claimed activation codes on user-delete to close re-claim loop

- **Applied:** yes. 2 file changes in one commit.
  - `app/api/me/route.ts`: replaced the bare `prisma.user.delete()`
    with a `prisma.$transaction([updateMany, delete])` array — the
    `updateMany` stamps `revokedAt: new Date()` on every
    `ActivationCode` whose `claimedByUserId === userId` AND whose
    `revokedAt === null` (the null guard preserves any earlier
    admin-revoked timestamp). Comment block above the transaction
    explains the rationale — the Schema's `claimedByUserId SetNull`
    cascade by itself leaves `claimedAt` set + `claimedByUserId`
    null, which the activate route's "already-claimed" guard treats
    as unclaimed, allowing a fresh account to re-redeem (the F-03
    re-claim loop).
  - `tests/api/me.test.ts`: added `activationCodeUpdateMany` and
    `transaction` mocks to the hoisted mock object, wired them into
    the `vi.mock("@/lib/prisma")` block. Default
    `transaction.mockImplementation` resolves the array of operations
    via `Promise.all`, so existing happy-path tests still observe
    `userDelete` being called. New test asserts: response 200,
    `activationCodeUpdateMany` called with
    `{ claimedByUserId: 42, revokedAt: null }` + `data.revokedAt
    instanceof Date`, `transaction` called with an Array, `userDelete`
    called once.
- **Diff:** 2 files, +62 / −7.
- `tsc --noEmit`: passed.
- `vitest run`: 175 → 176 (+1).
- **Mental trace:** Buyer creates account, redeems code, deletes
  account. Pre-fix: code's `claimedAt` persists, `claimedByUserId`
  is null (SetNull). New account redeems same code → succeeds (the
  activate route checked `claimedByUserId !== null` only). Post-fix:
  code's `revokedAt` is stamped at delete time. New account redeems
  same code → 410 Gone (the existing `revokedAt` check fires).
- **Anomalies:** none.

### Fix 4 — `f01cf19` drop 15-min bucket from Stripe idempotencyKey to prevent stale-tab double-charge

- **Applied:** yes. 1 file change in one commit.
  - `app/api/checkout/route.ts:124-130`: removed the `bucket =
    Math.floor(Date.now() / (15 * 60 * 1000))` segment from the
    idempotencyKey. The new key is `checkout-case-${caseId}-${emailHash}`
    — stable across the 24-hour window Stripe persists idempotency
    keys for. A user with a stale tab clicking Continue at minute 16
    now hits the same Stripe-side idempotency entry as their minute-0
    click and Stripe returns the SAME session (no second mintable
    paid path). The PENDING-session-reuse short-circuit higher in the
    handler still applies for the application-side flow.
- **Diff:** 1 file, +9 / −2.
- `tsc --noEmit`: passed.
- `vitest run`: 176 unchanged. No existing test pinned the exact
  idempotencyKey shape (verified via
  `Grep "idempotencyKey" tests/` — no matches).
- **Mental trace:** Two clicks, same `(caseId, email)`, any time
  apart up to 24h: Stripe returns the same Checkout session for
  both. User cannot double-pay the same case from a single email
  in a single day.
- **Anomalies:** none.

### Fix 5 — `b2dbd34` atomic updateMany on activation-code revoke (close read-then-write race)

- **Applied:** yes. 2 file changes in one commit.
  - `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts`: replaced
    the read-then-write pattern (`findUnique` → branch on `revokedAt
    !== null` → `update`) with an atomic `updateMany` whose `where`
    clause includes `id`, `caseFileId` (preserves the existing
    ownership check that the prompt's example omitted), AND
    `revokedAt: null`. On `count === 0` the route falls back to a
    `findUnique` that selects only `{ id, caseFileId, revokedAt }`
    to distinguish 404 (doesn't exist OR wrong case) from 409
    (already revoked).
  - `tests/api/admin-codes.test.ts`: added `activationCodeUpdateMany`
    to the hoisted mocks. Rewrote the existing two revoke tests to
    use the new flow (mock `updateMany` count 1 for happy, count 0
    + `findUnique` returning the already-revoked row for 409). Added
    a third test for the new 404 path (count 0 + `findUnique` returns
    null). Happy-path test now also asserts that the server STAMPS
    the timestamp instead of honoring the client's submitted value.
- **Diff:** 2 files, +57 / −27.
- `tsc --noEmit`: passed.
- `vitest run`: 176 → 177 (+1, the new 404 case).
- **Mental trace:** Admin A and admin B both click Revoke on the
  same code at the same instant. A's `updateMany` matches (count 1,
  sets `revokedAt` to t0). B's `updateMany` runs against the
  precondition `revokedAt: null` — A already wrote, so the
  precondition fails (count 0). B's branch goes to the fallback
  `findUnique` → row exists with the same caseFileId → returns 409.
  No double-write; A's t0 timestamp is preserved cleanly.
- **Anomalies:** the prompt's "current state" example omitted the
  ownership check (`existing.caseFileId !== parsedCaseId`) that the
  actual route enforces. Preserved by adding `caseFileId:
  parsedCaseId` to the `updateMany` `where` and re-checking it on
  the fallback `findUnique` (so a code belonging to a different
  case still returns 404).

### Fix 6 — `66be06e` R2 upload pipeline hardening — Sharp pixel limit (Content-Length cap deferred)

- **Applied:** partial. 1 file change in one commit. Only the F-12
  Sharp pixel-limit half landed; the F-11 R2 ContentLength half
  was reverted before commit.
  - `app/api/admin/uploads/blurhash/route.ts`: passed
    `{ limitInputPixels: 1_048_576 }` (1 megapixel = 1024×1024) as
    the Sharp constructor option. Caps memory blowup on a 16384×16384
    attack input — Sharp throws `Input image exceeds pixel limit`
    which the existing `try/catch` swallows into `return null`,
    surfacing as `{blurhash: null}` to the admin client.
  - `app/api/admin/uploads/sign/route.ts`: NOT TOUCHED. The prompt's
    proposed `ContentLength: MAX_UPLOAD_BYTES` change in the
    presigned `PutObjectCommand` was reverted because the AWS SDK
    v3 `@aws-sdk/s3-request-presigner` signs `ContentLength` as
    EXACT-match (not "≤ max" / range cap). Setting it to 5 MB would
    fail any legitimate upload whose actual size differs (R2 returns
    `403 SignatureDoesNotMatch` when the upload's `Content-Length`
    header doesn't equal the signed value). See
    `audits/BATCH_8_OBSERVATIONS.md` Observation 6 for the deferred
    alternative paths (Cloudflare R2 lifecycle rule, or
    `S3.createPresignedPost` with `content-length-range`).
- **Diff:** 1 file, +8 / −1.
- `tsc --noEmit`: passed.
- `vitest run`: 177 unchanged. `tests/api/admin-uploads.test.ts`
  has sign + blurhash happy paths; both still pass because the
  Sharp constructor's `limitInputPixels` is passed by reference and
  doesn't change the call shape.
- **Mental trace:** Legitimate 800×600 hero image (480 000 pixels) is
  well under the 1 048 576 cap → blurhash succeeds. Attack input
  16384×16384 (≈268 000 000 pixels) → Sharp throws → `{blurhash:
  null}` returned to admin → no memory blowup.
- **Anomalies:** the partial revert. Documented in
  `BATCH_8_OBSERVATIONS.md`. The commit subject was adjusted from
  the prompt's verbatim wording to reflect the partial scope (the
  prompt explicitly anticipated this contingency in §5 Required
  output).

### Fix 7 — `bbe17b5` add Reply-To: support@... to activation-code email

- **Applied:** yes. 2 file changes in one commit.
  - `app/api/webhooks/stripe/route.ts`: added `replyTo:
    "support@theblackledger.app"` to the
    `getResend().emails.send(...)` call that fires on
    `checkout.session.completed`. Customer hits Reply on the
    activation-code email → message lands at the monitored support
    mailbox instead of the no-reply From address.
  - `app/api/admin/support/[id]/reply/route.ts`: same `replyTo`
    field added to the support-reply send. Mirrors the activation-
    email pattern; closes the loop where a customer's reply to a
    support response would otherwise land at no-reply.
- **Diff:** 2 files, +9 / −0.
- `tsc --noEmit`: passed.
- `vitest run`: 177 unchanged. Verified via reading
  `tests/api/stripe.test.ts:319-323` that the resend assertion only
  pins `emailArgs.to` and `emailArgs.text.toContain(...)`, never
  the args object's full shape — adding `replyTo` is invisible to
  the test.
- **Mental trace:** Stripe completes a checkout → webhook fires →
  Resend send goes out with `from: no-reply@..., to: buyer@...,
  replyTo: support@...`. Buyer hits Reply → email goes to support
  mailbox → operator sees it in the existing support inbox UI.
- **Anomalies:** none. The audit's note about the support-reply
  route possibly already having a `replyTo` was wrong (it didn't);
  fix applied to both routes per the prompt's branch logic.

### Fix 8 — `2af557f` explicit toLowerCase on Order.email at every write site

- **Applied:** yes. 2 file changes in one commit.
  - `app/api/checkout/route.ts:177`: `email,` → `email:
    email.trim().toLowerCase(),` at the `prisma.order.create` data
    block.
  - `app/api/webhooks/stripe/route.ts:230-236`: same change at the
    orphan-recovery `tx.order.create` data block, where `buyerEmail`
    comes from `session.metadata.email`.
- **Diff:** 2 files, +11 / −2.
- `tsc --noEmit`: passed.
- `vitest run`: 177 unchanged. Existing tests already use lowercase
  email strings, so the explicit normalization is a no-op for the
  test inputs and the assertions remain green.
- **Mental trace:** Today, `parsed.data.email` from `checkoutSchema`
  is already lowercase because the Zod schema does the lowercasing.
  Tomorrow, a future caller (a server-action wrapper, a CLI
  reconciliation script) might submit an unparsed email. The
  duplicate-purchase guard uses `mode: "insensitive"` so it would
  still match, but having `Order.email` consistently lowercase at
  the data layer means the index-equality lookup is faster and the
  data store is predictable.
- **Anomalies:** none. The Stripe `metadata.email` write at the
  Checkout session create site (`route.ts:143-146`) was deliberately
  NOT touched — Fix 8's scope per the prompt is "Order.email at every
  write site," not metadata. The existing flow's recovery branch
  trim+lowercases when reading buyerEmail back, so the metadata
  channel is double-protected.

### Fix 9 — `344748d` move CheckpointAttempt write inside the stage-advance transaction

- **Applied:** yes. 2 file changes in one commit.
  - `app/api/cases/[slug]/checkpoint/route.ts`: split the
    CheckpointAttempt write into two branches. Wrong-answer attempts
    are written OUTSIDE any transaction (no stage advance to roll
    back; the audit row is intentional for "are players guessing"
    analytics). Correct-answer attempts are written INSIDE the
    existing `$transaction(async tx => ...)` block, AFTER the
    `updateMany` precondition succeeds — so a STAGE_CONFLICT
    rollback also rolls back the attempt log, preserving accuracy
    (concurrent losers don't leave false-positive "succeeded" rows).
  - `tests/api/checkpoint.test.ts`: extended the
    `transactionFn.mockImplementation` callback to expose
    `checkpointAttempt: { create: mocks.checkpointAttemptCreate }`
    inside the tx, since the route now calls
    `tx.checkpointAttempt.create` rather than
    `prisma.checkpointAttempt.create` on the correct-answer path.
- **Diff:** 2 files, +29 / −10.
- `tsc --noEmit`: passed.
- `vitest run`: 177 unchanged. All existing matcher + STAGE_CONFLICT
  tests still pass because the public contract (200/400/409 status
  codes + `userCaseUpdateMany` call shape) is unchanged.
- **Mental trace:** Two concurrent correct submissions race. Both
  pass the matcher; both enter their own `$transaction`. A's
  `updateMany` advances (count 1); A's `checkpointAttempt.create`
  inserts inside the same tx; A commits → 200. B's `updateMany`
  finds 0 matches (A already advanced); B throws `STAGE_CONFLICT`;
  B's transaction rolls back → 409, AND B's `checkpointAttempt` is
  NOT inserted. Audit trail: one correct attempt, one client-side
  409, no false "succeeded but didn't advance" row.
- **Anomalies:** none. The wrong-answer audit-trail behavior is
  deliberately preserved — those rows are useful, and they don't
  participate in any race because no stage-advance attempt is made.

### Fix 10 — `f857fb9` include hidden_evidence in CreateAccessCodeForm and access-codes page

- **Applied:** yes. 3 file changes in one commit.
  - `app/bureau/admin/cases/[caseId]/access-codes/page.tsx`: added
    `hiddenEvidence: { select: { id, title }, orderBy: revealOrder }`
    to the `caseFile.findUnique` `include` block. Forwarded the new
    array as `hiddenEvidence={caseFile.hiddenEvidence}` to
    `<AccessCodesPanel>`. (The schema's HiddenEvidence model uses
    `revealOrder`, not `sortOrder` — verified before committing.)
  - `app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodesPanel.tsx`:
    extended `Props` with `hiddenEvidence: { id, title }[]`,
    forwarded to `<CreateAccessCodeForm>`.
  - `app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx`:
    widened `TargetType` to include `"hidden_evidence"`. Extended
    `Props` with `hiddenEvidence`. Updated `targetOptions` useMemo
    with the `hidden_evidence` branch. Added `<option
    value="hidden_evidence">Hidden evidence</option>` to the target-
    type select.
- **Diff:** 3 files, +20 / −3.
- `tsc --noEmit`: passed (which catches any prop drift across the
  three files — none).
- `vitest run`: 177 unchanged. No existing UI test covers the form;
  manual smoke trace only.
- **Mental trace:** Admin opens
  `/bureau/admin/cases/<id>/access-codes` → CreateAccessCodeForm
  appears → "Target type" dropdown now offers Hidden evidence →
  selecting it populates the Target select with the case's
  HiddenEvidence rows ordered by `revealOrder` → submit → POST
  `/api/admin/cases/<id>/access-codes` with
  `unlocksTarget: { type: "hidden_evidence", id: <evidence_id> }`.
  The validator (`lib/validators.ts:279`) and the API route
  (`app/api/admin/cases/[caseId]/access-codes/route.ts:95-101`)
  already accept this branch (Batch 4 Fix 2).
- **Anomalies:** the prompt's empty-state copy template
  (`No ${targetType}s available — add one first.`) renders awkwardly
  for hidden_evidence as "No hidden_evidences available — add one
  first." Acceptable per the prompt; not addressed in this batch.

### Fix 11 — `62e4a72` record deferred Batch 9 product items + revisit triggers in CLAUDE.md

- **Applied:** yes. 1 file change in one commit.
  - `CLAUDE.md`: appended a new "Deferred product / architecture
    decisions (revisit triggers)" subsection at the end of the
    "Known follow-ups" section, before "Upcoming major milestones."
    Two entries: self-serve refund flow (DEFERRED — manual flow
    documented in Terms §7) and authenticated purchase flow
    (DEFERRED — keep guest checkout, ship per-recipient throttle in
    Batch 9).
- **Diff:** 1 file, +5 / −0.
- `tsc --noEmit`: not applicable (Markdown).
- `vitest run`: 177 unchanged.
- **Mental trace:** future Claude session reading CLAUDE.md sees
  these decisions explicitly recorded with revisit triggers, so it
  doesn't re-litigate them when planning the next batch.
- **Anomalies:** none. The "Upcoming major milestones" list was
  intentionally NOT trimmed (the prompt suggested removing F-05 /
  F-13 framing, but the existing list doesn't actually carry those
  IDs — it lists higher-level operational items like Resend DKIM,
  Stripe Live activation, Georgian lawyer review, first kit sale).
  No edit needed there.

### Fix 12 — _this commit_ Batch 8 report + observations

- **Applied:** yes. 2 new files under `audits/`.
  - `audits/BATCH_8_REPORT.md` — this file.
  - `audits/BATCH_8_OBSERVATIONS.md` — out-of-scope observations,
    deferral list, items still open after Batch 8.

## Final verification

- `git log --oneline -12` (after this commit lands) shows the prep
  commit, 11 fix commits, and this docs commit, in expected order.
- `git status`: clean (after this commit lands).
- `npx tsc --noEmit`: passed (no output).
- `npx vitest run`: 23 files / 177 tests passed (168 baseline + 9
  new — the prompt projected +8; the +1 over-delivery is the 404
  case in the Fix 5 test rewrite, which simulates a code-not-found
  scenario the original tests didn't cover).
- `npm run build`: clean. Only the pre-existing pg SSL informational
  notice; no edge-runtime warnings, no new diagnostics.
- `git diff 76a30ac main --stat` (post-fix series) shows exactly
  the files the prompt authorised:

```
 CLAUDE.md                                                                                  (Fix 11)
 app/api/admin/cases/[caseId]/codes/[codeId]/route.ts                                       (Fix 5)
 app/api/admin/support/[id]/reply/route.ts                                                  (Fix 7)
 app/api/admin/uploads/blurhash/route.ts                                                    (Fix 6)
 app/api/cases/[slug]/checkpoint/route.ts                                                   (Fix 9)
 app/api/checkout/route.ts                                                                  (Fix 4 + Fix 8)
 app/api/cron/cleanup-pending-orders/route.ts                                               (Fix 1)
 app/api/me/route.ts                                                                        (Fix 3)
 app/api/webhooks/stripe/route.ts                                                           (Fix 7 + Fix 8)
 app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodesPanel.tsx              (Fix 10)
 app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx          (Fix 10)
 app/bureau/admin/cases/[caseId]/access-codes/page.tsx                                      (Fix 10)
 audits/2026-05-06-godmode-audit.md                                                         (prep, new)
 audits/BATCH_8_OBSERVATIONS.md                                                             (Fix 12, new)
 audits/BATCH_8_REPORT.md                                                                   (Fix 12, new)
 audits/FIX_PROMPT_BATCH_8.md                                                               (prep, new)
 lib/rate-limit.ts                                                                          (Fix 2)
 tests/api/admin-codes.test.ts                                                              (Fix 5)
 tests/api/checkpoint.test.ts                                                               (Fix 9)
 tests/api/cron-cleanup.test.ts                                                             (Fix 1, new)
 tests/api/me.test.ts                                                                       (Fix 3)
 tests/lib/rate-limit.test.ts                                                               (Fix 2)
```

`app/api/admin/uploads/sign/route.ts` is intentionally absent —
Fix 6's R2 ContentLength portion was reverted because the SDK signs
ContentLength as exact-match (not "≤ max"), so the proposed cap
would have broken legitimate uploads. See `BATCH_8_OBSERVATIONS.md`
Observation 6 for the alternative paths.

No scope creep. Schema untouched. No new dependencies. No env
changes. No pushes. Three verified P1s closed (F-01, F-03, F-06);
seven P2/P3 defense-in-depth fixes landed; one P2 partial (F-12 of
F-11+F-12). Two operator actions documented in observations: F-04
Privacy Policy lawyer review, F-05 Terms §7 rewrite. Three Batch 9
items recorded in observations + CLAUDE.md backlog: F-02 partial
refund handler, F-13 per-recipient activation-email throttle, F-14
oneTimePerUser column drop. Ready for human review and push to
`origin/main`.
