# BATCH 7 — FIX REPORT

Four surgical defense-in-depth fixes applied to `main`, one commit per
fix, on a previously clean tree, plus this report. **No migrations** —
schema is untouched. **No new dependencies** — `package.json` and
`package-lock.json` not modified. **No env changes**, no pushes to
remote. Closes the four P2/P3 items the prompt named:

- Cowork P2-11 / Claude Code P2-5 — admin mutation routes lack rate limits
- Cowork P2-11 / Claude Code P2-9 — `runtime = "nodejs"` not pinned on every API route
- Cowork P2-13 / Claude Code P2-11 — login lookup not constant-time (email-enumeration timing leak)
- Cowork P2-1 (partially) / Claude Code P3-10 — dead `https://fonts.gstatic.com` reference in CSP `font-src`

## Pre-flight tree state

- `git rev-parse HEAD` at start: `96c2a3a` (`docs(audit): batch 7 fix
  prompt (defense-in-depth hardening)`). Sits two commits above
  `0bdd277` (the post-Batch-5 docs checkpoint), one above
  `c440821` (`docs: project state checkpoint after batch 6`), and
  three above the Batch 6 fix commits the prompt cites file:line
  against. The Batch 7 prompt commit is purely the dossier write —
  code state is identical to `2e0e2a9` (Batch 6 docs).
- `git status`: working tree clean.
- Pre-flight `npx tsc --noEmit`: passed (no output).
- Pre-flight `npx vitest run`: 22 files, 168 tests passed.
- Both 2026-05-01 audit dossiers (`audits/2026-05-01-godmode-audit.md`
  and `audits/2026-05-01-godmode-audit-cowork.md`), the Batch 6 report
  (`audits/BATCH_6_REPORT.md`), and the Batch 6 observations
  (`audits/BATCH_6_OBSERVATIONS.md`) all present and read in full
  before starting.

## Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `45c2c06` | fix(security): rate-limit admin mutation routes (60/60s per ip+route) |
| 2 | `f4eac26` | chore(runtime): pin runtime = "nodejs" on every Prisma-using API route |
| 3 | `ebf3369` | fix(security): constant-time bcrypt compare on login to close email-enumeration timing leak |
| 4 | `b10dd68` | chore(csp): drop unused fonts.gstatic.com from font-src |
| 5 | _this commit_ | docs(audit): batch 7 report + observations |

## Per-fix results

### Fix 1 — `45c2c06` rate-limit admin mutation routes (60/60s per ip+route)

- **Applied:** yes. 13 file changes in one commit. Each handler
  receives the same insertion: an `import { rateLimit } from
  "@/lib/rate-limit";` line added immediately after the
  `import { requireAdmin } from "@/lib/auth-helpers";` line, plus an
  11-line `rateLimit` block at the top of the relevant handler,
  immediately before the existing `const guard = await requireAdmin();`
  line. The block returns 429 with a `Retry-After` header on rate-limit
  exhaustion and short-circuits before any DB or auth work runs.
  Pattern is the same as `app/api/admin/uploads/sign/route.ts:48-57`
  (existing 20/60s rate limit on the upload signer).
- **Routes touched (13):**
  - `app/api/admin/cases/route.ts` (POST)
  - `app/api/admin/cases/[caseId]/route.ts` (PUT — legacy aggregate;
    the GET handler is unchanged)
  - `app/api/admin/cases/[caseId]/{overview,people,records,hints,checkpoints,solution}/route.ts`
    (PATCH each; six routes)
  - `app/api/admin/cases/[caseId]/workflow/route.ts` (PATCH)
  - `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts` (PATCH revoke)
  - `app/api/admin/cases/[caseId]/access-codes/route.ts` (POST; the GET
    handler is unchanged)
  - `app/api/admin/support/[id]/reply/route.ts` (POST)
  - `app/api/admin/support/[id]/status/route.ts` (PATCH)
- **Routes intentionally NOT touched** because they were already
  rate-limited at a different ceiling, per the prompt:
  - `app/api/admin/uploads/sign/route.ts` — 20/60s
  - `app/api/admin/uploads/blurhash/route.ts` — 30/60s
  - `app/api/admin/cases/[caseId]/codes/route.ts` — 10/60s (batch generate)
  - `app/api/admin/cases/[caseId]/activation-codes/route.ts` — 10/60s (legacy single-code generator)
- **Diff:** 13 files, +156 / -0. Each file gets +1 import line + +12
  handler-prefix lines (the rate-limit block + a blank line below it),
  totaling +13… except the two files that already had the
  `NextResponse` import cluster on a single line still net +12, since
  the import block is counted in the same chunk. Mechanically: each
  file shows `+12` in `git diff --stat` because the import is added
  inside the existing imports cluster (no surrounding context grew),
  and the rate-limit block itself is 11 lines + 1 blank-line spacer.
  Net `13 files × +12 = +156`.
