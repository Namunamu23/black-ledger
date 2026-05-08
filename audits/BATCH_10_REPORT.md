# BATCH 10 — FIX REPORT

One surgical UX/security fix on `main` plus this report. **No
migrations.** **No new dependencies** — neither `package.json` nor
`package-lock.json` is modified. **No env changes**, no pushes to
remote. Closes the auth-page redirect gap the operator noticed in
dogfooding: signed-in users could navigate to `/login`, `/register`,
`/forgot-password`, and `/reset-password` and see the auth forms.

## Pre-flight tree state

- `git rev-parse HEAD` at start: `e4740f6` (`docs(audit): batch 9b
  report + observations`).
- `git status`: working tree clean apart from three untracked
  `audits/FIX_PROMPT_BATCH_*.md` files, per the standard pattern of
  fix prompts living uncommitted at the audits folder during the
  active session.
- Pre-flight `npx tsc --noEmit`: passed (no output).
- Pre-flight `npx vitest run`: 23 files, 184 tests passed.
- Batch 9b report (`audits/BATCH_9B_REPORT.md`) read in full for
  house style; `tests/routes/unlock-flow.test.ts` and
  `tests/lib/auth-helpers.test.ts` read for the
  `vi.hoisted`/`vi.mock` test convention; `lib/post-login-path.ts`
  re-confirmed to export `pickPostLoginPath` and
  `DEFAULT_POST_LOGIN_PATH`; `components/layout/Navbar.tsx`
  re-confirmed to gate on `session?.user` (Batch 3 fix still in
  place).

## Commits

| #  | Hash      | Subject |
|----|-----------|---------|
| 1  | `e258ff3` | feat(auth): redirect signed-in users away from auth pages |
| 2  | _this commit_ | docs(audit): batch 10 report + observations |

## Per-fix results

### Fix 1 — `e258ff3` redirect signed-in users away from auth pages

- **Applied:** yes. 6 file changes in one commit.
  - `lib/auth-helpers.ts`: new `redirectIfAuthenticated(callbackUrl?:
    string | null): Promise<void>` export, alongside the existing
    `requireSession` / `requireAdmin` / `getOptionalSession` /
    `requireSessionJson`. Added `import { pickPostLoginPath } from
    "@/lib/post-login-path"`. Helper calls `auth()`, checks
    `session?.user`, and if signed in, calls
    `redirect(pickPostLoginPath(callbackUrl ?? null))`. The
    file's top-of-file docstring was updated to reflect five
    flavors instead of four, with a one-paragraph description of
    the new helper. The helper is the inverse of `requireSession`
    in shape and the policy lives in one place — same `auth()`
    call powers both, so the JWT-tokenVersion check from Batch 3
    applies uniformly.
  - `app/login/page.tsx`: converted to async server component,
    accepts `searchParams: Promise<{ callbackUrl?: string |
    string[] }>`, awaits the promise, narrows the callbackUrl to
    a string (drops arrays as malformed), calls
    `await redirectIfAuthenticated(callbackUrl)`. JSX body
    unchanged.
  - `app/register/page.tsx`: same pattern as login. Same
    callbackUrl plumbing. JSX body unchanged. `metadata` export
    preserved.
  - `app/forgot-password/page.tsx`: converted to async server
    component, calls `await redirectIfAuthenticated()` (no
    callbackUrl support — the page never accepts one). JSX body
    unchanged. `metadata` export preserved.
  - `app/reset-password/page.tsx`: same as forgot-password. The
    `?token=` reset token is intentionally NOT preserved through
    the redirect — see Observations §2.
  - `tests/routes/auth-redirect.test.ts` (new): 10 tests covering
    the four pages × two auth states (signed-in → redirect,
    anonymous → render). Login gets two extra edge-case tests
    (sanitized same-origin callbackUrl honored; off-origin
    callbackUrl rejected and falls back to `/bureau`). Mocks
    `@/auth` and `next/navigation` via the `vi.hoisted`
    pattern from `tests/routes/unlock-flow.test.ts` —
    `redirectFn` throws `REDIRECT:<url>` so the never-returns
    semantic of `next/navigation`'s `redirect` is faithfully
    reproduced.
