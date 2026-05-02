# BATCH 6 — FIX REPORT

Two surgical fixes applied to `main`, one commit per fix, on a previously
clean tree, plus this report. **No migrations** — schema is untouched.
No `npm install`, no env changes, no pushes to remote. Closes the
Privacy Policy §8 account-deletion commitment that previously had no
implementation in code (filed as P1-7 in
`audits/2026-05-01-godmode-audit.md` and P1-1 in
`audits/2026-05-01-godmode-audit-cowork.md`).

## Pre-flight tree state

- `git rev-parse HEAD` at start: `8e8133c` (`docs(audit): batch 6 fix
  prompt (account deletion endpoint)`). Sits one commit above `0bdd277`
  (the post-Batch-5 + Week-14 docs commit the prompt cites file:line
  against). The Batch 6 prompt commit is purely the dossier write —
  code state is identical to `0bdd277`.
- `git status`: working tree clean.
- Pre-flight `npx tsc --noEmit`: passed (no output).
- Pre-flight `npx vitest run`: 21 files, 161 tests passed.
- Both 2026-05-01 audit dossiers (`audits/2026-05-01-godmode-audit.md`
  and `audits/2026-05-01-godmode-audit-cowork.md`), the Batch 5 report
  (`audits/BATCH_5_REPORT.md`), and the Batch 5 observations
  (`audits/BATCH_5_OBSERVATIONS.md`) all present and read in full
  before starting.

## Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `263dfe3` | feat(account): DELETE /api/me with password re-auth gate |
| 2 | `44fa6fb` | feat(account): /account/delete page + DeleteAccountForm + bureau dashboard link |
| 3 | _this commit_ | docs(audit): batch 6 report + observations |

## Per-fix results

### Fix 1 — `263dfe3` DELETE /api/me with password re-auth gate

- **Applied:** yes. Three file changes in one commit.
  - `lib/validators.ts` — appended `deleteAccountSchema` at the end of
    the file (after `solutionPatchSchema`). Two fields:
    `password: z.string().min(1, "Password is required to delete your
    account.")` and `confirmation: z.literal("delete my account")`.
    Inline comment captures the rationale: confirmation is a UX
    safeguard, password is the actual security gate, and the literal
    validator's default zod error wording is acceptable because the
    form-side UI prevents submit until both fields are correctly
    populated.
  - `app/api/me/route.ts` (new) — `runtime = "nodejs"` pinned (Prisma +
    bcryptjs are not edge-safe). Order of operations in DELETE:
    (1) rate-limit at 3/60s (returns 429 + `Retry-After` header on
    exhaustion); (2) `requireSessionJson()` for 401 on no-session;
    (3) `request.json().catch(() => null)` + `safeParse` for 400 on
    invalid body; (4) `prisma.user.findUnique` with select narrowed to
    `{ id, role, passwordHash }` — no over-fetch, missing-row branch
    returns idempotent 200; (5) ADMIN-role check returns 403 with a
    "contact support" message (admins must email support — see
    Observation 1); (6) `compare(password, passwordHash)` for 401 on
    mismatch; (7) `prisma.user.delete({ where: { id } })` and 200.
    Comment block above the delete enumerates the cascade behaviour
    (UserCase + UserCaseEvent cascade; TheorySubmission cascade;
    CheckpointAttempt cascade; AccessCodeRedemption cascade;
    ActivationCode.claimedByUserId SetNull because the relation is
    optional `User?`; Order has no User FK by design — Batch 5
    deferred Order.userId, so financial records persist for tax
    retention as documented in Privacy §8).
  - `tests/api/me.test.ts` (new) — 7 tests, hoisted-mock pattern from
    `tests/api/register.test.ts:1-85` and the auth() mock convention
    from `tests/api/checkpoint.test.ts:14-47` (`vi.mock("@/auth")` —
    NOT `@/lib/auth-helpers`; `requireSessionJson` calls `auth()`
    internally so an upstream mock flows through cleanly).
