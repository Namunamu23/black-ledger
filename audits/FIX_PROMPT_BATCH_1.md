# BLACK LEDGER — FIX MODE, BATCH 1

**Paste everything below this line into a fresh Claude Code session running on Opus 4.7. Do not edit it. The session must have read+write access to the project folder. Run on a clean working tree.**

---

## ROLE AND MANDATE

You are a senior software engineer in surgical fix mode. The audit phase is over. Your job is to apply five small, mechanical, verified-necessary fixes to this codebase, one at a time, with maximum precision and zero scope creep.

You are not in audit mode. You are not in refactor mode. You are not allowed to "improve" things you didn't come here to fix. If you notice something else wrong, write it in a `BATCH_1_OBSERVATIONS.md` file at the end and let the human triage — do not act on it.

The audit that authorized these fixes is in `audits/`. The findings have already been verified against the actual code. You do not need to re-verify; you need to apply the fix exactly as specified below.

---

## MANDATORY PRE-FLIGHT (do this before touching any code)

1. Confirm the working tree is clean: `git status` must report "nothing to commit, working tree clean" on `main`. If it isn't, stop and tell the human.
2. Confirm you can run the type checker: `npx tsc --noEmit` should succeed before any fix. Note the baseline.
3. Confirm you can run the test suite: `npx vitest run` should pass cleanly. Note the baseline test count.
4. Read the three audit files in full so you understand the context:
   - `audits/2026-04-27-godmode-audit-v1.md`
   - `audits/2026-04-27-godmode-audit-v2.md`
   - `audits/2026-04-27-verification.md`
5. Read `lib/assert-safe-env.ts` so you understand the existing pattern you'll be reusing.
6. Read each target file listed in the fixes below, in full, before editing it. Cite the lines you'll touch.

---

## OPERATING PRINCIPLES (read every word)

1. **One fix at a time.** Apply Fix 1, run the type checker, run the tests, commit. Then Fix 2. Then Fix 3. And so on. Do not batch fixes into a single commit. Do not start Fix N+1 before Fix N is committed and green.

2. **Diff-then-apply.** For every change, first read the file, then show me the proposed diff in chat (file path + before/after), then apply the edit. Never edit without showing the diff first.

3. **Run the type checker after every edit.** `npx tsc --noEmit`. If it fails, fix the type error before moving on. Do not commit a type-broken state.

4. **Run the test suite after every fix.** `npx vitest run`. If a previously-passing test now fails, stop, do not commit, and report the failure. Do not "fix" the test by changing its assertions — that's how regressions ship. The test is telling you something. Read it, understand it, and either show me the conflict or revert the fix.

5. **Commit per fix with a precise message.** One fix = one commit. Use the exact message format I give for each fix. Do not push to remote — the human will review and push manually after all five fixes land.

6. **No scope creep.** If the fix is "change line 72," you change line 72. You do not also format the rest of the file, fix the typo on line 95, rename a poorly-named variable, or add a missing JSDoc. Pure surgical edits. Anything else goes in `BATCH_1_OBSERVATIONS.md`.

7. **No new dependencies.** Do not run `npm install`. Do not add packages. Every fix below is achievable with what's already in the lockfile.

8. **No migrations.** None of these five fixes touch the schema. If you find yourself reaching for `prisma migrate`, you've gone off-script — stop.

9. **No environment variable changes.** Do not edit `.env.example`. Do not add new env vars.

10. **Stop conditions.** If at any point: (a) the type checker fails after a fix and you can't see why in 5 minutes, (b) a previously-green test fails for a non-obvious reason, (c) the fix as specified doesn't apply cleanly because the file's content differs from what the spec describes, or (d) anything feels weird — **stop and report.** Do not improvise. The human will investigate.

---

## THE FIVE FIXES

### Fix 1 — Add `assertSafeEnv` to `scripts/seed-global-people.ts`

**Why:** Verified in `audits/2026-04-27-verification.md` §4. The script performs `prisma.personConnection.deleteMany()` and many other destructive operations. If a developer runs it with `DATABASE_URL` pointing at the Neon production database, real data is wiped. Every other destructive script in the repo (`create-admin`, `seed-case-file`, `reset-case-progress`, `test-full-flow`) calls `assertSafeEnv` immediately after dotenv. This script was missed.

**File:** `scripts/seed-global-people.ts`

**Change:** Add an `assertSafeEnv` import and call it immediately after `dotenv.config(); dotenv.config()`. The exact pattern is taken from `scripts/create-admin.ts` — read that file first to mirror its style precisely.

**Expected diff shape:**

```ts
// BEFORE (lines 1-5)
import dotenv from "dotenv";
import { prisma } from "../lib/prisma";

dotenv.config({ path: ".env.local" });
dotenv.config();

// AFTER
import dotenv from "dotenv";
import { prisma } from "../lib/prisma";
import { assertSafeEnv } from "../lib/assert-safe-env";

dotenv.config({ path: ".env.local" });
dotenv.config();

assertSafeEnv("seed-global-people");
```

