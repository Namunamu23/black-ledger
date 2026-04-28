# BATCH 2 — FIX REPORT

Five fixes applied surgically to `main`, one commit per fix, on a previously
clean tree (commit `f716ff5`). No pushes to remote.

## Commits

| # | Hash | Subject |
|---|------|---------|
| 1 | `0399a57` | fix(security): strip buyer email from checkout success page |
| 2 | `a34a12c` | fix(security): tighten webhook CSRF carve-out to explicit allowlist |
| 3 | `d9b0510` | fix(admin): catch P2002 on case create to return 409 instead of 500 |
| 4 | `f991366` | fix(security): rate-limit checkout/status and admin blurhash routes |
| 5 | `ec6a229` | fix(privacy): generalize duplicate-purchase 409 message to prevent enumeration |

## Baselines

- Pre-flight tree: clean on `main`, head `f716ff5`.
- Pre-flight `npx tsc --noEmit`: passed.
- Pre-flight `npx vitest run`: 21 files, 160 tests passed.

## Per-fix results

### Fix 1 — Strip buyer email from `/checkout/success` page
- Applied: yes. Three edits in `app/checkout/success/page.tsx` (one commit):
  removed `email: true` from the Prisma `select`, removed the
  `const email = order?.email ?? null` local, and rewrote the success-state
  paragraph to a generic "the email address you entered at checkout" copy.
  The `isComplete` branch logic and the "Processing" branch are untouched.
- Diff: 1 file, +4 / -6.
- `tsc --noEmit`: passed.
- `vitest run`: 160 passed (no test currently covers this page; baseline
  unchanged).
- Anomalies: none. Mental trace confirmed: `order.email` is no longer
  selected → no PII reaches the rendered HTML.

### Fix 2 — Tighten webhook CSRF carve-out to allowlist
- Applied: yes. Two edits in `middleware.ts` (one commit): added a
  module-level `WEBHOOK_PATHS = new Set<string>(["/api/webhooks/stripe"])`
  with the spec's exact docblock above it, and replaced
  `!pathname.startsWith("/api/webhooks/")` with `!WEBHOOK_PATHS.has(pathname)`
  in the CSRF guard. The neighbouring comment block was updated from
  "/api/webhooks/* is excluded" to "WEBHOOK_PATHS are excluded" to keep
  the comment honest.
- Diff: 1 file, +10 / -2.
- `tsc --noEmit`: passed.
- `vitest run`: 160 passed (no existing CSRF middleware test; the Stripe
  webhook test bypasses middleware by calling the route handler directly).
- Anomalies: none. Mental trace: `/api/webhooks/stripe` POST →
  `WEBHOOK_PATHS.has("/api/webhooks/stripe")` is true → CSRF block
  skipped → handler runs → signature verified. Hypothetical
  `/api/webhooks/foo` POST → not in the Set → CSRF block engages →
  cross-origin POST is rejected.

### Fix 3 — Catch `P2002` on `caseFile.create` → 409
- Applied: yes. One edit in `app/api/admin/cases/route.ts` (one commit):
  wrapped the `prisma.caseFile.create({...})` call in a try/catch that
  recognises Prisma's `P2002` unique-constraint code and returns 409
  with the same `"A case with that slug already exists."` message the
  precheck uses. Other errors are rethrown so the existing outer
  try/catch still maps them to 500. The precheck `findUnique` is
  unchanged.
- Diff: 1 file, +13 / -1.
- `tsc --noEmit`: passed.
- `vitest run`: 160 passed. `tests/api/admin-cases.test.ts` exercises
  the precheck happy path and the precheck-409 path; the new catch is
  not exercised (no race-condition test) but no existing test broke.
- Anomalies: see observations #1 — the existing `data: { ... }` block
  has pre-existing odd indentation that I preserved verbatim per the
  no-scope-creep rule.

### Fix 4 — Rate-limit `/api/checkout/status` and `/api/admin/uploads/blurhash`
- Applied: yes, two file edits in one commit, mirroring the existing
  pattern from `app/api/admin/uploads/sign/route.ts:48-57`:
  - `app/api/checkout/status/route.ts`: added `import { rateLimit }
    from "@/lib/rate-limit"` and a `{ limit: 30, windowMs: 60_000 }`
    block as the very first thing inside the GET handler.
  - `app/api/admin/uploads/blurhash/route.ts`: same import and block,
    placed before the existing `requireAdmin()` call (matching the
    upload-sign route's ordering).
- Diff: 2 files, +24 / -0.
- `tsc --noEmit`: passed.
- `vitest run`: 160 passed. `tests/api/admin-uploads.test.ts` covers
  the upload-sign rate-limit path; `/api/checkout/status` and
  `/api/admin/uploads/blurhash` have no existing tests, so the new
  rate-limit branches are not exercised but no existing test broke.
- Anomalies: none.

### Fix 5 — Generalise the duplicate-purchase 409 message
- Applied: yes. One edit in `app/api/checkout/route.ts` (one commit):
  changed the message string only — from the specific
  "An activation code for this case has already been sent to this
  email address. Check your inbox or contact support." to the generic
  "We couldn't start checkout. If you've already purchased this case,
  please check your inbox or contact support." Status code (409),
  guard logic, and `existingOrder` lookup are unchanged.
- Diff: 1 file, +1 / -1.
- `tsc --noEmit`: passed.
- `vitest run`: 160 passed. `tests/api/stripe.test.ts:198-218` asserts
  on `response.status === 409` and on the absence of Stripe/Order
  side-effects, but does not assert on the message text, so no test
  edit was needed.
- Anomalies: none.

## Final verification

- `git log --oneline -7` shows the five commits + the two prior
  `docs(audit)` commits in the expected order.
- `git status`: clean.
- `npx tsc --noEmit`: passed.
- `npx vitest run`: 21 files, 160 tests — same as baseline.
- `git diff main~5 main --stat`:

```
 app/api/admin/cases/route.ts            | 14 +++++++++++++-
 app/api/admin/uploads/blurhash/route.ts | 12 ++++++++++++
 app/api/checkout/route.ts               |  2 +-
 app/api/checkout/status/route.ts        | 12 ++++++++++++
 app/checkout/success/page.tsx           | 10 ++++------
 middleware.ts                           | 12 ++++++++++--
 6 files changed, 52 insertions(+), 10 deletions(-)
```

Exactly the six files the spec authorised. No scope creep.

Ready for human review and push.
