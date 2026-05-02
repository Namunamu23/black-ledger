# BATCH 7 — FIX PROMPT (defense-in-depth hardening; no migrations)

You are a fresh Claude Code session running on Opus 4.7. Apply the four fixes below, surgically, one commit per fix, in order, plus a final report commit. No scope creep. No migrations. No new dependencies.

This batch is the security-hardening sweep: items the prior audits flagged as P2 that aren't urgent but reduce attack surface and close timing leaks. Each fix is mechanical or surgical.

Read this entire prompt first. Then read the two audit dossiers and `BATCH_6_REPORT.md`. Then begin.

---

## 1. Operating principles (read twice)

1. **One commit per fix.** Subjects pre-written below — use verbatim.
2. **No migrations.** Schema is not touched. If you reach for `prisma migrate`, stop.
3. **No new dependencies.** No `npm install`, no `npm audit fix`. Use only what's already in `package.json`.
4. **No scope creep.** Capture out-of-scope discoveries in `audits/BATCH_7_OBSERVATIONS.md`.
5. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` passing at the same count or higher. If either fails, stop and report.
6. **No env changes, no pushes.**
7. **Ground truth = source code at HEAD.** This prompt cites locations against post-Batch-6 state. Re-confirm against the actual file before each edit; if line numbers drift after any intervening commits, find the right location by content not by line number.

---

## 2. Pre-flight

```
git rev-parse HEAD                  # should be at or after the Week 15 CLAUDE.md checkpoint commit
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 22 files / 168 tests
```

If any fail, stop. Confirm `audits/2026-05-01-godmode-audit.md`, `audits/2026-05-01-godmode-audit-cowork.md`, and `audits/BATCH_6_REPORT.md` are on tree.

---

## 3. The four fixes

### Fix 1 — `fix(security): rate-limit admin mutation routes (60/60s per ip+route)`

**Severity:** P2. Claude Code audit P2-5. Defense in depth — every public POST/PATCH is rate-limited; admin mutations have nothing. A leaked or phished admin session has no ceiling on burst writes.

**Pattern.** Insert a `rateLimit(...)` block as the FIRST action inside each handler (before `requireAdmin`). The order matches `/api/admin/uploads/sign/route.ts` — rate limit gates the auth lookup, so an attacker pounding admin URLs from a stolen IP burns through a budget rather than triggering DB queries on every 403. Use 60/60s per (ip, pathname) — generous for normal admin use, tight enough to stop bursts.

**Routes to update** (each gets the same insert; verify each handler does NOT already have a `rateLimit` call before adding):

| File | HTTP method |
|---|---|
| `app/api/admin/cases/route.ts` | POST |
| `app/api/admin/cases/[caseId]/route.ts` | PUT (the legacy aggregate save; GET is read-only, leave alone) |
| `app/api/admin/cases/[caseId]/overview/route.ts` | PATCH |
| `app/api/admin/cases/[caseId]/people/route.ts` | PATCH |
| `app/api/admin/cases/[caseId]/records/route.ts` | PATCH |
| `app/api/admin/cases/[caseId]/hints/route.ts` | PATCH |
| `app/api/admin/cases/[caseId]/checkpoints/route.ts` | PATCH |
| `app/api/admin/cases/[caseId]/solution/route.ts` | PATCH |
| `app/api/admin/cases/[caseId]/workflow/route.ts` | PATCH |
| `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts` | PATCH (revoke) |
| `app/api/admin/cases/[caseId]/access-codes/route.ts` | POST (GET is read-only, leave alone) |
| `app/api/admin/support/[id]/reply/route.ts` | POST |
| `app/api/admin/support/[id]/status/route.ts` | PATCH |

**Insert** at the top of each handler, immediately before the existing `requireAdmin()` call:

```ts
const limit = await rateLimit(request, { limit: 60, windowMs: 60_000 });
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

Add the import `import { rateLimit } from "@/lib/rate-limit";` to each file that doesn't already have it. Most don't.