(Match the exact import-path style used by the other guarded scripts. If they import from `"../lib/assert-safe-env"`, use that. Do not invent a different path.)

**Verification:** After editing, run `npx tsc --noEmit`. Then run a dry test: in a separate terminal mentally simulate `DATABASE_URL=postgresql://...neon.tech/...` — `assertSafeEnv` should throw before any DB call. You don't need to actually run the script; the type check is sufficient.

**Commit message:** `fix(scripts): add assertSafeEnv guard to seed-global-people`

---

### Fix 2 — Add `assertSafeEnv` to `scripts/unarchive-case.ts`

**Why:** Verified in `audits/2026-04-27-verification.md` §4. The script hardcodes `CASE_ID = 3` and runs `prisma.caseFile.update({ workflowStatus: "PUBLISHED" })`. Unguarded against production. Same class of bug as Fix 1.

**File:** `scripts/unarchive-case.ts`

**Change:** Add the same `assertSafeEnv` import and call as Fix 1. Place the guard call immediately after the dotenv calls and before the `import { prisma }` line is reached at runtime — so structurally, after both `dotenv.config(...)` lines.

**Expected diff shape:**

```ts
// BEFORE
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { prisma } from "../lib/prisma";

const CASE_ID = 3; // change this if needed

// AFTER
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { assertSafeEnv } from "../lib/assert-safe-env";
import { prisma } from "../lib/prisma";

assertSafeEnv("unarchive-case");

const CASE_ID = 3; // change this if needed
```

Do not change `CASE_ID = 3` to a CLI argument in this commit — that's a separate (P3) improvement listed in the audit. Out of scope here.

**Verification:** `npx tsc --noEmit`.

**Commit message:** `fix(scripts): add assertSafeEnv guard to unarchive-case`

---

### Fix 3 — Add CSV formula-injection protection to `csvEscape`

**Why:** Verified in `audits/2026-04-27-verification.md` §7. The current `csvEscape` only handles `,`, `"`, and `\n`. Cells beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` are interpreted as formulas in Excel, Numbers, and Google Sheets. Today's exposure is low (no free-form fields reach the CSV), but the fix is trivial and prevents future regressions when a free-form field is added.

**File:** `app/api/admin/cases/[caseId]/codes/route.ts`

**Change:** Replace the `csvEscape` function (lines 72-77) with a version that prefixes cells starting with formula-trigger characters using a single quote `'`. The function signature must stay identical (takes `string`, returns `string`).

**Expected new function:**

```ts
function csvEscape(value: string): string {
  // Prefix cells beginning with formula-trigger characters to prevent
  // CSV-injection in Excel / Numbers / Google Sheets. The leading apostrophe
  // is the standard mitigation; spreadsheets render the cell as text.
  const needsPrefix = /^[=+\-@\t\r]/.test(value);
  const safe = needsPrefix ? `'${value}` : value;
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
```

Do not change anything else in the file. Do not touch the `GET` handler, the `POST` handler, or the `randomTail` / `buildCode` helpers.

**Verification:**
1. `npx tsc --noEmit`.
2. `npx vitest run` — confirm `tests/api/admin-codes.test.ts` still passes (it tests CSV export). If it fails, the test is asserting the old escape behavior; show me the failure and stop.
3. Mentally trace: a cell with value `=cmd|/c calc` → matches the prefix regex → becomes `'=cmd|/c calc` → no comma/quote/newline → returned as-is. Good.

**Commit message:** `fix(security): prevent CSV formula injection in activation-code export`

---

### Fix 4 — Pin Stripe `apiVersion`

**Why:** Verified in both audits. `new Stripe(secretKey)` with no `apiVersion` parameter defaults to whatever the SDK ships as latest. A future SDK upgrade could silently shift webhook event shapes. Pinning makes upgrades explicit.

**File:** `lib/stripe.ts`

**Change:** Add an `apiVersion` to the `new Stripe(...)` call. The version must be one the installed Stripe SDK (`^22.1.0`) accepts as a valid `apiVersion` literal — TypeScript will tell you immediately if you pick an invalid one.

**How to pick the version:** Open `node_modules/stripe/types/lib.d.ts` (or the closest equivalent) and look at the `LatestApiVersion` type alias. Use exactly that string. If you can't find it quickly, use `"2024-12-18.acacia"` — that is the API version Stripe SDK 22.x was released against. If TypeScript rejects it, switch to whatever the SDK exports as `Stripe.LatestApiVersion`.

**Expected diff shape:**

```ts
// BEFORE (approximately)
const client = new Stripe(secretKey);

// AFTER
const client = new Stripe(secretKey, {
  apiVersion: "2024-12-18.acacia", // pin to SDK 22.x default; bump deliberately on SDK upgrade
});
```

Read the actual `lib/stripe.ts` first — the surrounding code (lazy singleton, error throw on missing env var) must remain untouched.

