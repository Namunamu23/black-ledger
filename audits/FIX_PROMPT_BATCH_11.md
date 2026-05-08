# BATCH 11 — FIX PROMPT (case-insensitive account-deletion confirmation)

You are a fresh Claude Code session running on Opus 4.7. Apply two commits: one feat commit relaxing the account-deletion confirmation phrase to be case-insensitive (and trim leading/trailing whitespace), plus one final report commit. No scope creep. No migrations. No new dependencies.

This batch closes a small UX friction the operator noticed in dogfooding: the account-deletion confirmation field requires the user to type the exact lowercase phrase `delete my account`. Variants like `"Delete My Account"`, `"DELETE MY ACCOUNT"`, or `" delete my account "` (with stray whitespace) all silently fail to enable the submit button — the user types what looks correct but the form never lets them proceed. The fix relaxes both layers (form + server validator) to be case-insensitive and whitespace-tolerant on the outer edges, while keeping the literal phrase strictly identical otherwise (no internal-whitespace collapse, no different phrase variants).

The phrase confirmation is intentional friction against accidental deletion (e.g., unattended browser, prankster friend). The actual security gate is the password re-auth via bcrypt. Relaxing case-sensitivity does not weaken the security model — a typo-resistant speed bump is still a speed bump.

Read this prompt first. Then read `audits/BATCH_10_REPORT.md` for house style and the post-Batch-10 baseline. Then begin.

---

## 1. Operating principles

1. **Two commits.** Subjects pre-written below — use verbatim.
2. **No migrations.** Pure code change.
3. **No new dependencies.**
4. **No scope creep.** The operator asked for case-insensitivity on the deletion confirmation phrase only. Do NOT modify any other validator, form, or test. Do NOT touch the page copy at `app/account/delete/page.tsx`. Do NOT alter the helper text in the form (`Type delete my account to confirm`) — leaving it lowercase signals canonical form, while the new behavior silently accepts variants.
5. **Mirror normalization on both sides.** Client and server must apply the same transform. If only the client trims+lowercases but the server doesn't, a scripted POST bypassing the UI could break the assumption (or vice versa for divergent UX). Use `.trim().toLowerCase()` in both places, identically.
6. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` passing at the same count or higher.
7. **No env changes, no pushes, no deploys.** The operator runs `git push` after the batch is complete and verified. No migrate-deploy needed.

---

## 2. Pre-flight

```
git rev-parse HEAD                  # at or after `beade07` (Batch 10 docs commit)
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 24 files / 194 tests
```

If any fail, stop. Confirm `audits/BATCH_10_REPORT.md` is on tree.

---

## 3. The two fixes

### Fix 1 — `feat(account): case-insensitive deletion-confirmation phrase`

Three editing operations + new tests, one commit.

**(a) `lib/validators.ts:304-307`** — relax the literal match to a normalize-then-literal pipeline.

Current:
```ts
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete your account."),
  confirmation: z.literal("delete my account"),
});
```

Replacement:
```ts
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete your account."),
  // Case-insensitive + outer-whitespace-tolerant. Internal whitespace is
  // NOT collapsed — "delete  my  account" (double-spaced) still fails.
  // The phrase confirmation is a friction layer against accidental
  // deletion; the password re-auth is the actual security gate, so this
  // relaxation is purely a UX improvement.
  confirmation: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.literal("delete my account")),
});
```

The accompanying comment block above the schema (lines 296-303 today) is still accurate and needs no change — re-read it to confirm before editing. If the existing comment mentions case-sensitivity explicitly, update that one phrasing only; otherwise leave intact.

**(b) `components/auth/DeleteAccountForm.tsx:12-15`** — mirror the normalization in the canSubmit predicate.

Current:
```ts
const canSubmit =
  password.length > 0 &&
  confirmation === "delete my account" &&
  status !== "loading";
```

Replacement:
```ts
const canSubmit =
  password.length > 0 &&
  confirmation.trim().toLowerCase() === "delete my account" &&
  status !== "loading";
```

The visible helper text inside the label (`Type delete my account to confirm`) stays lowercase — that's the canonical form. The new behavior is a quiet "we'll accept whatever you type as long as it normalizes to the canonical form." Don't change the helper text.

**(c) `tests/api/me.test.ts`** — keep all 7 existing tests intact (they should still pass; the canonical lowercase phrase still validates), and add 3 new tests covering the relaxed acceptance and the still-rejecting cases. Tests should mirror the existing pattern (mocked Prisma + bcrypt + signOut, etc.).

Sketch (Claude Code adapts to the project's actual mock patterns by re-reading `tests/api/me.test.ts` first):

```ts
it("accepts uppercase confirmation 'DELETE MY ACCOUNT' (F-X11)", async () => {
  // Re-uses the existing happy-path setup; only the confirmation string differs.
  // Expectation: 200 response, prisma.user.delete called, activationCode.updateMany called.
  // Assert behavior identical to the lowercase-canonical happy path.
});

