# BATCH 7 — OBSERVATIONS

Things noticed while applying Batch 7 that were out of scope. Triage as
you see fit; no action taken on any of these.

## 1. Forgot-password timing leak (Cowork P2-11) deliberately deferred from this batch

`app/api/forgot-password/route.ts:34-53` (post-Batch-7 file:line; the
runtime pin shifts numbers) executes `findUnique + token gen +
prisma.user.update + getResend().emails.send` (~200-400ms via Resend
round-trip) on the user-exists path, but only `findUnique` (~10ms) on
the user-not-found path. Wall-clock difference is the enumeration
signal — same shape as the login leak Fix 3 closed.

The clean structural fix is to defer the email send so the response
returns before the Resend call begins:

- **`after()` from `next/server`** — Next 15+ adds an `after()` helper
  that lets a route handler enqueue work to run after the response
  has been sent. This matches the desired UX (always-200, fast) and
  avoids any extra dependency. **The blocker:** the existing test
  `tests/api/register.test.ts` (despite the file name, it covers
  `forgot-password` paths) asserts `expect(resendSendFn).toHaveBeenCalled()`
  inside its `await POST(req)` block. Wrapping the send in `after()`
  defers it past the route handler's resolved promise, so the
  assertion fails on a stale mock. Closing this leak cleanly therefore
  requires either:
  - **Test-restructuring** so the assertion waits for the deferred
    callback (e.g., `vi.waitFor(() => expect(...).toHaveBeenCalled())`
    with a 1-2 second timeout), OR
  - **Deterministic-delay padding** on the user-not-found path
    (`await sleep(randomBetween(200, 400))`) — leaks far less but
    isn't free of a sophisticated statistical attack.

Both are real work, not the mechanical 1-line fix the rest of Batch 7
delivers. **Defer to a future batch with explicit "tests may change"
permission.**

## 2. Sentry / structured logging (Cowork P2-9 / Claude Code P3-7) deferred

Every `catch` block in `app/api/**` calls `console.error`. Vercel
function logs are tail-able but not searchable across requests, not
aggregated, and not alertable. The first time something breaks in
production we will learn from a customer email rather than a
dashboard. Both audit dossiers flag this; the fix-prompt model
forbids `npm install`, which any structured-logging vendor (Sentry,
Better Stack, Datadog) requires.

**For a future batch with explicit install permission:** install
`@sentry/nextjs` or `@logtail/next`, run their init wizard, replace
`console.error` calls with the SDK's capture method (or leave them —
both will surface the error). Approximate effort: half a day from
install to first alert wired up. Should be its own batch with the
project state checkpoint reflecting the new dependency before the
next audit.

## 3. `/bureau/database` unbounded findMany (Claude Code P2-8) deferred to a perf batch

`app/bureau/database/page.tsx:14-26` calls
`prisma.globalPerson.findMany` with no `take`/`skip` and a nested
`caseAppearances → caseFile` include. Today there are O(10s) of
GlobalPerson rows, so the page renders fast. Past 1k rows the RSC
payload becomes hundreds of KB even after Batch 4 closed the P0 leak
of `solutionSuspect`/`internalNotes`.

**Fix shape:** server-side pagination via `take + cursor` with a
search input that POSTs to a new `/api/bureau/database/search`
endpoint. Replace the static page render with a paginated client
component that hydrates the first page. UX-touching refactor;
multiple-touch effort. Defer to a perf batch.

## 4. `app/layout.tsx` `auth()` on every page render (Cowork P2-8) deferred to a perf batch

`app/layout.tsx:27` calls `auth()` to populate `<Navbar session={...} />`
on every page render — including marketing pages (`/`, `/about`,
`/faq`, `/how-it-works`, `/privacy`, `/terms`) that don't otherwise
need the user. Because the session callback in `auth.ts:63-77`
verifies tokenVersion against the live DB, every public-page render
triggers a Postgres round-trip. Today this is invisible at indie
traffic levels; under any viral spike (HN, Twitter) the database
becomes the bottleneck.

