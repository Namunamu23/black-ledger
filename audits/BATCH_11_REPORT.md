# BATCH 11 — FIX REPORT

One surgical UX fix on `main` plus this report. **No migrations.**
**No new dependencies** — neither `package.json` nor
`package-lock.json` is modified. **No env changes**, no pushes to
remote. Closes the small UX friction the operator noticed in
dogfooding: the account-deletion confirmation field accepted only
the exact lowercase phrase `delete my account`, silently failing
on common variants like `Delete My Account`, `DELETE MY ACCOUNT`,
or `  delete my account  ` (stray whitespace).

The phrase confirmation is intentional friction against accidental
deletion. The actual security gate is the password re-auth via
bcrypt. Relaxing case-sensitivity does not weaken the security
model — a typo-resistant speed bump is still a speed bump.

## Pre-flight tree state

- `git rev-parse HEAD` at start: `beade07` (`docs(audit): batch 10
  report + observations`).
- `git status`: working tree had three pre-staged
  `audits/FIX_PROMPT_BATCH_*.md` files in the index (operator
  pre-staging — left untouched throughout this batch by using
  explicit pathspecs on every commit). One untracked
  `audits/FIX_PROMPT_BATCH_11.md` at the repo root, per the
  standard fix-prompt-lives-uncommitted pattern.
