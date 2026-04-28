# BLACK LEDGER — FIX MODE, BATCH 3 (JWT session invalidation)

**Paste everything below this line into a fresh Claude Code session running on Opus 4.7. Do not edit it. The session must have read+write access to the project folder. Run on a clean working tree on `main` after Batches 1 and 2 have been merged.**

---

## ROLE AND MANDATE

Same role as Batches 1 and 2 — surgical fix mode, diff-then-apply, tsc + vitest after every edit, one commit per logical change, no push.

**This batch is different from the prior two in three ways. Read carefully:**

1. **It's the first batch that touches the database schema.** You will modify `prisma/schema.prisma` and write a new migration SQL file by hand. You will **NOT** run `npx prisma migrate dev`, `npx prisma db push`, or any other command that connects to a database. The migration is applied manually by the human, after review. The only Prisma command you may run is `npx prisma generate`, which regenerates the local TypeScript client from the schema and requires no DB connection.

2. **It touches NextAuth's auth flow.** Mistakes here log every user out, or worse, fail to log them out when they should be logged out (the bug we're fixing). Diff-before-apply is non-negotiable on every auth-related edit.

3. **It's three commits, not five.** Each commit is larger than Batch 1/2 commits because the fix is logically coupled across files. Commit boundaries are: (1) schema migration, (2) auth flow + reset bump, (3) test.

If you find yourself wanting to do anything not on the list below, write it in `BATCH_3_OBSERVATIONS.md` and move on. The human will triage.

---

## WHAT WE'RE FIXING AND WHY

Verified in `audits/2026-04-27-verification.md` §3. The current auth setup uses NextAuth v5 with `session: { strategy: "jwt" }` and no `maxAge`, defaulting to 30 days. The JWT callback only writes `id`/`role` on initial sign-in. The session callback never re-reads the user from the database. Result: when a user resets their password — typically because they think their account is compromised — their existing JWT cookies stay valid for up to 30 days. The very recovery flow they trust to lock attackers out doesn't.

**The fix:** Add a `tokenVersion` integer column to `User`. Capture it in the JWT on sign-in. On every authenticated request, the session callback compares the JWT's `tokenVersion` against the user's current `tokenVersion` from the database. On password reset, the user's `tokenVersion` is incremented — every existing JWT for that user instantly fails the version check and is treated as anonymous. Also tighten the session `maxAge` to 7 days so dormant sessions die naturally.

Side effect: every authenticated request now does one indexed `User.findUnique({ where: { id }, select: { tokenVersion } })`. That's ~2-5ms on Neon's pooler. Acceptable cost for the security guarantee.

---

## MANDATORY PRE-FLIGHT

1. `git status` → "nothing to commit, working tree clean" on `main`. Stop if not.
2. `git log --oneline -12` should show the most recent commit as `docs(audit): batch 2 report + observations` (`8ba5ca6`), with the five Batch 2 fix commits and the five Batch 1 fix commits all visible above the docs commits. If those aren't present, you're on the wrong branch — stop.
3. `npx tsc --noEmit` → must pass. Note the baseline.
4. `npx vitest run` → must pass. Note the baseline test count (should be 160 in 21 files; if different, that is your new baseline).
5. Verify Prisma is configured for Postgres: `prisma/migrations/migration_lock.toml` should declare `provider = "postgresql"`. If not, stop — something is off.
6. Read in full before editing anything:
   - `audits/2026-04-27-godmode-audit-v1.md`
   - `audits/2026-04-27-godmode-audit-v2.md`
   - `audits/2026-04-27-verification.md` (§3 is the relevant finding)
   - `audits/BATCH_1_REPORT.md`
   - `audits/BATCH_2_REPORT.md`
   - `prisma/schema.prisma` (focus on the `User` model, lines 68-83)
   - All four existing migration files under `prisma/migrations/` — model your new SQL on their style.
   - `auth.ts` and `auth.config.ts` (small files; read both in full)
   - `types/next-auth.d.ts`
   - `app/api/reset-password/route.ts`
   - `lib/auth-helpers.ts`
   - `tests/api/register.test.ts` (focus on the reset-password test block — your test will live here)

---

## OPERATING PRINCIPLES

