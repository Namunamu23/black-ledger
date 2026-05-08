# BATCH 10 — OBSERVATIONS

Things noticed while applying Batch 10 that survive past this fix
session, plus operator-action items unchanged from Batch 9b. Short
batch — most of the observation surface is unchanged.

## 1. Why the fix lives at the page level rather than middleware

Two reasons the redirect-if-authenticated check is wired into each
auth-form page rather than into `middleware.ts`.

- **Middleware composition risk.** `middleware.ts` already does the
  CSRF origin gate, the `/bureau/*` auth gating, and the
  `/bureau/unlock` carve-out. Adding more conditional redirect logic
  there increases the surface area where a subtle ordering bug could
  produce open-redirect or auth-bypass behavior. The four auth-form
  pages are leaves of the route tree; a leaf-level redirect cannot
  interact with the gating logic of any other route.
- **Single source of truth on "signed in".** Page-level redirects go
  through the same `auth()` call from `@/auth` that powers
  `requireSession`. That means the redirect honors every check
  `requireSession` does, including the JWT `tokenVersion` DB check
  from Batch 3 — a stale JWT (post-password-reset) is correctly
  treated as not-signed-in and the auth-form pages render normally.
  If we had put the check in middleware (which uses the trivial,
  Prisma-free `auth.config.ts` session callback), a stale-JWT
  visitor would have been redirected away from `/login` even though
  signing in is exactly what they need to do. The page-level check
  is therefore the only correct place for this policy.

## 2. Why `/reset-password` doesn't preserve the token through the redirect

The reset token in `?token=` is a single-use credential for
unauthenticated password recovery. A signed-in user clicking a reset
email link is in an unusual state — they're already authenticated,
yet they ended up at the link. There are two scenarios:

- **Common case.** They forgot they were signed in, clicked an old
  email out of habit, and don't actually need to reset. Dropping
  them at `/bureau` is the friendly outcome.
- **Adversarial case.** Someone hands them a reset link to "click
  for me" and tries to ride their authenticated session into the
  reset flow. Preserving the token through the redirect would make
  that easier; dropping it makes the user choose to sign out and
  re-use the token if they really intend to.

In both cases dropping the token at the redirect boundary is safer.
A user who genuinely wants to use the token can sign out from the
Bureau and re-click the email link. The token is still valid until
its 1-hour expiry.

This is the same reasoning applied symmetrically to the
`?token=` param that `/reset-password` consumes when anonymous —
once a session exists, the auth-form invariant ("signed-in users
don't see auth forms") wins.

## 3. Navbar status note — Batch 3 fix verified still in place

The Navbar (`components/layout/Navbar.tsx`) was last updated in
Batch 3 to gate on `session?.user` (line 44 + line 81 + line 136),
not just `session?`. This batch's reading pass confirmed the gate
is still in place — `/login` is filtered out of the nav items for
signed-in users (defensive — `siteConfig.navItems` doesn't include
`/login` or `/register` to begin with) and the
"Bureau"/"Sign Out"/"Access Bureau" branches all key on
`session?.user`. No follow-up needed; no change in this batch.

The Navbar's filter for `/login` is a defensive no-op today (the
nav items list doesn't include it), but it's the right shape if
`/login` ever gets added to that list. The same is not true for
`/register` — there's no symmetric filter — but since `/register`
is also absent from `siteConfig.navItems` and the only user-facing
"Sign up" link is the one inside `LoginForm` (which signed-in
visitors never see because `/login` itself now redirects), this is
a non-issue.

## 4. No-scope-creep notes

This batch did NOT:

- Touch `middleware.ts` (per Section 1's reasoning).
- Touch the Navbar (Batch 3 fix already in place; verification only).
- Touch `auth.ts` or `auth.config.ts`.
- Modify the sign-out flow or `SignOutButton`.
- Add a "change password while signed in" UI (out of scope; would
  belong on a future account-settings page that doesn't exist yet).
- Refactor the existing auth forms (`LoginForm`, `RegisterForm`,
  `ForgotPasswordForm`, `ResetPasswordForm`) — they're untouched.
  All four still read `useSearchParams()` from `next/navigation`
  on the client, which is why the `Suspense` boundaries in the
  page JSX are still required.
- Change anything about how `pickPostLoginPath` sanitizes the
  callbackUrl. The existing sanitizer is reused as-is.

The operator asked for the auth-redirect gap only, and that's the
shape of the change.

## 5. Test count progression notes

- Pre-flight (post-Batch-9b): 23 files / 184 tests.
- After Fix 1 (helper + four pages + new test file): 24 files /
  194 tests.
- Final: 24 files / 194 tests.

+10 tests from the new `tests/routes/auth-redirect.test.ts` file.
The original prompt sketch suggested ~8 tests; the implemented set
adds two extra edge cases on `/login` (sanitized same-origin
callbackUrl honored, off-origin callbackUrl rejected) which are
the most operationally important paths to lock down. The remaining
six tests are the four pages × two auth states — the minimum to
prove the helper wires up correctly to each page.

## 6. F-04 Privacy Policy §6 lawyer brief — operator action (carry-forward)

Unchanged from Batch 8 + Batch 9 + Batch 9b. Two factual issues in
`app/privacy/page.tsx` §6 (third-party processors):

- Stripe Payments Europe Ltd handles cards from EU buyers in
  addition to Stripe Inc.
- Cloudflare R2 region/jurisdiction disclosure is vague.

Action: brief the Georgian lawyer (already on the launch-blockers
list) on these specifically before re-shipping §6. Do NOT have
Claude rewrite §6 in code without lawyer input.

## 7. Carry-forward items still deferred (unchanged from Batch 9b)

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

## 8. Operational launch blockers (unchanged from Batch 9b)

Carried forward verbatim — not actionable from this codebase. Not
affected by Batch 10:

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