- Pre-flight `npx tsc --noEmit`: passed (no output).
- Pre-flight `npx vitest run`: 24 files, 194 tests passed.
- Batch 10 report (`audits/BATCH_10_REPORT.md`) read in full for
  house style; `lib/validators.ts:295-310` re-confirmed for the
  current schema shape and the surrounding comment block;
  `components/auth/DeleteAccountForm.tsx` re-confirmed for the
  `canSubmit` predicate location at lines 12-15;
  `tests/api/me.test.ts` read end-to-end (8 existing tests, not
  the 7 the prompt mentioned — minor doc drift; the relaxation
  doesn't break any of them).

## Commits

| #  | Hash      | Subject |
|----|-----------|---------|
| 1  | `58b2240` | feat(account): case-insensitive deletion-confirmation phrase |
| 2  | _this commit_ | docs(audit): batch 11 report + observations |

## Per-fix results

### Fix 1 — `58b2240` case-insensitive deletion-confirmation phrase

- **Applied:** yes. 3 file changes in one commit.
  - `lib/validators.ts`: relaxed `deleteAccountSchema.confirmation`
    from `z.literal("delete my account")` to a normalize-then-literal
    pipeline:
    ```ts
    confirmation: z
      .string()
      .transform((s) => s.trim().toLowerCase())
      .pipe(z.literal("delete my account")),
    ```
    Added a 5-line inline comment above the `confirmation:` field
    explaining the relaxation, the deliberate non-collapse of
    internal whitespace, and the security-model framing (password
    re-auth is the real gate). The pre-existing block comment
    above the schema (lines 297-303) does not mention
    case-sensitivity, so it was left intact per the prompt's
    instruction.
  - `components/auth/DeleteAccountForm.tsx`: mirrored the
    normalization in the `canSubmit` predicate — changed
    `confirmation === "delete my account"` to
    `confirmation.trim().toLowerCase() === "delete my account"`.
    Visible helper text inside the label
    (`Type delete my account to confirm`) stays lowercase as the
    canonical signal — the relaxation is silent.
  - `tests/api/me.test.ts`: 3 new tests inserted after the
    canonical happy path (test 5), grouped semantically with the
    other happy-path variants:
    - `accepts uppercase confirmation 'DELETE MY ACCOUNT' (Batch
      11 relaxation)` — asserts 200 + `userDelete` called once
      with `{ where: { id: 42 } }`.
    - `accepts mixed-case confirmation with surrounding
      whitespace (Batch 11 relaxation)` — body
      `confirmation: "  Delete My Account  "`, asserts 200 +
      `userDelete` called once.
    - `still rejects a non-canonical phrase variant ('delete
      account')` — asserts 400 + `userDelete` not called. Guards
      against accidental over-relaxation; "delete account"
      normalizes to itself, which does not equal "delete my
      account".
- **Diff:** 3 files, +41 / −2.
- `tsc --noEmit`: passed (no output). Zod's `.transform(...).pipe(...)`
  composition is a standard pattern; the inferred output type
  remains `"delete my account"` (the literal), so no downstream
  type churn.
- `vitest run`: 194 → 197 (+3 new tests). All 8 existing me.test.ts
  cases still pass — the canonical lowercase phrase
  `"delete my account".trim().toLowerCase() === "delete my account"`
  is a fixed point of the normalization.
- **Mental trace 1 (canonical happy path, unchanged):** user types
  `delete my account` → form's `canSubmit` sees
  `"delete my account".trim().toLowerCase() === "delete my account"`
  → `true` → button enabled → submit → server validator's
  `.transform` produces `"delete my account"` →
  `.pipe(z.literal(...))` matches → deletion proceeds.
- **Mental trace 2 (new uppercase happy path):** user types
  `DELETE MY ACCOUNT` → form's `canSubmit` normalizes to
  `"delete my account"` → matches → button enabled → submit →
  server `.transform` also normalizes to `"delete my account"` →
  literal match passes → deletion proceeds. UX is identical to
  the canonical path.
- **Mental trace 3 (still-rejecting case, e.g. typo):** user types
  `delete account` → form's `canSubmit` normalizes to
  `"delete account"` → does NOT equal `"delete my account"` →
  button disabled → can't submit → no server hit. Even if a
  script bypasses the UI and POSTs
  `{ confirmation: "delete account" }`, the server `.transform`
  produces `"delete account"`, which does not match the literal
  → 400. Defense-in-depth holds.
- **Anomalies:** none. The Zod `.transform(...).pipe(...)` pattern
  is well-supported and the inferred parse result type is the
  literal string, so no type regression. The mirrored
  client-side normalization keeps form ergonomics consistent
  with server validation.

### Fix 2 — _this commit_ Batch 11 report + observations

- **Applied:** yes. 2 new files under `audits/`.
  - `audits/BATCH_11_REPORT.md` — this file.
  - `audits/BATCH_11_OBSERVATIONS.md` — design rationale,
    layer-mirroring justification, helper-text decision,
    carry-forward items unchanged from Batch 10.

## Final verification

- `git log --oneline -2` (after this commit lands):

  ```
  <docs commit hash> docs(audit): batch 11 report + observations
  58b2240 feat(account): case-insensitive deletion-confirmation phrase
  ```

- `git status`: clean (after this commit lands, except for the
  three pre-staged `audits/FIX_PROMPT_BATCH_*.md` files left
  untouched in the index by the operator, plus the untracked
  `audits/FIX_PROMPT_BATCH_11.md`).
- `npx tsc --noEmit`: passed (no output).
- `npx vitest run`: 24 files / 197 tests passed (194 + 3 new).
- `npm run build`: clean. Only the pre-existing Next 16
  `middleware → proxy` deprecation notice and the harmless pg
  SSL informational line.
- `git diff beade07..main --stat` shows exactly the files Fix 1
  and Fix 2 authorized:

  ```
   audits/BATCH_11_OBSERVATIONS.md         (Fix 2, new)
   audits/BATCH_11_REPORT.md               (Fix 2, new)
   components/auth/DeleteAccountForm.tsx   (Fix 1)
   lib/validators.ts                       (Fix 1)
   tests/api/me.test.ts                    (Fix 1)
  ```

The pre-staged `audits/FIX_PROMPT_BATCH_9.md`,
`audits/FIX_PROMPT_BATCH_9B.md`, `audits/FIX_PROMPT_BATCH_10.md`
files remain in the operator's staging area (not committed by
this batch); `audits/FIX_PROMPT_BATCH_11.md` remains untracked.

No scope creep. No migrations. No new dependencies. No env
changes. No pushes. The deletion confirmation now silently
accepts case and outer-whitespace variants of the canonical
phrase.

## Operator action

Run `git push`. **No `prisma migrate deploy` needed** — this batch
is pure code, no schema change.
