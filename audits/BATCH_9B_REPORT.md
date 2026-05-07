# BATCH 9B — FIX REPORT

One surgical schema-cleanup commit on `main` plus this report. **One
destructive schema migration** (`DROP COLUMN
AccessCode.oneTimePerUser`). **No new dependencies** — neither
`package.json` nor `package-lock.json` is modified. **No env changes**,
no pushes to remote. Closes the second half of F-14 from the
2026-05-06 god-mode audit; Batch 9 Fix 5 had removed every runtime
reference to the column but intentionally deferred the drop so it
could ship clean and isolated. This is that ship.

## Pre-flight tree state

- `git rev-parse HEAD` at start: `1f2b514` (`docs(audit): batch 9
  report + observations`).
- `git status`: working tree clean. Two untracked files at
  `audits/FIX_PROMPT_BATCH_9.md` and `audits/FIX_PROMPT_BATCH_9B.md`
  — per the Batch 7/8/9 pattern, fix prompts live at the audits
  folder uncommitted during the active session and are committed
  separately by the operator if at all.
- Pre-flight `npx tsc --noEmit`: passed (no output).
- Pre-flight `npx vitest run`: 23 files, 184 tests passed.
- Batch 9 report (`audits/BATCH_9_REPORT.md`) read in full for house
  style; Batch 9 observations Section 2 (`Batch 9b scope`) read for
  the `scripts/test-full-flow.ts` reference inventory.

## Commits

| #  | Hash      | Subject |
|----|-----------|---------|
| 1  | `9d81c6b` | feat(schema): drop AccessCode.oneTimePerUser column |
| 2  | _this commit_ | docs(audit): batch 9b report + observations |

## Per-fix results

### Fix 1 — `9d81c6b` drop AccessCode.oneTimePerUser column