- `tsc --noEmit`: passed (no output).
- `vitest run`: 22 files / 168 tests passed (unchanged from baseline).
  No existing test fires 60+ admin requests in a single arrangement,
  so the new 429 branch isn't exercised.
- **Mental trace per path:**
  - **Within budget:** Admin POST `/api/admin/cases/[caseId]/overview`
    → `rateLimit(request, { limit: 60, windowMs: 60_000 })` → returns
    `success: true` → `requireAdmin()` runs → DB transaction proceeds.
    Indistinguishable from pre-fix behaviour for normal use.
  - **Burst exhaustion:** `for i in {1..70}; do curl -X PATCH .../workflow ...; done`
    from one IP. Requests 1-60 return their normal 200/422/etc.
    Requests 61-70 return 429 with `Retry-After: <s>`. The
    `requireAdmin()` lookup is never executed for the 429 batch — the
    rate-limit gate runs first.
  - **Read paths unchanged:** `GET /api/admin/cases/[caseId]/access-codes`
    and `GET /api/admin/cases/[caseId]` are explicitly NOT rate-limited
    here (per prompt). They remain accessible at full speed.
- **Anomalies:** none. Two of the 13 files have multiple handlers
  (`app/api/admin/cases/[caseId]/route.ts` has GET + PUT;
  `app/api/admin/cases/[caseId]/access-codes/route.ts` has GET + POST).
  Disambiguation in the Edit `old_string` was via the multi-line
  function signature, which is unique within each file.

### Fix 2 — `f4eac26` pin runtime = "nodejs" on every Prisma-using API route

- **Applied:** yes. 29 file changes in one commit. Each file gets a
  single `export const runtime = "nodejs";` line added immediately
  after the last import, with blank lines above and below — same
  pattern as the three already-pinned routes (`app/api/me/route.ts:9`,
  `app/api/cron/cleanup-pending-orders/route.ts:9`,
  `app/api/webhooks/stripe/route.ts:9`).
- **Routes touched (29):**
  - All 13 admin mutation routes from Fix 1
  - `app/api/admin/cases/[caseId]/{activation-codes,codes}/route.ts`
  - `app/api/admin/uploads/{sign,blurhash}/route.ts`
  - `app/api/auth/[...nextauth]/route.ts`
  - `app/api/access-codes/redeem/route.ts`
  - `app/api/cases/activate/route.ts`
  - `app/api/cases/[slug]/{theory,checkpoint}/route.ts`
  - `app/api/checkout/route.ts`, `app/api/checkout/status/route.ts`
  - `app/api/register/route.ts`, `app/api/reset-password/route.ts`,
    `app/api/forgot-password/route.ts`
  - `app/api/support/route.ts`, `app/api/waitlist/route.ts`
- **Routes intentionally NOT touched** because they were already pinned
  per the prompt:
  - `app/api/me/route.ts` (Batch 6)
  - `app/api/cron/cleanup-pending-orders/route.ts` (Batch 5)
  - `app/api/webhooks/stripe/route.ts` (since launch)
