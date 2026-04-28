# BLACK LEDGER — FIX MODE, BATCH 2

**Paste everything below this line into a fresh Claude Code session running on Opus 4.7. Do not edit it. The session must have read+write access to the project folder. Run on a clean working tree on `main` after Batch 1 has been merged.**

---

## ROLE AND MANDATE

Same role as Batch 1 — surgical fix mode, one fix at a time, no scope creep, diffs before edits, type-check + tests after every change, one commit per fix, no push.

The audit phase is over. The Batch 1 fixes have already shipped and verified green. Your job in this session is to apply five more small, mechanical, verified-necessary fixes — all hardening or copy changes, none touching the schema or auth model.

If you find yourself wanting to do anything not on the list below — refactor, "improve," fix a typo you spotted on the way past, rename a poorly-named variable — write it in `BATCH_2_OBSERVATIONS.md` and move on. The human will triage.

---

## MANDATORY PRE-FLIGHT

1. `git status` must report "nothing to commit, working tree clean" on `main`. If not, stop.
2. `git log --oneline -8` should show the seven Batch 1 commits at the top:
   - `docs(audit): batch 1 report + observations`
   - `fix(security): stamp activation-code revokedAt server-side`
   - `fix(stripe): pin apiVersion to prevent silent SDK-upgrade drift`
   - `fix(security): prevent CSV formula injection in activation-code export`
   - `fix(scripts): add assertSafeEnv guard to unarchive-case`
   - `fix(scripts): add assertSafeEnv guard to seed-global-people`
   - (plus the prior `docs(audit)` commits)

   If those aren't there, you're on the wrong branch — stop.
