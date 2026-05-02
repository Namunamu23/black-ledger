# BATCH 4 — FIX REPORT

Seven fixes applied surgically to `main`, one commit per fix, on a
previously clean tree. No pushes to remote. No migrations. No
`npm install` / `npm audit fix`. No env changes.

## Pre-flight tree state

- `git rev-parse HEAD` at start: `89c395c` (`docs(audit): two parallel
  god-mode audit dossiers + batch 4 fix prompt (2026-05-01)`). Sits
  three commits above `dd07e57` (the SHA the prompt cites file:line
  against): `99fc893` (audit dossiers), `89c395c` (batch-4 prompt),
  `dd07e57` (week-12 checkpoint). Audited line numbers re-confirmed
  against current files before each edit; only file `lib/validators.ts`
  shows minor drift (the spec cites `:275-284` and `:269` for the
  `revokeCodeSchema`; current file matches exactly).
- `git status`: working tree clean.
- Pre-flight `npx tsc --noEmit`: passed (no output).
- Pre-flight `npx vitest run`: 21 files, 161 tests passed.
- Both audit dossiers present at
  `audits/2026-05-01-godmode-audit.md` and
  `audits/2026-05-01-godmode-audit-cowork.md`. Both read in full
  before starting.

## Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `ef888d8` | fix(security): narrow Prisma select on /bureau/database to stop RSC payload leak |
| 2 | `9653e52` | fix(admin): allow hidden_evidence as AccessCode unlocksTarget |
| 3 | `2c824c5` | fix(stripe): use checkout.session.async_payment_failed for async failures |
| 4 | `c418223` | fix(stripe): close webhook concurrent-delivery race with updateMany precondition |
| 5 | `280d69f` | fix(privacy): make /api/register and /api/waitlist uniform-201 to prevent email enumeration |
| 6 | `28350b1` | fix(security): validate event.livemode on Stripe webhook to catch mode misconfiguration |
| 7 | `6aad4e8` | fix(admin): catch P2002 on slug update to return 409 instead of 500 |

## Per-fix results

### Fix 1 — `ef888d8` Narrow Prisma select on `/bureau/database`

- **Applied:** yes. One file edit in one commit.
  - `app/bureau/database/page.tsx:14-26` — replaced
    `include: { aliases: true, caseAppearances: { include: { caseFile: true } } }`
    with an explicit `select` block matching the `PersonSearchItem`
    type in `components/bureau/GlobalPeopleSearch.tsx:6-37` (18
    GlobalPerson scalars + `aliases.alias` + `caseAppearances.role` +
    `caseAppearances.caseFile.title/slug`). Inline comment flags the
    file as the authoritative shape contract for the server→client
    boundary.
- **Sweep mandate:** I ran the three audit-prescribed greps against
  `app/`:
  - `git grep -nE "include:\\s*\\{[^}]*caseFile:\\s*true" app/` →
    **8 sites**, triaged below.
  - `git grep -nE "include:\\s*\\{[^}]*aliases:\\s*true" app/` →
    **2 sites** (one was the target; the other is
    `app/bureau/people/[personId]/page.tsx`).
  - `git grep -nE "include:\\s*\\{[^}]*caseAppearances:\\s*true" app/`
    → **0 sites**.