it("accepts mixed-case confirmation with surrounding whitespace (F-X11)", async () => {
  // confirmation: "  Delete My Account  "
  // Expectation: 200 response, deletion proceeds.
});

it("still rejects a non-canonical phrase variant ('delete account')", async () => {
  // confirmation: "delete account"  // missing "my"
  // Expectation: 400 response, prisma.user.delete NOT called.
  // This guards against accidental over-relaxation of the validator.
});
```

If the existing tests use a shared `setupAuthedRequest` helper or a fixture object for the request body, follow that convention. Adapt the assertion shape to whatever `tests/api/me.test.ts` already does (e.g., if existing tests assert `expect(prismaMock.user.delete).toHaveBeenCalled()`, the new tests should do the same).

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — 194 → 197 (+3 new tests). Existing 7 me.test.ts cases still pass: the canonical lowercase phrase still validates because `"delete my account".trim().toLowerCase() === "delete my account"`.
- Mental trace 1 (canonical happy path, unchanged): user types "delete my account" → form's canSubmit sees `"delete my account".trim().toLowerCase() === "delete my account"` → true → button enabled → submit → server validator transform produces `"delete my account"` → pipes through `z.literal` → matches → deletion proceeds.
- Mental trace 2 (new uppercase happy path): user types "DELETE MY ACCOUNT" → form's canSubmit normalizes to `"delete my account"` → matches → button enabled → submit → server transform also normalizes → literal match passes → deletion proceeds.
- Mental trace 3 (still-rejecting case, e.g. typo): user types "delete account" → canSubmit normalizes to `"delete account"` → does NOT equal `"delete my account"` → button disabled → can't submit → no server hit. Even if a script bypasses the UI and POSTs `{confirmation: "delete account"}`, the server transform produces `"delete account"`, which does not match the literal → 400.

**Commit subject:** `feat(account): case-insensitive deletion-confirmation phrase`

---

### Fix 2 — `docs(audit): batch 11 report + observations`

Two new files mirroring the BATCH_10 structure.

**`audits/BATCH_11_REPORT.md`** — short report (~100-150 lines):

- Pre-flight tree state.
- 1-row commit table for Fix 1.
- Per-fix detail block: applied yes/no, files touched, diff stats, tsc + vitest deltas (194 → 197), three mental traces from above.
- Final verification gate output.

**`audits/BATCH_11_OBSERVATIONS.md`** — short, ~60-80 lines:

1. **Why we relaxed only outer whitespace + case, not internal whitespace.** "delete  my  account" (double-spaced) still fails — that's a deliberate phrase change, not a typing variation. Internal whitespace collapse would be a different policy decision and would slightly weaken the speed-bump.
2. **Why the fix is mirrored on both layers.** If only the client normalized, a script bypassing the UI could submit the canonical form directly — fine, no behavior change. If only the server normalized, the form would fail to enable the submit button on uppercase input and the user would think it's broken. Mirroring keeps both UX (form gates uppercase identically to lowercase) and security (server enforces the same canonical form regardless of input shape).
3. **Helper text is intentionally still lowercase.** `Type delete my account to confirm` stays as the canonical signal. The relaxation is silent — users who type variants discover it just works.
4. **Carry-forward items** unchanged from Batch 10: Sentry, CSP nonce migration, app/layout.tsx auth() per-render, forgot-password timing leak, /bureau/database admin pagination, error.tsx absence, R2 ContentLength alternative paths, F-04 lawyer brief pending.

**Commit subject:** `docs(audit): batch 11 report + observations`

Then stop. Do not push.

---

## 4. Final verification gate

After both commits are on tree:

```
git log --oneline -2                # Fix 1 + Fix 2 in order
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 197 tests passing (194 + 3 new)
npm run build                       # clean (only the pre-existing pg SSL informational notice)
git diff beade07..main --stat
```

Expected files touched:

```
lib/validators.ts                                           (Fix 1)
components/auth/DeleteAccountForm.tsx                       (Fix 1)
tests/api/me.test.ts                                        (Fix 1)
audits/BATCH_11_REPORT.md                                   (Fix 2, new)
audits/BATCH_11_OBSERVATIONS.md                             (Fix 2, new)
```

If any other file is in the diff, restore it before declaring done.

---

## 5. Begin

Read `audits/BATCH_10_REPORT.md` for house style. Read `lib/validators.ts:295-310` to confirm the current schema shape and surrounding comment block. Read `components/auth/DeleteAccountForm.tsx` to confirm the canSubmit predicate location. Read `tests/api/me.test.ts` end-to-end to mirror its mock conventions before adding the three new tests.

Then start with Fix 1 — validator change, form change, three new tests. Verify tsc + vitest clean. Commit. Then Fix 2 — write the two report files, verify, commit.

When you finish, surface the operator-action callout in your closing message: **"Run `git push`. No `prisma migrate deploy` needed — this batch is pure code, no schema change."**

Done.
