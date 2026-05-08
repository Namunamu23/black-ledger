# BATCH 9b — FIX PROMPT (drop AccessCode.oneTimePerUser column)

You are a fresh Claude Code session running on Opus 4.7. Apply two commits: one schema-cleanup commit with the destructive migration and all related code references in lockstep, plus one final report commit. No scope creep. **One destructive schema migration.** No new dependencies.

This batch is the second half of Batch 9's F-14 cleanup (2026-05-06 audit finding). Batch 9 Fix 5 removed every code reference to `AccessCode.oneTimePerUser` from runtime paths (validators, admin route, form, panel, redeem route, etc.) but intentionally left the column in `prisma/schema.prisma` and the production database so the destructive `DROP COLUMN` migration could ship clean and isolated. This is that ship.

Read this prompt first. Then read `audits/BATCH_9_REPORT.md` for house style and `audits/BATCH_9_OBSERVATIONS.md` (specifically Section 2 — "Batch 9b scope") for the `scripts/test-full-flow.ts` reference inventory. Then begin.

---

## 1. Operating principles

1. **Two commits.** Subjects pre-written below — use verbatim.
2. **One destructive migration.** Generates a `DROP COLUMN` migration file for `AccessCode.oneTimePerUser`. The column has been unused by runtime code since Batch 9; this is just removing the storage.
3. **No new dependencies.** No `npm install`. Use only what's already in `package.json`.
4. **No scope creep.** The four `oneTimePerUser` references in `scripts/test-full-flow.ts` are explicitly in scope for this batch — they are the last code references in the repo and must go in lockstep with the column drop.
5. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` at 184 tests minimum (no test changes expected — the only test fixture reference was cleaned in Batch 9 Fix 5).
6. **No env changes, no pushes, no deploys.** The operator runs `git push` and `npx prisma migrate deploy` after the batch is complete.

---

## 2. Operator deploy ordering — either order is safe

Production runtime does NOT touch the `AccessCode.oneTimePerUser` column post-Batch-9 (Fix 5 verified — `Grep "oneTimePerUser" app/ lib/ tests/` returns only audit dossier matches and the schema definition itself, no runtime code).

**Recommended order** (matches the standard "drop code references first, then drop column" pattern):
1. `git push` — Vercel deploys the schema-without-the-field code.
2. `npx prisma migrate deploy` — drops the column from production Neon.

**Reverse also safe** — since production runtime doesn't read or write the column, dropping it before pushing the new code produces no observable errors. Old code on Vercel doesn't reference the column; Prisma client cache doesn't matter because no runtime path queries it.

The unusual relaxation in deploy ordering is a deliberate property of how Batch 9 was sequenced. Note this as a "design pays off" win in the BATCH_9B_OBSERVATIONS.

---

## 3. Pre-flight

```
git rev-parse HEAD                  # at or after `1f2b514` (Batch 9 docs commit)
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 23 files / 184 tests
```

If any fail, stop. Confirm `audits/BATCH_9_REPORT.md` and `audits/BATCH_9_OBSERVATIONS.md` are on tree (they should be from Batch 9's Fix 7).

---

## 4. The two fixes

### Fix 1 — `feat(schema): drop AccessCode.oneTimePerUser column`

Three editing operations + one migration generation, all in a single commit.

**(a) `prisma/schema.prisma`** — find the `AccessCode` model (around line 432-444). Drop the `oneTimePerUser Boolean   @default(false)` field line. The trimmed model should look like:

```prisma
model AccessCode {
  id             Int       @id @default(autoincrement())
  code           String    @unique
  kind           AccessCodeKind
  caseFileId     Int
  caseFile       CaseFile  @relation("CaseAccessCodes", fields: [caseFileId], references: [id], onDelete: Cascade)
  unlocksTarget  Json
  requiresStage  Int?
  retiredAt      DateTime?
  createdAt      DateTime  @default(now())
  redemptions    AccessCodeRedemption[]
}
```

**(b) `scripts/test-full-flow.ts`** — find and remove the four `oneTimePerUser` references. Use `Grep -n "oneTimePerUser" scripts/test-full-flow.ts` to locate them precisely (line numbers in the audit observation may have drifted). Per `BATCH_9_OBSERVATIONS.md` Section 2, the inventory is:

- A `oneTimePerUser: ...` field in an HTTP request body for the create-code POST.
- A `oneTimePerUser: ...` field in a duplicate-code-409 POST body.
- A comment mentioning "oneTimePerUser pre-check" (or similar — the exact wording may differ; remove the line and any context that no longer applies).
- A `oneTimePerUser: false` line in a direct `prisma.accessCode.create` call (this would BREAK after the column is dropped if not removed in lockstep — must be deleted in this commit).

Verify completion: `Grep -n "oneTimePerUser" scripts/test-full-flow.ts` should return zero hits after editing.

**(c) Generate the migration:**

```
npx prisma migrate dev --name drop_access_code_one_time_per_user
```

This generates `prisma/migrations/<timestamp>_drop_access_code_one_time_per_user/migration.sql` containing approximately:

```sql
-- AlterTable
ALTER TABLE "AccessCode" DROP COLUMN "oneTimePerUser";
```

It also applies the migration to whatever `DATABASE_URL` points to (your Neon dev branch, which is the same instance as production) and regenerates `generated/prisma/**`.

**Verification before committing:**

- `npx tsc --noEmit` — passes. Prisma client now reflects the field removal; any leftover code reference would surface as a type error here. There shouldn't be any since Batch 9 Fix 5 cleaned them all from runtime paths.
- `npx vitest run` — 184 tests still passing. The test fixture in `tests/api/access-codes-redeem.test.ts` had its `oneTimePerUser: false` line removed in Batch 9 Fix 5; no test references the column.
- `Grep -rn "oneTimePerUser" app/ lib/ tests/ scripts/` should return zero hits across runtime and test code. Hits in `audits/` and `prisma/migrations/20260425045353_init/migration.sql` are historical artifacts and stay (the init migration is the original creation; you don't rewrite migration history).

**Commit subject:** `feat(schema): drop AccessCode.oneTimePerUser column`

---

### Fix 2 — `docs(audit): batch 9b report + observations`

Two new files mirroring the BATCH_9 structure.

**`audits/BATCH_9B_REPORT.md`** — short report (~150-200 lines is plenty). Include:

- Pre-flight tree state (HEAD SHA, working tree status, tsc + vitest counts).
- One-row commit table for Fix 1.
- Per-fix detail block: applied yes/no, files touched, diff stats, tsc + vitest deltas, mental trace ("admin creates an AccessCode → Prisma writes without the column → succeeds; redemption flow runs as in Batch 9 → no behavioral change"), anomalies (none expected).
- Final verification gate output: `git log --oneline -2`, `git status`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `git diff 1f2b514..main --stat`.
- Operator deploy ordering reminder (either order works, with the recommended pattern).

**`audits/BATCH_9B_OBSERVATIONS.md`** — short, ~80-120 lines. Sections:

1. **F-14 closure note** — record that this batch closes the F-14 audit-finding arc cleanly. The flag-was-a-no-op flag is gone, the column it backed is gone, and the unique constraint on `AccessCodeRedemption(accessCodeId, userId)` is now the sole source of truth for one-redemption-per-user enforcement.
2. **Deploy ordering relaxation** — document that this batch's relaxed ordering (either-order-safe) is a property of how Batch 9 was sequenced. Recipe for future destructive migrations: remove all runtime references first in batch N, then drop the column alone in batch N+1. The two-batch pattern lets either deploy order work and isolates blast radius.
3. **F-04 Privacy §6 lawyer brief still pending** — operator action, not code. Carry-forward unchanged from Batch 9.
4. **Carry-forward items** unchanged from Batch 9: Sentry/structured logging, CSP nonce migration, `app/layout.tsx` `auth()` per-render, forgot-password timing leak, `/bureau/database` pagination, error.tsx absence, R2 ContentLength alternative paths, etc.

**Commit subject:** `docs(audit): batch 9b report + observations`

Then stop. Do not push. Do not start any further batch.

---

## 5. Final verification gate

After both commits are on tree:

```
git log --oneline -2                # Fix 1 + Fix 2 in order
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 184 tests passing
npm run build                       # clean (only the pre-existing pg SSL informational notice)
git diff 1f2b514..main --stat
```

Expected files touched:

```
prisma/schema.prisma                                                                       (Fix 1)
prisma/migrations/<timestamp>_drop_access_code_one_time_per_user/migration.sql             (Fix 1, new)
generated/prisma/**                                                                        (Fix 1, regenerated)
scripts/test-full-flow.ts                                                                  (Fix 1)
audits/BATCH_9B_REPORT.md                                                                  (Fix 2, new)
audits/BATCH_9B_OBSERVATIONS.md                                                            (Fix 2, new)
```

If any other file is in the diff, restore it before declaring done.

---

## 6. Begin

Read `audits/BATCH_9_REPORT.md` for house style. Read `audits/BATCH_9_OBSERVATIONS.md` Section 2 for the `scripts/test-full-flow.ts` inventory. Then start with Fix 1 — edit schema + scripts, run `prisma migrate dev`, verify tsc + vitest clean, commit. Then Fix 2 — write the two report files, verify, commit.

When you finish, surface the operator-action callout in your closing message: **"Run `git push` then `npx prisma migrate deploy`. Either order works since runtime doesn't touch the dropped column; recommended order is push first then migrate."**

Done.