**Routes ALREADY rate-limited** (do NOT re-add — verify by grep):
- `app/api/admin/cases/[caseId]/codes/route.ts` — POST is rate-limited at 10/60s (batch generation)
- `app/api/admin/uploads/sign/route.ts` — 20/60s
- `app/api/admin/uploads/blurhash/route.ts` — 30/60s
- `app/api/admin/cases/[caseId]/activation-codes/route.ts` — 10/60s (legacy single-code generator)

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — existing admin tests don't fire 60+ requests in a single test, so the 429 branch shouldn't surface. 168 tests still passing.
- Mental trace: a curl loop `for i in {1..70}; do curl -X PATCH .../workflow ...; done` from one IP would hit 429 around request 60. Real admin use (a few dozen edits per session) stays well under.

**Commit subject:** `fix(security): rate-limit admin mutation routes (60/60s per ip+route)`

---

### Fix 2 — `chore(runtime): pin runtime = "nodejs" on every Prisma-using API route`

**Severity:** P2. Cowork audit P2-11 / Claude Code audit P2-9. Defense in depth — Prisma cannot run on the edge runtime. A future Next.js or adapter version that introduces an "edge-preferred" default could silently flip our routes to edge and crash at first request. Explicit `runtime = "nodejs"` is the lock.

**Files to update** (every route under `app/api/` that imports `@/lib/prisma`, `bcryptjs`, `getStripe`, `getResend`, or otherwise depends on Node-only APIs). Add `export const runtime = "nodejs";` at the top of each file (after imports, before the handler).

The pattern matches `app/api/webhooks/stripe/route.ts:9` and `app/api/me/route.ts:9` (both already have it).

**Verify which routes need the addition** by running:

```
git grep -L 'runtime = "nodejs"' 'app/api/**/route.ts'
```

That lists every route file that does NOT already have the pin. Edit each.

**Skip the following** — they're either already pinned OR don't need it because they don't touch Node-only APIs:

- `app/api/webhooks/stripe/route.ts` (already pinned at line 9)
- `app/api/me/route.ts` (already pinned at line 9)
- `app/api/cron/cleanup-pending-orders/route.ts` (already pinned)
- `app/u/[code]/route.ts` is NOT a `/api/*` route and does NOT use Prisma — it just calls `next/navigation`'s `redirect()`. The grep above excludes it; leave it without the pin (it can run on edge).

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — adding a const export changes nothing at runtime in tests. 168 still passing.
- `npm run build` clean — Next will include the runtime hint in its build output.
- `git diff main~1 main --stat` should show ~24 files each with `+1 -0` lines.

**Commit subject:** `chore(runtime): pin runtime = "nodejs" on every Prisma-using API route`

---

### Fix 3 — `fix(security): constant-time bcrypt compare on login to close email-enumeration timing leak`

**Severity:** P2. Cowork audit P2-13 / Claude Code audit P2-11. The `authorize` callback at `auth.ts:17-42` returns `null` immediately when no user is found (line 26), but takes ~80-200ms when a user IS found (the bcrypt compare). An attacker measuring response time can distinguish "this email is registered" from "this email is not."

**File:** `auth.ts:17-42` only. No other files touched.

**Replacement** for the `authorize` function and supporting module-level helper. Replace lines 17-42 with:

```ts
async authorize(credentials) {
  const parsed = loginSchema.safeParse(credentials);

  if (!parsed.success) return null;

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  // Constant-time. If the user doesn't exist, run a bcrypt compare
  // against a lazily-computed fake hash so the wall-clock cost matches
  // the user-exists case. Without this, a timing attack distinguishes
  // "this email is registered" from "this email is not."
  //
  // The fake-hash pre-image is a fixed constant — even if an attacker
  // submits its plaintext, `!user` short-circuits the return-null below
  // before any session is issued, so this leaks nothing.
  const hashToCompare = user?.passwordHash ?? (await getConstantTimeFakeHash());
  const passwordMatches = await compare(parsed.data.password, hashToCompare);

  if (!user || !passwordMatches) return null;

  return {
    id: String(user.id),
    email: user.email,
    name: user.name ?? user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
},
```

