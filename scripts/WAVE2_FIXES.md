# BLACK LEDGER — WAVE 2 FIX PROTOCOL
# ─────────────────────────────────────────────────────────────────────────────
# Self-contained instructions for Claude Code to implement 4 targeted security
# and reliability fixes. Read this file completely before touching any code.
# ─────────────────────────────────────────────────────────────────────────────

## CONTEXT

You are working on the Black Ledger codebase located at the repo root (site/).
This is a Next.js 16 / TypeScript strict / Prisma 7 / PostgreSQL application.
All fixes below have been fully specified — no design decisions required.
Do not invent extra changes. Do exactly what is described and nothing else.

After all fixes are applied:
1. Run: npx tsc --noEmit
2. Run: npx vitest run
3. Write a report to docs/WAVE2-FIXES-REPORT.md

---

## FIX 1 — ARCH-01: Atomic checkpoint advance (CRITICAL)

### Problem
`app/api/cases/[slug]/checkpoint/route.ts` advances `userCase.currentStage`
using a plain `tx.userCase.update({ where: { id } })`. There is no precondition
on the current stage value, so two concurrent requests can both read stage N,
both pass the validation check, and both write stage N+1 — resulting in a
double-increment that skips a stage entirely.

### Fix

**Step 1** — Read the file: `app/api/cases/[slug]/checkpoint/route.ts`

**Step 2** — Locate the `tx.userCase.update` call inside the transaction that
advances `currentStage`. It will look approximately like:

```ts
await tx.userCase.update({
  where: { id: userCase.id },
  data: { currentStage: newStage, ... },
});
```

**Step 3** — Replace that `update` with `updateMany` and add a `currentStage`
precondition, then assert that exactly one row was updated:

```ts
const advanced = await tx.userCase.updateMany({
  where: { id: userCase.id, currentStage: userCase.currentStage },
  data: { currentStage: newStage, ... },
});

if (advanced.count === 0) {
  throw new Error("STAGE_CONFLICT");
}
```

**Step 4** — In the catch block (or wherever the transaction error is handled),
add a handler for `"STAGE_CONFLICT"` that returns:
```ts
return NextResponse.json(
  { message: "Stage already advanced by a concurrent request." },
  { status: 409 }
);
```

**Step 5** — Preserve ALL existing fields that were in the original `data: {}`
object. Only change `update` → `updateMany`, add the `currentStage` where
condition, and add the count assertion + conflict handler. Do not alter any
other logic.

**Step 6** — Add one regression test to `tests/api/checkpoint.test.ts`:
- Test name: `"returns 409 when a concurrent advance wins the race (ARCH-01)"`
- Mock setup: `userCase.updateMany` returns `{ count: 0 }` (simulates the race)
- Assert: response status is 409

---

## FIX 2 — SEC-06: CSRF origin comparison uses URL parsing (SECURITY)

### Problem
`middleware.ts` compares the `Origin` header against `NEXT_PUBLIC_APP_URL` with
a raw string equality check or `startsWith`. This can be bypassed by an attacker
registering a domain like `https://theblackledger.app.evil.com` which would
pass a naive prefix check.

### Fix

**Step 1** — Read the file: `middleware.ts`

**Step 2** — Find the CSRF origin check. It will look something like:
```ts
const origin = request.headers.get("origin");
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
// some comparison of origin vs appUrl
```

**Step 3** — Replace the comparison so both sides are parsed through `new URL()`
before comparing, extracting only the `.origin` property (scheme + host + port):

```ts
const origin = request.headers.get("origin");
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

let allowed = false;
try {
  allowed = new URL(origin ?? "").origin === new URL(appUrl).origin;
} catch {
  allowed = false;
}

if (!allowed) {
  return new NextResponse("Forbidden", { status: 403 });
}
```

**IMPORTANT**: Keep all existing logic around this check intact — the allow-list
for `/api/auth/*`, `/api/webhooks/*`, and the `/bureau/unlock` pass-through must
not be changed. Only replace the origin string comparison itself.