- **Diff:** 6 files, +215 / −5.
- `tsc --noEmit`: passed (the new `searchParams: SearchParams`
  type, the async signatures on previously-sync components, and
  the new helper export all type-check cleanly).
- `vitest run`: 184 → 194 (+10 new tests).
- **Mental trace:** Signed-in user navigates to `/login` →
  Next 16 calls the async `LoginPage({ searchParams })` →
  `searchParams` resolves to `{}` → `callbackUrl` is `null` →
  `redirectIfAuthenticated(null)` runs → `auth()` returns the
  live session (with `user` defined and tokenVersion-checked) →
  `pickPostLoginPath(null)` returns `DEFAULT_POST_LOGIN_PATH =
  "/bureau"` → `redirect("/bureau")` throws the `NEXT_REDIRECT`
  signal → Next intercepts and serves a 307 → browser follows.
  Anonymous user navigates to `/login` → `auth()` returns
  `null` → helper returns `void` → page render continues to
  the existing JSX with the LoginForm in its Suspense boundary.
  Signed-in user with `?callbackUrl=/bureau/unlock?code=ABC` →
  same trace but `pickPostLoginPath` echoes the path back →
  redirect to `/bureau/unlock?code=ABC`. Off-origin
  `?callbackUrl=https://evil.com/steal` → `pickPostLoginPath`
  rejects (URL origin shifts off `http://localhost`) → falls
  back to `/bureau`.
- **Anomalies:** none. The `string | string[]` shape for
  `callbackUrl` matches Next 15+'s convention for repeated query
  params; arrays are silently dropped as malformed (a query
  string like `?callbackUrl=A&callbackUrl=B` is extremely unusual
  in normal traffic and is a reasonable signal of tampering or
  developer error rather than legitimate use).

### Fix 2 — _this commit_ Batch 10 report + observations

- **Applied:** yes. 2 new files under `audits/`.
  - `audits/BATCH_10_REPORT.md` — this file.
  - `audits/BATCH_10_OBSERVATIONS.md` — design rationale, Navbar
    status note, no-scope-creep declarations, carry-forward items
    unchanged from Batch 9b.

## Final verification

- `git log --oneline -2` (after this commit lands):

  ```
  <docs commit hash> docs(audit): batch 10 report + observations
  e258ff3 feat(auth): redirect signed-in users away from auth pages
  ```

- `git status`: clean (after this commit lands; the three
  `audits/FIX_PROMPT_BATCH_*.md` files remain untracked at the
  repo root per pattern).
- `npx tsc --noEmit`: passed (no output).
- `npx vitest run`: 24 files / 194 tests passed (184 + 10 new).
- `npm run build`: clean. Only the pre-existing Next 16
  `middleware → proxy` deprecation notice and the harmless pg
  SSL informational line.
- `git diff e4740f6..main --stat` shows exactly the files Fix 1
  and Fix 2 authorized:

  ```
   app/forgot-password/page.tsx            (Fix 1)
   app/login/page.tsx                      (Fix 1)
   app/register/page.tsx                   (Fix 1)
   app/reset-password/page.tsx             (Fix 1)
   audits/BATCH_10_OBSERVATIONS.md         (Fix 2, new)
   audits/BATCH_10_REPORT.md               (Fix 2, new)
   lib/auth-helpers.ts                     (Fix 1)
   tests/routes/auth-redirect.test.ts      (Fix 1, new)
  ```

`audits/FIX_PROMPT_BATCH_9.md`, `audits/FIX_PROMPT_BATCH_9B.md`,
and `audits/FIX_PROMPT_BATCH_10.md` remain untracked at the repo
root — intentionally not committed in this batch.

No scope creep. No migrations. No new dependencies. No env changes.
No pushes. Auth-form pages now consistently bounce signed-in
visitors back to `/bureau` (or to a sanitized callbackUrl).

## Operator action

Run `git push`. **No `prisma migrate deploy` needed** — this batch
is pure code, no schema change.