1. One logical change → one commit. Three commits this batch.
2. Diff before edit. Always show the proposed change before applying.
3. After every edit: `npx tsc --noEmit`. After every commit: `npx vitest run`. Both must be green.
4. **No live database operations.** Schema migrations are hand-written SQL only. The only Prisma command you may run is `npx prisma generate`. Never `migrate dev`, `migrate deploy`, `migrate reset`, `db push`, `db pull`, `db seed`, or `studio`.
5. No new dependencies. No env-var changes. No installations.
6. Do not push to remote. Human reviews and pushes manually.
7. Stop conditions: type error you can't fix in 5 minutes, previously-green test fails non-trivially, file content differs from spec, anything weird with the schema or migration → **stop and report.**

---

## THE THREE COMMITS

### Commit 1 — Schema migration: add `User.tokenVersion`

**Why this is its own commit:** the schema change must land first so Commit 2's TypeScript compiles. Keeping it isolated also means the migration can be reviewed and applied by the human independently of the code change.

**Three things to do, in order.**

#### 1a — Edit `prisma/schema.prisma`

Find the `User` model (around lines 68-83). Add `tokenVersion Int @default(0)` after `passwordResetExpiresAt`. Match the indentation style of the surrounding fields — the file uses spaces, not tabs.

```prisma
// BEFORE (excerpt)
model User {
  id                     Int                 @id @default(autoincrement())
  email                  String              @unique
  name                   String?
  passwordHash           String
  role                   UserRole            @default(INVESTIGATOR)
  createdAt              DateTime            @default(now())
  passwordResetToken     String?             @unique
  passwordResetExpiresAt DateTime?
  ownedCases             UserCase[]
  ...
}

// AFTER
model User {
  id                     Int                 @id @default(autoincrement())
  email                  String              @unique
  name                   String?
  passwordHash           String
  role                   UserRole            @default(INVESTIGATOR)
  createdAt              DateTime            @default(now())
  passwordResetToken     String?             @unique
  passwordResetExpiresAt DateTime?
  tokenVersion           Int                 @default(0)
  ownedCases             UserCase[]
  ...
}
```

Do not change any other field. Do not reorder existing fields.

#### 1b — Hand-write the migration SQL

Create a new directory and file at:

```
prisma/migrations/<timestamp>_add_user_token_version/migration.sql
```

Use a timestamp consistent with the existing migrations' format `YYYYMMDDHHMMSS`. Pick the current date (2026-04-27) plus a sensible time. Example: `20260427210000_add_user_token_version`. The exact time digits don't matter as long as the timestamp is later than `20260426200000_add_password_reset` (the latest existing migration).

Read one of the existing migration SQL files (e.g. `prisma/migrations/20260426200000_add_password_reset/migration.sql`) to match the comment style. The Prisma convention is a `-- AlterTable` comment above the SQL.

Contents:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
```

This is the entire file. Postgres backfills existing rows with `0` because of the `DEFAULT 0` clause. Forward-only; no down migration is needed (Prisma doesn't generate them).

Do **not** create or modify `migration_lock.toml` — the existing one (`provider = "postgresql"`) is correct and shared across all migrations.

#### 1c — Regenerate the Prisma client

Run `npx prisma generate`. This reads `prisma/schema.prisma` and updates the generated client at `generated/prisma/`. The generated folder is gitignored (verified in `.gitignore`) — running this command produces no committed changes. It does, however, update the in-memory TypeScript types so `User.tokenVersion` is now a known field.

**Verification for Commit 1:**

1. `npx tsc --noEmit` → must pass. The new field is now in the generated client; nothing in the existing codebase references `tokenVersion` yet, so type-checking should succeed cleanly.
2. `npx vitest run` → must pass at the same baseline. No test currently asserts on the User schema shape.
3. `git status` should show two changed files: `prisma/schema.prisma` (modified) and `prisma/migrations/<timestamp>_add_user_token_version/migration.sql` (new file).

**Commit message:** `feat(schema): add User.tokenVersion for session invalidation`

After committing, **do not run `npx prisma migrate deploy` or any other apply command.** The human will apply the migration to Neon manually after reviewing the SQL. Until then, the local generated client knows about `tokenVersion` but the live database does not — which is fine because no code in the repo references the column yet either.

---

### Commit 2 — Auth flow: capture, verify, and bump `tokenVersion`

**Why this is its own commit:** four files change together, all in service of the same security behavior. Splitting them across multiple commits would leave intermediate states that don't compile or don't behave correctly.

**Four files to edit.**

#### 2a — `types/next-auth.d.ts` (augment session/JWT/User types)

Read the current file first. It augments NextAuth's types to include `id` and `role` on `User`, `JWT`, and `Session`. Add `tokenVersion: number` to the same three places.

The exact edit depends on the current file's structure. The pattern is to add the new field alongside the existing `id` and `role` augmentations. Mirror the existing style.

#### 2b — `auth.ts` (return `tokenVersion` from `authorize`)

Read the current file. The `authorize` callback fetches the user via `prisma.user.findUnique({ where: { email } })` and returns `{ id, email, name, role }`. Two changes:

1. Update the `select` (or extend the projection if no explicit select is used) so `tokenVersion` is included in the fetched user.
2. Include `tokenVersion: user.tokenVersion` in the returned object.

If the existing query uses `findUnique({ where: { email } })` without a `select`, you can either add a `select` block or just project the field in the return. Either is fine — match the file's existing style.

#### 2c — `auth.config.ts` (capture, verify, set maxAge)

Read the current file. The current implementation has:

```ts
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
```

**Three changes:**

(i) Add `maxAge: 60 * 60 * 24 * 7` to the `session` config block (7 days).

(ii) In the `jwt` callback, capture `tokenVersion` on initial sign-in. The `user` parameter will have `tokenVersion` available now that `auth.ts` returns it. Add `token.tokenVersion = user.tokenVersion;` inside the `if (user)` block.

(iii) In the `session` callback, before populating `session.user.id` / `session.user.role`, look up the user's current `tokenVersion` in the database and compare it against the JWT's `tokenVersion`. If they don't match (or the user no longer exists), clear `session.user` so downstream guards see an unauthenticated session.

The expected new shape:

```ts
import { prisma } from "@/lib/prisma";