Add the helper at module scope, AFTER the imports (line 6) and BEFORE the `export const { handlers, ... } = NextAuth({...})` block. Also add `hash` to the bcryptjs import:

```ts
import { compare, hash } from "bcryptjs";
```

```ts
// Lazily-computed bcrypt hash of a fixed placeholder. Used by the
// authorize callback to match wall-clock timing on the user-not-found
// path. The hash is computed once on first sign-in attempt and cached
// in module scope; subsequent attempts read the cached value.
let _constantTimeFakeHash: string | null = null;
async function getConstantTimeFakeHash(): Promise<string> {
  if (_constantTimeFakeHash === null) {
    _constantTimeFakeHash = await hash("__no_user_constant_time_placeholder__", 12);
  }
  return _constantTimeFakeHash;
}
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — no test exercises the `authorize` callback directly (existing tests mock `@/auth` instead), so 168 tests still pass without modification.
- Mental trace — sign-in with non-existent email: `findUnique` returns null → `hashToCompare = await getConstantTimeFakeHash()` (~80-150ms first call, instant after) → `compare(badPassword, fakeHash)` (~80-150ms) → `!user` true → return null. Total wall-clock ~80-300ms.
- Mental trace — sign-in with existing email + wrong password: `findUnique` returns user → `hashToCompare = user.passwordHash` → `compare(badPassword, realHash)` (~80-150ms) → `!passwordMatches` true → return null. Total wall-clock ~80-150ms.
- Mental trace — first sign-in attempt of a process can be slower than subsequent ones because `getConstantTimeFakeHash` computes once. After the first call, the cached value is used and timing is consistent.

**Commit subject:** `fix(security): constant-time bcrypt compare on login to close email-enumeration timing leak`

---

### Fix 4 — `chore(csp): drop unused fonts.gstatic.com from font-src`

**Severity:** P3. Cowork audit P2-1 partially / Claude Code audit P3-10. `next/font/google` (used in `app/layout.tsx:9-12`) downloads font binaries at build time and self-hosts them under `/_next/static/`. There is no runtime request to `fonts.gstatic.com`. The CSP entry is dead — and dead CSP entries are a maintenance hazard (future readers think they're load-bearing). Removing it also tightens the policy.

**File:** `next.config.ts:30` only.

**Current:**
```ts
"font-src 'self' https://fonts.gstatic.com",
```

**Replace with:**
```ts
"font-src 'self'",
```

**Style note** — the same line pattern (`style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`) at `next.config.ts:29` references `fonts.googleapis.com` which IS used by `next/font/google`'s build-time stylesheet generation. **Do NOT remove the `style-src` entry.** Only the `font-src` `gstatic.com` reference is dead.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — 168 tests still passing (no test exercises CSP).
- `npm run build` clean.
- Manual sanity: after deploy, render any page in production with browser dev-tools open; the Network tab should show fonts loading from `/_next/static/...`, not from `fonts.gstatic.com`. (Confirmation only — not part of this commit's verification gate.)

**Commit subject:** `chore(csp): drop unused fonts.gstatic.com from font-src`

---

## 4. Final verification gate

After all four commits are on tree:

```
git log --oneline -4                # confirm four commits in order
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 168 tests passing
npm run build                       # clean
git diff main~4 main --stat         # confirm only authorized files touched
```

Expected files touched (the runtime-pin commit's diff stat will be the largest):

```
auth.ts                                                    (Fix 3)
next.config.ts                                             (Fix 4)
app/api/access-codes/redeem/route.ts                       (Fix 2)
app/api/admin/cases/[caseId]/access-codes/route.ts         (Fix 1 + Fix 2)
app/api/admin/cases/[caseId]/activation-codes/route.ts     (Fix 2)
app/api/admin/cases/[caseId]/checkpoints/route.ts          (Fix 1 + Fix 2)
app/api/admin/cases/[caseId]/codes/[codeId]/route.ts       (Fix 1 + Fix 2)
app/api/admin/cases/[caseId]/codes/route.ts                (Fix 2)
app/api/admin/cases/[caseId]/hints/route.ts                (Fix 1 + Fix 2)
app/api/admin/cases/[caseId]/overview/route.ts             (Fix 1 + Fix 2)
app/api/admin/cases/[caseId]/people/route.ts               (Fix 1 + Fix 2)
app/api/admin/cases/[caseId]/records/route.ts              (Fix 1 + Fix 2)
app/api/admin/cases/[caseId]/route.ts                      (Fix 1 + Fix 2)
app/api/admin/cases/[caseId]/solution/route.ts             (Fix 1 + Fix 2)
app/api/admin/cases/[caseId]/workflow/route.ts             (Fix 1 + Fix 2)
app/api/admin/cases/route.ts                               (Fix 1 + Fix 2)
app/api/admin/support/[id]/reply/route.ts                  (Fix 1 + Fix 2)
app/api/admin/support/[id]/status/route.ts                 (Fix 1 + Fix 2)
app/api/admin/uploads/blurhash/route.ts                    (Fix 2)
app/api/admin/uploads/sign/route.ts                        (Fix 2)
app/api/auth/[...nextauth]/route.ts                        (Fix 2)
app/api/cases/activate/route.ts                            (Fix 2)
app/api/cases/[slug]/checkpoint/route.ts                   (Fix 2)
app/api/cases/[slug]/theory/route.ts                       (Fix 2)
app/api/checkout/route.ts                                  (Fix 2)
app/api/checkout/status/route.ts                           (Fix 2)
app/api/forgot-password/route.ts                           (Fix 2)
app/api/register/route.ts                                  (Fix 2)
app/api/reset-password/route.ts                            (Fix 2)
app/api/support/route.ts                                   (Fix 2)
app/api/waitlist/route.ts                                  (Fix 2)
audits/BATCH_7_OBSERVATIONS.md                             (Fix 5, new)
audits/BATCH_7_REPORT.md                                   (Fix 5, new)
```

If any other file is in the diff, restore it before declaring done.

---

## 5. Required output

`audits/BATCH_7_REPORT.md` matching the structure of `audits/BATCH_6_REPORT.md`. Per-commit hash + subject + file diff + tsc/vitest results + mental trace + anomalies + pre-flight tree state at top.

`audits/BATCH_7_OBSERVATIONS.md` — capture explicitly:

1. **Forgot-password timing leak (Cowork P2-11) deliberately deferred from this batch.** The clean fix (`after()` from `next/server`) breaks the existing Resend-call assertion in `tests/api/register.test.ts` because the callback runs after the test's `await` resolves. Closing this leak cleanly requires either deterministic-delay padding or test-restructuring — both real work, not a mechanical fix. Defer to a future batch.
2. **Sentry / structured logging (Cowork P2-9 / Claude Code P3-7) deferred.** Needs `npm install`, which the fix-prompt model forbids. Should be its own batch with explicit install permission.
3. **`/bureau/database` unbounded findMany (Claude Code P2-8) deferred to a perf batch.** Pagination is a UX-touching refactor.
4. **`app/layout.tsx` `auth()` on every page render (Cowork P2-8) deferred to a perf batch.** Closing it requires a Navbar refactor (lazy fetch via /api/me).

**Commit subject:** `docs(audit): batch 7 report + observations`

Then stop. Do not push. Do not start Batch 8.

---

## 6. Begin

Read both audit dossiers under `audits/`. Read `BATCH_6_REPORT.md` for house style. Then start with Fix 1's pre-flight + thirteen-route admin rate-limit insertion. Commit. Verify. Move to Fix 2's `git grep -L` + sweep. Continue through Fix 4. Write the two report files in commit 5. Done.