3. `npx tsc --noEmit` must pass.
4. `npx vitest run` must pass — note the baseline test count (it should be 160 in 21 files; if different, that's your new baseline).
5. Read in full before editing anything: `audits/2026-04-27-godmode-audit-v1.md`, `audits/2026-04-27-godmode-audit-v2.md`, `audits/2026-04-27-verification.md`, `audits/BATCH_1_REPORT.md`, `audits/BATCH_1_OBSERVATIONS.md`.

---

## OPERATING PRINCIPLES (carryover from Batch 1)

1. One fix → one commit → one verified-green state.
2. Diff before edit. Always show the proposed change in chat before applying.
3. `npx tsc --noEmit` after every edit. `npx vitest run` after every fix. Both must be green before commit.
4. No scope creep. Only the files explicitly named below.
5. No new dependencies. No schema migrations. No env-var changes.
6. Do not push to remote. Human reviews and pushes manually.
7. Stop conditions: type error you can't fix in 5 minutes, previously-green test fails, file content differs from spec, anything weird → **stop and report.**

---

## THE FIVE FIXES

### Fix 1 — Strip buyer email from `/checkout/success` page

**Why:** Verified in `audits/2026-04-27-verification.md` §1. The unauthenticated success page reads `Order.email` from the database via `select: { status: true, email: true }` and renders it into the HTML at line 33-34. Anyone with the `session_id` URL — referrer leaks, browser-history scrapers, accidental URL sharing — can read the buyer's email. The companion API `/api/checkout/status` was hardened in Wave 1 to strip email; this server-rendered page was missed.

**File:** `app/checkout/success/page.tsx`

**Two changes inside this single file (one commit):**

#### 1a — Drop `email` from the Prisma `select`

```ts
// BEFORE (line 12-17)
const order = sessionId
  ? await prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
      select: { status: true, email: true },
    })
  : null;

// AFTER
const order = sessionId
  ? await prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
      select: { status: true },
    })
  : null;
```

#### 1b — Drop the `email` local variable and rewrite the copy

```ts
// BEFORE (line 19-20)
const isComplete = order?.status === "COMPLETE";
const email = order?.email ?? null;

// AFTER
const isComplete = order?.status === "COMPLETE";
```

And in the JSX:

```tsx
// BEFORE (lines 32-37)
<p className="mt-3 text-sm leading-6 text-zinc-400">
  Your activation code has been sent to{" "}
  <span className="font-mono text-zinc-200">{email}</span>. Check
  your inbox, sign in to the bureau, and redeem it to begin the
  investigation.
</p>

// AFTER
<p className="mt-3 text-sm leading-6 text-zinc-400">
  Your activation code has been sent to the email address you
  entered at checkout. Check your inbox, sign in to the bureau,
  and redeem it to begin the investigation.
</p>
```

Do not change anything else in this file. The "Processing" branch (lines 46-62) is unrelated — leave it alone. The page's outer layout, imports, and `isComplete` branching all stay identical.

**Verification:**
1. `npx tsc --noEmit` — must pass; the unused `email` constant being removed should leave no dangling references.
2. `npx vitest run` — no test currently covers this page (verified in audit §1.7), so the count stays the same.
3. Mental trace: `order.email` is no longer selected → no PII reaches the rendered HTML. Confirmed by the diff.

**Commit message:** `fix(security): strip buyer email from checkout success page`

---

### Fix 2 — Tighten webhook CSRF carve-out to an explicit allowlist

**Why:** Verified in `audits/2026-04-27-godmode-audit-v1.md`. The middleware currently exempts every path beginning with `/api/webhooks/` from CSRF origin checking. Today only one webhook route exists (`/api/webhooks/stripe`) and it verifies its own signature, so there's no live exposure. But the broad carve-out means a future engineer adding `/api/webhooks/foo` won't realize they've opted out of CSRF protection — the gap will only become visible when something exploits it.

**File:** `middleware.ts`

**Change:** Replace the `pathname.startsWith("/api/webhooks/")` check with a `Set`-based allowlist that requires explicit registration of any future webhook route.

**Read the file first** so you see the exact current line. The audit located the relevant block around line 21-39, with the carve-out at line 25. The pattern below is the target — match its placement to whatever the actual file looks like.

```ts
// AT THE TOP OF middleware.ts (alongside other module-level constants)

/**
 * Routes that are exempt from CSRF origin checking because they verify
 * authenticity at the request layer (Stripe webhook signature, etc.).
 * Adding a new path here is a security-sensitive change: the route MUST
 * implement its own authenticity check before exemption.
 */
const WEBHOOK_PATHS = new Set<string>(["/api/webhooks/stripe"]);

// IN THE CSRF GUARD BLOCK
// BEFORE
if (
  STATE_MUTATING_METHODS.has(req.method) &&
  pathname.startsWith("/api/") &&
  !pathname.startsWith("/api/auth/") &&
  !pathname.startsWith("/api/webhooks/")
) { ... }

// AFTER
if (
  STATE_MUTATING_METHODS.has(req.method) &&
  pathname.startsWith("/api/") &&
  !pathname.startsWith("/api/auth/") &&
  !WEBHOOK_PATHS.has(pathname)
) { ... }
```

If the existing constant naming or import style conflicts with what's already in the file, mirror the file's style. The functional change is: replace the prefix check with an exact-membership check against a Set declared at module scope. That's the only behavior change.

**Verification:**
1. `npx tsc --noEmit` — must pass.
2. `npx vitest run` — there is no existing CSRF middleware test, so the count stays the same. The Stripe webhook test (`tests/api/stripe.test.ts`) bypasses the middleware (it calls the route handler directly) so it's unaffected.
3. Mental trace: `/api/webhooks/stripe` POST → `WEBHOOK_PATHS.has("/api/webhooks/stripe")` is true → CSRF block skipped → handler runs → signature verified. Same as before. A hypothetical `/api/webhooks/foo` POST → not in the Set → CSRF block engages → cross-origin POST is rejected.

**Commit message:** `fix(security): tighten webhook CSRF carve-out to explicit allowlist`

---

### Fix 3 — Catch `P2002` on `caseFile.create` and translate to 409

**Why:** Verified in `audits/2026-04-27-godmode-audit-v1.md`. The admin "create case" route does a `findUnique` precheck on the slug, then a `create`. Two simultaneous admin submissions with the same slug both pass the precheck, the second `create` fails with Prisma's `P2002` unique-constraint error, and the admin sees a 500. With one admin this is theoretical; the fix is two lines and turns the failure mode into a clean 409.

**File:** `app/api/admin/cases/route.ts`

**Read the file first.** The audit located the relevant block around line 23-54. Find the `prisma.caseFile.create({ ... })` call. Wrap it in a try/catch that recognizes `P2002` and returns a 409 with the same message shape the existing precheck uses. Keep the precheck — it's a fast-path for the common case; the catch is purely the race-safety net.

```ts
// BEFORE (approximately)
const createdCase = await prisma.caseFile.create({ data: {...} });

// AFTER
let createdCase;
try {
  createdCase = await prisma.caseFile.create({ data: {...} });
} catch (error) {
  const e = error as { code?: string };
  if (e.code === "P2002") {
    return NextResponse.json(
      { message: "A case with that slug already exists." },
      { status: 409 }
    );
  }
  throw error;
}
```

Match the message exactly to whatever the existing precheck returns (read the file — if the precheck says something slightly different, mirror it for consistency). Do not change anything else in this file. Do not refactor the precheck.

**Verification:**
1. `npx tsc --noEmit`.
2. `npx vitest run` — `tests/api/admin-cases.test.ts` covers this route. Most likely the existing tests don't simulate a P2002 race, so they should still pass unchanged. If a test breaks because of how it asserts on the success path's return shape, stop and report.
3. Mental trace: a hypothetical race where two POSTs hit at the same instant — both pass the precheck, first wins the `create`, second hits P2002, second now gets 409 instead of 500. Confirmed.

**Commit message:** `fix(admin): catch P2002 on case create to return 409 instead of 500`

---

### Fix 4 — Rate-limit `/api/checkout/status` and `/api/admin/uploads/blurhash`

**Why:** Both audits flagged these as unrate-limited. `/api/checkout/status` is public, runs a Postgres lookup per call, and is a DoS surface against Neon's connection pool. `/api/admin/uploads/blurhash` is admin-only but performs a network fetch + Sharp decode per call — a compromised admin session can pile cost on the function.

**Two files in a single commit.** They share the same fix shape: prepend a `rateLimit` call at the top of the handler, mirroring the pattern used by every other rate-limited route in the codebase.

#### 4a — `app/api/checkout/status/route.ts`

Read the file first to see the current GET handler shape. Add this block as the very first thing inside the GET function, before any other work:

```ts
const limit = await rateLimit(request, { limit: 30, windowMs: 60_000 });
if (!limit.success) {
  return NextResponse.json(
    { message: "Too many requests." },
    {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    }
  );
}
```

Make sure `rateLimit` is imported from `@/lib/rate-limit` (mirror the existing import style of the file — relative vs alias-based).

#### 4b — `app/api/admin/uploads/blurhash/route.ts`

Same pattern. Add the same `rateLimit` block at the top of the POST handler. Use `{ limit: 30, windowMs: 60_000 }` to match.

**Verification:**
1. `npx tsc --noEmit`.
2. `npx vitest run` — `tests/api/admin-uploads.test.ts` may exercise the upload-sign route but probably not the blurhash route. If the suite passes, you're done. If a test asserts a specific number of allowed calls per IP and now gets rate-limited, stop and report.
3. Mental trace: 31st call within 60 seconds returns 429 with `Retry-After`. Same behavior as every other rate-limited route in the codebase.

**Commit message:** `fix(security): rate-limit checkout/status and admin blurhash routes`

---

### Fix 5 — Generalize the duplicate-purchase 409 message

**Why:** Verified in `audits/2026-04-27-verification.md` §5. The duplicate-purchase guard in `/api/checkout` returns a 409 with a message that explicitly confirms "this email has already bought this case." Combined with the route's 5/60s/IP rate limit and unauthenticated-by-design nature, this is an enumeration vector against your customer base.

This commit only changes the **message string** — not the status code, not the guard logic, not the response shape. A complete fix (drop the guard entirely or move it behind the Stripe call) requires architectural changes that are out of scope for Batch 2 and will land in Batch 3 alongside the BuyButton double-charge race fix. This message change closes the easy enumeration vector now while we plan the larger work.

**File:** `app/api/checkout/route.ts`

**Read the file first.** Locate the `if (existingOrder) { return NextResponse.json(...) }` block (audit located it around lines 68-76). Change only the `message` string.

```ts
// BEFORE
return NextResponse.json(
  {
    message:
      "An activation code for this case has already been sent to this email address. Check your inbox or contact support.",
  },
  { status: 409 }
);

// AFTER
return NextResponse.json(
  {
    message:
      "We couldn't start checkout. If you've already purchased this case, please check your inbox or contact support.",
  },
  { status: 409 }
);
```

The new message is generic — it doesn't confirm whether the email-case pair is a known purchase. It's the same message a buyer would reasonably see for any other failed-checkout reason.

Do not change the status code. Do not change the guard logic. Do not remove the `existingOrder` lookup. Do not touch the `BuyButton` client component (whose 409 handling continues to work unchanged).

**Verification:**
1. `npx tsc --noEmit`.
2. `npx vitest run` — `tests/api/stripe.test.ts` covers the checkout route. If a test asserts on the exact text of the 409 message, it will fail and need a one-line update. Mirror the new wording in the test. If the test asserts something else (status code, response shape), it should still pass.
3. Mental trace: a probing attacker hits the route with `(known-email, known-caseId)` and gets the new message. They cannot distinguish that response from "Stripe is having a bad day" or "rate limit hit on a previous call" or any other generic checkout failure. Enumeration vector closed at the message-content layer.

**Commit message:** `fix(privacy): generalize duplicate-purchase 409 message to prevent enumeration`

---

## FINAL VERIFICATION

1. `git log --oneline -7` should show your five commits + the two prior commits at the top.
2. `git status` should report a clean working tree.
3. `npx tsc --noEmit` should pass.
4. `npx vitest run` should pass with the same test count as the post-Batch-1 baseline (or +1/-1 if you adjusted any test in Fix 5; document that adjustment in the report).
5. `git diff main~5 main --stat` should show changes only in: `app/checkout/success/page.tsx`, `middleware.ts`, `app/api/admin/cases/route.ts`, `app/api/checkout/status/route.ts`, `app/api/admin/uploads/blurhash/route.ts`, `app/api/checkout/route.ts`. Six files. If anything else shows up, you've broken the no-scope-creep rule — explain.
6. **Do not push.**

---

## REPORT

When all five fixes are committed and the final verification is green, write `BATCH_2_REPORT.md` at the repo root with:

- The five commit hashes
- Per fix: confirmed-applied, tsc result, vitest result, any anomalies
- Anything unexpected goes in `BATCH_2_OBSERVATIONS.md` separately
- "Ready for human review and push." as the final line

Then stop. Do not start Batch 3. Wait for the human.

---

## HARD RULES (re-read before you begin)

- One fix → one commit → one verified-green state.
- Diff before edit. Always.
- No scope creep. No opportunistic refactors.
- No new dependencies. No schema migrations. No env-var changes.
- Do not push to remote.
- If anything is weird, stop. The human will help.

Begin Fix 1.