- **Routes intentionally NOT touched** because they don't run Node-only
  APIs (per prompt's exclusion):
  - `app/u/[code]/route.ts` — not under `app/api/`, no Prisma touch
    (just a `redirect()` via `next/navigation`); runs fine on edge.
- **Diff:** 29 files, +58 / -0. Per-file delta is `+2`: one for the
  runtime declaration, one for the blank line below it (matching the
  pattern in `me/route.ts` and `webhooks/stripe/route.ts`).
- `tsc --noEmit`: passed.
- `vitest run`: 22 files / 168 tests passed (a const export is a
  no-op at test-runtime; tests were unaffected).
- `npm run build`: clean. Only the documented pre-existing pg SSL
  informational notice (`The SSL modes 'prefer', 'require', and
  'verify-ca' are treated as aliases for 'verify-full'.`); no new
  warnings, no edge-runtime warnings.
- **Mental trace:** A future Next or adapter upgrade introduces an
  edge-preferred default. Routes with `export const runtime = "nodejs"`
  pin themselves to Node and continue importing `@/lib/prisma`,
  `bcryptjs`, `getStripe`, `getResend` without crashing. Without the
  pin, those imports would fail at first request because Prisma's
  pg adapter and bcryptjs both require Node-only APIs.
- **Anomalies:** the `git grep -L 'runtime = "nodejs"' 'app/api/**/route.ts'`
  enumeration the prompt suggested doesn't run cleanly on Windows
  PowerShell; `Glob app/api/**/route.ts` followed by an inverse
  `Grep` for the runtime string was the reproducible substitute. Both
  produce the same 29-file list. No file outside the prompt's expected
  list was touched.

### Fix 3 — `ebf3369` constant-time bcrypt compare on login to close email-enumeration timing leak

- **Applied:** yes. 1 file change in one commit. Three edits to
  `auth.ts`:
  - `import { compare } from "bcryptjs";` → `import { compare, hash } from "bcryptjs";`
  - Added a module-scope helper between the imports and the
    `export const { handlers, ... }` block:
    ```ts
    let _constantTimeFakeHash: string | null = null;
    async function getConstantTimeFakeHash(): Promise<string> {
      if (_constantTimeFakeHash === null) {
        _constantTimeFakeHash = await hash("__no_user_constant_time_placeholder__", 12);
      }
      return _constantTimeFakeHash;
    }
    ```
  - Replaced the `authorize` callback body. The new body always runs
    a `bcrypt.compare` — using the user's real `passwordHash` when the
    user exists, or the lazily-computed fake hash when they don't —
    so the wall-clock cost is uniform regardless of whether the
    submitted email matches a real account. A 4-line comment block
    above the `hashToCompare` assignment explains the rationale and
    captures the pre-image-leak non-issue (the placeholder string is
    fixed and is never used to mint a session).
- **Diff:** 1 file, +24 / -8.
- `tsc --noEmit`: passed.
- `vitest run`: 22 files / 168 tests passed (no test exercises the
  `authorize` callback directly — existing tests mock `@/auth`
  upstream — so 168 stays unchanged).
- **Mental traces:**
  - **Bad email + any password:** `loginSchema.safeParse` succeeds
    (typed inputs); `findUnique` returns `null`; `hashToCompare =
    await getConstantTimeFakeHash()` (~80-150ms on first sign-in
    attempt of the process; instant after, served from module cache);
    `compare(badPassword, fakeHash)` (~80-150ms); `!user` is truthy
    → `return null`. Total wall-clock: ~80-300ms first time of the
    process, ~80-150ms thereafter.
  - **Real email + wrong password:** `findUnique` returns the user;
    `hashToCompare = user.passwordHash`; `compare(badPassword,
    realHash)` (~80-150ms); `!passwordMatches` is truthy → `return
    null`. Total wall-clock: ~80-150ms.
  - **Real email + right password:** same as above but `compare`
    returns true; `!user || !passwordMatches` is falsy → returns the
    `{ id, email, name, role, tokenVersion }` shape unchanged from
    pre-fix.
  - **Cache priming behaviour:** the very first sign-in attempt of a
    Lambda cold-start is slower than subsequent attempts because
    `getConstantTimeFakeHash` runs a real bcrypt hash on first call.
    This is acceptable — it's a one-time per-process cost and an
    attacker measuring a single sign-in cannot distinguish "cache
    cold" from "real password compared." Subsequent attempts in the
    same process are flat-time across both branches.
- **Anomalies:** none. The `compare` import is unchanged in usage; the
  `hash` import is used only inside the helper. The placeholder string
  `"__no_user_constant_time_placeholder__"` is intentionally fixed
  and intentionally not interesting — its only role is to be a valid
  pre-image for a bcrypt hash that the helper computes once.

### Fix 4 — `b10dd68` drop unused fonts.gstatic.com from font-src

- **Applied:** yes. 1 file change in one commit. One line:
  `next.config.ts:30` was `"font-src 'self' https://fonts.gstatic.com",`
  → `"font-src 'self'",`. Adjacent `style-src` line at `:29` is
  preserved as `"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"`
  because `next/font/google`'s build-time stylesheet generation
  references that origin.
- **Diff:** 1 file, +1 / -1.
- `tsc --noEmit`: passed.
- `vitest run`: 22 files / 168 tests passed.
- **Mental trace:** `app/layout.tsx:9-12` instantiates Manrope via
  `next/font/google`. At build time, Next downloads the woff2 binaries
  and emits them under `/_next/static/media/...`. At runtime, the
  served HTML's `<link rel="preload" href="/_next/static/media/...">`
  references the self-hosted file; no network request to
  `fonts.gstatic.com` is made by the production page. The CSP
  declaration was therefore dead — a future maintainer reading the
  CSP would (incorrectly) infer that the runtime needs the origin.
  Removing it tightens the policy without breaking anything and
  removes a third-party CDN reference that the Privacy Policy §7
  doesn't disclose.
- **Anomalies:** none. The `style-src` line still references
  `https://fonts.googleapis.com`. That entry is load-bearing at
  build-time-only as far as the runtime is concerned, but Next's
  static stylesheets occasionally embed a `@import` reference to the
  Google CSS endpoint at first paint depending on the version. Per
  the prompt: do not touch the `style-src` line. Only the `font-src`
  reference is dead.

### Fix 5 — _this commit_ Batch 7 report + observations

- **Applied:** yes. Two new files under `audits/`.
  - `audits/BATCH_7_REPORT.md` — this file.
  - `audits/BATCH_7_OBSERVATIONS.md` — out-of-scope observations,
    deferral list, items still open after Batch 7.

## Final verification

- `git log --oneline -5` (after this commit lands) shows the four fix
  commits + this docs commit, in expected order:
  ```
  <new>  docs(audit): batch 7 report + observations
  b10dd68 chore(csp): drop unused fonts.gstatic.com from font-src
  ebf3369 fix(security): constant-time bcrypt compare on login to close email-enumeration timing leak
  f4eac26 chore(runtime): pin runtime = "nodejs" on every Prisma-using API route
  45c2c06 fix(security): rate-limit admin mutation routes (60/60s per ip+route)
  96c2a3a docs(audit): batch 7 fix prompt (defense-in-depth hardening)
  ```
- `git status`: clean (after this commit lands).
- `npx tsc --noEmit`: passed (no output).
- `npx vitest run`: 22 files / 168 tests passed (unchanged from
  baseline — none of the four fixes added test coverage; the prompt
  did not request new tests).
- `npm run build`: clean. Only the pre-existing pg SSL informational
  notice and the Next 16 `middleware → proxy` deprecation notice; no
  new warnings introduced.
- `git diff main~5 main --stat` (after this commit lands) is expected
  to show exactly the files the prompt authorised:

```
 auth.ts                                                    (Fix 3)
 next.config.ts                                             (Fix 4)
 app/api/access-codes/redeem/route.ts                       (Fix 2)
 app/api/admin/cases/[caseId]/access-codes/route.ts         (Fix 1 + Fix 2)
 app/api/admin/cases/[caseId]/activation-codes/route.ts     (Fix 2)
 app/api/admin/cases/[caseId]/checkpoints/route.ts          (Fix 1 + Fix 2)
 app/api/admin/cases/[caseId]/codes/[codeId]/route.ts       (Fix 1 + Fix 2)
 app/api/admin/cases/[caseId]/codes/route.ts                (Fix 2)
 app/api/admin/cases/[caseId]/hints/route.ts                (Fix 1 + Fix 2)
 app/api/admin/cases/[caseId]/overview/route.ts             (Fix 1 + Fix 2)
 app/api/admin/cases/[caseId]/people/route.ts               (Fix 1 + Fix 2)
 app/api/admin/cases/[caseId]/records/route.ts              (Fix 1 + Fix 2)
 app/api/admin/cases/[caseId]/route.ts                      (Fix 1 + Fix 2)
 app/api/admin/cases/[caseId]/solution/route.ts             (Fix 1 + Fix 2)
 app/api/admin/cases/[caseId]/workflow/route.ts             (Fix 1 + Fix 2)
 app/api/admin/cases/route.ts                               (Fix 1 + Fix 2)
 app/api/admin/support/[id]/reply/route.ts                  (Fix 1 + Fix 2)
 app/api/admin/support/[id]/status/route.ts                 (Fix 1 + Fix 2)
 app/api/admin/uploads/blurhash/route.ts                    (Fix 2)
 app/api/admin/uploads/sign/route.ts                        (Fix 2)
 app/api/auth/[...nextauth]/route.ts                        (Fix 2)
 app/api/cases/activate/route.ts                            (Fix 2)
 app/api/cases/[slug]/checkpoint/route.ts                   (Fix 2)
 app/api/cases/[slug]/theory/route.ts                       (Fix 2)
 app/api/checkout/route.ts                                  (Fix 2)
 app/api/checkout/status/route.ts                           (Fix 2)
 app/api/forgot-password/route.ts                           (Fix 2)
 app/api/register/route.ts                                  (Fix 2)
 app/api/reset-password/route.ts                            (Fix 2)
 app/api/support/route.ts                                   (Fix 2)
 app/api/waitlist/route.ts                                  (Fix 2)
 audits/BATCH_7_OBSERVATIONS.md                             (Fix 5, new)
 audits/BATCH_7_REPORT.md                                   (Fix 5, new)
```

No scope creep. Schema untouched. No new dependencies. No env changes.
No pushes. Ready for human review and push to `origin/main`. No
operator follow-up required for any of the four fixes — they take
effect immediately on next deploy. See `BATCH_7_OBSERVATIONS.md` for
adjacent items deferred to later batches (forgot-password timing,
Sentry/structured logging, `/bureau/database` pagination, `app/layout.tsx`
auth-on-every-render).
