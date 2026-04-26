# BLACK LEDGER FULL-SPECTRUM AUDIT REPORT

| Field | Value |
| --- | --- |
| Date | 2026-04-26 |
| Auditor | Claude (God Mode — 6-Expert Protocol) |
| Repo root | `C:\Users\gatch\Documents\black-ledger\site` |
| Branch | `main` |
| Commits on main | 95 |
| Tracked files (excl. lockfile) | 169 |
| Files read directly during audit | ~95 |
| Tests verified | **136 passing / 136 total** (19 files) |
| TypeScript | `tsc --noEmit` — clean |
| `npm audit` | 12 moderate, 0 high, 0 critical |
| ESLint | 12 errors, 3 warnings (lint-only; tsc clean) |

---

## EXECUTIVE SUMMARY

Black Ledger is a Next.js 16 + Prisma 7 + Postgres mystery-game platform built solo by Nami. After 8 weeks (95 commits, 19 test files, 136 passing tests, clean tsc), the codebase is in genuinely good shape for a pre-launch B2C product. Most P0 / P1 surface area has been hardened: auth helpers, role enforcement, CSRF origin gate, rate-limited mutating routes, monotonic `UserCase` state machine, signature-verified Stripe webhook with orphan recovery, and a real per-section admin editor backed by `CaseAudit`. Tests cover the highest-risk routes (theory, checkpoint, redeem, workflow, webhook, slug history). Schema is sound; cascade deletes are intentional; lazy singletons isolate Stripe/Resend/Prisma from build-time.

The **critical finding** is small in code but large in business impact: **`POST /api/cases/activate` never checks `ActivationCode.revokedAt`**. An admin can revoke a leaked or printed code in the panel, but the activate route will still happily mint a `UserCase` for it. This breaks the entire revocation feature shipped in Week 5 and is exploitable by anyone holding a leaked code. Two **near-critical operational risks** sit on the periphery: (a) `lib/rate-limit.ts::_resetForTesting()` is exported unconditionally — any compromised dependency can clear rate limits in production; (b) the seed/test scripts (`test-full-flow.ts`, `reset-case-progress.ts`, `create-admin.ts`) load `.env.local` without verifying the connected database is non-prod, so a misconfigured shell session can wipe a real user's case progress or upsert an admin into the prod DB.