- **Diff:** 3 files, +288 / -0.
- `tsc --noEmit`: passed.
- `vitest run`: 22 files / 168 tests passed (was 21 / 161). The 7 new
  tests cover the seven specified paths verbatim; counts match the
  prompt's target exactly.
- **Mental trace per path:**
  1. **401 unauthenticated** — `authFn.mockResolvedValue(null)` →
     `requireSessionJson()` returns a 401 NextResponse →
     `sessionOrErr instanceof NextResponse` short-circuits before
     `findUnique`. Asserted: status 401, neither `findUnique` nor
     `delete` called. ✓
  2. **400 invalid body** — `{confirmation: "delete my account"}` (no
     password) and `{password: "secret", confirmation: "yes please"}`
     (wrong literal) both fail `safeParse`. Asserted: both return 400
     and `delete` is never called across the two arrangements. ✓
  3. **401 wrong password** — `compareFn.mockResolvedValue(false)` →
     route returns 401 with `"Incorrect password."` message.
     Asserted: status 401, message regex `/incorrect password/i`,
     `delete` not called. ✓
  4. **403 ADMIN self-delete refused** — `findUnique` returns
     `{role: "ADMIN", passwordHash: "..."}`. Route's role check trips
     before `compare` runs. Asserted: status 403, `compareFn` not
     called, `delete` not called. Note: the session's `role` field is
     not the deciding factor — the DB lookup is — so the admin path
     is exercised even though `authFn` continues to return an
     INVESTIGATOR-shaped session in this test.
  5. **200 + delete called on happy path** — defaults match
     (INVESTIGATOR, `compare` resolves true). Asserted: status 200,
     `userDelete` called once with `{where: {id: 42}}`.
  6. **200 idempotent when row missing** — `findUnique` returns null.
     Route's "session was valid but row gone — already deleted"
     branch fires. Asserted: status 200, neither `compareFn` nor
     `userDelete` called.
  7. **429 once rate limit exhausted** — three successive valid DELETE
     calls each return 200, fourth returns 429 with a non-empty
     `Retry-After` header. Asserted: 200/200/200/429, header
     truthy. ✓
- **Anomalies:** none. The prompt's test plan listed seven paths but
  bundled (a) "missing password" and (b) "wrong confirmation" under a
  single "400 invalid body" item; the test file consolidates them into
  one `it` block with two arrangements to land exactly on the +7 /
  168-total target the prompt's verification gate specifies.

### Fix 2 — `44fa6fb` /account/delete page + DeleteAccountForm + bureau dashboard link

- **Applied:** yes. Three file changes in one commit.
  - `app/account/delete/page.tsx` (new) — server component,
    `requireSession()`-gated (redirects unauthenticated visitors to
    `/login` via the helper's existing `redirect("/login")` call).
    `<Card variant="dossier" padding="lg">` wraps a "Danger Zone"
    title, two paragraphs summarising what is and isn't deleted (cases
    + theories + checkpoints go; Orders persist per Privacy §8;
    redeemed ActivationCodes are unowned), and the form. `metadata`
    object sets the page title + description.
  - `components/auth/DeleteAccountForm.tsx` (new) — `"use client"`,
    React state for password + confirmation + status + message.
    `canSubmit` gates the submit button on both fields populated AND
    `confirmation === "delete my account"` AND `status !== "loading"`.
    `handleSubmit`: `fetch("/api/me", { method: "DELETE" })` →
    on `!ok`, render the server's message in a `role="alert"` <p>;
    on success, `signOut({ redirectTo: "/" })` (NextAuth v5 idiom,
    mirrors `components/auth/SignOutButton.tsx`). Network error
    branch: catches `fetch` reject and shows a generic message.
  - `app/bureau/page.tsx` — single insertion in the dashboard header
    button-row. Added a `<Link href="/account/delete">` between the
    existing "Archive" link and `<SignOutButton />`. Styling
    deliberately understated: small (px-3 py-1.5 text-xs),
    zinc-500 default, with `hover:border-red-500/40 hover:text-red-300`
    so the danger color only appears on intent-to-click. The link
    doesn't compete with the primary amber/zinc nav.