**Step 4** — No new test needed for this fix (the existing CSRF tests in the
suite already cover the origin gate; the change is internal to how the
comparison is evaluated).

---

## FIX 3 — OPS-04: Add R2 origin to CSP img-src (RELIABILITY)

### Problem
`next.config.ts` has a Content-Security-Policy header with `img-src 'self' data: blob:`.
The R2 public URL origin (stored in `R2_PUBLIC_URL` env var) is not included.
When CSP is flipped from report-only to enforced, all hero images and portrait
images served from R2 will be blocked by the browser.

### Fix

**Step 1** — Read the file: `next.config.ts`

**Step 2** — Find the `img-src` directive inside the CSP string.

**Step 3** — Append the R2 origin dynamically. The env var is `R2_PUBLIC_URL`
(e.g. `https://pub-xxxx.r2.dev`). Extract just the origin:

```ts
const r2Origin = process.env.R2_PUBLIC_URL
  ? new URL(process.env.R2_PUBLIC_URL).origin
  : "";
```

Then include it in `img-src`:
```
img-src 'self' data: blob: ${r2Origin};
```

If `r2Origin` is empty (env var not set), the resulting directive will be
`img-src 'self' data: blob: ;` — the trailing space is harmless.

**Step 4** — Place the `r2Origin` computation before the CSP string is built,
so it can be interpolated. Do not change any other directive.

**Step 5** — No test needed for this change.

---

## FIX 4 — ARCH-02: Bureau case page uses Promise.allSettled (RELIABILITY)

### Problem
`app/bureau/cases/[slug]/page.tsx` (or similar path — search for
`resolveEvidence` or `redemptions.map`) calls `Promise.all(...)` over an array
of DB lookups for revealed evidence. If any single lookup throws (e.g. a
temporarily unavailable connection, a deleted record), the entire page returns
a 500 error and the player loses access to all their case content.

### Fix

**Step 1** — Search for the file containing `resolveEvidence` and
`Promise.all`. It is likely in `app/bureau/cases/[slug]/page.tsx` or a nearby
server component.

**Step 2** — Replace the `Promise.all` call with `Promise.allSettled`:

```ts
// Before:
const evidenceItems = await Promise.all(redemptions.map(resolveEvidence));

// After:
const settled = await Promise.allSettled(redemptions.map(resolveEvidence));
const evidenceItems = settled
  .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof resolveEvidence>>> =>
    r.status === "fulfilled"
  )
  .map((r) => r.value);
```

**Step 3** — If `resolveEvidence` returns `null` for unknown types, keep any
existing null-filter that was already there. The goal is: if one item fails,
the rest still render.

**Step 4** — No new test needed (this is a defensive change to a server
component; unit testing Promise.allSettled behavior in isolation is not
meaningful here).

---

## AFTER ALL FIXES

1. Run `npx tsc --noEmit`. Fix any type errors before proceeding.
2. Run `npx vitest run`. All tests must pass (expect 142 or more).
3. Write a report to `docs/WAVE2-FIXES-REPORT.md` with the following sections:

```markdown
# Wave 2 Fixes Report — {date}

## Summary
{one sentence per fix: what was changed and in what file}

## ARCH-01 — Atomic Checkpoint Advance
- File modified: ...
- Exact change made: ...
- Test added: yes/no — {test name}
- tsc: clean / errors (list any)

## SEC-06 — CSRF URL Parsing
- File modified: ...
- Exact change made: ...
- tsc: clean / errors (list any)

## OPS-04 — CSP img-src R2 Origin
- File modified: ...
- Exact change made: ...
- tsc: clean / errors (list any)

## ARCH-02 — Promise.allSettled on Bureau Case Page
- File modified: ...
- Exact change made: ...
- tsc: clean / errors (list any)

## Test Results
{paste full vitest output here}

## Skipped / Blocked
{anything that could not be implemented and why}
```

Save the report and you are done.