- **Sweep triage** (every site that uses `include: { caseFile: true }`
  and either renders inline or returns JSON; the audit's rule is "leak
  only if the prisma object crosses to a `"use client"` component"):
  | File | Verdict | Reasoning |
  |---|---|---|
  | `app/bureau/database/page.tsx` | **Fixed in this commit** | Passes prisma rows to `<GlobalPeopleSearch>` (`"use client"`). |
  | `app/bureau/archive/page.tsx:17,25` | **Safe** | Server component renders `entry.caseFile.title/summary/slug` inline as JSX text; no client component receives the object. |
  | `app/bureau/page.tsx:34` | **Safe** | Server component renders `entry.caseFile.title/summary/slug/maxStage` inline. |
  | `app/bureau/cases/[slug]/debrief/page.tsx:27-28` | **Safe** | Server component renders `caseFile.debrief*` inline; only delivers debrief content to a SOLVED-state owner. |
  | `app/bureau/people/[personId]/page.tsx:34-35,57-58,78-79` | **Safe** | Server component, audit explicitly flagged it as the known-safe reference; verified by reading. Renders `appearance.caseFile.title/slug` and `entry.caseFile.slug` inline. |
  | `app/bureau/cases/[slug]/records/[recordId]/page.tsx:35-36` | **Safe (with note)** | Server component fetches `ownedCase` with `caseFile: true` but only reads `ownedCase.caseFileId` — the include is wasteful but does not cross to a client component. Captured in observations. |
  | `app/api/cases/activate/route.ts:38` | **Safe** | API route returns JSON; the only fields put into the response body are `message` and `slug` (lines 73-77, 113-114). The `caseFile.title` is interpolated into `message`. The full include is wasteful (loads solution columns into memory) but does not appear in the response. Captured in observations. |
  | `app/api/cases/[slug]/theory/route.ts:49-50` | **Safe** | API route uses `ownedCase.caseFile.solutionSuspect/Motive/Evidence` for evaluation and `ownedCase.caseFile.maxStage` for the stage gate; only `message`, `resultLabel`, `feedback`, `score` go into the response body (line 142-145). Captured in observations. |
- **Diff:** 1 file, +29 / -4.
- `tsc --noEmit`: passed.
- `vitest run`: 161 tests, unchanged from baseline.
- **Mental trace:** A signed-in investigator visits `/bureau/database`.
  The page now `select`s only the projection `PersonSearchItem`
  documents. The RSC payload sent to the browser carries 18 scalars per
  person + alias strings + (role, caseFile.title, caseFile.slug) per
  appearance. `solutionSuspect`, `solutionMotive`, `solutionEvidence`,
  `debriefOverview`, `debriefWhatHappened`, `debriefWhyItWorked`,
  `debriefClosing`, `debriefSectionTitle`, `debriefIntro`, and
  `internalNotes` are all dropped. View Source no longer reveals
  solutions.
- **Anomalies:** none. The committed file post-edit was re-read and
  contains zero of the forbidden field names.

### Fix 2 — `9653e52` Allow `hidden_evidence` as AccessCode `unlocksTarget`

- **Applied:** yes. Two file edits in one commit.
  - `lib/validators.ts:279` — extended
    `unlocksTarget.type: z.enum(["record", "person", "hint"])` to
    `["record", "person", "hint", "hidden_evidence"]`.
  - `app/api/admin/cases/[caseId]/access-codes/route.ts:75-81` —
    appended a fourth `else if (type === "hidden_evidence")` ownership
    branch that resolves against `prisma.hiddenEvidence.findUnique`
    and validates `caseFileId === parsedCaseId`. Sibling of the
    existing record/person/hint branches; placed before the
    `if (!targetExists)` 422 return.
- **Diff:** 2 files, +7 / -1.
- `tsc --noEmit`: passed (the Prisma client already exposes
  `prisma.hiddenEvidence` because the schema model exists, so no
  `npx prisma generate` was required).
- `vitest run`: 161 tests, unchanged.
- **Mental trace:**
  `POST /api/admin/cases/<id>/access-codes` with
  `{ code, kind, unlocksTarget: { type: "hidden_evidence", id: 1 }, ... }`
  → Zod parses (the enum now accepts the value) → ownership check
  resolves the row via `prisma.hiddenEvidence.findUnique` → if
  `caseFileId === parsedCaseId`, `targetExists = true` → handler
  proceeds to the create path. The redeem route at
  `app/api/access-codes/redeem/route.ts:33-38` already branches on
  `target?.type === "hidden_evidence"`, and
  `RevealedEvidence.tsx:114-131` already renders it.
- **Anomalies:** none.

### Fix 3 — `2c824c5` Switch to `checkout.session.async_payment_failed`

- **Applied:** yes. Two edits in one file in one commit.
  - `app/api/webhooks/stripe/route.ts:67-69` — replaced the switch arm
    `case "payment_intent.payment_failed":` with
    `case "checkout.session.async_payment_failed":` and updated the
    handler call to `handleCheckoutAsyncPaymentFailed(... as Stripe.Checkout.Session)`.
  - `app/api/webhooks/stripe/route.ts:284-294` — replaced the
    `handlePaymentFailed(intent: Stripe.PaymentIntent)` function with
    `handleCheckoutAsyncPaymentFailed(session: Stripe.Checkout.Session)`.
    The new handler keys the lookup on `stripeSessionId` (always set at
    session-create time) instead of `stripePaymentIntent` (only set in
    the success path).
- **Diff:** 1 file, +10 / -5.
- `tsc --noEmit`: passed.
- `vitest run`: 161 tests, unchanged. The existing
  `tests/api/stripe.test.ts` covers signature verification and
  `checkout.session.completed` happy path + idempotency + orphan
  recovery; nothing tested the failed-payment branch, so nothing
  needed updating.
- **Mental trace:** A `checkout.session.async_payment_failed` event
  arrives → handler finds the `Order` row via `stripeSessionId` →
  if PENDING, marks FAILED → if already COMPLETE (rare race with the
  success path), leaves alone.
- **Operator action documented in `BATCH_4_OBSERVATIONS.md`:** the
  webhook subscription change in the Stripe Dashboard must follow this
  code change for it to do anything. Captured.
- **Anomalies:** none.

### Fix 4 — `c418223` Close webhook concurrent-delivery race

- **Applied:** yes. Two edits in
  `app/api/webhooks/stripe/route.ts` plus a test-mock update in one
  commit.
  - **Transaction body** (around `:170-202`): added a new
    `tx.order.updateMany({ where: { id, status: PENDING }, data: { status: COMPLETE } })`
    precondition immediately after the orderRow resolution. On
    `count === 0`, the function throws
    `"ALREADY_COMPLETED_BY_CONCURRENT_DELIVERY"` to roll back the
    transaction. The final `tx.order.update` no longer carries
    `status: COMPLETE` — that field is moved to the precondition.
  - **Outer catch** (around `:75-81`): added a leading branch that
    catches the sentinel error and returns
    `{ received: true }` + 200, so Stripe does not retry the duplicate
    delivery.
  - **Test mocks** (`tests/api/stripe.test.ts`): added
    `orderUpdateMany` to the hoisted mocks and to the
    `vi.mock("@/lib/prisma")` and `transactionFn` proxies. Default
    `mockResolvedValue({ count: 1 })` in `beforeEach`. Two existing
    assertions on `orderUpdate.mock.calls[0][0].data.status === "COMPLETE"`
    were rewritten — the status flip now happens via `updateMany`, so
    the assertion was split: one new `expect(orderUpdateMany)` block
    asserting on the precondition shape (`where: { id, status: "PENDING" }`,
    `data: { status: "COMPLETE" }`), and the existing `orderUpdate[0]`
    block kept its `stripePaymentIntent` + `activationCodeId`
    assertions but lost `status: "COMPLETE"` (no longer written there).
- **Diff:** 2 files, +49 / -6.
- `tsc --noEmit`: passed.
- `vitest run`: 161 tests, unchanged.
- **Mental trace under concurrent redelivery:** tx-A wins the
  `updateMany` (count: 1), mints the ActivationCode, writes
  payment_intent + code link, commits, sends the email. tx-B enters
  next, runs `updateMany` (count: 0 because Order is now COMPLETE),
  throws the sentinel, transaction rolls back, outer catch returns
  200. Net: one ActivationCode, one email. Strict refinement under
  no-concurrency: the precondition still hits PENDING and flips it,
  identical to the old `data.status: COMPLETE` write — behavior
  unchanged.
- **Anomalies:** the prompt's verification section assumed the test
  mocks would not need updating. They did — the new `tx.order.updateMany`
  call against the mock proxy was undefined. The test-mock fix is the
  same shape as the prompt's Fix-6 test-mock fix; applied in this same
  commit because it is purely about supporting the new tx call shape.
  Documented in `BATCH_4_OBSERVATIONS.md`.

### Fix 5 — `280d69f` Uniform-201 register and waitlist

- **Applied:** yes. Three file edits in one commit.
  - `app/api/register/route.ts:37-46` — replaced the 409
    `"An account with this email already exists."` branch with a
    silent-absorb 201 returning the same `"Account created."` message
    a first-time registration gets. Multi-line comment block explains
    the trade-off (UX gap acknowledged; password-reset is the recovery
    path).
  - `app/api/waitlist/route.ts:42-50` — replaced the 409 branch on
    `P2002` with a silent-absorb 201 returning
    `"You're on the waitlist."` (the same shape as a first-time
    signup).
  - `tests/api/register.test.ts:129-141` — rewrote the
    `"returns 409 when email is already registered"` test to
    `"silently absorbs a duplicate email with 201 (no enumeration via 409)"`,
    asserting `res.status === 201` and `userCreate not called`. Title
    updated, body updated, comment added explaining the
    `forgot-password` parallel.
- **Diff:** 3 files, +19 / -8.
- `tsc --noEmit`: passed.
- `vitest run`: 161 tests, unchanged. The rewritten register test now
  exercises the new behavior; the waitlist 409 path was untested
  before this batch and remains untested (no test was added — out of
  scope per the prompt).
- **Mental trace:** Attacker scans
  `POST /api/register {email: "alice@x.com", password: "x".repeat(8)}`
  for any candidate email at the rate-limit ceiling (3/60s). All
  responses are 201 with `"Account created."`; the attacker cannot
  distinguish a new account from a duplicate. Same for
  `POST /api/waitlist`.
- **Anomalies:** the prompt did not mention that the waitlist route
  uses `"You’re on the waitlist."` (curly apostrophe) rather than
  `"You're on the waitlist."` (ASCII). I preserved the existing curly
  apostrophe in both branches so the behavior is truly indistinguishable
  (since byte-for-byte identical strings are required for the
  enumeration defense to be airtight). Documented in observations.

### Fix 6 — `28350b1` Validate `event.livemode` on Stripe webhook

- **Applied:** yes. Two edits in one commit.
  - `app/api/webhooks/stripe/route.ts:57-78` — inserted the guarded
    livemode check between the existing signature-verification block
    and the `console.log("Stripe webhook received: ...")` line. The
    leading `if (process.env.STRIPE_SECRET_KEY)` guard preserves the
    test-environment carve-out (the prompt's recommended form).
  - `tests/api/stripe.test.ts` — added `livemode: false` to four event
    fixtures (the four `mocks.stripeConstructEvent.mockReturnValue`
    sites: completed, idempotent-redelivery, orphan recovery, orphan
    no-meta). The `beforeAll` block already set
    `STRIPE_SECRET_KEY = "sk_test_123"`, so the guard's check is now
    active in the test environment with `expectLive = false` matching
    the fixture's `livemode: false`.
- **Diff:** 2 files, +31 / -0.
- `tsc --noEmit`: passed.
- `vitest run`: 161 tests, unchanged.
- **Mental trace:** Production with `sk_live_*` set →
  `expectLive = true` → live event with `livemode: true` passes →
  test event with `livemode: false` is rejected with 400 + a
  structured `[STRIPE-MODE-MISMATCH]` log line. Test environment with
  `sk_test_*` set → `expectLive = false` → test event with
  `livemode: false` passes (matches existing test fixtures).
- **Anomalies:** the prompt's verification section described two
  possible test-env states (key unset → guard skips; key set with test
  prefix → guard runs). This codebase's test setup uses the second
  state (`STRIPE_SECRET_KEY = "sk_test_123"` in `beforeAll`), so the
  fixture-update path applied. This is the path the prompt's
  test-fix-patch sub-section actually covers; applied as written.

### Fix 7 — `6aad4e8` Catch P2002 on slug update

- **Applied:** yes. Two file edits in one commit.
  - `app/api/admin/cases/[caseId]/route.ts:482-503` — extended the
    legacy aggregate PUT's outer catch with a `P2002 → 409` branch
    returning `"Another admin save changed this case while you were
    editing. Please reload and try again."`. Mirrors Batch 2's pattern
    in `app/api/admin/cases/route.ts` (POST) verbatim.
  - `app/api/admin/cases/[caseId]/overview/route.ts:76-119` — wrapped
    the existing `prisma.$transaction(...)` block in a `try { } catch (error) { }`
    with the same P2002 → 409 pattern. Non-P2002 errors are re-thrown
    so the existing failure semantics (whatever caller handles the
    bubbled error) are preserved.
- **Diff:** 2 files, +52 / -22 (the overview route's diff is wider
  than necessary because re-indenting the transaction body inside the
  new `try { }` block touched every line).
- `tsc --noEmit`: passed.
- `vitest run`: 161 tests, unchanged.
  `tests/api/admin-slug-history.test.ts` and
  `tests/api/admin-section-patches.test.ts` cover the happy paths;
  the new P2002 race branch is uncovered (acceptable per the prompt —
  same as Batch 2's P2002 catch on case create).
- **Mental trace:** Two admins click Save with the same target slug
  within milliseconds of each other on the overview tab. Both pass the
  `liveConflict` and `historyConflict` pre-checks (the slug is free at
  read time). Tx-A enters, updates the row, the unique index now
  reserves the slug for tx-A. Tx-B enters, hits the unique index on
  `caseFile.update`, throws P2002. Outer catch translates it to 409
  with the reload hint instead of bubbling to a generic 500.
- **Anomalies:** none.

## Final verification

- `git log --oneline -7` shows the seven new commits at the top, in
  the spec's order:
  ```
  6aad4e8 fix(admin): catch P2002 on slug update to return 409 instead of 500
  28350b1 fix(security): validate event.livemode on Stripe webhook to catch mode misconfiguration
  280d69f fix(privacy): make /api/register and /api/waitlist uniform-201 to prevent email enumeration
  c418223 fix(stripe): close webhook concurrent-delivery race with updateMany precondition
  2c824c5 fix(stripe): use checkout.session.async_payment_failed for async failures
  9653e52 fix(admin): allow hidden_evidence as AccessCode unlocksTarget
  ef888d8 fix(security): narrow Prisma select on /bureau/database to stop RSC payload leak
  ```
- `git status`: clean.
- `npx tsc --noEmit`: passed.
- `npx vitest run`: 21 files, 161 tests passed (same as baseline; no
  new test added but two existing tests rewritten to fit refined
  behavior — register 409→201, stripe webhook status-write split).
- `npm run build`: passed. Only the documented `pg` driver SSL
  informational warning ("SECURITY WARNING: The SSL modes 'prefer',
  'require', and 'verify-ca' are treated as aliases for 'verify-full'.").
  No new build warnings introduced. The Next 16 `middleware → proxy`
  notice cited in the prompt is no longer emitted in the current build
  output (the runtime is now displayed as `ƒ Proxy (Middleware)`
  without an explicit deprecation line).
- `git diff main~7 main --stat`:

```
 app/api/admin/cases/[caseId]/access-codes/route.ts |  6 +++
 app/api/admin/cases/[caseId]/overview/route.ts     | 61 ++++++++++++++--------
 app/api/admin/cases/[caseId]/route.ts              | 13 +++++
 app/api/register/route.ts                          | 13 +++--
 app/api/waitlist/route.ts                          |  7 ++-
 app/api/webhooks/stripe/route.ts                   | 60 ++++++++++++++++++---
 app/bureau/database/page.tsx                       | 33 ++++++++++--
 lib/validators.ts                                  |  2 +-
 tests/api/register.test.ts                         |  7 ++-
 tests/api/stripe.test.ts                           | 41 +++++++++++++--
 10 files changed, 197 insertions(+), 46 deletions(-)
```

Exactly the ten files the spec authorised — the seven primary code
files plus `tests/api/register.test.ts` (Fix 5's authorised test
update) and `tests/api/stripe.test.ts` (authorised under both Fix 4's
mock-shape update and Fix 6's livemode-fixture update). No scope
creep.

Ready for human review and push. No migrations to run.