**Verification:**
1. `npx tsc --noEmit` — must pass. If TypeScript complains that `"2024-12-18.acacia"` is not assignable to `Stripe.LatestApiVersion`, replace it with the value of that type's exported literal.
2. `npx vitest run` — `tests/api/stripe.test.ts` must still pass. The Stripe client is mocked there, so the apiVersion change is invisible to tests.

**Commit message:** `fix(stripe): pin apiVersion to prevent silent SDK-upgrade drift`

---

### Fix 5 — Stamp `revokedAt` server-side; drop client value

**Why:** Verified in `audits/2026-04-27-verification.md` (and called out in both audits). The PATCH endpoint that revokes activation codes currently accepts `revokedAt` as a client-supplied ISO datetime and writes it verbatim to the database. The audit trail must be a server-stamped fact, not a client claim. An admin (or anyone with a stolen admin session) can backdate revocations.

**Two files to change.** Both edits go in a single commit because they're one logical fix.

#### 5a. `lib/validators.ts`

Locate `revokeCodeSchema` (around line 269-271 per audit). Change it from accepting a `revokedAt` field to an empty body schema. Existing clients that still send `{ revokedAt: ... }` will continue to work — Zod will silently strip the unknown field.

**Expected change:**

```ts
// BEFORE
export const revokeCodeSchema = z.object({
  revokedAt: z.string().datetime(),
});

// AFTER
// Body is intentionally empty: revokedAt is stamped server-side to
// guarantee audit-trail integrity. The schema is kept (rather than
// removed) so the route can still call .safeParse() and reject
// malformed JSON bodies.
export const revokeCodeSchema = z.object({}).strict().or(z.object({}));
```

Wait — `.strict().or(z.object({}))` is awkward. Use the simpler form:

```ts
// AFTER (simpler)
export const revokeCodeSchema = z.object({}).passthrough();
```

The `.passthrough()` means extra fields (like a still-sent `revokedAt`) don't cause the parse to fail — they're just ignored. Existing clients keep working.

#### 5b. `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts`

Locate the PATCH handler (around line 23-49 per audit). Find the `prisma.activationCode.update` call where `data: { revokedAt: new Date(parsed.data.revokedAt) }` lives. Change it to stamp the server clock.

**Expected change:**

```ts
// BEFORE (approximately)
data: { revokedAt: new Date(parsed.data.revokedAt) },

// AFTER
data: { revokedAt: new Date() },
```

If the route also reads `parsed.data.revokedAt` anywhere else, remove those reads — the field no longer exists on the parsed type. If it doesn't compile, follow the type error to find the references.

**Do NOT** in this commit:
- Add a `CaseAudit` write for the revoke action (audit calls this out as missing — true, but separate fix)
- Modify the `RevokeButton` client component (it can keep sending the now-ignored `revokedAt`; cleaning that up is a separate cosmetic fix)
- Change the route's response shape

**Verification:**
1. `npx tsc --noEmit` — must pass cleanly.
2. `npx vitest run` — `tests/api/admin-codes.test.ts` covers the revoke flow. If it sends a `revokedAt` field in the request body, it should still pass (`.passthrough()` ignores it). If it asserts on the *value* of `revokedAt` matching what the client sent, that assertion will now fail because the server is stamping `Date.now()`. In that case, the test was asserting the bug — update it to assert that `revokedAt` is *recent* (within the last few seconds) rather than equal to the client value. If the test change feels larger than 1-2 lines, stop and ask.

**Commit message:** `fix(security): stamp activation-code revokedAt server-side`

---

## FINAL VERIFICATION (after all five commits land)

1. `git log --oneline -5` should show your five commits in order.
2. `git status` should report a clean working tree.
3. `npx tsc --noEmit` should pass.
4. `npx vitest run` should pass with the same number of green tests as the baseline (or the baseline plus any test count adjustments you made for Fix 5).
5. `git diff main~5 main --stat` should show changes only in: `scripts/seed-global-people.ts`, `scripts/unarchive-case.ts`, `app/api/admin/cases/[caseId]/codes/route.ts`, `lib/stripe.ts`, `lib/validators.ts`, `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts`. If any other file shows up in that diff, you've broken the no-scope-creep rule — explain why.
6. **Do not push.** The human will review your five commits and push manually.

---

## REPORT

When all five fixes are committed and the final verification is green, write a short `BATCH_1_REPORT.md` at the repo root with:

- The five commit hashes
- Per fix: confirmed-applied, tsc result, vitest result, any anomalies
- Anything unexpected you observed (these go in `BATCH_1_OBSERVATIONS.md`, not the report)
- "Ready for human review and push." as the final line

Then stop. Do not start Batch 2. Do not look ahead. Do not propose follow-up work. Wait for the human.

---

## HARD RULES (re-read before you begin)

- One fix → one commit → one verified-green state.
- Diff before edit. Always.
- No scope creep. No opportunistic refactors. No "while I'm here" cleanups.
- No new dependencies. No schema migrations. No env-var changes.
- Do not push to remote.
- If anything is weird, stop. The human will help.
- Plain markdown report at the end. No emojis. No filler.

Begin Fix 1.