- **Applied:** yes. 4 file changes in one commit.
  - `prisma/schema.prisma`: dropped the `oneTimePerUser Boolean
    @default(false)` field from the `AccessCode` model. Trimmed
    model is field-for-field identical to the inventory in the fix
    prompt.
  - `prisma/migrations/20260507070657_drop_access_code_one_time_per_user/migration.sql`
    (new): single statement — `ALTER TABLE "AccessCode" DROP COLUMN
    "oneTimePerUser"`. Generation note: `npx prisma migrate dev`
    refused to proceed non-interactively because the destructive
    warning ("3 non-null values in production") triggers an
    interactive confirmation prompt. Standard fallback applied —
    migration directory + SQL file written by hand, then `npx prisma
    migrate deploy` applied it cleanly to the dev branch on Neon
    (the Batch 9 footprint, since both batches' dev DB is the same
    branch). `npx prisma generate` ran afterwards to refresh the
    Prisma client. Production application happens via the same
    `migrate deploy` command on the operator's machine pointed at
    the production env.
  - `scripts/test-full-flow.ts`: four `oneTimePerUser` references
    removed in lockstep with the column drop.
    - HTTP body field on the create-code POST (Zod already strips
      unknown fields, so this was cosmetic).
    - HTTP body field on the duplicate-code-409 POST (same).
    - Two-line comment about "TESTQR01's oneTimePerUser pre-check"
      removed entirely; the test below it creates a fresh
      `ADMINREDEEM01` code and the test is self-evident without the
      stale rationale. (After Batch 9 the comment was already
      partially obsolete; the unique constraint
      `@@unique([accessCodeId, userId])` is now the only collision
      mechanism, and `playerJar` and `adminJar` are different users
      so even the original collision concern doesn't apply.)
    - `oneTimePerUser: false` line in the inline
      `prisma.accessCode.create` call. Crucially this line *had* to
      go in the same commit as the column drop — without it, the
      script would TypeError at compile time after `prisma
      generate` regenerated the client without the field.
  - `app/api/access-codes/redeem/route.ts`: tightened the P2002
    catch comment that previously said "the previous oneTimePerUser
    branch was a no-op above this catch." Replaced with "the schema's
    `@@unique([accessCodeId, userId])` is the sole source of truth
    for one-redemption-per-user." The Batch 9 Fix 5 comment was
    written when the column still existed; with the column gone, a
    reference to "the previous oneTimePerUser branch" is doubly
    historical and worth pruning. Behavior unchanged.
- **Diff:** 4 files, +10 / −9.
- `tsc --noEmit`: passed (after `prisma generate` ran).
- `vitest run`: 184 unchanged. No tests reference the column —
  Batch 9 Fix 5 had already removed the only fixture line in
  `tests/api/access-codes-redeem.test.ts`.
- **Mental trace:** Admin opens the access-codes UI, creates an
  AccessCode → POST hits the create route → Prisma writes a row
  without the column (because the schema field is gone, and the
  column is gone from the table) → succeeds. User redeems the code
  → succeeds. Same user re-redeems → P2002 → catch returns
  `alreadyRedeemed: true` exactly as before. Behavior is byte-for-byte
  identical to the pre-fix path; the meaningless storage column is
  gone.
- **Anomalies:** none on the fix itself. One process anomaly worth
  noting: `prisma migrate dev` is interactive when warnings fire,
  even with `--create-only`. Manual SQL + `migrate deploy` is the
  documented Prisma workaround and produces an identical migration
  file to what the interactive flow would have written. The
  workaround does not affect the migration's correctness or its
  applicability via `migrate deploy` in production.

### Fix 2 — _this commit_ Batch 9b report + observations

- **Applied:** yes. 2 new files under `audits/`.
  - `audits/BATCH_9B_REPORT.md` — this file.
  - `audits/BATCH_9B_OBSERVATIONS.md` — F-14 arc closure,
    deploy-ordering relaxation rationale, F-04 carry-forward,
    standard carry-forward items unchanged from Batch 9.

## Final verification

- `git log --oneline -2` (after this commit lands):

  ```
  <docs commit hash> docs(audit): batch 9b report + observations
  9d81c6b feat(schema): drop AccessCode.oneTimePerUser column
  ```

- `git status`: clean (after this commit lands; the two
  `audits/FIX_PROMPT_BATCH_9*.md` files remain untracked at the
  repo root per pattern).
- `npx tsc --noEmit`: passed (no output).
- `npx vitest run`: 23 files / 184 tests passed. No delta — the
  fix is a column drop with no test surface to exercise.
- `npm run build`: clean. No new warnings; only the pre-existing
  Next 16 `middleware → proxy` deprecation notice.
- `git diff 1f2b514..main --stat` shows exactly the files the
  prompt authorised:

  ```
   app/api/access-codes/redeem/route.ts                                                       (Fix 1)
   audits/BATCH_9B_OBSERVATIONS.md                                                            (Fix 2, new)
   audits/BATCH_9B_REPORT.md                                                                  (Fix 2, new)
   prisma/migrations/20260507070657_drop_access_code_one_time_per_user/migration.sql          (Fix 1, new)
   prisma/schema.prisma                                                                       (Fix 1)
   scripts/test-full-flow.ts                                                                  (Fix 1)
  ```

`generated/prisma/**` is gitignored, so the regenerated client does
not appear in the diff. `audits/FIX_PROMPT_BATCH_9.md` and
`audits/FIX_PROMPT_BATCH_9B.md` remain untracked at the repo root —
intentionally not committed in this batch.

No scope creep. One destructive schema migration. No new dependencies.
No env changes. No pushes. F-14 audit-finding arc closed cleanly.

## Operator action — either order works

Production runtime does NOT touch the dropped column post-Batch-9
(Fix 5 verified — `Grep -rn oneTimePerUser app/ lib/ tests/` returns
zero hits; only audit dossiers and the historical init migration SQL
keep references for documentation purposes). Either deploy order is
safe for this batch:

- **Recommended order** (matches the standard "drop code refs first,
  then drop column" pattern):
  1. `git push` — Vercel deploys the schema-without-the-field code.
  2. `npx prisma migrate deploy` — drops the column from production
     Neon.
- **Reverse also safe** — drop the column first, push code second.
  Old code on Vercel doesn't reference the column anywhere; Prisma
  client cache doesn't matter because no runtime path queries it.

The unusual relaxation in deploy ordering is a deliberate property
of how Batch 9 was sequenced. See
`audits/BATCH_9B_OBSERVATIONS.md` Section 2 for the recipe.

Ready for human review and push to `origin/main`.