export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tokenVersion = user.tokenVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user || token.id == null) {
        return session;
      }

      // Verify the JWT's tokenVersion matches the user's current version.
      // A password reset increments user.tokenVersion, instantly invalidating
      // every existing JWT for that user. Pre-existing JWTs from before the
      // tokenVersion field was introduced have token.tokenVersion === undefined,
      // which we treat as 0 — matching the @default(0) on the column — so
      // existing sessions stay valid until they expire or the user resets.
      const expectedVersion = (token.tokenVersion as number | undefined) ?? 0;
      const dbUser = await prisma.user.findUnique({
        where: { id: Number(token.id) },
        select: { tokenVersion: true },
      });

      if (!dbUser || dbUser.tokenVersion !== expectedVersion) {
        // Stale session — clear user fields so guards (`requireSession`,
        // `requireAdmin`, `requireSessionJson`) treat the request as anonymous.
        return { ...session, user: undefined as unknown as typeof session.user };
      }

      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
};
```

If the existing `auth.config.ts` differs structurally from what's shown above, **mirror the file's actual structure** while making only the three semantic changes (add `maxAge`, capture `tokenVersion` in JWT, verify in session). Do not refactor unrelated code.

Note: importing `prisma` into `auth.config.ts` may or may not work cleanly depending on how the file is consumed by Next.js's edge middleware. If `npx tsc --noEmit` passes after the change, you're fine. If a build-time error appears about edge-incompatible imports, **stop and report** — there's a non-trivial NextAuth pattern (split into a "base" config without DB access for middleware vs a "full" config for server) that requires care, and we'll handle it as a separate decision.

#### 2d — `app/api/reset-password/route.ts` (bump `tokenVersion` on reset)

Read the current file. Find the `prisma.user.update` call (around line 50-57 per the audit). Add `tokenVersion: { increment: 1 }` to the `data` block.

```ts
// BEFORE
await prisma.user.update({
  where: { id: user.id },
  data: {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
  },
});

