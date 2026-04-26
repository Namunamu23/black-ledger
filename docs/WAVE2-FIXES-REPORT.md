# Wave 2 Fixes Report — 2026-04-26

## Summary
- ARCH-01: Made checkpoint stage advance atomic via `updateMany` with a `currentStage` precondition + 409 conflict handler in `app/api/cases/[slug]/checkpoint/route.ts`.
- SEC-06: Replaced raw origin string equality with parsed-`URL().origin` comparison in `middleware.ts`.
- OPS-04: Added the `R2_PUBLIC_URL` origin to the CSP `img-src` directive in `next.config.ts`.
- ARCH-02: Switched evidence resolution to `Promise.allSettled` in `app/bureau/cases/[slug]/page.tsx` so one bad lookup no longer 500s the whole case page.

## ARCH-01 — Atomic Checkpoint Advance
- File modified: `app/api/cases/[slug]/checkpoint/route.ts`
- Exact change made: Inside the `prisma.$transaction`, replaced `tx.userCase.update({ where: { id }, data: { ... } })` with `tx.userCase.updateMany({ where: { id, currentStage: userCase.currentStage }, data: { ... } })`. If `advanced.count === 0`, the transaction throws `Error("STAGE_CONFLICT")`. The outer `catch` now intercepts that sentinel and returns HTTP 409 with `{ message: "Stage already advanced by a concurrent request." }`. All other fields in the original `data` payload (`currentStage`, `status`, `firstOpenedAt`, `lastViewedAt`) and the surrounding `userCaseEvent.create` call are preserved unchanged.
- Test added: yes — `"returns 409 when a concurrent advance wins the race (ARCH-01)"` in `tests/api/checkpoint.test.ts`. Mocks `userCase.updateMany` to resolve `{ count: 0 }` and asserts `response.status === 409`. Existing tests in the same file were updated from `userCase.update` mocks to `userCase.updateMany` mocks (returning `{ count: 1 }` by default) to match the new implementation.
- tsc: clean

## SEC-06 — CSRF URL Parsing
- File modified: `middleware.ts`
- Exact change made: Inside the existing CSRF gate (state-mutating `/api/*` requests, with the `/api/auth/*` and `/api/webhooks/*` carve-outs left intact), replaced `if (!origin || origin !== APP_ORIGIN)` with a `try { allowed = new URL(origin ?? "").origin === new URL(APP_ORIGIN).origin } catch { allowed = false }` block. If `!allowed`, the response is the same `NextResponse.json({ message: "Forbidden." }, { status: 403 })` as before. All surrounding logic (route allow-list, `/bureau/unlock` pass-through, auth gates) is unchanged.
- tsc: clean

## OPS-04 — CSP img-src R2 Origin
- File modified: `next.config.ts`
- Exact change made: Added `const r2Origin = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).origin : "";` before the CSP string is built. Changed the `img-src` line in `CSP_REPORT_ONLY` from the literal string `"img-src 'self' data: blob:"` to a template literal `` `img-src 'self' data: blob: ${r2Origin}` ``. No other CSP directive was modified. When `R2_PUBLIC_URL` is unset the directive becomes `img-src 'self' data: blob: ` (trailing space, harmless).
- tsc: clean

## ARCH-02 — Promise.allSettled on Bureau Case Page
- File modified: `app/bureau/cases/[slug]/page.tsx`
- Exact change made: Replaced `(await Promise.all(redemptions.map((r) => resolveEvidence(r.accessCode.unlocksTarget)))).filter(...)` with a `Promise.allSettled` call. Fulfilled values are extracted via a typed type guard (`PromiseFulfilledResult<Awaited<ReturnType<typeof resolveEvidence>>>`), then `.map((r) => r.value)`, then the existing `null` filter is preserved so unknown `unlocksTarget` types and deleted target rows are still dropped. Rejected lookups are silently dropped instead of crashing the page.
- tsc: clean

## Test Results
```
 RUN  v4.1.4 C:/Users/gatch/Documents/black-ledger/site

 Test Files  20 passed (20)
      Tests  143 passed (143)
   Start at  12:30:16
   Duration  1.06s (transform 2.96s, setup 0ms, import 7.12s, tests 720ms, environment 2ms)
```

(Previous baseline: 142 tests. New total 143 = +1 ARCH-01 regression test.)

## Skipped / Blocked
None — all four fixes applied as specified, tsc is clean, and the full vitest suite passes.
