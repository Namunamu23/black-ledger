# BATCH 11 — OBSERVATIONS

Things noticed while applying Batch 11 that survive past this fix
session, plus operator-action items unchanged from Batch 10. Short
batch — minimal observation surface; the change is a 5-line
validator tweak and a 1-line predicate tweak.

## 1. Why we relaxed only outer whitespace + case, not internal whitespace

`"delete  my  account"` (double-spaced, three tokens) still fails
validation. That's deliberate — internal whitespace collapse would
be a different policy decision. The relaxations applied here
(`trim` + `toLowerCase`) cover the variants a user is most likely
to produce by accident:

- Caps-lock left on (`DELETE MY ACCOUNT`).
- Browser auto-capitalization on the first word (`Delete my
  account`).
- Title case from muscle memory (`Delete My Account`).
- Stray space from clipboard paste (`  delete my account  `).

Internal-whitespace mistakes ("delete  my account", "deletemyaccount",
"delete my  account") are rarer and look more like a user mistyping
the literal phrase than a casing/whitespace artifact. A user who
hits double-space probably also has time to notice the canonical
form on the helper-text label and correct course. Collapsing
internal whitespace would slightly weaken the speed-bump (it would
silently accept "deletemyaccount" if combined with a more
aggressive normalizer, for instance), so we stop at the outer
edges.

## 2. Why the fix is mirrored on both layers

Client + server applied the same `s.trim().toLowerCase()` transform.
Two failure modes if only one layer normalized:

- **Client-only normalization.** A scripted POST bypassing the UI
  could submit `{ confirmation: "delete my account" }` directly —
  fine, no behavior change, but if the client also accepted
  variants the server would reject them with a 400 and the operator
  would see a confusing "client said it was OK but server said no"
  bug report.
- **Server-only normalization.** The form's `canSubmit` predicate
  would refuse to enable the submit button on uppercase input even
  though the server would have accepted it. The user would type
  `Delete My Account`, see a disabled button, and conclude the form
  is broken.

Mirroring keeps both UX (form gates uppercase identically to
lowercase) and security (server enforces the same canonical form
regardless of input shape) consistent with each other.

## 3. Helper text intentionally still lowercase

The visible label inside the form
(`Type delete my account to confirm`) stays lowercase as the
canonical signal. The relaxation is silent — users who type
variants discover by experience that it just works. Showing the
canonical form rather than advertising the relaxed accepted
forms keeps the label uncluttered (no "case-insensitive" footnote)
and biases users toward the literal phrase, which still produces
the smallest server-side normalization work and is the form
documented in any operator-facing notes about the deletion flow.

## 4. Doc drift noted in the prompt

The prompt said "keep all 7 existing tests intact" — there were
actually 8 tests in `tests/api/me.test.ts` (the `429 once the
rate limit (3/60s) is exhausted` test from Batch 6 was the
uncounted one). All 8 still pass after the relaxation, so the
drift had no operational consequence. Test count progression
in this batch is therefore 194 → 197 (+3 new), and `me.test.ts`
went from 8 → 11.

## 5. Test count progression notes

- Pre-flight (post-Batch-10): 24 files / 194 tests.
- After Fix 1 (validator + form + 3 new me.test.ts cases):
  24 files / 197 tests.
- Final: 24 files / 197 tests.

No new test files; me.test.ts grew by 3.

## 6. F-04 Privacy Policy §6 lawyer brief — operator action (carry-forward)

Unchanged from Batch 8 + Batch 9 + Batch 9b + Batch 10. Two
factual issues in `app/privacy/page.tsx` §6 (third-party
processors):

- Stripe Payments Europe Ltd handles cards from EU buyers in
  addition to Stripe Inc.
- Cloudflare R2 region/jurisdiction disclosure is vague.

Action: brief the Georgian lawyer (already on the launch-blockers
list) on these specifically before re-shipping §6. Do NOT have
Claude rewrite §6 in code without lawyer input.

## 7. Carry-forward items still deferred (unchanged from Batch 10)

Re-confirmed during this batch's reading pass; not actioned:

- **Sentry / structured logging** — every `catch` block in
  `app/api/**` calls `console.error`. Vercel function logs are not
  searchable across requests, not aggregated, not alertable.
  Requires `npm install @sentry/nextjs` or similar; needs a
  separate batch with explicit install permission.
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
  synchronously — defer to a batch with explicit "tests may
  change" permission.
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

## 8. Operational launch blockers (unchanged from Batch 10)

Carried forward verbatim — not actionable from this codebase. Not
affected by Batch 11:

- Resend DKIM/SPF/DMARC for `theblackledger.app`.
- Stripe Live activation wizard (TOS+Privacy URLs to be re-set in
  live mode; webhook subscriptions for
  `checkout.session.async_payment_failed` and `charge.refunded` to
  be verified during activation).
- Georgian lawyer review of `/privacy` and `/terms` (including the
  §6 factual corrections from F-04 and the §7 rewrite from Batch 9
  Fix 6).
- Optional: register Individual Entrepreneur (IE) entity in
  Georgia.

End of observations.