- **Diff:** 3 files, +143 / -0 (pure additions; no behaviour change to
  existing code paths).
- `tsc --noEmit`: passed.
- `vitest run`: 22 files / 168 tests passed (unchanged from Fix 1's
  count — UI is intentionally not unit-tested in this codebase).
- `npm run build`: clean. The Next route table now includes both
  `/api/me` (ƒ Dynamic) and `/account/delete` (ƒ Dynamic). The
  client component for `DeleteAccountForm` is bundled separately as
  expected for `"use client"`.
- **Mental trace — happy path (UI):** Investigator clicks the small
  "Delete account" link in the bureau header → page loads behind
  `requireSession` → form renders. They type their password, type
  exactly `delete my account`, click submit → fetch DELETE /api/me →
  200 → `signOut({ redirectTo: "/" })` clears the JWT cookie and
  navigates to `/`. The User row + cascades are gone from Neon.
- **Mental trace — wrong password:** Same flow up to submit → fetch
  returns 401 with `{message: "Incorrect password."}` → form sets
  status="error", message="Incorrect password.", renders the alert
  paragraph. Submit button is re-enabled (canSubmit recomputes; status
  flipped back to "error", which is `!== "loading"`). User can retry.
- **Mental trace — already-deleted (idempotent):** Edge case where the
  user's session is valid (tokenVersion check passed because nothing
  bumped it) but the DB row is missing — possible only if an admin
  manually deleted via SQL between session-mint and form-submit. Form
  submits → 200 → signOut → redirect home. No surprise to the user.
- **Anomalies:** none.

### Fix 3 — _this commit_ Batch 6 report + observations

- **Applied:** yes. Two new files under `audits/`.
  - `audits/BATCH_6_REPORT.md` — this file.
  - `audits/BATCH_6_OBSERVATIONS.md` — out-of-scope observations,
    deferral list, Privacy/Terms-of-Service items still open after
    Batch 6.

## Final verification

- `git log --oneline -4` shows the two new fix commits + the prompt
  commit + the docs checkpoint, in expected order:
  ```
  44fa6fb feat(account): /account/delete page + DeleteAccountForm + bureau dashboard link
  263dfe3 feat(account): DELETE /api/me with password re-auth gate
  8e8133c docs(audit): batch 6 fix prompt (account deletion endpoint)
  0bdd277 docs: project state checkpoint after batch 5
  ```
- `git status`: clean.
- `npx tsc --noEmit`: passed (no output).
- `npx vitest run`: 22 files / 168 tests passed (was 21 / 161 — exactly
  +1 file, +7 tests, matching the prompt's target).
- `npm run build`: clean. Only the documented Next 16 `middleware →
  proxy` deprecation notice and the pre-existing benign Prisma SSL
  alias warning; no new warnings introduced.
- `git diff main~3 main --stat` (after this commit lands) is expected to
  show exactly the eight files the prompt authorised:

```
 app/account/delete/page.tsx                    (Fix 2, new)
 app/api/me/route.ts                            (Fix 1, new)
 app/bureau/page.tsx                            (Fix 2)
 audits/BATCH_6_OBSERVATIONS.md                 (Fix 3, new)
 audits/BATCH_6_REPORT.md                       (Fix 3, new)
 components/auth/DeleteAccountForm.tsx          (Fix 2, new)
 lib/validators.ts                              (Fix 1)
 tests/api/me.test.ts                           (Fix 1, new)
```

No scope creep. Schema untouched. Ready for human review and push to
`origin/main`. No operator follow-up required for the new endpoint
itself — see `BATCH_6_OBSERVATIONS.md` for adjacent items deferred to
later batches (admin-deletion path, ActivationCode revoke-on-delete
cascade, post-deletion confirmation email, account-deletion audit log).