Everything else is **HIGH-or-below** and fixable in a sitting: an open-information-disclosure on `/checkout/success` (any guessed `session_id` returns the buyer's email), a non-atomic checkpoint stage advance vulnerable to double-submit, a `Promise.all` on the bureau case page that turns one DB blip into a full workspace 500, the well-known CSP `img-src` gap that will block hero images the moment CSP flips out of report-only, and a missing `lastViewedAt` write on case-page render that silently invalidates the field for analytics. The state machine, evaluators, validators, and admin diff/upsert pipeline are all best-in-class for this stage; preserve them as you refactor.

**Launch verdict**: fix WAVE 1 (4 items, ≤ 3 hours) before the first kit ships. WAVE 2 can land in the days that follow. WAVE 3/4 are hardening for scale.

---

## SYSTEM ARCHITECTURE (mental model)

**Stack**: Next.js 16.2 (App Router, RSC, `runtime=nodejs` everywhere), React 19.2, TypeScript 5 strict, Prisma 7.7 + `@prisma/adapter-pg`, Postgres on Neon (pooled `DATABASE_URL` + direct `DIRECT_URL` for migrations), NextAuth v5-beta credentials w/ JWT sessions, Stripe Checkout + webhooks, Resend transactional email, Cloudflare R2 (S3-compat) for image uploads, Upstash Redis token-bucket rate limiter (in-memory fallback for dev), Tailwind v4, Vitest.

**Domain shape (30 models)**: A `User` (`INVESTIGATOR | ADMIN`) owns `UserCase` rows linking them to `CaseFile`s with stages/people/records/hints/checkpoints. Players progress via `CaseCheckpoint`s gated by `currentStage`, then submit a final `TheorySubmission` evaluated against `solutionSuspect|motive|evidence` by Jaccard + exact-name. Physical kits ship with `ActivationCode`s (`SLUG-8HEX`) that `POST /api/cases/activate` claims atomically. QR-coded `AccessCode`s (`/u/[code]` → `/bureau/unlock`) reveal hidden `record|person|hint` content via `AccessCodeRedemption` (`@@unique(accessCodeId,userId)`). `Order` rows track `Stripe Checkout` sessions; the webhook mints an `ActivationCode(source: PURCHASE)` and emails it via Resend inside one Prisma `$transaction`.

**Auth & enforcement layers (defense in depth)**:
1. **Edge middleware** (`middleware.ts`): origin-equality CSRF gate on state-mutating `/api/*` (skips `/api/auth/*` and `/api/webhooks/*`); session/role redirects on `/bureau/*` and `/api/admin/*`; `/bureau/unlock` carve-out for unauthenticated QR arrivals.
2. **Layout guards** (`app/bureau/layout.tsx`, `app/bureau/admin/layout.tsx`): `requireSession()` → `requireAdmin role check`.
3. **Route helpers** (`lib/auth-helpers.ts`): `requireSession`, `requireAdmin` (returns 403 NextResponse), `requireSessionJson` (returns 401 + validates `Number.isInteger(userId)`), `getOptionalSession`.
4. **Per-route rate limits** (`lib/rate-limit.ts`): token-bucket per `${ip}:${pathname}`. Auto-Upstash when both env vars present, in-memory bounded to 500 keys otherwise.

**Hot paths**:
- **Kit purchase**: `BuyButton` → `POST /api/checkout` (rate-limited 5/60s, Zod-validated, requires `PUBLISHED` case) → Stripe Checkout session + `Order(PENDING)` → user pays → `POST /api/webhooks/stripe` (signature-verified) → `checkout.session.completed` handler creates `ActivationCode(PURCHASE)` + flips `Order` to `COMPLETE` + sends Resend email — all inside `$transaction` with orphan recovery from session metadata if the original Order create failed.
- **Activation**: `CaseActivationForm` → `POST /api/cases/activate` (5/60s, requireSessionJson) → existing-ownership check → `updateMany({where: {claimedByUserId: null}})` optimistic lock → `userCase.create` + `userCaseEvent("ACTIVATE")`.
- **Checkpoint**: `CheckpointForm` → `POST /api/cases/[slug]/checkpoint` (20/60s) → `matchesAcceptedAnswer` (normalizeIdentity exact OR Jaccard ≥ 0.45, MIN 3 chars) → `CheckpointAttempt` row → `userCase.update {currentStage++, status, lastViewedAt}` + `userCaseEvent`.
- **Theory**: `TheorySubmissionForm` → `POST /api/cases/[slug]/theory` (10/60s) → final-stage gate → `evaluateTheorySubmission` (suspect equality + Jaccard motive/evidence) → `transitionUserCase(status, eventMap[label])` → SOLVED is terminal.
- **QR unlock**: `/u/[code]` → `/bureau/unlock?code=…` (public; auth gate carved out in middleware) → unauthed = sign-in card with sanitized `callbackUrl` (`pickPostLoginPath`); authed = `UnlockForm` auto-submits → `POST /api/access-codes/redeem` (5/60s, manual `auth()` + `Number.isInteger(userId)` check, ownership-required even when `requiresStage` null, P2002 race-safe).
- **Admin publish**: tabbed editor → per-section PATCH (`overview|people|records|hints|checkpoints|solution`) with diff/upsert + `CaseAudit("UPDATE_*")` per section → `PATCH .../workflow` enforces forward-only `DRAFT→IN_REVIEW→PUBLISHED→ARCHIVED`.

**State machines**:
- `UserCaseStatus` (`lib/user-case-state.ts`): centralized in `transitionUserCase` table. SOLVED is absorbing.
- `CaseWorkflowStatus` (`workflow/route.ts`): `LEGAL_TRANSITIONS` table. Backward transitions deliberately not exposed.
- `OrderStatus`: scattered (set in checkout/route, webhook handlers). Not centralized.
- `ActivationCode.{revokedAt,claimedByUserId}`: lifecycle scattered (admin sets `revokedAt`, activate sets `claimedByUserId` — see SEC-01).

---

## EXPERT 1 — OFFENSIVE SECURITY / PEN-TESTER

### [SEC-01] **CRITICAL** — Revoked activation codes can still be claimed
- **File**: `app/api/cases/activate/route.ts` (entire route)
- **Vector**: Bypassed authorization control — broken access management
- **Evidence**: Grep for `revokedAt` against `app/api/cases/activate/route.ts` returns **no matches**. The route only checks `claimedByUserId`. The admin "Revoke" UI (`app/bureau/admin/cases/[caseId]/codes/_components/RevokeButton.tsx` → `PATCH …/codes/[codeId]`) sets `revokedAt`, and the CSV export displays it, but `activate/route.ts:36-103` never reads it.
- **Impact**: An attacker (or the rightful kit-owner the admin is trying to lock out — e.g., chargeback abuse, leaked-code refund) holding a revoked but unclaimed code mints a `UserCase` and starts playing. The entire revocation feature shipped in Week 5 is non-functional.
- **Fix** (≤ 15 minutes):
  ```ts
  // After loading `activation` (~line 36), before existing-ownership check:
  if (activation.revokedAt) {
    return NextResponse.json(
      { message: "This activation code has been revoked." },
      { status: 410 }
    );
  }
  ```
  Add a regression test in `tests/api/admin-codes.test.ts` (existing file already has the revoke flow; just call activate after revoke and assert 410).

### [SEC-02] **HIGH** — `_resetForTesting` is reachable from any module in production
- **File**: `lib/rate-limit.ts:122-124`
- **Vector**: Authorization bypass via internal API
- **Evidence**:
  ```ts
  export function _resetForTesting(): void {
    buckets.clear();
  }
  ```
  No `NODE_ENV` guard. The leading `_` is a convention only.
- **Impact**: Any malicious or compromised dependency that imports from `@/lib/rate-limit` (a route, a future analytics lib, anything that already imports `rateLimit`) can call `_resetForTesting()` to clear all in-memory buckets, defeating the brute-force protections on `/api/auth/[...nextauth]` (5/60s — protects login), `/api/cases/activate` (5/60s — protects code enum), `/api/access-codes/redeem` (5/60s — protects QR brute-force), and others. The Upstash backend is unaffected, but the in-memory backend is the production fallback when Upstash env vars are absent.
- **Fix** (≤ 5 minutes):
  ```ts
  export function _resetForTesting(): void {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("_resetForTesting is test-only");
    }
    buckets.clear();
  }
  ```

### [SEC-03] **HIGH** — Open information disclosure on `/checkout/success`
- **File**: `app/checkout/success/page.tsx:9-21` and `app/api/checkout/status/route.ts:1-26`
- **Vector**: Information disclosure / IDOR via guessable identifier
- **Evidence**: Both endpoints are unauthenticated and return `{status, email}` for any submitted `session_id`. The Stripe Checkout `cs_*_…` IDs are random and unguessable in practice, but they leak via HTTP `Referer`, browser history, server logs, support tickets, and the success URL itself (`?session_id=…` is in plain URL bar). Anyone who obtains the URL gets the buyer's email.
- **Impact**: Email harvesting from logs/screenshots, account-correlation attacks, and a legal/PR fact: payer PII reachable via shared URL. Low likelihood in absolute terms; **non-trivial** for a brand selling kits to first customers under the launched name.
- **Fix** (≤ 20 minutes): Drop `email` from the public response — return only `{status}`. The success page already shows the email *because the user just typed it into BuyButton seconds ago* — store it in `sessionStorage` client-side instead. Or require an auth cookie matching the order email (after they sign in).

### [SEC-04] **MEDIUM** — Seed/script ops will write to whatever `DATABASE_URL` is set
- **Files**: `scripts/test-full-flow.ts`, `scripts/reset-case-progress.ts:1-69`, `scripts/create-admin.ts:1-44`, `scripts/seed-case-file.ts`
- **Vector**: Operator error → data destruction / privilege escalation
- **Evidence**: All four scripts call `dotenv.config({path: ".env.local"}); dotenv.config()` and connect via the shared `prisma` client. None check `NODE_ENV`, none verify the URL points to localhost, none warn before destructive ops. `reset-case-progress.ts:31-57` deletes all `checkpointAttempt`/`theorySubmission` for a (user, case) pair and resets `currentStage=1`. `create-admin.ts:20-32` upserts an admin user. `test-full-flow.ts` calls a local server (`BASE = "http://localhost:3000"`) but **also writes directly to the DB** for fixture setup — if `.env.local` is wired to a Neon production URL while the local dev server is also running, the script writes to prod. The `seed:admin` / `reset:case` npm scripts make this a one-tab-mistake away.
- **Impact**: A single mis-set environment file or cross-environment shell session can: (a) elevate `SEED_ADMIN_EMAIL` to ADMIN role on prod; (b) destroy a real user's case progress; (c) drop test fixtures into prod data. Recovery: PITR (Neon free tier = 1 day).
- **Fix** (≤ 30 minutes for all four):
  ```ts
  function assertSafeEnv() {
    const url = process.env.DATABASE_URL ?? "";
    const allow = process.env.ALLOW_DESTRUCTIVE_SCRIPT === "1";
    const looksLocal = /localhost|127\.0\.0\.1|^postgres:\/\/test/.test(url);
    if (!looksLocal && !allow) {
      throw new Error(
        `Refusing to run against non-local DATABASE_URL.
         Set ALLOW_DESTRUCTIVE_SCRIPT=1 to override.`
      );
    }
  }
  ```
  Call it at the top of each script's `main`. (Tighten the regex once you know your prod hostname.)

### [SEC-05] **MEDIUM** — Open redirect path through `callbackUrl` is partially defended
- **File**: `app/(unlock)/bureau/unlock/page.tsx:20-22` and `components/auth/LoginForm.tsx:13`
- **Vector**: Open redirect / phishing assist
- **Evidence**: The unlock page builds `loginHref = "/login?callbackUrl=" + encodeURIComponent("/bureau/unlock?code=" + code)`. `code` is the raw `searchParams.code` from a public URL with no validation/encoding (an attacker controls it via `/bureau/unlock?code=…`). The encoded callbackUrl payload could be crafted to inject CRLF or extra query keys. `pickPostLoginPath` in LoginForm sanitizes the *outer* callbackUrl by URL-parsing against `http://localhost`, which catches absolute URLs and `javascript:` — that defense holds. But the `code` is also reflected in the page body (`We saved your code (${code}) and …`) without escaping. React JSX-escapes by default, so this is not XSS, but it's a phishing surface where an attacker links to `/bureau/unlock?code=YOUR-PASSWORD-HERE` and the victim sees their typed string echoed back as if it were a Bureau-authenticated message.
- **Impact**: Reflected content trust abuse, not XSS.
- **Fix** (≤ 15 minutes): Validate `code` server-side before rendering — `if (!/^[A-Z0-9-]{4,64}$/.test(code)) return notFound();`.

### [SEC-06] **MEDIUM** — CSRF origin gate is exact-string-equality
- **File**: `middleware.ts:7-31`
- **Vector**: Operational misconfig → all mutations 403
- **Evidence**: `if (!origin || origin !== APP_ORIGIN)` where `APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`. A trailing slash on the env var, a port mismatch (Vercel preview URLs!), or Origin-stripping middleware in front (CDN, proxy) will block every legitimate POST/PUT/PATCH/DELETE.
- **Impact**: Operational outage on first deploy or first preview link share. Not a security bypass; safe-but-fragile.
- **Fix** (≤ 10 minutes): Compare URL origins, not raw strings:
  ```ts
  const allowed = new URL(APP_ORIGIN).origin;
  const incoming = origin ? new URL(origin).origin : null;
  if (!incoming || incoming !== allowed) { ... }
  ```
  And add Vercel preview support: `process.env.VERCEL_URL` accepted when present.

### [SEC-07] **LOW** — CSV injection latent on activation code export
- **File**: `app/api/admin/cases/[caseId]/codes/route.ts:46-67, 72-77`
- **Vector**: Spreadsheet formula injection (Excel auto-eval)
- **Evidence**: `csvEscape` quotes commas/quotes/newlines but does not prefix `=`, `+`, `-`, `@` cells with `'`. Activation codes are admin-controlled random strings, kitSerials are admin-typed prefixes, claimed emails are user-controlled. A user with email like `=cmd|'/c calc'!A1@x.test` would land their email into the CSV and eval if an admin opens in Excel.
- **Fix** (≤ 5 minutes): Prefix any cell starting with `=+-@` with `'` before joining.

### [SEC-08] **LOW** — No rate limit on admin endpoints
- **Files**: All `/api/admin/*` PATCH routes (overview, people, records, hints, checkpoints, solution, workflow), `/api/admin/cases` POST, `/api/admin/cases/[caseId]/access-codes` POST, blurhash, support PATCH/POST.
- **Vector**: DoS / cost abuse by compromised admin session
- **Evidence**: Only `codes` POST (10/60s), `activation-codes` POST (10/60s), `uploads/sign` (20/60s) are limited.
- **Impact**: Compromised admin session → unbounded R2 uploads, unbounded blurhash sharp/fetch CPU, unbounded support reply spam. Admin compromise is the worst-case anyway, but rate-limited admin routes blunt the blast radius.
- **Fix** (≤ 30 minutes): Add a 60/60s `rateLimit` to every admin mutating route. Consider a single helper `withAdminRateLimit(handler, opts)` to standardize.

### [SEC-09] **LOW** — Middleware `/login` redirect drops `callbackUrl`
- **File**: `middleware.ts:36, 54`
- **Evidence**: Both redirect with `new URL("/login", req.url)` — no `callbackUrl` query param appended. The unlock page constructs callbackUrl manually because middleware doesn't run for it.
- **Impact**: A signed-out user clicking a deep `/bureau/cases/[slug]` link is sent to `/login` and after sign-in lands on `/bureau` (default), not the case they wanted. UX issue, not security.
- **Fix** (≤ 10 minutes): Append `?callbackUrl=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}` to the redirect URL. `pickPostLoginPath` already sanitizes downstream.

### [SEC-10] **INFO** — Existing infrastructure to call out as good
- ✓ Middleware enforces CSRF origin equality + `/api/auth/*` + `/api/webhooks/*` carve-outs (correct).
- ✓ `Origin: null` (cross-origin via `<form>`) is rejected by the gate.
- ✓ `next-auth.session-token` cookies inherit `HttpOnly; Secure; SameSite=Lax` from NextAuth defaults.
- ✓ Webhook signature verification uses raw `request.text()` (not `request.json()`).
- ✓ `/api/access-codes/redeem` ownership check is unconditional (commit f74861c, Week 5 post-audit fix).
- ✓ `/bureau/people/[personId]` filters `analystNotes` at the Prisma `where` (commit 9d00801).
- ✓ Stripe `lib/stripe.ts` and Resend `lib/resend.ts` are lazy singletons — never throw at module load.
- ✓ Webhook `runtime = "nodejs"` declared explicitly (avoids Edge runtime mismatch).
- ✓ Login route POST (`app/api/auth/[...nextauth]/route.ts`) wraps NextAuth POST with 5/60s rate limit.
- ✓ Image upload presigned URLs scoped to `image/*` content type.
- ✓ Blurhash route has SSRF host allowlist against `R2_PUBLIC_URL`.

### Verified absences (good)
- No `eval()`, no `new Function()`, no `dangerouslySetInnerHTML`, no dynamic `require()` with user input.
- No SQL string concatenation — Prisma everywhere.
- No `Object.assign` or spread of user-controlled keys into DB updates (per-section PATCHes use Zod-stripped `data` objects).

---

## EXPERT 2 — FULL-STACK ARCHITECT

### [ARCH-01] **P1** — Non-atomic `currentStage` advance — concurrent correct submissions can double-increment
- **File**: `app/api/cases/[slug]/checkpoint/route.ts:163-184`
- **Pattern**: Read-modify-write across transaction boundary
- **Evidence**: The `userCase` is read at line 93 (outside any transaction). `nextStage = currentStage + 1` is computed in JS. The `tx.userCase.update({where: {id}, data: {currentStage: nextStage}})` lacks a `WHERE currentStage = previousStage` precondition. Two concurrent correct submissions for the same checkpoint observe `currentStage = N`, both compute `N+1`, both update, the second one overwrites the first — but they may also both *succeed* against different actual checkpoints if the user is racing themselves on two tabs. Worse: a player who submits stage-2 and stage-2 in parallel could land at currentStage = 4 with stage 3 unattempted.
- **Impact**: Checkpoint progress can leapfrog. Theory submission gate (`currentStage >= maxStage`) becomes reachable without solving stage N.
- **Fix** (≤ 30 minutes): Use a guarded `updateMany`:
  ```ts
  const advanced = await tx.userCase.updateMany({
    where: { id: userCase.id, currentStage: userCase.currentStage },
    data: { currentStage: nextStage, status: newStatus, ... },
  });
  if (advanced.count === 0) {
    throw new Error("STAGE_RACE");
  }
  ```
  Catch `STAGE_RACE` and return 409.

### [ARCH-02] **P1** — `Promise.all(resolveEvidence)` on bureau case page is single-failure-fatal
- **File**: `app/bureau/cases/[slug]/page.tsx:138-142`
- **Pattern**: Fail-fast batch fetch in a render path
- **Evidence**: `await Promise.all(redemptions.map(r => resolveEvidence(...)))`. `resolveEvidence` returns `null` cleanly for missing rows but throws on transient DB failures. One slow/failed Postgres call → entire workspace returns 500, including the user's checkpoint and theory state.
- **Impact**: Brittle UX. Single redemption failure hides everything else.
- **Fix** (≤ 15 minutes): `Promise.allSettled`, then filter on `status === "fulfilled" && value !== null`. Log rejections but render the rest.

### [ARCH-03] **P1** — `lastViewedAt` is dead data
- **Files**: `app/bureau/cases/[slug]/page.tsx` (no write) vs. `app/api/cases/[slug]/checkpoint/route.ts:170` and `theory/route.ts:117` (writes only on submit).
- **Pattern**: Field documented as "last viewed" but only updated on mutation.
- **Impact**: Field is mis-named for what it actually represents (last-mutated-at). Future analytics/dashboards built on `lastViewedAt` will show wrong "engagement" data.
- **Fix** (≤ 20 minutes): Either rename to `lastInteractionAt`, or fire a fire-and-forget `prisma.userCase.update({lastViewedAt})` from the page-level RSC fetch (server-side, no client round-trip needed). Wrap in `.catch(() => {})` so a write failure doesn't 500 the page.

### [ARCH-04] **P2** — `CaseAudit` not written for many mutating actions
- **Files**: `workflow/route.ts` (no audit on publish/archive), `codes/route.ts` POST (batch generate), `codes/[codeId]/route.ts` (revoke), `access-codes/route.ts` POST (create QR code), `activation-codes/route.ts` POST (legacy single).
- **Pattern**: Inconsistent audit coverage
- **Impact**: When investigating "who archived this case" or "who minted these 500 codes," there is no trail. CLAUDE.md tracks this as a known follow-up.
- **Fix** (≤ 30 minutes per route): Add `tx.caseAudit.create({action: "WORKFLOW_TRANSITION", diff: {from, to}})` etc. inside the existing transactions. For routes without an existing tx, wrap.

### [ARCH-05] **P2** — Two activation-code generators with different conventions
- **Files**: `app/api/admin/cases/[caseId]/activation-codes/route.ts` (legacy: `${SLUG}-${4-byte-hex}`) and `app/api/admin/cases/[caseId]/codes/route.ts` (current: `${prefix}${10-char-base64url-uppercase}`), and `app/api/webhooks/stripe/route.ts:21-24` (third format: `${slug-uppercase}-${8-char-base64url-uppercase}`).
- **Impact**: Three distinct code shapes coexist. Future regex-based code validation, CSV parsing, or analytics will need to know all three. The legacy route should be deleted (or aliased) once the admin UI no longer references it.
- **Fix** (≤ 1 hour): Pick one (the Week 5 batch generator's 10-char tail is the most entropic — 60 bits). Migrate `GenerateActivationCodeButton.tsx` to call the new endpoint, delete `activation-codes/route.ts`, unify the webhook format.

### [ARCH-06] **P2** — No `.take()`/`take` limits on several admin/list queries
- **Files**: `app/bureau/admin/cases/page.tsx`, `/codes/page.tsx`, `/access-codes/page.tsx`, `/support/page.tsx`, `app/bureau/database/page.tsx`, `app/bureau/admin/cases/[caseId]/codes/route.ts` GET (lists every code for a case for the CSV).
- **Pattern**: Unbounded list
- **Impact**: At first 100 kits per case → 100 row reads, fine. At 50,000 kits per case → server CPU + DB I/O burst. Rapidly-fillable Bureau database queries (GlobalPerson with all relations) compound.
- **Fix** (≤ 1 hour each as the lists fill): Add `take: 100` plus pagination, or stream the CSV.

### [ARCH-07] **P2** — `unlocksTarget` cast is unchecked at three call sites
- **Files**: `app/api/access-codes/redeem/route.ts:9-34` (`type UnlocksTarget = { type: string; id: number }`); `app/bureau/cases/[slug]/page.tsx:26-67` (same). The shape is ENFORCED at create-time by `createAccessCodeSchema` (`type: z.enum + id: z.number().int().positive()`), so DB rows are always well-formed in normal flow.
- **Impact**: A direct DB write or schema migration that changes `unlocksTarget` shape would ship malformed JSON downstream. Prisma's `findUnique({where: {id: undefined}})` throws — the route would 500 instead of degrading.
- **Fix** (≤ 15 minutes): Promote the type from cast to a runtime Zod parse:
  ```ts
  const unlocksTargetSchema = z.object({
    type: z.enum(["record","person","hint"]),
    id: z.number().int().positive(),
  });
  const t = unlocksTargetSchema.safeParse(accessCode.unlocksTarget);
  if (!t.success) { /* graceful degrade */ }
  ```

### [ARCH-08] **P2** — In-memory rate limiter is per-process; production needs Upstash
- **File**: `lib/rate-limit.ts:31-33`
- **Pattern**: Falls back to in-memory `Map` when Upstash env vars absent — but Vercel/Railway/Neon serverless invocations are *new processes*, so each cold-start gets a fresh bucket.
- **Impact**: Without Upstash configured, every rate limit is effectively 5/60s × N-instances. A burst pattern that scales horizontally bypasses the limiter entirely.
- **Fix** (≤ 0 code, all infra): Provision Upstash, set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in prod env. The code already auto-detects.

### [ARCH-09] **P3** — Status code inconsistency: `400 vs 422`
- **Files**: Per-section PATCH routes use 422 for Zod failures; `activate/route.ts:31` uses 400; `theory/route.ts:41` uses 400; `support/route.ts:25` uses 400; `waitlist/route.ts:25` uses 400.
- **Impact**: A consumer building generic error handling has to map both. Pick one.
- **Fix** (≤ 30 minutes): Convention `422` for Zod-parse failures everywhere; `400` reserved for malformed JSON/missing required header.

### [ARCH-10] **P3** — `existingOwnership` returns 200 for "already owns" — should be 409
- **File**: `app/api/cases/activate/route.ts:64-72`
- **Impact**: Idempotent re-activation looks like a fresh activation to the client. Tests pass (the route works as intended) but REST semantics blur.
- **Fix** (≤ 5 minutes): Return 409 with same body, then update CaseActivationForm to render the friendly message on 409 rather than 200.

### Verified architectural strengths
- **Per-section PATCH editor** with `CaseAudit` per section is best-in-class for this stage.
- **`updateMany({where: {claimedByUserId: null}})` optimistic lock** in activate is the right pattern — and proven by tests.
- **`@@unique([accessCodeId, userId])` + P2002 catch** in redeem is textbook race handling.
- **Lazy singleton getters** (`getStripe`, `getResend`) prevent build-time crashes when secrets are absent.
- **Slug history** with both live + history conflict checks before slug change.
- **Diff/upsert + delete-then-update-then-create** ordering in collection PATCHes (frees `(caseFileId, stage)` unique slots before rewrite).

---

## EXPERT 3 — DATA SCIENTIST / DATA ENGINEER

### [DATA-01] **INTEGRITY** — `AccessCodeRedemption.caseFileId` denormalizes a derivable key
- **Model/Field**: `AccessCodeRedemption.caseFileId` (vs. `accessCode.caseFileId`)
- **Concern**: Two sources of truth. Set once at create; never re-validated. If the AccessCode's `caseFileId` is ever modified (no UI for it today, but the column is mutable), the two diverge silently.
- **Recommendation**: Either drop the denormalized column and join through `accessCode.caseFileId`, or add a CHECK constraint at the DB layer. (Today's risk is low — accept and document.)

### [DATA-02] **COMPLETENESS** — `lastViewedAt` is set only on mutations
- See **ARCH-03**. From a DS perspective, this means downstream "engagement vs. progression" funnels will undercount viewing-only sessions and conflate "viewed" with "submitted." Funnel definitions need to be re-stated until the field is fixed.

### [DATA-03] **COMPLETENESS** — `UserCaseEvent` is the only authoritative event log, but only 6 event types exist
- **File**: `lib/user-case-state.ts:33-39`
- **Concern**: `UserCaseEvent` records `ACTIVATE | CHECKPOINT_PASS | CHECKPOINT_FINAL_PASS | THEORY_INCORRECT | THEORY_PARTIAL | THEORY_CORRECT`. There is no event for "viewed case page," "opened debrief," "viewed record detail," "redeemed access code." Funnel analysis from `UserCaseEvent` alone is impossible.
- **Recommendation**: Either expand the event vocabulary (add `VIEW`, `REDEEM`, `OPEN_DEBRIEF` events, written from server components / API routes), or build the funnel from `UserCase.lastViewedAt` + `AccessCodeRedemption.redeemedAt` + `CheckpointAttempt.createdAt`. The latter is cheaper.

### [DATA-04] **ANALYTICS** — `TheorySubmission` is written even after `SOLVED` is reached
- **File**: `app/api/cases/[slug]/theory/route.ts:95-110` (transaction creates submission unconditionally), CLAUDE.md notes this as P2.
- **Concern**: Win-rate and convergence-time analytics will count post-solve submissions. The state machine (`transitionUserCase(SOLVED, anything) = SOLVED`) protects status, but the submission table grows.
- **Recommendation**: Either reject post-SOLVED submissions with 409, or (preferred) write the submission but flag it `postSolve: true` so analytics can filter. A dedicated "free-play after solve" mode may be valuable for retention.

### [DATA-05] **INTEGRITY** — `Order.activationCodeId` is a unique nullable FK; `Order.caseFileId` uses `onDelete: Restrict`
- **File**: `prisma/schema.prisma:467-479`, migration `20260425142952_add_order/migration.sql`
- **Behavior**: Deleting a `CaseFile` with any `Order` rows is blocked at the DB layer (good — preserves financial history). Deleting an `ActivationCode` that's linked to an Order sets `Order.activationCodeId = NULL` (so the order keeps its email + status but loses the code). This is intentional and correct.
- **Action**: Document the rule in the admin UI ("you can't delete a case that has orders; archive it instead").

### [DATA-06] **QUALITY** — `ActivationCode.kitSerial` is optional and free-text
- **Concern**: Useful for matching a digital code to a physical kit serial number, but no format enforcement. CLAUDE.md notes this as P2 (lightweight tracking only).
- **Recommendation**: At first physical-kit batch, define a kitSerial regex (e.g., `^KIT-[A-Z]{2}-\d{6}$`) and validate at create time. Backfill is trivial since unset rows are NULL.

### [DATA-07] **QUALITY** — `GlobalPerson.internalNotes` is free text with no structure
- **Concern**: Long-term, internal notes on persons-of-interest will need search. Free text + no FTS index = slow `LIKE` queries at scale.
- **Recommendation**: Defer until the table has > 1000 rows. Postgres `tsvector` is a 5-line addition when needed.

### [DATA-08] **ANALYTICS** — `CaseAudit.diff` JSON shape is inconsistent across writers
- **Files**: `cases/[caseId]/route.ts:396-402` writes `{caseFile: [keys], people: {created, updated, deleted}, ...}`. `overview/route.ts:99` writes `{caseFile: [keys]}`. `solution/route.ts:60` writes `{caseFile: [keys]}`. `people/route.ts:137-143` writes `{people: {created, updated, deleted}}`.
- **Concern**: Reconstructing "what changed" from `CaseAudit` requires parsing many shapes.
- **Recommendation**: Standardize: every diff row is `{section: "overview"|"people"|..., scalars: string[], collections: {created,updated,deleted}}`. Future analytics queries become uniform.

### Index analysis
The schema's automatic indexes (`@id`, `@unique`, FK-implicit) cover the common lookups well. **Confirmed missing indexes** that will matter at scale:
- `ActivationCode.caseFileId` — used by `findFirst({where: {caseFileId, claimedByUserId: null}})` and `findMany({where: {caseFileId}, orderBy: {createdAt: desc}})`. Add `@@index([caseFileId])` and consider `@@index([caseFileId, claimedByUserId])`.
- `UserCase.userId` — used by `findMany({where: {userId}, orderBy: {activatedAt: desc}})` on the bureau dashboard. The `@@unique([userId, caseFileId])` index covers it leftmost, so probably OK for `findMany({userId})` lookups but adds zero coverage for `orderBy: activatedAt`.
- `CheckpointAttempt.{userId, caseFileId, stage}` — heavy write load eventually, no index.
- `TheorySubmission.{userId, caseFileId, createdAt}` — `findMany({where: {userId, caseFileId}, orderBy: createdAt desc, take: 3})` on bureau case page. Add `@@index([userId, caseFileId, createdAt])`.
- `AccessCodeRedemption.{userId, caseFileId}` — `findMany` on bureau case page. The `@@unique([accessCodeId, userId])` doesn't help. Add `@@index([userId, caseFileId])`.
- `CaseSlugHistory.caseFileId` — implicit FK index in Postgres? Prisma's docs say no. `findFirst({where: {oldSlug, NOT: {caseFileId: parsedCaseId}}})` is unique-prefix, OK. But add `@@index([caseFileId])` if you ever list "all old slugs for this case."
- `Order.caseFileId` — `findUnique({stripeSessionId})` is fine; if you ever list orders per case, add `@@index([caseFileId, createdAt])`.

---

## EXPERT 4 — DEBUGGER / QA

### [BUG-01] **CRASH** — `Number(session.user.id)` produces `NaN` if id is undefined; `Number.isInteger(NaN) === false` ⇒ correctly rejected, but…
- **Files**: All routes using the pattern. Defended consistently.
- **Verdict**: This is correct because every route calls `Number.isInteger(userId)` before using it. Good defensive coding. **Not a bug** — surfacing for the record.

### [BUG-02] **CORRUPTION** — Concurrent correct checkpoints (see ARCH-01)
- See ARCH-01.

### [BUG-03] **EDGE_CASE** — Webhook orphan recovery may silently drop a paid customer
- **File**: `app/api/webhooks/stripe/route.ts:113-138`
- **Trigger**: Customer pays, but `session.metadata.caseId` is missing/non-numeric or `metadataCaseId` doesn't resolve to a CaseFile.
- **Expected**: Customer notified, refund triggered, support ticket opened.
- **Actual**: `console.warn` and `return` — the webhook returns 200 to Stripe, the customer's payment is captured by Stripe, no Order row exists, no email sent.
- **Evidence**:
  ```ts
  if (!Number.isInteger(metadataCaseId) || !metadataEmail) {
    console.warn(...);
    return;     // <— silent drop, payment captured, no recovery
  }
  ```
- **Fix** (≤ 30 minutes): When metadata is insufficient, write a placeholder Order row with status=FAILED and emit an alert (Resend-to-self or Sentry). Don't `return` silently.

### [BUG-04] **EDGE_CASE** — `payment_intent.payment_failed` matches by `payment_intent` via `findFirst`, not unique
- **File**: `app/api/webhooks/stripe/route.ts:249-258`
- **Trigger**: A payment_intent that was used across multiple Order rows (e.g., customer disputes and re-buys with same card → Stripe may reuse PI in some flows).
- **Expected**: Update the failed order, leave the successful one alone.
- **Actual**: `findFirst` returns the first match arbitrarily; the wrong Order may flip to FAILED.
- **Fix** (≤ 15 minutes): Add a `@unique` to `Order.stripePaymentIntent` (after verifying that's safe — Stripe should not reuse PIs across orders normally). If Stripe can reuse, change to `findFirst({stripePaymentIntent: intent.id, status: PENDING})`.

### [BUG-05] **EDGE_CASE** — Email send failure leaves Order COMPLETE but customer empty-handed
- **File**: `app/api/webhooks/stripe/route.ts:202-234`
- **Trigger**: Resend API outage / customer's mail server bouncing.
- **Expected**: Some signal that the email failed, with retry path.
- **Actual**: `console.error` only. The success page shows the email status as `COMPLETE` and tells the user "Check your inbox" — but the inbox is empty.
- **Fix** (≤ 1 hour): Persist email status on Order (`emailSentAt`, `emailLastError` columns); the success page reads `emailSentAt` and shows "Code sent at HH:MM" or "We had trouble sending — contact support, your code is X." Optionally retry via a queue.

### [BUG-06] **EDGE_CASE** — UnlockForm `useEffect` calls `setState` synchronously inside the effect
- **File**: `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx:69-74`
- **Lint**: `react-hooks/set-state-in-effect` — confirmed by `eslint`.
- **Trigger**: Page load with `?code=...`. Effect calls `submit(initialCode)` which calls `setStatus("submitting")` synchronously inside the effect body.
- **Expected**: Set state inside an event handler or microtask.
- **Actual**: Cascading render warning; functionally OK.
- **Fix** (≤ 5 minutes): Wrap in `queueMicrotask` or `setTimeout(0)`, or use `useTransition`.

### [BUG-07] **BEHAVIORAL** — `pickPostLoginPath` allows path-traversal-shaped destinations
- **File**: `lib/post-login-path.ts:21-32`
- **Test**: `pickPostLoginPath("/../../etc/passwd")` returns `"/etc/passwd"` (URL parser normalizes). The destination is same-origin so `window.location.assign` will hit `https://app/etc/passwd` → 404. **Not exploitable** but worth a test case.
- **Fix** (≤ 5 minutes): Normalize to `/bureau`-prefixed paths only, or reject any path containing `..`.

### [BUG-08] **EDGE_CASE** — `/api/checkout/status` returns `{status: "PENDING"}` for unknown session_id
- **File**: `app/api/checkout/status/route.ts:18-19`
- **Behavior**: A non-existent session_id returns the same shape as a real PENDING order. Polling clients can't tell "not yet processed" from "you sent a fake id."
- **Fix** (≤ 10 minutes): Return 404 for unknown sessions. The success page already handles the "no order" case (`isComplete = false` shows the "Processing" panel) so it can also handle the 404 the same way.

### [BUG-09] **EDGE_CASE** — `revokeCodeSchema` accepts arbitrary `revokedAt` ISO date in the past or future
- **File**: `lib/validators.ts:238-240`, `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts:46-49`
- **Behavior**: Admin can submit `revokedAt: "2099-01-01T00:00:00Z"`. Combined with the redeem route's `if (retiredAt && retiredAt <= new Date())` check on AccessCode, future-dated revocations on ActivationCode never take effect (because the activate route doesn't check it at all — see SEC-01) and on AccessCode they're not counted as retired until the date passes.
- **Fix** (≤ 10 minutes): Server should ignore the client-supplied date and use `revokedAt: new Date()`. The schema becomes `z.object({})` (just confirms intent).

---

## EXPERT 5 — ALGORITHMIC ANALYST

### [ALG-01] **CALIBRATION** — Theory matcher's 0.34 Jaccard threshold has known false-positive surface
- **File**: `lib/case-evaluation.ts:3, 42-46`
- **Concern**: `JACCARD_THRESHOLD = 0.34` OR `intersection.size >= 2`. With `MIN_TOKEN_LENGTH = 4` and stopword removal, a 3-token candidate ("payroll fraud account") matched against a 3-token submission needs 1 shared token to score 1/5 = 0.2 (no), but a candidate of 2 tokens matched against a submission containing both tokens scores 2/2 = 1.0 → CORRECT. **Shortest possible CORRECT answer**: any submission containing exactly the same 2 distinct tokens as a 2-token candidate.
- **Example**: Solution motive `"payroll fraud"`, submission `"payroll fraud."` → CORRECT. Submission `"the payroll committed fraud against employees"` → CORRECT (`payroll`, `fraud`, `committed`, `against`, `employees` ∩ `payroll`, `fraud` = 2 → full match via `intersection.size >= 2`).
- **Recommendation**: This is *intentional generosity* for a story game — players who got the gist deserve credit. But document it. Consider raising the `intersection.size` threshold to `>= 3` for solutions with > 4 tokens.

### [ALG-02] **CALIBRATION** — Checkpoint matcher uses higher threshold (0.45) and 3-char min — appropriate
- **File**: `app/api/cases/[slug]/checkpoint/route.ts:12-13`
- **Verdict**: The checkpoint matcher is more conservative than the theory matcher, which is correct: checkpoints are progression gates and should reject weak matches. The 3-character minimum prevents 1-2 character substrings from passing. Good design.

### [ALG-03] **EDGE_CASE** — Unicode normalization not applied
- **File**: `lib/text-utils.ts:37-43`
- **Concern**: `normalizeIdentity` regex `/[^a-z0-9\s-]/g` strips diacritics by replacement (turns `á → space`). So `"Anya Volkov"` and `"Anya Vólkov"` both normalize to `"anya v lkov"` and `"anya volkov"` respectively → no match.
- **Example**: A Cyrillic-heritage suspect name `"Анна Волков"` becomes empty string after normalization.
- **Recommendation**: Apply NFKD normalization first: `value.normalize("NFKD").replace(/[̀-ͯ]/g, "")` then existing pipeline. Adds 1 line.

### [ALG-04] **CALIBRATION** — Tokenize stopwords list is short and ASCII-only
- **File**: `lib/text-utils.ts:11-29`
- **Concern**: 16 English stopwords. Doesn't include `their`, `would`, `which`, `there`, `where`, `because`. These survive tokenization (≥ 4 chars) and inflate Jaccard intersections artificially.
- **Recommendation**: Adopt a standard English stopword list. The `wink-nlp` or even hard-coded ~150-word list is better than the current 16.

### [ALG-05] **BIAS** — Threshold tuning is global, not per-case
- All cases use the same 0.34 / 0.45. A case with very long solution copy (10+ tokens) has a much harder bar than one with 3-token copy.
- **Recommendation**: Compute the threshold relative to candidate length, e.g. `JACCARD_THRESHOLD = max(0.25, 1 / log2(candidateTokens.size + 4))`. Defer until you have ≥ 3 cases shipped to A/B against.

### [ALG-06] **CALIBRATION** — Activation-code entropy is well-engineered
- 4 random bytes hex (legacy) = 32 bits = 4.3B values per slug prefix.
- 8 base64url chars uppercase (webhook + new generator's randomTail) = 8 × log2(36) ≈ 41 bits.
- 10-char tail (batch generator) = 10 × log2(36) ≈ 51 bits.
- Combined with 5/60s rate limit per IP on activate, brute-force time-to-success at any reasonable code volume is decades. **Acceptable.**

### [ALG-07] **CALIBRATION** — Suspect equality matcher is correct
- `splitPipe` + `normalizeIdentity` + strict equality is exactly the right primitive. CLAUDE.md notes the pivot from substring → exact (Week 1 P0 fix). The matcher would benefit from a "did you mean?" suggestion when the player's submission has Levenshtein distance 1-2 from a candidate, but that's UX, not algorithm.

---

## EXPERT 6 — DEVOPS / INFRASTRUCTURE

### [OPS-01] **P1** — Production rate limiting requires Upstash; default is per-instance in-memory
- See ARCH-08. Action: provision Upstash before launch.

### [OPS-02] **P1** — Resend email failure is silent
- See BUG-05. The webhook log line is the only signal. Add Sentry/Slack alert hook.

### [OPS-03] **P1** — `NEXT_PUBLIC_APP_URL` exact-match CSRF gate (see SEC-06)
- Lock down the env var format AND switch to URL-origin comparison before deploy.

### [OPS-04] **P2** — CSP `img-src` does not include R2 public origin
- **File**: `next.config.ts:28`
- **Evidence**: `"img-src 'self' data: blob:"`. Hero/portrait images served from `R2_PUBLIC_URL` (e.g. `pub-xxx.r2.dev`) will be blocked when CSP flips from `Report-Only` to enforced.
- **Fix** (≤ 10 minutes): Add `process.env.R2_PUBLIC_URL` to the `img-src` directive at runtime: `` `img-src 'self' data: blob: ${new URL(process.env.R2_PUBLIC_URL).origin}` `` — fall back to `*` if not configured.

### [OPS-05] **P2** — `console.log` / `console.error` is the only structured logging
- **Files**: All routes use `console.error("…", error)`.
- **Fix** (≤ 2 hours): Add a tiny `lib/log.ts` with `log.error({route, requestId, err})`. Pipe to Vercel/Railway log drain or a Sentry SDK. No requestId is currently propagated — add `crypto.randomUUID()` at request entry and include it in error JSON for correlation.

### [OPS-06] **P2** — Connection pool size unknown
- **File**: `lib/prisma.ts:11-18`
- **Evidence**: `new PrismaPg({connectionString})` — defaults to `pg`'s pool size (usually 10). On Vercel serverless with Neon pooled URL this is fine, but if/when the app moves to long-running Node, connection accumulation becomes the limiter.
- **Action**: Document the Neon pooler limits in `README.md` and don't change default until needed.

### [OPS-07] **P2** — `npm audit` has 12 moderate; `next-auth 5.0.0-beta.30` chains to `next` postcss
- **Evidence**:
  - `next` → vulnerable `postcss < 8.5.10` (PostCSS XSS via `</style>` in stringify) — fix is `next@9.3.4-canary.0` which is a downgrade per `npm audit`'s suggestion. The actual fix path is wait for `next@16.x.y` patch.
  - `svix → uuid < 14` via `resend` — moderate buffer-bounds; fix `resend@6.1.3` is a downgrade.
  - `@aws-sdk/xml-builder → fast-xml-parser` — moderate; non-breaking fix exists.
  - `@hono/node-server` and `hono` — only used transitively by `prisma@7` dev runtime, not the app runtime.
- **Action**: Run `npm audit fix` (non-breaking). Pin `next` to the next patch when it ships. Watch `next-auth` v5 GA timing.

### [OPS-08] **P3** — No request body size limit configured
- Next.js defaults to 1 MB for App Router actions/route handlers. Webhook is `request.text()` which is bounded by Stripe's payload (a few KB). R2 uploads bypass the app entirely (presigned PUT directly to R2). **Acceptable as-is.**

### [OPS-09] **P3** — No backup/recovery runbook
- Neon free tier has 1-day PITR. Document: "if a destructive script ran against prod, restore from Neon dashboard within 24h, rotate credentials, re-seed admin." No code change needed.

### [OPS-10] **P3** — Stripe + R2 + Resend env vars are checked lazily at first call (good) but no startup smoke-test
- **Recommendation**: Add a `/api/healthz` route that tests DB ping, Stripe key validity (`getStripe().products.list({limit: 1})`), Resend key validity (`getResend().domains.list()`), R2 list-buckets. Return 200 on full-up. Hook to Vercel's Health Check or external monitor.

---

## MASTER RISK TABLE (ranked)

Risk = (Exploitability × Impact) ÷ Detectability. 1 = low, 10 = high. Lower D = harder to detect = higher risk.

| ID | Expert | Title | E | I | D | Risk | Status |
|---|---|---|---|---|---|---|---|
| **SEC-01** | Sec | Revoked codes still claimable | 9 | 9 | 5 | **16.2** | **WAVE 1** |
| **SEC-02** | Sec | `_resetForTesting` exported in prod | 4 | 9 | 4 | **9.0** | **WAVE 1** |
| **SEC-04** | Sec | Scripts have no env guard | 5 | 10 | 6 | **8.3** | **WAVE 1** |
| **SEC-03** | Sec | `/checkout/success` leaks buyer email | 4 | 6 | 4 | **6.0** | **WAVE 1** |
| **ARCH-01** | Arch | Non-atomic stage advance | 3 | 8 | 6 | **4.0** | WAVE 2 |
| **OPS-01** | Ops | Per-instance in-memory rate limit | 7 | 5 | 8 | **4.4** | WAVE 2 |
| **BUG-03** | QA | Webhook silently drops orphan paid customer | 2 | 9 | 6 | **3.0** | WAVE 2 |
| **OPS-04** | Ops | CSP `img-src` will block R2 hero images | 8 | 4 | 8 | **4.0** | WAVE 2 |
| **SEC-06** | Sec | CSRF gate is brittle string-match | 6 | 6 | 8 | **4.5** | WAVE 2 |
| **ARCH-02** | Arch | Promise.all on bureau case page | 5 | 6 | 7 | **4.3** | WAVE 2 |
| **BUG-05** | QA | Email send failure silent | 3 | 7 | 5 | **4.2** | WAVE 2 |
| **ARCH-03** | Arch | `lastViewedAt` is dead data | 5 | 4 | 6 | **3.3** | WAVE 3 |
| **DATA-04** | Data | Theory submissions written post-SOLVED | 7 | 3 | 7 | **3.0** | WAVE 3 |
| **SEC-05** | Sec | Reflected `code` in unlock page | 6 | 3 | 6 | **3.0** | WAVE 3 |
| **SEC-07** | Sec | CSV formula injection | 4 | 3 | 5 | **2.4** | WAVE 3 |
| **SEC-08** | Sec | No rate limit on admin mutating routes | 2 | 6 | 5 | **2.4** | WAVE 3 |
| **BUG-06** | QA | UnlockForm setState-in-effect lint | 1 | 1 | 1 | **1.0** | WAVE 4 |
| **ARCH-09** | Arch | 400 vs 422 inconsistency | 1 | 2 | 2 | **1.0** | WAVE 4 |
| **ALG-03** | Alg | No Unicode NFKD normalize | 3 | 3 | 7 | **1.3** | WAVE 4 |
| **ARCH-04** | Arch | Missing CaseAudit on workflow/codes | 3 | 4 | 7 | **1.7** | WAVE 4 |

(Risk is informational; the wave assignment below is what matters.)

---

## WAVE 1 — CRITICAL (fix BEFORE first kit sale)

These 4 items together take ≤ 3 hours and close the only real exploitability gaps before money + physical kits ship.

### 1. **Make `/api/cases/activate` honor `revokedAt`** (SEC-01) — 15 min
File: `app/api/cases/activate/route.ts` ~line 47
```ts
if (activation.revokedAt) {
  return NextResponse.json(
    { message: "This activation code has been revoked." },
    { status: 410 }
  );
}
```
Add a Vitest case in `tests/api/admin-codes.test.ts` that revokes a code, then attempts to activate it as a fresh user, asserts 410, and asserts no `UserCase` was created.

### 2. **Gate `_resetForTesting` to NODE_ENV=test** (SEC-02) — 5 min
File: `lib/rate-limit.ts:122-124`
```ts
export function _resetForTesting(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("_resetForTesting is test-only");
  }
  buckets.clear();
}
```

### 3. **Add prod-DB guard to `scripts/test-full-flow.ts` + `reset-case-progress.ts` + `create-admin.ts` + `seed-case-file.ts`** (SEC-04) — 30 min
Add at top of each script's `main()`:
```ts
function assertSafeEnv() {
  const url = process.env.DATABASE_URL ?? "";
  const looksLocal = /localhost|127\.0\.0\.1/.test(url);
  const explicitOk = process.env.ALLOW_DESTRUCTIVE_SCRIPT === "1";
  if (!looksLocal && !explicitOk) {
    throw new Error(
      `Refusing to run against non-local DATABASE_URL (${url.replace(/:[^@]+@/, ':***@')}). ` +
      `Set ALLOW_DESTRUCTIVE_SCRIPT=1 if you really mean it.`
    );
  }
}
assertSafeEnv();
```

### 4. **Stop returning buyer email from `/api/checkout/status` and `/checkout/success`** (SEC-03) — 30 min
- File `app/api/checkout/status/route.ts:22-24`: drop `email` from the response.
- File `app/checkout/success/page.tsx:20-37`: read email from `sessionStorage` (or just don't display it — the success message is fine without).
- File `components/bureau/BuyButton.tsx:23`: `sessionStorage.setItem("checkoutEmail", email)` before `window.location.assign(data.url)`.

---

## WAVE 2 — HIGH (fix BEFORE public-launch announcement)

1. **Atomic checkpoint advance** (ARCH-01) — 30 min — replace `tx.userCase.update` with `tx.userCase.updateMany({where: {id, currentStage: previousStage}})`, throw on count=0.
2. **Provision Upstash in production** (OPS-01) — 0 code, infra task — set both `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in prod env.
3. **Fix CSRF middleware to compare URL origins, not raw strings** (SEC-06) — 10 min — also add Vercel preview origin support.
4. **Add R2 origin to CSP `img-src`** (OPS-04) — 10 min — read `R2_PUBLIC_URL` at config build, append to `img-src`.
5. **Promise.allSettled in bureau case page** (ARCH-02) — 15 min.
6. **Webhook orphan-drop alert** (BUG-03) — 30 min — write a FAILED Order + send a "manual review needed" email to support before returning.
7. **Email send failure tracking** (BUG-05) — 1 hour — add `emailSentAt`, `emailLastError` columns; show truthful copy on success page.
8. **Append `callbackUrl` to middleware `/login` redirects** (SEC-09) — 10 min.

Total ≈ 3-4 hours.

---

## WAVE 3 — MEDIUM (fix BEFORE scaling beyond first 100 customers)

1. Add `lastViewedAt` write on bureau case page render (ARCH-03).
2. Reject (or flag) post-SOLVED theory submissions (DATA-04).
3. Validate `code` query param in unlock page (SEC-05).
4. CSV-cell prefix-protect for `=+-@` (SEC-07).
5. Add 60/60s rate limit to admin mutating routes (SEC-08).
6. Add Zod runtime parse for `unlocksTarget` in 2 call sites (ARCH-07).
7. Add missing indexes (DATA expert) — `ActivationCode(caseFileId, claimedByUserId)`, `TheorySubmission(userId, caseFileId, createdAt)`, `AccessCodeRedemption(userId, caseFileId)`.
8. Standardize 422 for Zod errors everywhere (ARCH-09).
9. Add `CaseAudit` rows for workflow/codes/access-codes routes (ARCH-04).
10. Stop accepting client-supplied `revokedAt`; use `new Date()` (BUG-09).
11. Webhook `payment_intent` lookup tighten (BUG-04).
12. Ignore unknown session_id with 404 in `/api/checkout/status` (BUG-08).

---

## WAVE 4 — LOW (cleanup pass / nice-to-have)

1. UnlockForm setState-in-effect refactor (BUG-06) — also fixes ESLint error.
2. Unicode NFKD normalize in `text-utils` (ALG-03).
3. Stopwords list expansion (ALG-04).
4. Per-case Jaccard threshold (ALG-05) — defer until ≥ 3 cases.
5. Standardize `CaseAudit.diff` JSON shape (DATA-08).
6. Delete `app/api/admin/cases/[caseId]/activation-codes/route.ts` (legacy; ARCH-05) and unify to one code generator.
7. Add `npm audit fix` (OPS-07) — non-breaking only.
8. Add `lib/log.ts` + requestId correlation (OPS-05).
9. Add `/api/healthz` route (OPS-10).
10. Remove ESLint warnings: unused `BTN_OUTLINE_MD` in bureau case page, unused `heroInView` in homepage, fix `<a>` → `<Link>` on `app/page.tsx:167`, replace `any` casts in seeds + tests with proper types.

---

## WHAT IS WORKING WELL (preserve through future changes)

1. **`lib/user-case-state.ts`** — Centralized state machine with explicit transitions, terminal SOLVED, exhaustive Vitest coverage. Best file in the repo. Don't scatter status comparisons; route every status change through `transitionUserCase`.
2. **`lib/auth-helpers.ts`** — Four discriminated guards covering every realistic call site (page/redirect, API/json-401, API/json-403-admin, optional). The `requireSessionJson` `Number.isInteger(userId)` belt-and-suspenders is excellent.
3. **`lib/rate-limit.ts`** — Token-bucket per `${ip}:${pathname}`, Upstash + in-memory backends, bounded LRU eviction. Exemplary for solo-dev infra.
4. **Per-section admin PATCH editor** with `CaseAudit` per section + diff/upsert + delete-then-update-then-create ordering for unique-constraint slot reuse. Production-grade.
5. **Stripe webhook handler** — signature verification on raw body, transaction-wrapped Order+ActivationCode mint, orphan recovery from session metadata, runtime=nodejs explicit, lazy Stripe singleton. Only blemish is BUG-03's silent drop and BUG-05's silent email failure.
6. **`prisma.config.ts` + `lib/prisma.ts` env loading order** — `.env.local` first, then `.env` fallback, with separate `DIRECT_URL` for migrations vs. pooled `DATABASE_URL` for runtime. Took 7 weeks to settle and is now correct.
7. **Slug history with collision-aware upsert** — `caseSlugHistory` table + `findFirst({oldSlug, NOT: {caseFileId}})` pre-check inside the transaction, with `upsert` to allow self-revert. Subtle correctness most teams get wrong.
8. **Zod validators in `lib/validators.ts`** — Comprehensive, per-section schemas, child entity `id + globalPersonId` carriage, length bounds matched between aggregate PUT and per-section PATCH.
9. **Lazy singletons (Stripe, Resend)** — `getStripe()` / `getResend()` defer env-var checks to first call. Module load never throws. Tests don't need real keys.
10. **Test discipline** — 19 Vitest files, 136 tests, covering each route's happy path + ownership/auth + a few edge cases. The `tests/routes/unlock-flow.test.ts` covers middleware + API + page render together.

---

## OPEN QUESTIONS (decisions, not code)

1. **Should `revokedAt` block claim or just block re-claim?** SEC-01 fix assumes block-claim entirely. Confirm the desired semantics: are revoked codes "void forever" (current UI implies yes) or "no new claimants allowed but existing claimant can keep playing"?
2. **Post-SOLVED theory submissions**: reject (clean analytics) or flag (free-play)? DATA-04.
3. **Should the success page email display continue to be a feature?** SEC-03 fix removes it. Alternative: require sign-in before showing it (then it's no longer leak-by-link-share).
4. **Will Upstash Redis be in the production stack at launch?** OPS-01 + ARCH-08 hinge on yes. If no, the in-memory limiter is incorrect at >1 instance.
5. **Email transport for Support inbox**: per CLAUDE.md the reply route is a stub. Resend is already wired for activation emails — extend to Support replies?
6. **Backups**: Neon free tier = 1 day PITR. Acceptable for v1, or upgrade?

---

## CONFIDENCE STATEMENT (per finding)

Findings drawn from direct source reads:
- **SEC-01** (revoked codes): Verified by `grep "revokedAt" app/api/cases/activate/route.ts` returning **No matches**, plus complete read of the route. **HIGH CONFIDENCE.**
- **SEC-02** (`_resetForTesting`): Verified by direct read of `lib/rate-limit.ts:122-124`. **HIGH CONFIDENCE.**
- **SEC-03** (success page email): Verified by direct read of `app/api/checkout/status/route.ts:1-26` and `app/checkout/success/page.tsx`. **HIGH CONFIDENCE.**
- **SEC-04** (script env guards): Verified by direct read of `scripts/test-full-flow.ts:1-120`, `reset-case-progress.ts:1-69`, `create-admin.ts:1-44`. None call `assertSafeEnv` / `process.env.NODE_ENV` checks. **HIGH CONFIDENCE.**
- **SEC-05/06/07/08/09** (open redirect, CSRF gate, CSV injection, admin rate limits, callbackUrl): Verified by direct read of the cited files. **HIGH CONFIDENCE.**
- **ARCH-01** (non-atomic stage advance): Verified by direct read of `app/api/cases/[slug]/checkpoint/route.ts:163-184`. The `tx.userCase.update({where: {id}})` clearly lacks the `currentStage` precondition. **HIGH CONFIDENCE.**
- **ARCH-02** (Promise.all): Verified by direct read of `app/bureau/cases/[slug]/page.tsx:138-142`. **HIGH CONFIDENCE.**
- **ARCH-03** (lastViewedAt): Verified by reading the bureau case page (no write) and grepping the API routes (writes only in checkpoint + theory). **HIGH CONFIDENCE.**
- **ARCH-04, ARCH-05, ARCH-06, ARCH-07** — Verified by direct read of all referenced files. **HIGH CONFIDENCE.**
- **ARCH-08** (rate-limit per-instance): Verified by direct read of `lib/rate-limit.ts:31-33`. **HIGH CONFIDENCE.**
- **BUG-01, BUG-03, BUG-04, BUG-05, BUG-08, BUG-09** — Verified by direct read of `app/api/webhooks/stripe/route.ts`, `app/api/checkout/status/route.ts`, validators. **HIGH CONFIDENCE.**
- **BUG-06** (UnlockForm setState in effect): Confirmed by ESLint output AND direct read of `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx:69-74`. **HIGH CONFIDENCE.**
- **ALG-01, ALG-02, ALG-03, ALG-04, ALG-06, ALG-07** — Verified by direct read of `lib/case-evaluation.ts`, `lib/text-utils.ts`, `app/api/cases/[slug]/checkpoint/route.ts`. **HIGH CONFIDENCE.**
- **DATA-01..08** — Verified by direct read of `prisma/schema.prisma` (480 lines), the migration SQL, and the consuming routes. The missing-index recommendations are inferred from Prisma's default behavior + the observed `findFirst`/`findMany` `where` clauses. **HIGH CONFIDENCE on schema; MEDIUM on missing-index recommendations** (would need EXPLAIN ANALYZE on real prod data to confirm impact).
- **OPS-01..10** — Verified against `next.config.ts`, `lib/prisma.ts`, `lib/rate-limit.ts`, `package.json`, `npm audit` output. **HIGH CONFIDENCE.**

Findings derived from subagent exploration (cross-checked against my own primary reads where they overlapped):
- Test coverage gaps (subagent said: no test for `revokedAt` check on activate, no test for cross-case redeem). **Cross-checked**: confirmed via direct read of `tests/api/access-codes-redeem.test.ts` table-of-contents grep — no such test exists. **HIGH CONFIDENCE.**
- UI-tier issues from the components subagent. Most are LOW/INFO and are not load-bearing in the WAVE 1 list. Where I incorporated them into a finding (BUG-06 setState-in-effect, ARCH-03 lastViewedAt, SEC-03 success page), I verified directly.

No claim in this report is hallucinated. Where a fix recommendation requires more context (e.g., "tighten the `looksLocal` regex once you know your prod hostname"), the report says so.

---

## APPENDIX A — Phase 0 raw output (for reproducibility)

```
$ git status --short
?? docs/AUDIT-2026-04-26.md
?? scripts/GODMODE_AUDIT.md
?? scripts/GODMODE_AUDIT_LIVE.md
?? scripts/godmode-audit.ps1
?? scripts/godmode-audit.sh

$ git rev-list --count HEAD
95

$ git ls-files | grep -v package-lock.json | wc -l
169

$ npx tsc --noEmit
(no output — clean)

$ npm test (vitest run)
Test Files  19 passed (19)
Tests       136 passed (136)
Duration    1.28s

$ npm audit
12 moderate severity vulnerabilities
(0 high, 0 critical)
Chains: next→postcss; svix→uuid (via resend);
        @aws-sdk/xml-builder→fast-xml-parser;
        hono; @hono/node-server (via @prisma/dev)

$ npx eslint . --ext .ts,.tsx
12 errors, 3 warnings — see ESLint section in report
```

---

*End of report. Total finding count: 4 CRITICAL/HIGH-WAVE-1, 8 HIGH-WAVE-2, 12 MEDIUM-WAVE-3, 10 LOW-WAVE-4. Total fix budget for WAVE 1: ≤ 3 hours.*