**Fix shape:** convert `Navbar` to a client component that lazily
fetches a thin `/api/me` projection (already exists for the
account-deletion form's needs) on hover/menu-open, OR add a
`session: null`-fast-path in the layout for marketing routes.
Multi-day refactor with regression risk on the auth flow.
Defer to a perf batch with explicit Navbar-rewrite permission.

## 5. Adjacent rate-limit / runtime sweep findings noted but out of scope

Carried forward unchanged from prior batches' observations and
re-confirmed during Batch 7's reading pass — not actioned in Batch 7:

- The two new admin rate-limit branches added in Fix 1 (60/60s on 13
  routes) are functional but **untested**. No vitest coverage
  exercises the 429 path. The pattern matches the existing
  rate-limit branches added in Batches 2/4/5/6 which are also
  untested. Should the codebase eventually adopt a "race-against-mock"
  test for one of these branches, the other 12 should follow at the
  same time. **Cost:** one shared `tests/api/rate-limit-sweep.test.ts`
  helper. **Defer.**
- The `runtime = "nodejs"` pin from Fix 2 is a const export with no
  runtime side-effect; tests can't observe it. Verifying the pin
  works as intended would need `npm run build` plus inspection of
  the `.next/server/app/api/**/route.js` output — out of scope for
  test additions, but trivially confirmable on next deploy by the
  Vercel function-runtime indicator.
- `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts`'s revoke
  handler now has rate-limiting + runtime pin; it still does **not**
  write a `CaseAudit` row on revoke (Cowork P3-12). Carried forward
  from prior observations.

## 6. Other follow-ups still open from the 2026-05-01 audits after Batch 7

Listing for Batch 8+ scoping. These remain after Batch 7:

- **Cowork audit P1-2 (customer-facing half):** Terms of Service
  promises a 7-day refund mechanism. Batch 5 closed the Stripe-side
  half (refund webhook revokes entitlement). The customer-facing
  "Request a refund" flow with the 7-day window enforced via
  `claimedAt` is still open. Either build the customer-facing flow,
  or clarify the policy to "request via support email."
- **Audit P1-3:** Activation-code email goes to attacker-supplied
  address. Architectural — needs product input on whether to require
  account-creation pre-checkout, or deliver code via token-link.
- **Audit P1-6:** `AccessCodeRedemption` unique-key vs
  `oneTimePerUser=false` is a no-op. Product call: drop the column or
  drop the unique constraint.
- **Audit P2-7:** Role demotion does not propagate to existing JWT
  sessions (tokenVersion only bumps on password reset). Hypothetical
  until a second admin exists.
- **Audit P2-10 / cowork P2-12:** CSP allows `'unsafe-inline'` and
  `'unsafe-eval'` in `script-src`. Move to nonce-based. Multi-batch
  effort in itself; defer until other launch-blockers close.
- **Cowork P2-1 (full):** Google Fonts embedding without Privacy
  Policy disclosure. Batch 7 closed the dead `font-src` reference,
  but the load-bearing `style-src https://fonts.googleapis.com` is
  still present. To fully close the privacy concern, either disclose
  Google as a font CDN processor in `/privacy` §5, or replace
  `next/font/google` with `next/font/local` (ship Manrope from
  `/public/fonts/`).
- **Cowork P2-6:** Legacy single-code generator at
  `/api/admin/cases/[caseId]/activation-codes` has unbounded collision
  retry. Either bound the retry to 3 attempts (mirror the newer batch
  endpoint) or delete the legacy route.
- **Cowork P2-7:** Initial activation code creation in admin case POST
  silently 500s on collision after creating the CaseFile. Wrap both
  writes in a `$transaction`.
- **All P3 items from prior audits and CLAUDE.md follow-ups** —
  carried forward. Notable ones:
  - Lazy Stripe/Resend client caching in production (`P3-1` cowork)
  - `lucide-react ^1.8.0` version pin sanity-check (`P3-3` cowork)
  - `tsconfig target ES2017` bump to ES2022 (`P3-4`)
  - Forgot-password timing leak — see Observation 1 above
  - `unarchive-case.ts` hard-coded CASE_ID
  - `RevokeButton` still POSTs ignored `revokedAt` field
  - `assertSafeEnv` only matches Neon hosts
  - `CaseAudit` not written for: revoke, AccessCode create, workflow
    PATCH, batch-generate
  - `tsconfig`, `engines.node`, dotenv-in-prod-runtime, etc.

## 7. Operational launch blockers (NOT engineering work, parallel track)

Carried forward unchanged from CLAUDE.md and prior observations — not
actionable from this codebase:

- Resend DKIM/SPF/DMARC for `theblackledger.app` (DNS records in
  Namecheap; ~30-45 min in the Resend dashboard).
- Stripe Live activation wizard (business type, ID verification,
  bank, public details mirrored from sandbox; TOS+Privacy URLs need
  to be re-set in Live mode).
- Georgian lawyer review of `/privacy` and `/terms`.
- Optional: register Individual Entrepreneur (IE) entity in Georgia
  for liability separation and the 1% small-business tax band.
- Once Batch 5's `charge.refunded` and Fix 1's admin-rate-limit are
  stable in production: a one-time Sandbox-mode end-to-end test of
  refund + revoke (operator action; can pair with the
  `tests/test-stripe-e2e.ts` script extension).
- Stripe Dashboard webhook subscription (per Batch 4's Fix 3 in
  `BATCH_4_REPORT.md`) from `payment_intent.payment_failed` →
  `checkout.session.async_payment_failed` — pending until Stripe Live
  activation, since the test-mode webhook still works against the
  old subscription.

End of observations.
