# BATCH 1 — FIX REPORT

Five fixes applied surgically to `main`, one commit per fix, on a previously
clean tree (commit `fc6bb58`). No pushes to remote.

## Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `b058c01` | fix(scripts): add assertSafeEnv guard to seed-global-people |
| 2 | `8f7c343` | fix(scripts): add assertSafeEnv guard to unarchive-case |
| 3 | `84985ee` | fix(security): prevent CSV formula injection in activation-code export |
| 4 | `1e1b61c` | fix(stripe): pin apiVersion to prevent silent SDK-upgrade drift |
| 5 | `3ce8776` | fix(security): stamp activation-code revokedAt server-side |

## Baselines

- Pre-flight tree: clean on `main`, head `fc6bb58`.
- Pre-flight `npx tsc --noEmit`: passed.
- Pre-flight `npx vitest run`: 21 files, 160 tests passed.

## Per-fix results

### Fix 1 — assertSafeEnv guard in `scripts/seed-global-people.ts`
- Applied: yes. One import added, one `assertSafeEnv("seed-global-people")`
  call added immediately after the two `dotenv.config(...)` lines. Pattern
  mirrors `scripts/create-admin.ts` exactly.
- Diff: 1 file, +3 lines.
- `tsc --noEmit`: passed.
- `vitest run`: 160 passed.
- Anomalies: none.

### Fix 2 — assertSafeEnv guard in `scripts/unarchive-case.ts`
- Applied: yes. Same pattern as Fix 1, with the `assertSafeEnv` import placed
  alongside the existing `prisma` import (after the dotenv calls, since this
  script imports prisma after dotenv runs). `CASE_ID = 3` left untouched.
- Diff: 1 file, +3 lines.
- `tsc --noEmit`: passed.
- `vitest run`: 160 passed.
- Anomalies: none.

### Fix 3 — CSV formula-injection protection in `csvEscape`
- Applied: yes. `csvEscape` in `app/api/admin/cases/[caseId]/codes/route.ts`
  replaced with the spec's version that prefixes cells beginning with
  `=`, `+`, `-`, `@`, `\t`, or `\r` with a single quote before the
  comma/quote/newline wrap step.
- Diff: 1 file, +8 / -3.
- `tsc --noEmit`: passed.
- `vitest run`: 160 passed.
- Anomalies: no existing test covers the CSV path
  (`tests/api/admin-codes.test.ts` exercises POST batch generate and PATCH
  revoke, not the GET `?format=csv` branch). Mental trace of the new
  function against `=cmd|/c calc` confirmed: matches `^=` → prefixed to
  `'=cmd|/c calc` → no comma/quote/newline → returned unwrapped.

### Fix 4 — Pin Stripe `apiVersion` in `lib/stripe.ts`
- Applied: yes. `new Stripe(secretKey)` replaced with
  `new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia", ... })`. The
  surrounding lazy-singleton structure and the missing-key throw are
  unchanged.
- Diff: 1 file, +3 / -1.
- `tsc --noEmit`: passed.
- `vitest run`: 160 passed (Stripe client is mocked in the suite, so the
  pin is invisible at the test layer).
- Anomalies: the spec's suggested literal `"2024-12-18.acacia"` would not
  have type-checked against the installed SDK. See observations.

### Fix 5 — Stamp `revokedAt` server-side; drop client value
- Applied: yes, two file edits in one commit.
  - `lib/validators.ts`: `revokeCodeSchema` reduced to
    `z.object({}).passthrough()` — keeps the `safeParse()` shape so the
    handler still rejects malformed JSON, while ignoring any
    client-supplied `revokedAt` field.
  - `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts`: the update
    payload now writes `revokedAt: new Date()` instead of
    `new Date(parsed.data.revokedAt)`.
- Diff: 2 files, +2 / -4.
- `tsc --noEmit`: passed.
- `vitest run`: 160 passed. The existing test
  (`tests/api/admin-codes.test.ts:122-142`) asserts only that
  `updateArgs.data.revokedAt` is a `Date` instance, not its value — so the
  server-stamp change required no test updates.
- Anomalies: none. Out-of-scope items the spec explicitly deferred
  (`CaseAudit` write for revoke; cleaning up `RevokeButton` to stop sending
  the now-ignored field) were left untouched.

## Final verification

- `git log --oneline -5` shows the five commits in the expected order.
- `git status`: clean.
- `npx tsc --noEmit`: passed.
- `npx vitest run`: 21 files, 160 tests — same as baseline.
- `git diff main~5 main --stat`:

```
 app/api/admin/cases/[caseId]/codes/[codeId]/route.ts |  2 +-
 app/api/admin/cases/[caseId]/codes/route.ts          | 11 ++++++++---
 lib/stripe.ts                                        |  4 +++-
 lib/validators.ts                                    |  4 +---
 scripts/seed-global-people.ts                        |  3 +++
 scripts/unarchive-case.ts                            |  3 +++
 6 files changed, 19 insertions(+), 8 deletions(-)
```

Exactly the six files the spec authorized. No scope creep.

Ready for human review and push.
