# UX BATCH — Database Terminal: commit UI redesign + refactor seed script

You are a fresh Claude Code session running on Opus 4.7. Apply the two commits below, in order, on the existing working tree state. No new dependencies. No migrations. No pushes. No running of any seed scripts.

The working tree currently has uncommitted changes from a Cowork session that redesigned `/bureau/database` into a detective-terminal search UI. Your job is to commit those cleanly, then refactor `scripts/seed-global-people.ts` so it's idempotent and safe to run against any environment.

---

## 1. Operating principles

1. **Two commits, no scope creep.** Subjects pre-written below — use verbatim.
2. **No `npm install`, no migrations, no `npm run seed:people`, no pushes.** The user runs the seed themselves after review.
3. **Verify after every edit.** `npx tsc --noEmit` must exit clean. After Fix 2's edits, also run `wc -l scripts/seed-global-people.ts` — the file must have grown to ~920 lines (original was 890; the edits add ~30 lines net). If `wc -l` shows < 900 lines, the Edit tool truncated the file — STOP, run `git checkout HEAD -- scripts/seed-global-people.ts`, and report. Do not retry blindly. (A prior Cowork session hit this exact truncation twice on this file.)
4. **No env changes, no `.env.local` writes.**

---

## 2. Pre-flight

```
git rev-parse HEAD
git status
npx tsc --noEmit
wc -l scripts/seed-global-people.ts
```

Expected `git status`:

- `M  app/bureau/database/page.tsx`
- `??  app/bureau/database/actions.ts`
- `??  components/bureau/GlobalPeopleSearchTerminal.tsx`
- `D  components/bureau/GlobalPeopleSearch.tsx`
- `scripts/seed-global-people.ts` should be UNTOUCHED (no entry).

Expected baseline:

- `npx tsc --noEmit` clean.
- `wc -l scripts/seed-global-people.ts` reports `890`.

If anything else is dirty in the working tree, stop and report.

---

## 3. Fix 1 — Commit the Database UI redesign as-is

Stage and commit the four already-modified files. The redesign was implemented in a Cowork session: empty terminal initial state, server-action-driven search, "Open File →" CTA on result cards. Closes the deferred Cowork audit P2-8 (`/bureau/database` unbounded findMany on page load).

Stage:

```
git add app/bureau/database/page.tsx
git add app/bureau/database/actions.ts
git add components/bureau/GlobalPeopleSearchTerminal.tsx
git add components/bureau/GlobalPeopleSearch.tsx
```

(The last `git add` stages the deletion. `git status` after these adds should show all four as staged with no unstaged changes related to `/bureau/database`.)

Verify staged content:

```
git diff --staged --stat
```

Expect: 3 files added, 1 deleted, page.tsx modified.

**Commit subject:** `feat(database): bureau identity search terminal — server action + client component + thin page shell`

After the commit, `npx tsc --noEmit` should still pass.

---

## 4. Fix 2 — Refactor `scripts/seed-global-people.ts` to be idempotent and prod-safe

Two surgical edits, applied sequentially. Verify line count after each.

### Edit A — Replace `assertSafeEnv` with opt-in flag + docstring

Find the **exact** 8-line block at the top of the file:

```ts
import dotenv from "dotenv";
import { prisma } from "../lib/prisma";
import { assertSafeEnv } from "../lib/assert-safe-env";

dotenv.config({ path: ".env.local" });
dotenv.config();

assertSafeEnv("seed-global-people");
```

Replace with:

```ts
/**
 * GlobalPerson reference-data seed.
 *
 * Source of truth for the bureau identity index that /bureau/database queries.
 * Idempotent: each identity is `upsert`-ed by its unique bureauId, and every
 * destructive operation (per-person sub-tables, person-to-person connections)
 * is scoped to people defined in this seed. Re-running converges the database
 * to whatever this file declares without leaking duplicates and without
 * touching connections involving people added outside the seed.
 *
 * Safety gate: requires explicit opt-in via BL_ALLOW_GLOBAL_PEOPLE_SEED=true.
 * This replaces the older URL-pattern `assertSafeEnv` block — too blunt to
 * allow legitimate production seeding even though the script's writes are
 * fully scoped.
 *
 * Usage:
 *
 *     BL_ALLOW_GLOBAL_PEOPLE_SEED=true npm run seed:people
 */

import dotenv from "dotenv";
import { prisma } from "../lib/prisma";

dotenv.config({ path: ".env.local" });
dotenv.config();

const ALLOW_FLAG = "BL_ALLOW_GLOBAL_PEOPLE_SEED";

if (!process.env[ALLOW_FLAG]) {
  console.error(
    "\n  Refusing to run without explicit opt-in.\n\n" +
    "  This script seeds the GlobalPerson bureau identity index used by\n" +
    "  /bureau/database. It is idempotent and safe to run against any\n" +
    "  environment, but the explicit flag prevents accidental invocation.\n\n" +
    `  Set ${ALLOW_FLAG}=true and re-run:\n\n` +
    `    ${ALLOW_FLAG}=true npm run seed:people\n`
  );
  process.exit(1);
}
```

After this edit:

- `wc -l scripts/seed-global-people.ts` must show between **920 and 925**. If it shows < 900 or > 950, the file was truncated or duplicated — STOP, run `git checkout HEAD -- scripts/seed-global-people.ts`, and report.
- `npx tsc --noEmit` must pass.

### Edit B — Scope the unconditional `personConnection.deleteMany`

Find the **exact** 1-line statement (it appears once in the file, around the original line 860, will have shifted after Edit A):

```ts
  await prisma.personConnection.deleteMany();
```

Replace with:

```ts
  // Scoped delete: only wipe connections involving a person we are about
  // to seed. Connections between two non-seeded people (e.g. ones an admin
  // added manually) are preserved. This is what makes the script safe to
  // re-run against production without nuking unrelated data.
  const seededPersonIds = Array.from(peopleByBureauId.values());
  if (seededPersonIds.length > 0) {
    await prisma.personConnection.deleteMany({
      where: {
        OR: [
          { sourcePersonId: { in: seededPersonIds } },
          { targetPersonId: { in: seededPersonIds } },
        ],
      },
    });
  }
```

After this edit:

- `wc -l scripts/seed-global-people.ts` must show ~933-940. If < 925, truncation again — STOP and `git checkout HEAD -- scripts/seed-global-people.ts`.
- `npx tsc --noEmit` must pass.
- `tail -5 scripts/seed-global-people.ts` must show the original ending of the file:

```
  .finally(async () => {
    await prisma.$disconnect();
  });
```

If it doesn't, the file was truncated. STOP and restore.

### Stage and commit Fix 2

```
git add scripts/seed-global-people.ts
git diff --staged --stat
```

Expect: 1 file changed, ~50 insertions, ~3 deletions.

**Commit subject:** `refactor(seed): make seed-global-people idempotent and prod-safe via opt-in flag`

---

## 5. Final verification gate

```
git log --oneline -3
git status
npx tsc --noEmit
wc -l scripts/seed-global-people.ts
tail -5 scripts/seed-global-people.ts
```

Expected:

- `git log --oneline -3` shows the two new commits in the order above.
- `git status` shows working tree clean.
- `npx tsc --noEmit` exits clean.
- `wc -l scripts/seed-global-people.ts` reports ~933-940 lines, NOT truncated.
- `tail -5 scripts/seed-global-people.ts` ends with the `.finally()` block exactly as the original did.

If anything fails, do not push. Report.

---

## 6. Stop

Two commits on `main`. Do not push. Do not run any seed scripts. Do not start any next batch. Done.
