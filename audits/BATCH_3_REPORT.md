# BATCH 3 — FIX REPORT (JWT session invalidation)

Three commits applied surgically to `main`, one logical change per commit, on
a previously clean tree (head `1aed31d`). No pushes to remote. The Postgres
migration has been hand-written but **NOT** applied to any database.

## Migration apply notes (read first)

A new Prisma migration was created at:

```
prisma/migrations/20260427210000_add_user_token_version/migration.sql
```

Contents (one statement):

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
```

Apply against Neon with:

```
npx prisma migrate deploy
```

This requires `DIRECT_URL` (or `DATABASE_URL` as fallback per
`prisma.config.ts`) to point at the production Neon DB. The `assertSafeEnv`
guard family does not gate `prisma` commands — apply carefully and
intentionally. `npx prisma generate` has already been run locally; running
it again on the deploy host is harmless.

The column is `NOT NULL DEFAULT 0`, so existing rows backfill to `0`. No
down-migration is needed (Prisma does not generate them).

## Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `87cf012` | feat(schema): add User.tokenVersion for session invalidation |
| 2 | `5853ef7` | fix(security): invalidate JWT sessions on password reset |
| 3 | `dc010a8` | test(security): cover tokenVersion increment on password reset |

## Baselines

- Pre-flight tree: clean on `main`, head `1aed31d` (`docs(audit): batch 3
  fix prompt (JWT session invalidation)`). The prompt envisaged head
  `8ba5ca6` but the two later docs commits (`6677d41` checkpoint and
  `1aed31d` Batch 3 prompt commit) sit above it; all five Batch 1 + five
  Batch 2 fix commits are present below the docs commits exactly as the
  spec required.
- Pre-flight `npx tsc --noEmit`: passed.
- Pre-flight `npx vitest run`: 21 files, 160 tests passed.
- `prisma/migrations/migration_lock.toml` confirmed `provider = "postgresql"`.

## Per-commit results

### Commit 1 — `87cf012` `feat(schema): add User.tokenVersion`
- Applied: yes.
  - `prisma/schema.prisma`: added `tokenVersion Int @default(0)` to the
    `User` model, immediately after `passwordResetExpiresAt`. Indentation
    matches the surrounding right-aligned style.
  - `prisma/migrations/20260427210000_add_user_token_version/migration.sql`:
    new file, single `ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER
    NOT NULL DEFAULT 0;` statement, modelled on the comment style used by
    `20260426163724_add_order_email_tracking` and
    `20260426200000_add_password_reset`.
  - `npx prisma generate` was run; the generated client at
    `generated/prisma/` (gitignored) now exposes `tokenVersion: number` on
    the User type. No DB connection was opened.
- Diff: 2 files, +3 lines.
- `tsc --noEmit`: passed (no code references the new column yet).
- `vitest run`: 160 passed (unchanged from baseline).
- Anomalies: none. The migration timestamp (`20260427210000`) follows the
  spec verbatim — it sits later than the prior latest migration
  (`20260426200000_add_password_reset`) and predates today's date
  (`2026-04-28`), which is acceptable for Prisma's lexicographic ordering.

### Commit 2 — `5853ef7` `fix(security): invalidate JWT sessions on password reset`
- Applied: yes, four files in one commit.
  - `types/next-auth.d.ts`: `tokenVersion?: number` added to `Session.user`,
    `User`, and `JWT` augmentations in both the canonical `@auth/core/*`
    modules and the `next-auth` / `next-auth/jwt` re-exports — six
    addition sites total. **Field is optional (`?:`), not required as the
    spec literally suggested.** See observation #1 for why.
  - `auth.ts`: returned `tokenVersion: user.tokenVersion` from the
    `Credentials` `authorize` callback. The `findUnique({ where: { email } })`
    call has no `select`, so `user.tokenVersion` is already in the result.
  - `auth.config.ts`: three semantic changes per spec.
    - Added `import { prisma } from "@/lib/prisma";` at the top.
    - Added `maxAge: 60 * 60 * 24 * 7, // 7 days` to the `session` block.
    - JWT callback writes `token.tokenVersion = user.tokenVersion;` on
      initial sign-in.
    - Session callback now: early-returns if `!session.user || token.id == null`;
      reads `expectedVersion` as `(token.tokenVersion as number | undefined) ?? 0`;
      looks up `dbUser` via `findUnique({ where: { id: Number(token.id) },
      select: { tokenVersion: true } })`; on mismatch returns
      `{ ...session, user: undefined as unknown as typeof session.user }`
      so guards (`requireSession`, `requireAdmin`, `requireSessionJson`)
      treat it as anonymous; on match populates `id`, `role`, and
      `tokenVersion`. The two ASCII-comment blocks from the spec are
      preserved verbatim.
  - `app/api/reset-password/route.ts`: `tokenVersion: { increment: 1 }`
    appended to the `prisma.user.update({ data: ... })` block. Token
    lookup, expiry check, bcrypt 12 hashing, and the rate-limit gate are
    all unchanged.
- Diff: 4 files, +35 / -3.
- `tsc --noEmit`: passed (after the optional `?:` adjustment described in
  observation #1).
- `vitest run`: 160 passed (unchanged from baseline). The existing
  reset-password test (`tests/api/register.test.ts:342-366`) casts only the
  three previously known fields on `updateCall.data` and asserts only on
  those three — adding a fourth field at runtime did not break the cast or
  the assertions, exactly as the pre-Commit-2 trace predicted.
- Anomalies: see observations #1 (augmentation optionality) and
  #2 (edge-runtime risk for `auth.config.ts` + `prisma`).
- Mental trace confirmed: legacy JWT (no `tokenVersion`) → cast yields
  `0` → DB lookup returns `tokenVersion: 0` (default) → match → session
  populated normally. Fresh sign-in under the new code → JWT carries
  `tokenVersion: N` → DB returns `N` → match → session populated. After
  password reset → user.tokenVersion becomes `N+1` → next session callback
  sees JWT `N` vs DB `N+1` → mismatch → returns `{ ...session, user:
  undefined ... }` → guards redirect to `/login`.

### Commit 3 — `dc010a8` `test(security): cover tokenVersion increment`
- Applied: yes. One new test inserted into `tests/api/register.test.ts`
  immediately after the existing "clears the reset token and expiry after a
  successful reset" test, inside the
  `describe("POST /api/reset-password", ...)` block. The new test
  ("increments tokenVersion to invalidate existing JWT sessions") posts to
  the route with a valid token, captures the `prisma.user.update` argument,
  and asserts `expect(updateArgs.data.tokenVersion).toEqual({ increment: 1
  })`. A fresh user id (`24`) is used so it doesn't share fixture state with
  the surrounding tests.
- Diff: 1 file, +20 lines.
- `tsc --noEmit`: passed.
- `vitest run`: 161 passed (160 baseline + 1 new test).
- Anomalies: none. Behaviour-flip check: removing `tokenVersion: { increment:
  1 }` from `app/api/reset-password/route.ts:57` would leave
  `updateCall.data.tokenVersion === undefined`, and the
  `expect(...).toEqual({ increment: 1 })` would fail — confirming the test
  actually exercises the new behaviour.

## Final verification

- `git log --oneline -10` shows the three new commits (`dc010a8`,
  `5853ef7`, `87cf012`) at the top, in the correct order, sitting above the
  Batch 3 prompt docs commit (`1aed31d`).
- `git status`: clean.
- `npx tsc --noEmit`: passed.
- `npx vitest run`: 21 files, 161 tests passed.
- `git diff main~3 main --stat`:

```
 app/api/reset-password/route.ts                    |  1 +
 auth.config.ts                                     | 30 +++++++++++++++++++---
 auth.ts                                            |  1 +
 .../20260427210000_add_user_token_version/migration.sql |  2 ++
 prisma/schema.prisma                               |  1 +
 tests/api/register.test.ts                         | 20 +++++++++++++++
 types/next-auth.d.ts                               |  6 +++++
 7 files changed, 58 insertions(+), 3 deletions(-)
```

Exactly the seven files the spec authorised. No scope creep.

Ready for human review, migration application, and push.