// AFTER
await prisma.user.update({
  where: { id: user.id },
  data: {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    tokenVersion: { increment: 1 },
  },
});
```

Do not change anything else in this file. The token-lookup, expiry check, bcrypt hashing, and rate limiting all remain untouched.

**Verification for Commit 2:**

1. `npx tsc --noEmit` → must pass. The augmented types from `types/next-auth.d.ts` make `token.tokenVersion`, `user.tokenVersion`, and `session.user.tokenVersion` all type-safe.
2. `npx vitest run` → must pass. Two of the existing register/reset-password tests in `tests/api/register.test.ts` may assert on the **shape of the data passed to `prisma.user.update`** during reset. If a test asserts that the update payload has exactly three fields (`passwordHash`, `passwordResetToken`, `passwordResetExpiresAt`) and now sees a fourth (`tokenVersion`), it will fail. **Read the test file before applying this change.** If a test will fail, stop, show me the exact assertion and the proposed fix (one-line addition to expect the new field), and wait. Don't modify tests during Commit 2 — test changes go in Commit 3.
3. Manual trace: a user signs in → JWT has `tokenVersion: 0` (DB default). Session callback DB-lookup returns `tokenVersion: 0`. Match → session populated. User resets password → `tokenVersion` becomes `1`. Old JWT still has `tokenVersion: 0`. Next session callback: DB returns `1`, JWT has `0`, mismatch → `session.user` cleared → guards redirect to `/login`. Correct.

**Commit message:** `fix(security): invalidate JWT sessions on password reset`

---

### Commit 3 — Test: cover `tokenVersion` increment on password reset

**Why this is its own commit:** the test locks in the behavior of Commit 2 and is the only meaningfully unit-testable piece of the fix (the session-callback DB check requires a full NextAuth context to test, which is outside the scope of this batch's test surface).

**File:** `tests/api/register.test.ts`

Find the existing reset-password test block. There is at least one test that POSTs to `/api/reset-password` with a valid token and asserts the response is 200. Add a new test (or extend an existing one if natural) that asserts: **the `prisma.user.update` call passes `data.tokenVersion: { increment: 1 }` along with the other expected fields.**

The test should mock `prisma.user.findUnique` to return a user with a known token, mock `prisma.user.update` to record its arguments, POST to the route with a valid body, and then assert on the captured `update` arguments.

The exact mocking pattern is whatever the existing reset-password tests in this file already use. Match that pattern. If the existing tests already capture the `update` arguments and assert on them, the safest path is to extend that same assertion block to also assert `expect(updateArgs.data.tokenVersion).toEqual({ increment: 1 })`.

If during Commit 2 you discovered that an existing test was about to break because of the new `tokenVersion` field in the update payload, fix that test in this commit too — but the fix should be a one-line addition to the existing assertion, not a rewrite. If the fix feels larger than that, stop and ask.

**Verification for Commit 3:**

1. `npx tsc --noEmit` → must pass.
2. `npx vitest run` → all tests pass. The new test covers the reset-bump path. The total test count should be the baseline + 1 (or unchanged if you extended an existing test rather than adding a new one).
3. The new test should pass against the Commit 2 implementation. If you flip the `data.tokenVersion: { increment: 1 }` line off in the route handler, this test should fail — verifying it actually tests what it claims.

**Commit message:** `test(security): cover tokenVersion increment on password reset`

---

## FINAL VERIFICATION

1. `git log --oneline -10` shows your three new commits at the top, in order.
2. `git status`: clean working tree.
3. `npx tsc --noEmit`: passes.
4. `npx vitest run`: passes with the same test count as the baseline (or +1 if you added a new test in Commit 3).
5. `git diff main~3 main --stat` should show changes only in:
   - `prisma/schema.prisma`
   - `prisma/migrations/<timestamp>_add_user_token_version/migration.sql` (new file)
   - `auth.ts`
   - `auth.config.ts`
   - `types/next-auth.d.ts`
   - `app/api/reset-password/route.ts`
   - `tests/api/register.test.ts`
   
   Seven files. If anything else shows up, you've broken the no-scope-creep rule.

6. **Do not push.** **Do not run `npx prisma migrate deploy`.** The human will: review the diff, apply the migration to Neon manually (via Prisma's deploy command or via Neon's console), then push the commits.

---

## REPORT

When all three commits are committed and the final verification is green, write `BATCH_3_REPORT.md` at the repo root with:

- The three commit hashes
- Per commit: confirmed-applied, tsc result, vitest result, any anomalies
- A `## Migration apply notes` section near the top with instructions for the human:
  - The exact migration filename you created
  - The contents of the SQL (one-liner)
  - The recommended apply command: `npx prisma migrate deploy` (this requires `DIRECT_URL` to point at the production Neon DB; the `assertSafeEnv` family doesn't gate `prisma` commands, so the human must apply the migration carefully and intentionally)
  - A note that `npx prisma generate` has already been run locally; running it again on the deploy host is harmless
- Anything unexpected goes in `BATCH_3_OBSERVATIONS.md` separately.
- "Ready for human review, migration application, and push." as the final line.

Then stop. Do not start Batch 4. Wait for the human.

---

## HARD RULES (re-read before you begin)

- One commit per logical change. Three commits this batch.
- Diff before edit. Always.
- No live database operations. Hand-written migration SQL only. `npx prisma generate` is the only Prisma command authorized.
- No new dependencies. No env-var changes.
- Do not push to remote. Do not apply the migration to any database.
- If `auth.config.ts` produces edge-runtime build errors after importing `prisma`, stop and report. Do not improvise a split-config workaround.
- If anything is weird, stop. The human will help.

Begin Commit 1.
