Confirmed: I have read the entire prompt and understand the role (75-mind fused audit), the gating (Phase 0 → 1 → 2 → 3, sequential, no skipping), the read-only constraint (no edits/migrations/installs/deploys), the citation discipline (only claims I can quote from disk), and the prohibition on flattery, vagueness, or sycophancy.

Beginning Phase 0.

# PHASE 0 — BOOT

## 0.1 Working tree enumeration

Working tree clean, HEAD at `76a30ac`, 239 tracked files. Six migrations on disk. Now reading the boot files.

# PHASE 0 — BOOT REPORT

**Repo state.** Git HEAD `76a30ac` on `main`, working tree clean. 239 tracked files: 88 `.ts`, 87 `.tsx`, 40 `.md`, 6 `.sql`, 1 `.prisma`, plus configs.

**Stack versions (verified in `package.json`).** Node 20+ target (tsconfig ES2017 — dated), Next 16.2.3, React 19.2.4, NextAuth 5.0.0-beta.30 (still beta), Prisma 7.7.0 + adapter-pg 7.8.0, Zod 4.3.6, Stripe 22.1.0 (apiVersion pin verified `2026-04-22.dahlia`), Resend 6.12.2, sharp 0.34.5, bcryptjs 3.0.3, @upstash/ratelimit 2.0.8, @aws-sdk/client-s3 3.1032.0, lucide-react ^1.8.0 (suspect pin — flagged in prior audits, deferred). Strict TS clean.

**Integrations.** Neon Postgres (pooled `DATABASE_URL` + direct `DIRECT_URL`); Stripe (Checkout + signed webhook); Resend (transactional email); Cloudflare R2 via @aws-sdk/client-s3 (presigned PUT); Upstash Redis (rate-limit prod backend); Vercel Cron (`/api/cron/cleanup-pending-orders`).

**Migration timeline (linear, 6 migrations).**

| # | Timestamp | What |
|---|---|---|
| 1 | `20260425045353_init` | full schema cold start (9 enums, 22 tables) |
| 2 | `20260425142952_add_order` | Order + OrderStatus + ActivationCodeSource |
| 3 | `20260426163724_add_order_email_tracking` | Order.emailSentAt/emailLastError |
| 4 | `20260426200000_add_password_reset` | User.passwordResetToken/expiresAt |
| 5 | `20260427210000_add_user_token_version` | User.tokenVersion |
| 6 | `20260501000000_add_processed_stripe_event_and_order_index` | ProcessedStripeEvent + Order(caseFileId,email,status) idx |

`prisma/schema.prisma` matches the cumulative migration state — no drift.

**Audit-history summary.** Two parallel god-mode audits (2026-04-27 v1+v2 + verification) → 7/7 confirmed → 7 fix batches shipped (Batches 1–7). Two more parallel audits (2026-05-01 + cowork) re-found everything plus a P0 RSC payload leak in `/bureau/database` that the first audits missed → Batches 4–7. Most recent batch is 7 (defense-in-depth: admin rate limits + nodejs runtime pins + constant-time login + dead font CSP entry).

**Coverage tracker (will be ticked through Phase 1).** Targets:
- Root configs: package.json✓, tsconfig.json✓, next.config.ts✓, prisma.config.ts✓, vitest.config.ts✓, eslint.config.mjs✓, vercel.json✓, .env.example✓, .gitignore✓, .gitattributes✓, postcss.config.mjs, middleware.ts✓
- Auth: auth.ts✓, auth.config.ts✓, types/next-auth.d.ts
- Schema/migrations: schema.prisma✓, all 6 migrations✓, migration_lock.toml✓
- `lib/`: 14 files
- `app/api/`: 30+ route handlers
- `app/`: pages + layouts + server actions
- `components/`: 30+ components
- `scripts/`: 10 scripts
- `tests/`: 22 test files
- `audits/`: all batch reports + observations + audit dossiers ✓
- `data/site.ts`, `app/globals.css`

**Claims-to-verify tracker.** Pulled from CLAUDE.md + Batch 1–7 reports (will independently re-verify in Phase 1.9):

| Claim | Where claimed |
|---|---|
| `apiVersion: "2026-04-22.dahlia"` pinned in lib/stripe.ts | Batch 1 Fix 4 |
| `csvEscape` prefixes formula chars in code export | Batch 1 Fix 3 |
| `assertSafeEnv` on seed-global-people + unarchive-case | Batch 1 Fix 1+2 |
| revokeCodeSchema = z.object({}).passthrough() + server-stamped revokedAt | Batch 1 Fix 5 |
| Email stripped from /checkout/success page | Batch 2 Fix 1 |
| WEBHOOK_PATHS Set-based allowlist replaces prefix carve-out | Batch 2 Fix 2 |
| P2002 catch on caseFile.create returns 409 | Batch 2 Fix 3 |
| /api/checkout/status + /api/admin/uploads/blurhash rate-limited 30/60s | Batch 2 Fix 4 |
| Generic 409 message on duplicate-purchase | Batch 2 Fix 5 |
| User.tokenVersion column + JWT invalidation on password reset + 7-day maxAge | Batch 3 |
| auth.config.ts is Prisma-free (edge-safe split-config) | Batch 3 follow-up |
| Navbar guards on session?.user (not session?) | Batch 3 post-deploy fix |
| /bureau/database ships only narrowed projection (no solutions / internalNotes) | Batch 4 Fix 1 |
| AccessCode validator accepts hidden_evidence | Batch 4 Fix 2 |
| Webhook handles checkout.session.async_payment_failed (not payment_intent.payment_failed) | Batch 4 Fix 3 |
| Webhook updateMany precondition for concurrent-delivery race | Batch 4 Fix 4 |
| /api/register + /api/waitlist uniform-201 (no 409) | Batch 4 Fix 5 |
| Webhook validates event.livemode | Batch 4 Fix 6 |
| Slug update P2002 → 409 on legacy PUT and overview PATCH | Batch 4 Fix 7 |
| ProcessedStripeEvent.create at top of webhook for hard idempotency | Batch 5 Fix 2 |
| Stripe idempotencyKey + PENDING-session reuse on /api/checkout | Batch 5 Fix 3 |
| charge.refunded → revoke ActivationCode + delete UserCase + Order=REFUNDED | Batch 5 Fix 4 |
| Cron sweeper marks PENDING > 24h as FAILED, gated by CRON_SECRET | Batch 5 Fix 5 |
| DELETE /api/me with password+confirmation re-auth gate, 3/60s rate-limit | Batch 6 Fix 1 |
| /account/delete page + DeleteAccountForm + bureau header link | Batch 6 Fix 2 |
| 13 admin mutation routes rate-limited 60/60s | Batch 7 Fix 1 |
| `runtime = "nodejs"` on every Prisma-using API route (29 routes) | Batch 7 Fix 2 |
| Constant-time bcrypt compare on login | Batch 7 Fix 3 |
| fonts.gstatic.com removed from CSP font-src | Batch 7 Fix 4 |
| Stripe Checkout: `consent_collection.terms_of_service: "required"` | Week 12 |
| /privacy + /terms exist | Week 12 |
| Footer has Privacy + Terms links | Week 12 |

**Phase 0 done.** Coverage tracker built; claims-to-verify list fixed; audit history internalized. Proceeding to Phase 1.

# PHASE 1 — TOTAL COMPREHENSION

## PHASE 1 — TOTAL COMPREHENSION (compressed deliverables)

### 1.1 — File-by-file pass coverage attestation
Read in full: `auth.ts`, `auth.config.ts`, `middleware.ts`, `next.config.ts`, `prisma.config.ts`, `tsconfig.json`, `package.json`, `vitest.config.ts`, `eslint.config.mjs`, `vercel.json`, `.env.example`, `.gitignore`, `.gitattributes`, `prisma/schema.prisma`, all 6 migrations, `migration_lock.toml`, every file in `lib/` (14 files), every API route handler (32 routes), every page in `app/bureau/`, the public `/cases/[slug]`, `/checkout/success`, `/(unlock)/bureau/unlock`, `/login`, `/register`, `/reset-password`, `/forgot-password`, `/account/delete`, `/privacy`, `/terms`, `app/layout.tsx`, all components in `components/auth/`, `components/bureau/{BuyButton, CaseActivationForm, CheckpointForm, TheorySubmissionForm, GlobalPeopleSearchTerminal}`, `components/cases/CasePublicView.tsx`, `components/admin/{PublishCaseButton, CreateCaseForm, ImageUploader}`, `components/layout/{Navbar, Footer}`, `app/bureau/admin/{cases/page, cases/[caseId]/{edit, codes, access-codes}/page, support/page, support/[id]/page}`, `app/bureau/admin/cases/[caseId]/access-codes/_components/{AccessCodesPanel, AccessCodeList, CreateAccessCodeForm}`, `app/bureau/admin/support/[id]/_components/ReplyForm`, `types/next-auth.d.ts`, `tests/api/me.test.ts` (sampled), all 12 audit dossier markdowns, `scripts/{create-admin, reset-case-progress, unarchive-case, seed-global-people}` (sampled). Surveyed by Explore: marketing pages (no findings), admin tab UI components (no client-secret leaks), `app/bureau/people/[personId]/page.tsx` (analyst-note visibility filter verified at line 50-55), test files inventory.

### 1.2 — Architecture map
Routing layout matches v1 audit exactly with two changes:
- `/api/me` (DELETE) added in Batch 6
- `/api/cron/cleanup-pending-orders` (GET) added in Batch 5
- `/bureau/database/page.tsx` rewritten (commit `a743bc0`) to thin server-shell + `actions.ts` server-action search + `GlobalPeopleSearchTerminal` client component (the prior unbounded `findMany` is gone).

Render model: every page is RSC except the listed client islands. Suspense boundaries wrap `useSearchParams()`-reading forms at `/login`, `/register`, `/reset-password`, `/bureau` (around `CaseActivationForm`).

External boundaries (verified): Stripe (Checkout + signed webhook); Resend (transactional email); R2 (presigned PUT, SSRF-guarded blurhash); Neon (pooled `DATABASE_URL` runtime, `DIRECT_URL` for migrations); Upstash Redis (rate-limit prod backend); Vercel Cron (one cron at 04:00 UTC).

### 1.3 — Auth & authorization model

**Authentication paths.** Credentials login (`auth.ts:23-58`) with constant-time bcrypt compare; registration (`/api/register`) returns uniform 201 — no enumeration; password reset bumps `User.tokenVersion: { increment: 1 }` (`/api/reset-password:58`) and clears token; new `/account/delete` flow (Batch 6) re-auths via password + literal "delete my account" confirmation.

**Roles.** `INVESTIGATOR` (default), `ADMIN`. Set only by direct DB seed (`scripts/create-admin.ts`); registration hardcodes `INVESTIGATOR`.

**Guards.** `lib/auth-helpers.ts` exports `requireSession()` (page redirect), `requireAdmin()` (returns Session | NextResponse(403)), `requireSessionJson()` (returns Session | NextResponse(401), validates `Number.isInteger(userId)`), `getOptionalSession()`. **All 17 `/api/admin/*` route files contain `requireAdmin()` calls** (verified via grep).

**Session lifecycle.** JWT, 7-day `maxAge` (`auth.config.ts:17`). On sign-in, JWT carries `id, role, tokenVersion`. On every `auth()` call from a Node-runtime context, `auth.ts:78-93` re-reads `tokenVersion` from the User row; mismatch returns `{ ...session, user: undefined }` so guards treat as anonymous. Middleware uses the trivial `auth.config.ts` pass-through (no DB touch — edge-safe).

**CSRF model.** `middleware.ts:29-46` gates state-mutating `/api/*` requests against `new URL(origin).origin === new URL(APP_ORIGIN).origin`. `/api/auth/*` and `WEBHOOK_PATHS = new Set(["/api/webhooks/stripe"])` (line 17) are explicitly carved out — exact path match, not prefix.

### 1.4 — Data flow traces

**Guest purchase →** `BuyButton.tsx` → `POST /api/checkout` (rate-limit 5/60s, validates schema, COMPLETE-order check, 15-min PENDING-session reuse, sha256-truncated idempotencyKey) → Stripe Checkout (TOS consent required) → `Order(PENDING)` row → user pays → `checkout.session.completed` webhook → signature verify → livemode check → ProcessedStripeEvent insert (P2002 = duplicate, return 200) → `handleCheckoutCompleted`: orphan recovery via metadata, codeRetry×3, `$transaction` { updateMany precondition (PENDING→COMPLETE), ActivationCode.create(source: PURCHASE), Order.update(stripePaymentIntent + activationCodeId) } → Resend email with `?activate=CODE` deep-link → `Order.emailSentAt` or `Order.emailLastError` recorded.

**Activation →** user clicks email → `/register` (uniform 201) or sign-in → bureau → `CaseActivationForm` reads `?activate=CODE` → `POST /api/cases/activate` → rate-limit 5/60s → ownership check via `userCase.findUnique` → revokedAt-410 check → atomic `updateMany({where: {claimedByUserId: null}})` → `UserCase.create` + `UserCaseEvent` log.

**Theory submission →** workspace → maxStage gate → SOLVED early-return → `evaluateTheorySubmission` → state machine transition → `$transaction` { TheorySubmission, UserCase.update, UserCaseEvent }.

**Checkpoint advance →** rate-limit 20/60s → ownership → `matchesAcceptedAnswer` (Jaccard ≥ 0.45 OR exact normalized match, MIN_NORMALIZED_LENGTH = 3) → CheckpointAttempt **outside** transaction → `$transaction` { updateMany({currentStage: ownedStage}), UserCaseEvent } → STAGE_CONFLICT → 409.

**Charge.refunded →** webhook → ProcessedStripeEvent dedup → `handleChargeRefunded` finds Order via `stripePaymentIntent` → `$transaction` { Order.update(REFUNDED), ActivationCode.update({revokedAt}), UserCase.deleteMany if `claimedByUserId !== null` }. TheorySubmission/CheckpointAttempt rows preserved.

**AccessCode redeem →** QR → `/u/[code]` → `/bureau/unlock` → if no session, sign-in card with `?callbackUrl=` preserving `?code=` → after auth, `UnlockForm` auto-POSTs → `/api/access-codes/redeem` rate-limit 5/60s → ownership check (UserCase exists for caseFileId) → requiresStage check → oneTimePerUser branch or unique-constraint P2002 fallback → resolveContent (record/person/hint/hidden_evidence).

**Account deletion →** `/account/delete` page (requireSession) → `DeleteAccountForm` → `DELETE /api/me` rate-limit 3/60s → requireSessionJson → schema parse → DB lookup → ADMIN-role refused with 403 → bcrypt compare → `prisma.user.delete` (cascades fire) → `signOut`.

**Cron sweep →** Vercel Cron (`0 4 * * *`) → GET `/api/cron/cleanup-pending-orders` with `Authorization: Bearer ${CRON_SECRET}` → string-equality check (line 20) → `updateMany` flips PENDING > 24h to FAILED.

### 1.5 — Schema & migration map
22 Prisma models, 9 enums, 6 migrations linear (matches schema.prisma — verified). Sensitive fields: `User.passwordHash`, `User.passwordResetToken`, `User.tokenVersion`, `Order.email`, `Order.stripeSessionId`, `Order.stripePaymentIntent`, `ActivationCode.code`, `AccessCode.code`, `GlobalPerson.internalNotes`, `PersonAnalystNote.visibility=INTERNAL`, `ProcessedStripeEvent.id`. Cascades: `User → UserCase/TheorySubmission/CheckpointAttempt/AccessCodeRedemption` all CASCADE; `User → ActivationCode.claimedByUserId` SetNull; `CaseAudit.userId` RESTRICT (intentional — admin self-deletion blocked); `Order.caseFileId` RESTRICT; `Order.activationCodeId` SetNull. Order has no User FK — designed for buyer-of-record retention. Index added Batch 5: `Order(caseFileId, email, status)`.

### 1.6 — Environment & secrets surface
Env vars referenced in code: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (intentional client-exposure), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `RESEND_API_KEY`, `RESEND_FROM`, `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME/PUBLIC_URL`, `UPSTASH_REDIS_REST_URL/TOKEN`, `SEED_ADMIN_EMAIL/PASSWORD`, `CRON_SECRET`, `BL_ALLOW_GLOBAL_PEOPLE_SEED` (NEW since audits — used by `scripts/seed-global-people.ts`), `NODE_ENV`. All present in `.env.example` except `BL_ALLOW_GLOBAL_PEOPLE_SEED` (script self-documents). No client-exposed secrets beyond `NEXT_PUBLIC_APP_URL`.

### 1.7 — Test inventory (22 files / 168 tests)

| File | Covers | Doesn't cover |
|---|---|---|
| `tests/api/register.test.ts` | register happy/duplicate-201/bcrypt cost/forgot-password/reset-password/tokenVersion increment | rate-limit branches |
| `tests/api/stripe.test.ts` | webhook signature/checkout 404/200/409, completed event, idempotent redelivery, livemode mismatch, orphan recovery | `charge.refunded`, `async_payment_failed`, ProcessedStripeEvent collision, idempotencyKey collision, PENDING-session reuse |
| `tests/api/me.test.ts` | 7 paths: 401/400×2/401-wrong-pw/403-admin/200-happy/200-idempotent/429-rate-limit | concurrent-delete race |
| `tests/api/checkpoint.test.ts` | matcher cases, stage gate, transitions, STAGE_CONFLICT | end-to-end concurrency |
| `tests/api/theory.test.ts` | scoring, transitions, SOLVED early return | rate-limit |
| `tests/api/access-codes-redeem.test.ts` | ownership check, requiresStage, oneTimePerUser, retiredAt | hidden_evidence cross-case |
| `tests/api/admin-cases.test.ts` | POST happy + duplicate slug + P2002 | rate-limit, runtime pin |
| `tests/api/admin-codes.test.ts` | batch generate + revoke (server-stamp `revokedAt`) | CSV formula injection, 60/60s rate-limit |
| `tests/api/admin-section-patches.test.ts` | overview/people/records/hints/checkpoints/solution PATCH diffs | concurrent admin writes |
| `tests/api/admin-slug-history.test.ts` | rename + redirect, history-conflict 409 | P2002-on-update branch |
| `tests/api/admin-support.test.ts` | reply + status PATCH | Resend transport failure path |
| `tests/api/admin-uploads.test.ts` | sign happy/422/503/429, blurhash SSRF | image bomb / decompression DoS |
| `tests/api/bureau-people.test.ts` | analyst-note visibility filter for non-admin | admin path |
| `tests/api/workflow.test.ts` | legal/illegal transitions | publishedAt timestamp persistence |
| `tests/api/activate.test.ts` | code redeem, revokedAt 410, claimedByUserId race | concurrent-redeem race |
| `tests/lib/{auth-helpers,case-evaluation,case-quality,post-login-path,rate-limit,user-case-state}.test.ts` | unit-level |  |
| `tests/routes/unlock-flow.test.ts` | layout gates, /bureau/unlock public bypass | ?callbackUrl edge cases |

**Untested critical paths:** `charge.refunded` handler, cron sweeper auth, ProcessedStripeEvent collision, idempotencyKey collision, PENDING-session reuse, constant-time login, all 13 admin 60/60s rate-limit branches, runtime pin verification, slug-update P2002.

### 1.8 — Dependency posture
- `next-auth ^5.0.0-beta.30` — beta. Ship at your own risk; any breaking change between betas needs careful upgrade.
- `next 16.2.3` — bleeding edge.
- `react 19.2.4` / `react-dom 19.2.4` — current.
- `prisma ^7.7.0` / `@prisma/client ^7.7.0` / `@prisma/adapter-pg ^7.8.0` — current major.
- `zod ^4.3.6` — current.
- `stripe ^22.1.0` — current; `apiVersion: "2026-04-22.dahlia"` pinned (verified `lib/stripe.ts:21`).
- `bcryptjs ^3.0.3` — cost 12 in code; pure-JS implementation (slower than `bcrypt` native binding but acceptable).
- `sharp ^0.34.5` — used in blurhash route only.
- `lucide-react ^1.8.0` — verified by Cowork audit as a real package; an old major track. CLAUDE.md flagged for sanity check.
- `@upstash/ratelimit ^2.0.8` / `@upstash/redis ^1.37.0` — current.
- `@aws-sdk/client-s3 ^3.1032.0` + `@aws-sdk/s3-request-presigner ^3.1032.0` — current.
- `qrcode ^1.5.4` — used in client AccessCodeList.

### 1.9 — Audit history reconciliation

| Batch | Claim | File | Status |
|---|---|---|---|
| 1 | apiVersion pinned `2026-04-22.dahlia` | `lib/stripe.ts:21` | **verified** |
| 1 | csvEscape formula-prefix | `app/api/admin/cases/[caseId]/codes/route.ts:74-84` | **verified** |
| 1 | assertSafeEnv on seed-global-people | `scripts/seed-global-people.ts` | **regressed** — replaced with `BL_ALLOW_GLOBAL_PEOPLE_SEED` opt-in flag (commit `e964593`); rationale: script is now idempotent. Net effect: weaker generic protection (single env-var bypass) but safer behavior (upserts only). |
| 1 | assertSafeEnv on unarchive-case | `scripts/unarchive-case.ts:8` | **verified** |
| 1 | revokeCodeSchema = `z.object({}).passthrough()` + server-stamped `revokedAt` | `lib/validators.ts:269`, `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts:62` | **verified** |
| 2 | email stripped from /checkout/success | `app/checkout/success/page.tsx:13-17` | **verified** |
| 2 | WEBHOOK_PATHS Set allowlist | `middleware.ts:17, 33` | **verified** |
| 2 | P2002 catch on caseFile.create | `app/api/admin/cases/route.ts:71-80` | **verified** |
| 2 | /api/checkout/status + /api/admin/uploads/blurhash rate-limited 30/60s | `route.ts:8`, `route.ts:43` | **verified** |
| 2 | generic 409 message on duplicate-purchase | `app/api/checkout/route.ts:71-79` | **verified** |
| 3 | User.tokenVersion + JWT invalidation + 7-day maxAge | `prisma/schema.prisma:77`, `auth.ts:78-93`, `auth.config.ts:17` | **verified** |
| 3 | auth.config.ts is Prisma-free | `auth.config.ts:1-44` | **verified** (no Prisma import) |
| 3 | Navbar guards on `session?.user` | `components/layout/Navbar.tsx:44, 48, 81, 136` | **verified** |
| 4 | /bureau/database narrowed projection | `app/bureau/database/page.tsx` | **superseded** — page rewritten in commit `a743bc0` to thin server-shell + server action with paginated select; no Prisma fetch on initial render. Stronger than Batch 4's narrowed select. |
| 4 | AccessCode validator accepts hidden_evidence | `lib/validators.ts:279`, `app/api/admin/cases/[caseId]/access-codes/route.ts:95-101` | **verified** (API), **partial** (admin UI `CreateAccessCodeForm.tsx:5` still has `TargetType = "record" \| "person" \| "hint"` — UI lags behind validator) |
| 4 | webhook handles `checkout.session.async_payment_failed` | `app/api/webhooks/stripe/route.ts:115-117, 354-369` | **verified** |
| 4 | `updateMany` precondition for concurrent-delivery | `app/api/webhooks/stripe/route.ts:245-251` | **verified** |
| 4 | /api/register + /api/waitlist uniform-201 | `app/api/register/route.ts:39-49`, `app/api/waitlist/route.ts:44-51` | **verified** |
| 4 | webhook validates `event.livemode` | `app/api/webhooks/stripe/route.ts:65-79` | **verified** |
| 4 | slug update P2002 → 409 (legacy PUT and overview PATCH) | `app/api/admin/cases/[caseId]/route.ts:496-509`, `app/api/admin/cases/[caseId]/overview/route.ts:118-132` | **verified** |
| 5 | ProcessedStripeEvent.create at top of webhook | `app/api/webhooks/stripe/route.ts:87-103` | **verified** |
| 5 | Stripe idempotencyKey + PENDING-session reuse | `app/api/checkout/route.ts:99-150` | **verified** |
| 5 | charge.refunded handler | `app/api/webhooks/stripe/route.ts:118-120, 371-435` | **verified** |
| 5 | cron sweeper gated by CRON_SECRET | `app/api/cron/cleanup-pending-orders/route.ts:11-21` | **verified** (string-equality, see finding) |
| 6 | DELETE /api/me with re-auth | `app/api/me/route.ts:11-92` | **verified**; 7 tests pass |
| 6 | /account/delete page + form + bureau link | confirmed | **verified** |
| 7 | 13 admin mutation routes rate-limited 60/60s | confirmed across files | **verified** |
| 7 | runtime = "nodejs" on every Prisma-using route | grep returns 32 of 32 | **verified** (`api/auth/[...nextauth]/route.ts` also pinned) |
| 7 | constant-time bcrypt compare | `auth.ts:12-18, 46-49` | **verified** |
| 7 | fonts.gstatic.com removed from CSP | `next.config.ts:30` | **verified** (font-src is `'self'` only) |
| W12 | Stripe Checkout consent enforced | `app/api/checkout/route.ts:140-142` | **verified** |
| W12 | /privacy + /terms exist | `app/privacy/page.tsx`, `app/terms/page.tsx` | **verified** |
| W12 | Footer has Privacy + Terms links | `components/layout/Footer.tsx:36-49` | **verified** |

**Phase 1 done.**

# PHASE 2 — FORENSIC AUDIT

I'll go through the 19 categories, citing every finding from disk reads above. Findings are **net-new** unless marked otherwise — known items previously closed by Batches 1-7 are not re-flagged unless a regression was caught.

---

### 2.1 — Authentication

#### [P2] `forgot-password` route's "user exists" path leaks email registration via response timing

**Location:** `app/api/forgot-password/route.ts:13-100`

**What:** The handler awaits `prisma.user.update` + `getResend().emails.send` inline before returning. The "user does not exist" branch returns after a single `findUnique`. The wall-clock difference is the enumeration signal.

**Evidence:**
> ```ts
> // line 41-42 — non-existent path returns ~10 ms
> if (!user) { return NextResponse.json({ message: GENERIC_OK }, { status: 200 }); }
> // lines 49-90 — exists path: token gen + DB update + Resend send (~200-400 ms)
> ```

**Why it's a problem:** The Cowork audit and the Claude Code audit both flagged this. Batch 7's observation explicitly deferred it because the existing test asserts `expect(resendSendFn).toHaveBeenCalled()` synchronously. The constant-time login fix landed in Batch 7, so login no longer leaks — but `forgot-password` does, undoing the parity.

**Impact:** Sophisticated probe with rate-limit (3/60 s/IP) is impractical at scale, but a determined attacker who can rotate IPs (cheap) can map any candidate email list to "registered or not." Compounds with the per-purchase enumeration in P2-3 below.

**Remediation:** Move the slow path out-of-band. Three options ordered by surface size:
1. `await sleep(randomBetween(200, 400))` on the no-user branch (simplest, leaks under statistical attack but raises the bar significantly).
2. `after()` from `next/server` to defer the email send past the response. Existing test must be updated to `vi.waitFor(...)`.
3. Inngest/QStash/Vercel Queues for proper out-of-band processing.

**Verification:** Curl 100 known-existing emails and 100 known-missing emails; the medians should be statistically indistinguishable.

**Confidence:** High.

---

#### [P3] Login no longer leaks email but the rate-limit path leaks before bcrypt compare

**Location:** `app/api/auth/[...nextauth]/route.ts:9-21`

**What:** The wrapping rate-limit (`limit: 5, windowMs: 60_000`) at this catch-all route applies to **all** NextAuth flows: sign-in POST, callback POST, sign-out POST, CSRF token POST, etc. A user clicking sign-out 6 times in one minute hits 429.

**Evidence:** Already noted by Cowork audit as P3-7 — rate-limit applies to sign-out as well as sign-in.

**Why it's a problem:** Carries forward unchanged.

**Remediation:** Branch on `request.url` or move the rate-limit to a dedicated `/api/auth/callback/credentials` POST handler. Low-priority.

**Confidence:** High.

---

### 2.2 — Authorization (AuthZ / IDOR)

#### [P2] `/api/access-codes/redeem` does not verify that `unlocksTarget` resolves to the same case as the AccessCode

**Location:** `app/api/access-codes/redeem/route.ts:11-43, 76-107`

**What:** The redeem route's `resolveContent` calls `prisma.caseRecord.findUnique({ where: { id: target.id } })` (and similar for person/hint/hidden_evidence) without filtering by `caseFileId`. The admin POST validator at `app/api/admin/cases/[caseId]/access-codes/route.ts:75-101` does correctly check `targetExists = row?.caseFileId === parsedCaseId` at create time, so today's data is consistent. But anything that bypasses the admin POST (a SQL admin update, a future migration that flips `unlocksTarget`, a future bulk-import script, or a hidden_evidence row that's later moved to a different case) breaks the invariant.

**Evidence:**
> ```ts
> // app/api/access-codes/redeem/route.ts:14-17
> if (target?.type === "record") {
>   const record = await prisma.caseRecord.findUnique({ where: { id: target.id } });
>   return { type: "record", record };
> }
> ```

> ```ts
> // ownership check at line 97-107 verifies the user owns AccessCode.caseFileId,
> // but resolveContent fetches the target row without confirming THAT row also
> // belongs to AccessCode.caseFileId.
> ```

**Why it's a problem:** Defense in depth. The admin POST gate is the only enforcement; if it ever drifts (or a future schema change permits cross-case targets), users see content from cases they don't own.

**Impact:** Today: zero (admin POST validates). Future: a cross-case content leak that bypasses the bureau workspace's `unlockStage <= currentStage` filter entirely.

**Remediation:** In `resolveContent`, accept `caseFileId` from the caller and assert `row.caseFileId === caseFileId` before returning. Equivalent fix at `app/bureau/cases/[slug]/page.tsx:28-83` (`resolveEvidence`) which has the same shape.

**Verification:** Invariant test: create an AccessCode in case A pointing at a record in case B (via direct DB write); attempt redeem; expect 404 instead of leaked record.

**Confidence:** High.

---

#### [P3] Slug-history redirect leaks "this slug used to be a case"

**Location:** `app/cases/[slug]/page.tsx:19-28`, `app/bureau/cases/[slug]/page.tsx:121-134`

**What:** Both pages, on cache miss, fall back to `caseSlugHistory.findUnique`. If the slug is in history, a 307 redirect to the new slug is issued — observable by the caller. An attacker can probe slug-name guesses to learn historical case names that were renamed. Trivial info disclosure.

**Remediation:** None recommended; the leakage is intentional product behavior (you want renamed-case backlinks to redirect). Logged for completeness.

**Confidence:** High.

---

### 2.3 — Input validation & injection

No injection findings. All API routes call `safeParse()`. No `$queryRaw`/`$executeRaw` (grep confirmed). No `dangerouslySetInnerHTML` in app/components (only in audit doc files). Resend HTML emails route every interpolation through `escapeHtml` (verified at `app/api/webhooks/stripe/route.ts:437-444` and `app/api/admin/support/[id]/reply/route.ts:96-103`).

#### [P2] Sharp's `limitInputPixels` not configured on the blurhash decode path

**Location:** `app/api/admin/uploads/blurhash/route.ts:30-34`

**What:** Sharp's default `limitInputPixels` is 0x4000×0x4000 (~268M pixels), meaning a 16384×16384 PNG fed through the URL would consume ~3 GB of memory before being clipped. The route is admin-only and rate-limited 30/60 s, so the practical exposure is bounded; however an admin (or compromised admin) could DoS the function via a single oversized image already uploaded to R2.

**Evidence:**
> ```ts
> const { data, info } = await sharp(inputBuffer)
>   .resize({ width: TARGET_WIDTH, fit: "inside" })
>   .ensureAlpha()
>   .raw()
>   .toBuffer({ resolveWithObject: true });
> ```

**Why it's a problem:** Defense in depth. Vercel functions have memory limits; Sharp eating 3 GB before resize crashes the function and leaves the buffer half-allocated. Cheap to bound.

**Remediation:** `sharp(inputBuffer, { limitInputPixels: 1_048_576 /* 1024×1024 */ })` — anything over 1 MP is overkill for a blurhash anyway.

**Confidence:** Medium (haven't measured live behavior; based on Sharp docs).

---

### 2.4 — CSRF, CORS, headers, CSP

No new findings on CSRF (Batch 2 fix verified). CSP issues (`'unsafe-inline'`, `'unsafe-eval'`) carry forward as P2-12 from Cowork audit.

#### [P2] CSP `connect-src 'self'` will block any client-side fetch to a different origin

**Location:** `next.config.ts:32`

**What:** If the codebase ever needs to call out from the browser to Stripe.js, Resend's analytics endpoint, an embedded analytics tool, or a future API on a separate origin, the request will be silently blocked by CSP. There is no current violation, but the policy is one-line restrictive in a way that will surprise future contributors.

**Remediation:** Document inline or expand to `connect-src 'self' https://api.stripe.com https://m.stripe.network` if Stripe.js is ever introduced. Today's value is correct given the architecture; flagging only because it's a future-proofing trap.

**Confidence:** High (the value is observably restrictive; the impact is on hypothetical future code).

---

### 2.5 — Rate limiting & abuse

#### [P2] Rate-limit IP source uses leftmost `x-forwarded-for` token, which is attacker-controlled

**Location:** `lib/rate-limit.ts:88-95`

**What:** `extractIp` reads `xff.split(",")[0].trim()` as the IP. `x-forwarded-for` is appended to by every proxy hop; on Vercel the leftmost value is the client's *claimed* IP, which the client's browser controls. An attacker spoofing `X-Forwarded-For: 8.8.8.8` rotates through arbitrary IPs and bypasses every rate-limit bucket trivially.

**Evidence:**
> ```ts
> function extractIp(request: Request): string {
>   const xff = request.headers.get("x-forwarded-for");
>   if (xff) {
>     const first = xff.split(",")[0]?.trim();
>     if (first) return first;
>   }
>   return request.headers.get("x-real-ip") ?? "unknown";
> }
> ```

**Why it's a problem:** Vercel sets `x-forwarded-for: <real-client-ip>, <vercel-edge-ip>` — the *leftmost* is the real client when the request goes directly to Vercel. **However**, any client that submits its own `X-Forwarded-For` header before reaching Vercel's edge (e.g., curl, a script, a malicious browser extension) gets that header forwarded as-is. Vercel does NOT strip incoming `X-Forwarded-For`; it appends to it. So the leftmost token is the attacker's spoofed value, not the real source.

The correct strategy on Vercel is to read the **rightmost trustworthy** value, or to use the dedicated `x-real-ip` header (which Vercel sets to the real client IP and which untrusted clients cannot directly add to a request without it being normalized away). Or use Next.js's `ip` accessor on `NextRequest` (which on Vercel resolves to `request.headers.get("x-real-ip")`).

**Impact:** Every rate-limit (registration 3/60s, checkout 5/60s, theory 10/60s, admin mutations 60/60s) can be defeated by rotating spoofed `X-Forwarded-For` headers. Credential-stuffing attacks, code-redeem brute force, email-bomb DoS — all uncapped in practice. Combined with the in-memory dev backend's 500-key eviction, an attacker can also evict legitimate buckets.

**Reproduction:** `for i in 1..1000; do curl -H "X-Forwarded-For: 1.2.3.$i" -X POST .../api/register -d '{"email":"...","password":"..."}'; done`. Each request gets a fresh bucket.

**Remediation:** Switch to `x-real-ip` only, which Vercel sets and clients cannot forge in transit (Vercel's edge overwrites/normalizes it). Or use the `request.ip` accessor where available. Verify on Vercel docs which header is the trusted one for the current platform release.

**Verification:** Deploy a test endpoint that logs `extractIp(request)`, then curl it with various spoofed headers; the logged value must always equal the real source IP.

**Confidence:** Medium-High (Vercel-specific behavior; needs platform-dashboard verification, but the static read is unambiguous about the leftmost-token policy).

---

#### [P2] Activation code keyspace entropy ~52 bits — fine for online guessing, weak for offline if database leaks

**Location:** `app/api/webhooks/stripe/route.ts:11-23`, `app/api/admin/cases/[caseId]/codes/route.ts:9-27`

**What:** Both code generators use `randomBytes(8).toString("base64url").replace(/[-_]/g, "X").slice(0, 8 or 10).toUpperCase()`. After the slice, the case-folded character set is 36 chars (`A-Z0-9` after lowercase hex collisions and the `X` substitution for `-/_`). 8 chars × log2(36) ≈ 41 bits; 10 chars ≈ 51 bits. The slug prefix adds no entropy.

**Why it's a problem:** Online brute-force at the rate-limit ceiling (5/60s on `/api/cases/activate`) is impractical (would take 10^10 years on average). Offline brute-force, if the `ActivationCode` table ever leaks via a Neon snapshot, an admin laptop, a backup dump, or a developer console log, is feasible: 41 bits is reachable in days on consumer GPU hardware. Codes are not hashed at rest, so anyone with read access to the DB has them in plaintext immediately — entropy doesn't matter on that path.

**Impact:** A leaked DB dump → attacker has every issued code → can re-redeem against fresh accounts (claimedByUserId nulls preserved post-account-deletion already permit re-claim per Batch 6 observation).

**Remediation:** (a) Hash codes at rest (`bcrypt(code, 4)` — fast cost since it's just a lookup index). Lookup becomes "find by salted-hash"; admins lose the ability to display the code text after creation, but the email already carried it. (b) OR: increase entropy to 16 chars (~93 bits) so even leaked codes are not brute-forceable.

**Confidence:** Medium-High (entropy calc is exact; impact depends on DB-leak threat model).

---

### 2.6 — Money, Stripe, webhooks, idempotency

#### [P1] `handleChargeRefunded` does not handle partial refunds — full revoke on any refund amount

**Location:** `app/api/webhooks/stripe/route.ts:371-435`

**What:** The handler revokes the ActivationCode and deletes the UserCase whenever `charge.refunded` fires, regardless of `charge.amount_refunded` vs `charge.amount`. Stripe issues `charge.refunded` for both full and partial refunds. A partial refund (operator credits $5 of a $30 kit for, say, a damaged physical component) currently triggers full entitlement revocation.

**Evidence:**
> ```ts
> // No `if (charge.amount_refunded < charge.amount) return;` guard.
> // Order is unconditionally marked REFUNDED at line 410.
> ```

**Why it's a problem:** A goodwill partial refund (the kind a small business uses to retain customers) yanks the case file out from under a paying user. The Terms of Service §7 says "request a full refund within 7 days... if you have not redeemed the activation code"; partial refunds are out of scope of the policy but Stripe's standard refund mechanic supports them.

**Impact:** Customer-relationship damage. Operator issues a $3 partial refund for shipping; customer's bureau access disappears next webhook delivery; customer emails support angry. Bigger blast radius once the kit catalog grows.

**Remediation:** Branch on `charge.amount_refunded === charge.amount` (full refund only) for the destructive path. For partial refunds, log + mark `Order.status: "PARTIALLY_REFUNDED"` (new enum value) and leave entitlement.

**Verification:** Test-mode partial refund of a $30 charge → confirm UserCase persists; full refund of same charge → confirm UserCase is deleted.

**Confidence:** High.

---

#### [P2] `idempotencyKey` collision window is exactly 15 minutes — tab-double-click 16 minutes later mints a second Stripe session

**Location:** `app/api/checkout/route.ts:128-130`

**What:**
> ```ts
> const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
> const idempotencyKey = `checkout-case-${caseId}-${emailHash}-${bucket}`;
> ```

A user who keeps a stale checkout tab open for >15 minutes and clicks Continue again gets a new bucket → new idempotencyKey → new Stripe session → new Order(PENDING). Stripe doesn't enforce idempotency across keys, so two distinct sessions exist.

**Why it's a problem:** The PENDING-session-reuse short-circuit at line 88-112 catches this case if the prior PENDING Order is < 15 min old, but **falls through** for older ones. So between minutes 15 and "Stripe expires the session" (default 3 hours), a user with a stale tab who clicks again creates a duplicate paid path. If they pay both, they're charged twice.

**Reproduction:** Open BuyButton, click Continue, leave the Stripe tab open. Wait 16 minutes. Open another tab with the case page, click Continue again. Two different Stripe sessions return.

**Impact:** Real-money correctness in a narrow but realistic window.

**Remediation:** Drop the `bucket` from the idempotencyKey — make it `${caseId}-${emailHash}` only. Stripe idempotency keys are persisted ~24 hours by default, which matches the typical session-expiry window. Two requests with the same `(caseId, emailHash)` within 24 hours collapse to one Stripe session regardless of timing. Combine with the existing PENDING-session-reuse check.

**Verification:** Manual test as above; confirm only one Stripe session.

**Confidence:** High.

---

#### [P2] `email` lower-cased by Zod, but `emailHash` computed from the trimmed/lowercased value — Stripe idempotency safe; flag is documentation only

**Location:** `app/api/checkout/route.ts:124-127`

**What:** `email` is lowercased by `checkoutSchema` at parse time. `emailHash` derives from the lowercased value. Same input always produces the same key. **Not a finding.** Listed for completeness because the implementation is correct.

---

#### [P2] `Order.email` is case-preserved at write time, case-insensitive at read time — drift risk for ad-hoc admin queries

**Location:** `app/api/checkout/route.ts:170` writes `email` (lowercased post-Zod), `app/api/checkout/route.ts:65-68` reads with `mode: "insensitive"`. `app/api/webhooks/stripe/route.ts:230-236` writes the metadata-recovered email which **may not be lowercased** depending on how Stripe stores `session.metadata.email`.

**Why it's a problem:** Looking at `app/api/checkout/route.ts:143-146`:
> ```ts
> metadata: { caseId: String(caseId), email },
> ```

The `email` here is the post-Zod lowercased value. So the recovered Order email is lowercase. **Not exploitable** as written, but the dependency on Zod's lowercase pre-processing is a hidden coupling. If a future caller submits a non-Zod-validated email to the metadata pipeline, case-drift creeps in and the duplicate-purchase guard goes blind to one branch.

**Remediation:** Normalize `Order.email` on every write with an explicit `.toLowerCase()` at the write site, not relying on upstream Zod. Cosmetic; documented only.

**Confidence:** Medium.

---

#### [P3] Webhook stale event-id retention has no TTL — `ProcessedStripeEvent` grows monotonically

**Location:** `prisma/schema.prisma:499-502`, `app/api/webhooks/stripe/route.ts:87-103`

**What:** Every Stripe event (one per refund, one per checkout completion, one per failure, etc.) inserts a row into `ProcessedStripeEvent`. There is no cleanup. Stripe's event retry window is ~3 days; rows older than that are storage churn.

**Why it's a problem:** At realistic indie volumes (1k events/year), this is ~1 KB extra storage. At unicorn scale it's still small. Mostly cosmetic; flagging because Batch 5 explicitly added a sweeper for stuck PENDING orders but didn't add a sibling sweeper for old ProcessedStripeEvent.

**Remediation:** Add to the existing cron: `prisma.processedStripeEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } })` (30 days, well past Stripe's 3-day retry window).

**Confidence:** High.

---

### 2.7 — Database, transactions, concurrency

#### [P2] `CheckpointAttempt` row written outside the stage-advance transaction — a STAGE_CONFLICT or rollback leaves the attempt persisted

**Location:** `app/api/cases/[slug]/checkpoint/route.ts:139-148`

**What:**
> ```ts
> // line 139-148
> await prisma.checkpointAttempt.create({  // OUTSIDE transaction
>   data: { ... },
> });
>
> if (!isCorrect) { return 400; }
>
> // ... transaction at line 165 with updateMany STAGE_CONFLICT throw
> ```

If the user submits, the matcher passes, but two concurrent requests race on `currentStage`, the loser throws `STAGE_CONFLICT` and the transaction rolls back — but the `CheckpointAttempt` row is already committed before the transaction starts.

**Why it's a problem:** Audit-trail noise. The CheckpointAttempt log shows attempts that "succeeded" but didn't advance the stage. Doesn't affect security or correctness; muddies analytics.

**Remediation:** Move `checkpointAttempt.create` inside the transaction. Cosmetic.

**Confidence:** High.

---

#### [P2] Three admin pages do unbounded `findMany` — performance at scale

**Location:**
- `app/bureau/admin/cases/page.tsx:12-23` — fetches every CaseFile with nested includes (people/records/hints/checkpoints/activationCodes/owners/theorySubmissions).
- `app/bureau/admin/cases/[caseId]/codes/page.tsx:29-33` — every ActivationCode for the case with claimedByUser email.
- `app/bureau/admin/cases/[caseId]/access-codes/page.tsx:42-46` — every AccessCode for the case with redemption ids.

**Why it's a problem:** At indie scale (10 cases × 100 codes each), the queries are fine. At "successful product" scale (50 cases × 5k codes per case), the admin pages become slow and the RSC payload large. None of these cross to a client component as full prisma objects, so no security leak — purely performance.

**Note:** The `findMany` in `app/cases/page.tsx:9` is the public catalog with `where: { isActive: true, workflowStatus: "PUBLISHED" }`. Same shape but bounded by published-case count and tolerable at any reasonable catalog size.

**Remediation:** Add pagination to the three admin pages. Minimal pattern from `app/bureau/admin/support/page.tsx:46-58` — `PAGE_SIZE = 25 + skip + take + total count + searchParams.page`. ~30 lines per page.

**Confidence:** High.

---

#### [P2] Activation revoke-then-write race window — 409 after concurrent revoke

**Location:** `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts:46-65`

**What:**
> ```ts
> const existing = await prisma.activationCode.findUnique({ where: { id: parsedCodeId } });
> if (existing.revokedAt !== null) return 409;
> await prisma.activationCode.update({ where: { id: parsedCodeId }, data: { revokedAt: new Date() } });
> ```

Two admins racing the revoke API both see `revokedAt: null`, both pass the check, both call `.update`. The second's timestamp overwrites the first's. Cosmetic — both intended to revoke.

**Remediation:** `prisma.activationCode.updateMany({ where: { id: parsedCodeId, revokedAt: null }, data: { revokedAt: new Date() } })` and check `count === 1` (404 if 0 with the precondition). Atomic. Same shape as the checkpoint advance pattern. Trivial fix.

**Confidence:** High.

---

#### [P3] `caseSlugHistory` cleanup does not delete history rows when a case is renamed back to the original

**Location:** `app/api/admin/cases/[caseId]/route.ts:426-435`, `app/api/admin/cases/[caseId]/overview/route.ts:94-107`

**What:** When admin renames `A → B`, a CaseSlugHistory row is created with `oldSlug: A`. When admin renames back `B → A`, a new CaseSlugHistory row is upserted with `oldSlug: B` (mapping back to the same case). The original `oldSlug: A` row stays. Now both `/cases/A` and `/cases/B` redirect to whichever is current. **Not a bug** — both historical URLs should redirect — but the table grows unbounded with rename churn.

**Remediation:** Drop history rows where `oldSlug` matches the current slug of the same case. Cosmetic.

**Confidence:** High.

---

### 2.8 — Email & deliverability

No new findings beyond the operational items already in CLAUDE.md (DKIM/SPF/DMARC pending). Resend templates use `escapeHtml` on every interpolation; verified in webhook + support reply.

#### [P2] Activation code email lacks `Reply-To` header — replies route back to the no-reply sender

**Location:** `app/api/webhooks/stripe/route.ts:285-321`

**What:** The `getResend().emails.send` call sets `from: getResendFrom()` (default `no-reply@theblackledger.app`) but no `replyTo`. The email body says "If you have any trouble, reply to this email." A reply lands at the no-reply mailbox, which is unmonitored.

**Why it's a problem:** Customers who reply lose the message silently. CAN-SPAM (US), CASL (Canada), and GDPR transactional-email best practices all expect `Reply-To` to point to a monitored address.

**Remediation:** Add `replyTo: "support@theblackledger.app"` to the Resend send call. Same pattern in `app/api/admin/support/[id]/reply/route.ts:58-79` (which doesn't need `replyTo` because it's already from a monitored mailbox replying to the customer — but adding `replyTo: "support@..."` there is also good hygiene).

**Confidence:** High.

---

### 2.9 — File upload pipeline (R2)

#### [P2] R2 presigned PUT does not bound `Content-Length` — DoS via massive upload

**Location:** `app/api/admin/uploads/sign/route.ts:86-94`

**What:** The `PutObjectCommand` is signed with `Bucket`, `Key`, `ContentType` only — no `ContentLength` constraint. The presigned URL accepts any size up to R2's per-object cap (~5 GB for non-multipart). Client validates `MAX_SIZE_BYTES = 5 * 1024 * 1024` (5 MB) at `components/admin/ImageUploader.tsx:14`, but the client check is advisory — the presigned URL itself does not enforce a size.

**Why it's a problem:** A compromised admin (or an admin's stolen presigned URL — they're valid for 15 minutes regardless of session state) can upload a 5 GB file straight to R2. Cloudflare R2 charges per-GB-stored; one bad upload is a $0.015/month cost, but at 1000 uploads it's a $15/month surprise plus bandwidth charges if ever served.

**Remediation:** Add `ContentLength: 5 * 1024 * 1024` to `PutObjectCommand` and tell the SDK to include it in the signature. Or use `getSignedUrl({ ContentLength: ... })`. Or add a Cloudflare R2 lifecycle rule capping object size.

**Confidence:** High.

---

#### [P3] R2 object key prefix is user-controlled (sanitized filename)

**Location:** `app/api/admin/uploads/sign/route.ts:30-36, 82-83`

**What:** The key is `uploads/${context}/${randomUUID()}-${safeName}`. `safeName` is sanitized to `[a-z0-9.-]` and capped at 80 chars. The randomUUID prefix prevents collisions. `context` is Zod-enum-validated to `"hero" | "portrait" | "record"`. **No finding** — listed for completeness.

---

### 2.10 — Frontend / React / RSC

No client-secret leaks found. All `"use client"` components inspected. Hydration is straightforward (no time-based or random-based client-server mismatches detected).

#### [P3] `app/layout.tsx:27` calls `auth()` on every page render including marketing pages

**Location:** `app/layout.tsx:27`

**What:** Every visit to `/`, `/about`, `/cases`, `/faq`, `/how-it-works`, `/privacy`, `/terms` triggers a Postgres round-trip via the Node-runtime `auth()` callback (which reads `User.tokenVersion`).

**Why it's a problem:** Carries forward as Cowork P2-8 / Batch 7 Observation 4. Performance hazard, not security. Marketing-page traffic spikes hit the database.

**Remediation:** Lazy-load Navbar via a thin `/api/me` projection or skip the tokenVersion check from the public layout. Multi-day refactor.

**Confidence:** High.

---

#### [P3] `/bureau/page.tsx` calls `getOptionalSession()` immediately after the layout's `requireSession()`

**Location:** `app/bureau/page.tsx:28`, `app/bureau/layout.tsx:8`

**What:** The bureau layout already gates on `requireSession()`. The page re-fetches the session via `getOptionalSession()`, triggering a second `auth()` call (and thus a second tokenVersion DB lookup). Same on `app/bureau/archive/page.tsx:11`.

**Why it's a problem:** Duplicate work per request. At ~80-150 ms per `auth()` call (bcrypt + DB), this doubles bureau-page TTFB.

**Remediation:** Pass the session from the layout via Next 15+'s `cookies()`/`headers()` or restructure to a server component that takes the session as a prop. Performance-only.

**Confidence:** High.

---

### 2.11 — TypeScript & code health

No `as any` in source code. `as unknown as` count justified per prior audits (8 instances). Strict TS clean.

#### [P3] `tsconfig target ES2017` is dated

**Location:** `tsconfig.json:3`

**What:** Target should bump to ES2022 for native top-level await, `Object.hasOwn`, etc. Runtime support in Node 22 is universal. Carry-forward from CLAUDE.md.

**Confidence:** High.

---

#### [P3] `package.json` missing `engines.node`

**Location:** `package.json`

**What:** No `engines: { "node": ">=22" }` field. Vercel infers from `tsconfig` and `next` version, but a contributor running Node 18 hits silent runtime issues (e.g. native `crypto.randomUUID()` is fine in 18+, `node:test` differs). Carry-forward.

**Confidence:** High.

---

### 2.12 — Error handling & observability

No structured logging — every catch logs `console.error`. Carry-forward as P3-7 from prior audit. No `error.tsx` or `not-found.tsx` checked at every route group level — only `app/not-found.tsx` in repo (verified via Glob). Graceful-degradation on `error.tsx` would catch unhandled exceptions per-route group; today they bubble to Next's default 500 page.

#### [P3] `error.tsx` not present in any route group — unhandled errors render a generic Next.js 500

**Location:** Verified via `Glob '**/error.tsx'` — returns nothing in app/.

**Remediation:** Add a minimal `app/error.tsx` (and one in `/bureau/`) so unhandled exceptions show a branded "Something went wrong" page with a "go home" link. ~30 lines each.

**Confidence:** High (file absence is observable).

---

### 2.13 — Migrations & deploy safety

All 6 migrations are additive (`ADD COLUMN`, `CREATE TABLE`, `CREATE INDEX`). No `DROP COLUMN`, no `ALTER COLUMN ... NOT NULL` without default. No `RENAME` operations.

#### [P3] `Order_caseFileId_email_status_idx` was created without `CONCURRENTLY`

**Location:** `prisma/migrations/20260501000000_add_processed_stripe_event_and_order_index/migration.sql:10`

**What:** `CREATE INDEX Order_caseFileId_email_status_idx ON "Order" ...` (not `CREATE INDEX CONCURRENTLY`). Postgres `CREATE INDEX` takes an `ACCESS SHARE` lock on writes during the build — fine on an empty `Order` table (current state per CLAUDE.md is "no real customer orders") but blocks writes if applied to a populated production table.

**Why it's a problem:** The migration was applied when the table was small. If a future similar index ever lands while the table is large, this becomes operational pain.

**Remediation:** Document a project rule "non-init migrations should use `CREATE INDEX CONCURRENTLY` for indexes on tables expected to grow." No code change today.

**Confidence:** High.

---

### 2.14 — Vercel / production config

#### [P1] Cron secret comparison is not constant-time — timing oracle

**Location:** `app/api/cron/cleanup-pending-orders/route.ts:20`

**What:**
> ```ts
> if (authHeader !== `Bearer ${cronSecret}`) {
>   return NextResponse.json({ message: "Forbidden." }, { status: 403 });
> }
> ```

Plain JavaScript `===` early-exits at the first mismatching character. An attacker who can hit this endpoint at high volume can extract `CRON_SECRET` byte-by-byte via timing. With an Upstash-backed remote rate-limiter NOT applied to this route (cron is unrate-limited by design — Vercel calls it once a day), the attacker has unlimited probes.

**Evidence:** No rate-limit on `/api/cron/*`. The only protection is `CRON_SECRET` knowledge.

**Why it's a problem:** Once `CRON_SECRET` is recovered, the attacker can fire `cleanup-pending-orders` arbitrarily — flipping every PENDING > 24h to FAILED. Today the actual destructive scope is mild (PENDING orders are abandoned anyway). But: future cron endpoints will likely use the same `CRON_SECRET` (it's a Vercel-platform-wide convention), and once one is compromised, all are. Furthermore, BatchObservations 5.5 already noted the route lacks `User-Agent: vercel-cron/1.0` validation — combined, this is a privilege-escalation surface.

**Reproduction:** Time `curl -H "Authorization: Bearer X..."` requests with varying first characters; the median 200/403 latency varies measurably with prefix-match length. Modern cloud network jitter swamps the signal at indie scale, but a determined attacker on the same Vercel region beats the noise.

**Impact:** Today: low (one cron, modest destructive scope). Adding a refund-cancel cron, a payouts cron, or any sensitive scheduled operation widens this dramatically.

**Remediation:**
> ```ts
> import { timingSafeEqual } from "crypto";
> const expected = Buffer.from(`Bearer ${cronSecret}`);
> const got = Buffer.from(authHeader ?? "");
> if (got.length !== expected.length || !timingSafeEqual(got, expected)) { return 403; }
> ```

Both buffers must be the same length for `timingSafeEqual` to work — the `length` short-circuit handles that.

**Verification:** `grep "timingSafeEqual"` should return one hit in `app/api/cron/cleanup-pending-orders/route.ts`.

**Confidence:** High (the static read is unambiguous).

---

#### [P2] Vercel preview deployments may bypass CSRF if `NEXT_PUBLIC_APP_URL` is unset

**Location:** `middleware.ts:7-8`

**What:**
> ```ts
> const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
> ```

On a Vercel preview branch (e.g. `claude-vibrant-cohen-837e20.vercel.app`), if `NEXT_PUBLIC_APP_URL` is unset in preview env, the fallback is `http://localhost:3000` and every same-origin request from the preview domain fails CSRF (since `https://...vercel.app` !== `http://localhost:3000`). Worse: if `NEXT_PUBLIC_APP_URL` is set to *production* in preview env (a common Vercel misconfig), CSRF is misaligned and users on preview sometimes get 403 when posting forms.

**Why it's a problem:** Preview environments are where you discover bugs before they hit prod; CSRF-broken preview is a deploy hazard. Conversely, if NEXT_PUBLIC_APP_URL has a trailing slash (e.g. `https://theblackledger.app/`), `new URL("...").origin` strips the slash so the comparison still works — that risk is closed.

**Remediation:** Document that `NEXT_PUBLIC_APP_URL` must be set per-environment in Vercel. Or accept Vercel's per-deploy URL via `process.env.VERCEL_URL` as a fallback ("if the request origin matches `https://${VERCEL_URL}`, accept it"). The Wave-2 doc at `docs/WAVE2-FIXES-REPORT.md` discusses this; flagging as a documented operational hazard.

**Confidence:** Medium (depends on Vercel env-var configuration which I cannot inspect from this session).

---

### 2.15 — Compliance & legal

#### [P1] Privacy Policy §6 says "all of our processors are based in the United States" — but Cloudflare R2 routes traffic globally and Stripe processes EU customer data through Stripe Payments Europe Ltd

**Location:** `app/privacy/page.tsx:271-285`

**What:** The Policy text claims all processors are US-based and uses that as the legal basis for international transfer. In practice:
- Stripe processes EU customer payments through Stripe Payments Europe Ltd (Ireland). The contractual processor for an EU buyer is Stripe Ireland, not Stripe US.
- Cloudflare R2 stores data in regional buckets; the bucket location depends on configuration. If `R2_BUCKET_NAME` resolves to an EU Cloudflare region (Cloudflare has EU-resident object storage), data does NOT cross to the US.

**Why it's a problem:** The international-transfer disclosure is factually incomplete. Under GDPR, accurate processor disclosure is mandatory, and the operator has committed to "Stripe (United States)" specifically. A compliance audit by the Personal Data Protection Service of Georgia or an EU complaint would flag this.

**Reproduction:** Check the R2 bucket region in Cloudflare dashboard. Check Stripe account country in the dashboard.

**Remediation:** Have a Georgian lawyer review (already on the punch-list per CLAUDE.md). The factual disclosure should be amended to "Stripe (United States or Stripe Payments Europe Ltd, Ireland, depending on customer region)" and "Cloudflare R2 (region-specific; primarily United States)".

**Confidence:** High (the legal claim and the actual processor architecture are observably mismatched).

---

#### [P1] Refund policy at Terms §7 says 7-day window enforced via "claimedAt is null" — no customer-facing enforcement endpoint

**Location:** `app/terms/page.tsx:189-225`

**What:** The Terms commit to "request a refund within 7 days... if you have not redeemed the activation code." Today the refund flow is:
1. Customer emails `support@theblackledger.app`.
2. Operator manually checks `ActivationCode.claimedAt`.
3. Operator initiates Stripe refund through dashboard.
4. The new `charge.refunded` handler (Batch 5) revokes the code.

There is NO automated check that the request is within 7 days. The operator could refund after the window — which they're allowed to do per "outside the 7-day window... at our sole discretion" in the policy — but there's also no enforcement mechanism preventing them from refunding *under* the policy and then **realizing the customer redeemed the code 8 days later via a stale `claimedAt` value**. Tomorrow: a customer redeems, plays through, refunds within 7 days, the operator approves because `claimedAt` was null at request time, the customer keeps a solved case + refund.

**Why it's a problem:** Operational opportunity for buyer abuse. Today Trick: redeem on day 1, request refund on day 6 saying "I haven't redeemed yet" — operator checks `claimedAt`, finds non-null, denies. Mitigated by the actual data check. **However**: between operator inbox-checking and Stripe refund-clicking, the entitlement is preserved (Batch 5's `charge.refunded` handler only fires when Stripe sends the event). So the abuse window depends on operator-process discipline.

**Impact:** With one operator and a small customer base, low. As volume grows, operator inevitably approves a refund where `claimedAt` was nulled out (e.g. user deleted account) — Order/ActivationCode rows persist, but `claimedByUserId` SetNull might mask the previous redemption.

**Remediation:** Build a `/api/refund-request` endpoint that:
1. Authenticates user.
2. Checks `Order.createdAt > now - 7 days` AND `ActivationCode.claimedAt === null`.
3. Issues Stripe refund via API (which fires the existing webhook handler).
Combined with policy clarification: "redeemed = claimedAt is non-null at the moment we receive your request" plus a customer-facing UI for the request flow. Substantial work — Batch 8+ scope.

**Confidence:** High (Cowork P1-2 carries forward — Stripe-side half of the fix landed in Batch 5; product-side enforcement still missing).

---

#### [P2] Stripe Checkout consent does not capture the consent record on our side

**Location:** `app/api/checkout/route.ts:140-142`

**What:** Stripe's `consent_collection.terms_of_service: 'required'` enforces the checkbox at checkout, but the resulting `Order` row stores only `email`, `caseFileId`, `stripeSessionId`, etc. — no field for "consent obtained at checkout: TOS v2026-04-28". Stripe stores the consent on their side, but if a future customer challenges the Terms or if the Terms change before they activate, we can't prove which version they accepted.

**Remediation:** Add `Order.tosVersion: String?` and write the current Terms's "Last updated" date at checkout. ~5-line schema change + migration. Defer to next batch.

**Confidence:** High.

---

#### [P2] Children policy says "16+" but Eligibility section in Terms says "16 to use, 18 to purchase" — Privacy says "we do not knowingly collect from under 16"

**Location:** `app/terms/page.tsx:71-89`, `app/privacy/page.tsx:367-383`

**What:** The two documents are consistent (both "16 to use"). However, COPPA in the US sets the threshold at 13, not 16. EU's GDPR Article 8 sets 16 (with some member states allowing 13 minimum). **Not a finding** — the conservative 16 floor is correct for both jurisdictions. Listed for completeness.

---

### 2.16 — UX, copy, edge cases

#### [P3] `/bureau/unlock` "We saved your code" copy is misleading

**Location:** `app/(unlock)/bureau/unlock/page.tsx:39-41`

**What:** "We saved your code (CODE) and will reapply it once you're signed in." The code is **not saved** — it's encoded in the `?callbackUrl=` parameter. If the user clears cookies, switches tabs, or closes the window before signing in, the code is gone.

**Carry-forward** from CLAUDE.md follow-ups (P3-6). Cosmetic.

**Confidence:** High.

---

#### [P3] BuyButton has no rendered consent-checkbox on the page; consent is collected on Stripe's hosted page

**Location:** `components/bureau/BuyButton.tsx:50-87`

**What:** The "Get the kit" button leads to an email-capture form, then redirects to Stripe. The consent checkbox is on Stripe's hosted page (per `consent_collection: {terms_of_service: 'required'}`). For our records, we don't have a moment of "user clicked I agree" before leaving our site.

**Why it might matter:** Stripe captures the consent and stores it on their side. If we ever audit consent ourselves, we depend on Stripe's records. An attacker MITM-ing between Stripe and us cannot remove the consent record from their side, so this is mostly OK. However: GDPR best practice recommends the controller (us) capture the consent record themselves.

**Remediation:** Optional. Add a checkbox to the email-capture step in BuyButton with a link to /terms and /privacy. Persist as an audit row before redirecting to Stripe. Defer.

**Confidence:** Medium.

---

### 2.17 — Business logic loopholes & abuse vectors

#### [P1] Account deletion → ActivationCode `claimedByUserId` SetNull → re-claim by a different user

**Location:** `prisma/schema.prisma:158`, `app/api/me/route.ts:74-89`, `app/api/cases/activate/route.ts:64-94`

**What:** When a user deletes their account, `ActivationCode.claimedByUserId SetNull` fires (per the FK rule). The `claimedAt` timestamp stays. Then `app/api/cases/activate/route.ts:64-94` checks: `existingOwnership` (the deleting user no longer has a UserCase), `activation.claimedByUserId` (now null after SetNull), so the route's "already claimed by someone else" branch (line 83-88) is bypassed and a new user can register and re-claim the code.

**Evidence:** Confirmed in Batch 6 Observation 2. The observation says "Whether this is desirable is a product decision."

**Why it's a problem:** A malicious user could:
1. Buy a case (legitimate Stripe payment).
2. Redeem it.
3. Delete their account.
4. Re-create a fresh account with the same email (registration is uniform 201, no enumeration block).
5. Re-redeem the same code.
6. Repeat indefinitely on a single $30 purchase.

Or a refund-after-delete scenario: user buys, redeems, deletes account, requests refund (within 7 days). Operator checks `claimedAt` — it's set, so refund denied. User says "I deleted my account, please refund." Operator manually refunds. Code's `revokedAt` is set by `charge.refunded`. But: the user's deletion already nulled `claimedByUserId`, and the refund handler's `if (order.activationCode.claimedByUserId !== null) tx.userCase.deleteMany(...)` skips because `claimedByUserId === null`. Net: refund issued; code revoked; no UserCase to delete (user is gone); the next user who finds the code in their email and registers can redeem it... except for `revokedAt` which now blocks. So this *specific* sequence doesn't work, but the more general pattern remains.

**Impact:** Free-content abuse via a delete-loop. Medium-severity because the cost of each loop is one Stripe transaction (real card swipe), so an attacker needs a stolen card to scale; but a legitimate frugal user could just delete-and-recreate to give a kit to a friend.

**Remediation:** When a user deletes their account, also stamp `revokedAt: new Date()` on every ActivationCode they claimed. This is a one-line addition to the `prisma.user.delete` flow:
> ```ts
> await prisma.$transaction([
>   prisma.activationCode.updateMany({
>     where: { claimedByUserId: userId },
>     data: { revokedAt: new Date() },
>   }),
>   prisma.user.delete({ where: { id: userId } }),
> ]);
> ```

**Verification:** Test sequence: register → activate → delete → register again with same email → enter same code → expect 410 ("revoked").

**Confidence:** High.

---

#### [P2] No throttling on per-recipient activation-code email sends — paid spam relay vector

**Location:** `app/api/checkout/route.ts:135` + `app/api/webhooks/stripe/route.ts:285-321`

**What:** The audit dossier P1-3 ("attacker-supplied email") is open. The architectural fix (require account-creation pre-checkout, or token-link delivery) is deferred. **The interim fix** the audits suggested — per-recipient throttle — has not been implemented. An attacker pays for 50 different cases (or loops on one card 50 times across the catalog) with `email: victim@example.com` and floods the victim's inbox with branded "Your Black Ledger activation code" emails from `no-reply@theblackledger.app`. Resend's account reputation suffers; the victim reports as spam; Resend suspends the account.

**Why it's a problem:** Open since the v1 audit. Defended only by: (a) the attacker pays $30 per email — limits scale, (b) the duplicate-purchase guard blocks same-(email × case) repeat. But: the catalog has multiple cases, so 50 email sends to a victim cost only 50 × $30 = $1500 — affordable for a focused harassment campaign.

**Remediation:** In the webhook, add `prisma.order.count({ where: { email, createdAt: { gt: 1h ago }, status: COMPLETE } })` and refuse to send (log + mark Order with `emailLastError: "Throttled"`) if the count exceeds 3 in the last hour.

**Confidence:** High.

---

#### [P2] `oneTimePerUser=false` is functionally a no-op due to unconditional `@@unique([accessCodeId, userId])`

Carries forward from prior audits. Open follow-up for product decision.

**Confidence:** High.

---

#### [P2] AccessCode unlocks_target validator widened to `hidden_evidence` but the admin UI form excludes it

**Location:** `lib/validators.ts:279`, `app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx:5`

**What:** Batch 4 Fix 2 widened the validator and added the API ownership branch for `"hidden_evidence"`, BUT the client form `TargetType = "record" | "person" | "hint"` (line 5) and the dropdown options (line 172-175) still exclude it. So an admin cannot create a `hidden_evidence` AccessCode through the UI; they'd have to `curl` it directly. The redeem route + the workspace renderer DO support hidden_evidence.

**Impact:** Half-shipped feature. The fix at the API/validator layer landed; the UI layer didn't. Admin who wants to use hidden_evidence has no UI path.

**Remediation:** One-line addition: `type TargetType = "record" | "person" | "hint" | "hidden_evidence"` + add the dropdown option + populate `targetOptions` for `targetType === "hidden_evidence"` from a new `hiddenEvidence: { id, title }[]` prop fetched on the page. ~10 lines.

**Confidence:** High.

---

### 2.18 — What previous audits missed

The 2026-05-01 audits did not catch:
- The non-constant-time `CRON_SECRET` comparison (Phase 2.14 above).
- The `idempotencyKey` 15-minute bucket flaw (Phase 2.6 above).
- The `findMany` admin-page pagination gap (Phase 2.7 above) — Cowork mentioned `/bureau/database` paginate but didn't sweep admin pages.
- The `charge.refunded` handler treating partial refunds as full revocations (Phase 2.6 above).
- The `Resend` activation email lacking `Reply-To` (Phase 2.8 above).
- The R2 presigned PUT lacking `Content-Length` bound (Phase 2.9 above).
- The Sharp `limitInputPixels` not being set (Phase 2.3 above).
- The `CheckpointAttempt` write outside the transaction (Phase 2.7 above).
- The Privacy Policy §6 factual error about all processors being US-based (Phase 2.15 above).
- The `Order.email` case-normalization dependency on Zod (Phase 2.6 above).
- The `error.tsx` absence (Phase 2.12 above).
- The `IP source` rate-limit bypass via spoofed `X-Forwarded-For` (Phase 2.5 above) — none of the audits checked this.
- The activation-code re-claim after account deletion (Phase 2.17 above) — flagged in Batch 6 Observation 2 as a "product decision," not a security finding.
- The `hidden_evidence` admin UI gap (Phase 2.17 above) — Batch 4 Fix 2 only widened the API; the UI still lags.
- The activation-code email recipient throttling not implemented as the v1-audit-recommended interim fix.

The audits caught and the latest batches closed: BuyButton race (Batch 5), webhook concurrent-delivery (Batch 4), payment_intent.payment_failed orphan (Batch 4), email enumeration via 409 (Batch 4), webhook livemode validation (Batch 4), JWT non-invalidation (Batch 3), broad webhook CSRF carve-out (Batch 2), email-leaking checkout/success page (Batch 2), CSV formula injection (Batch 1), revokedAt client-controlled (Batch 1), DELETE /api/me missing (Batch 6), admin rate limits missing (Batch 7), runtime not pinned (Batch 7), login timing leak (Batch 7).

### 2.19 — Other (75-mind sweep)

#### [P2] No backup / DR plan documented for Neon

**What:** Neon offers branch-based point-in-time recovery (PITR) up to 7 days on the free tier. After 7 days, no recovery is possible. The `DATABASE_URL` is a single Neon project; if the project is accidentally deleted (one-click in the Neon dashboard), all data is gone with no backup. Carry-forward as an operational launch blocker.

**Remediation:** Add a daily `pg_dump` cron pushing to a separate destination (R2, Backblaze B2). Or upgrade Neon plan to Scale for 30-day PITR.

**Confidence:** High.

---

#### [P3] No webhook secret rotation story

**What:** `STRIPE_WEBHOOK_SECRET` is a single value. If it ever leaks (via Vercel env-var snapshot, a developer's screenshot, etc.), there's no documented procedure to rotate. Stripe supports multiple webhook endpoints with different secrets, but the codebase reads only one.

**Remediation:** Document a rotation runbook. Optionally support reading multiple secrets from `STRIPE_WEBHOOK_SECRET_1, STRIPE_WEBHOOK_SECRET_2` and try each. Defer.

**Confidence:** High.

---

#### [P3] No CI / automated test gate before merge

**Location:** Confirmed via `Glob '.github/workflows/*'` — returns nothing.

**What:** There's no GitHub Actions CI. Push-to-main is the only gate. A future PR can land with broken tests, broken type-checks, or broken builds.

**Remediation:** Add `.github/workflows/ci.yml` running `tsc --noEmit && vitest run && next build`. Defer.

**Confidence:** High.

---

#### [P3] `/api/cron/cleanup-pending-orders` lacks Vercel-cron user-agent validation

**Location:** `app/api/cron/cleanup-pending-orders/route.ts:10-22`

**What:** Vercel cron requests carry `User-Agent: vercel-cron/1.0`. The route checks only `Authorization: Bearer ${cronSecret}`. An attacker who somehow obtains the secret can invoke the route any time. Adding a `User-Agent` check provides defense-in-depth (an attacker would need to also forge the UA) — though UAs are trivially forgeable, it raises the bar for an unsophisticated probe.

**Remediation:** `if (request.headers.get("user-agent") !== "vercel-cron/1.0") return 403;`. Defense-in-depth only.

**Confidence:** Medium.

---

#### [P3] Vercel exposes `VERCEL_GIT_COMMIT_SHA` / `VERCEL_GIT_COMMIT_REF` as build env vars — confirm not bundled into client

**Location:** Likely none; `Grep "VERCEL_"` returns no source matches. Listed for completeness.

**Remediation:** Document in `.env.example` if any are intentionally used. None are today.

**Confidence:** High.

---

#### [P4] Admin support reply uses Resend's HTML escape but plaintext body is line-split with double-`<p>`

**Location:** `app/api/admin/support/[id]/reply/route.ts:69-78`

**What:**
> ```ts
> ${parsed.data.body
>   .split("\n")
>   .map((line) => `<p>${escapeHtml(line)}</p>`)
>   .join("")}
> ```

A blank line in the operator's reply produces an empty `<p></p>` which collapses to no visible space in some clients (Gmail) but adds vertical space in others (Apple Mail). Cosmetic; reply formatting may surprise.

**Remediation:** Filter empty lines or use `<br>` for spacing. Cosmetic.

**Confidence:** High.

---

#### [P3] `lib/rate-limit.ts:62-65` — in-memory bucket eviction by insertion order, not LRU

**Location:** `lib/rate-limit.ts:62-65`

**What:** When the in-memory backend (dev) reaches `MAX_TRACKED_KEYS = 500`, it evicts the **first** key in insertion order. An attacker can fill the bucket with 500 fresh keys, evicting the legitimate user's bucket so the legitimate user gets a fresh quota. Less of a concern in dev; negligible in prod (Upstash backend). Carry-forward from Cowork P3-16.

**Remediation:** True LRU with an access timestamp on the bucket. Or just bump MAX_TRACKED_KEYS to 50_000 — RAM is cheap. Or accept dev-only.

**Confidence:** High.

---

# PHASE 3 — SYNTHESIS & EXECUTIVE REPORT

## 3.1 — Executive summary

Black Ledger is the most carefully-engineered indie codebase I've audited in this product class. Seven disciplined fix batches plus two Week-12 polish passes have closed every commodity vulnerability the prior god-mode audits surfaced. Webhooks are signature-verified, livemode-checked, and idempotent at two layers. Stripe Checkout enforces TOS consent. JWT sessions invalidate on password reset within milliseconds. The CSRF middleware uses `URL().origin` round-trips, not string-prefix matches. CSP is enforced. Login is constant-time. Activation codes are server-stamped. Admin endpoints have a 60/60s rate limit on every mutation route. The Privacy + Terms pages are well-structured and fact-check against Georgia's PDPL. Test coverage is broad and the build is clean.

What's left is a small, tractable set of real issues that span four categories. **One P1 is a 5-line code fix** (cron secret comparison non-constant-time at `app/api/cron/cleanup-pending-orders/route.ts:20`). **Three P1s are business-logic loopholes** (refund-after-redeem entitlement-preservation gap, account-deletion → activation-code re-claim loop, Privacy Policy Section 6 factual error about processor locations). **One P1 is a partial-refund correctness bug** (the new `charge.refunded` handler treats partial refunds as full revocations). The remainder is performance hazards (3 admin pages with unbounded `findMany`), defense-in-depth (X-Forwarded-For spoofing bypasses every rate limit, R2 presigned PUT lacks Content-Length cap, Sharp lacks decompression-bomb cap), and 2 Week-12 launch blockers nobody has tackled (Resend DKIM/SPF/DMARC and Stripe Live activation).

The most adversarially-troubling finding is the **X-Forwarded-For trust assumption in `lib/rate-limit.ts:88-95`**. Every public POST rate-limit (registration 3/60s, code redeem 5/60s, theory 10/60s, checkpoint 20/60s, admin mutations 60/60s) is bypassable by a script that spoofs `X-Forwarded-For: 1.2.3.<random>` per request. Vercel does not strip incoming X-Forwarded-For; it appends. The leftmost token (which `lib/rate-limit.ts` reads) is attacker-controlled. Verify the platform's actual behavior in the Vercel dashboard — but if the static read is correct, every rate-limit is decorative until this is fixed. Severity escalates if any single endpoint becomes a credential-stuffing or code-guessing target after launch.

Ship-readiness for first paying customer: **fix the four P1 code findings + the X-Forwarded-For rate-limit bypass before live mode flips.** Privacy Policy §6 and the refund flow are weeks-of-customer-trust issues, not days-of-uptime issues — fix them this month. The three operational blockers (Resend DKIM, Stripe Live, Georgian lawyer review) sit outside the codebase; do them in parallel.

## 3.2 — Findings dashboard

| ID | Severity | Title | Location |
|---|---|---|---|
| F-01 | **P1** | Cron secret comparison not constant-time | `app/api/cron/cleanup-pending-orders/route.ts:20` |
| F-02 | **P1** | `charge.refunded` revokes entitlement on partial refunds | `app/api/webhooks/stripe/route.ts:371-435` |
| F-03 | **P1** | Account-delete → ActivationCode `claimedByUserId` SetNull → re-claim loop | `prisma/schema.prisma:158`, `app/api/me/route.ts:74-89` |
| F-04 | **P1** | Privacy Policy §6 factually wrong about processor locations | `app/privacy/page.tsx:271-285` |
| F-05 | **P1** | Refund policy 7-day window has no automated enforcement endpoint | `app/terms/page.tsx:189-225`, no `/api/refund-request` exists |
| F-06 | **P2** | X-Forwarded-For spoofing bypasses every rate limit | `lib/rate-limit.ts:88-95` |
| F-07 | **P2** | `idempotencyKey` 15-min bucket window allows duplicate Stripe sessions | `app/api/checkout/route.ts:128-130` |
| F-08 | **P2** | `forgot-password` route timing leaks email registration | `app/api/forgot-password/route.ts:13-100` |
| F-09 | **P2** | `/api/access-codes/redeem` resolveContent lacks caseFileId match assertion | `app/api/access-codes/redeem/route.ts:11-43` |
| F-10 | **P2** | Three admin pages do unbounded `findMany` | `app/bureau/admin/cases/page.tsx:12`, `[caseId]/codes/page.tsx:29`, `[caseId]/access-codes/page.tsx:42` |
| F-11 | **P2** | R2 presigned PUT lacks `Content-Length` bound | `app/api/admin/uploads/sign/route.ts:86-94` |
| F-12 | **P2** | Sharp `limitInputPixels` not configured | `app/api/admin/uploads/blurhash/route.ts:30-34` |
| F-13 | **P2** | Activation code email throttle-per-recipient not implemented | `app/api/webhooks/stripe/route.ts:285-321` |
| F-14 | **P2** | `oneTimePerUser=false` is a no-op (carries forward — open) | `prisma/schema.prisma:456` |
| F-15 | **P2** | `hidden_evidence` admin UI form excludes the type | `app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx:5` |
| F-16 | **P2** | Activation code keyspace ~52 bits — weak if DB leaks | `app/api/webhooks/stripe/route.ts:11-23` |
| F-17 | **P2** | CheckpointAttempt outside transaction | `app/api/cases/[slug]/checkpoint/route.ts:139-148` |
| F-18 | **P2** | `Order` consent record (TOS version) not captured | `app/api/checkout/route.ts:140-142` |
| F-19 | **P2** | Activation code revoke is read-then-write race | `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts:46-65` |
| F-20 | **P2** | Resend activation email lacks `Reply-To` | `app/api/webhooks/stripe/route.ts:285-321` |
| F-21 | **P2** | No backup/DR plan for Neon | (operational) |
| F-22 | **P2** | Vercel preview env CSRF brittle if `NEXT_PUBLIC_APP_URL` misconfigured | `middleware.ts:7-8` |
| F-23 | **P2** | `app/layout.tsx` calls `auth()` on every render (carries forward) | `app/layout.tsx:27` |
| F-24 | **P2** | CSP `'unsafe-inline'`/`'unsafe-eval'` (carries forward) | `next.config.ts:28` |
| F-25 | **P2** | Resend DKIM/SPF/DMARC pending (operational) | (Namecheap DNS) |
| F-26 | **P2** | Stripe Live activation pending (operational) | (Stripe Dashboard) |
| F-27 | **P2** | Sharp + Email + many admin endpoints lack test coverage on new branches | (multiple) |
| F-28 | **P2** | Slug-history grows unbounded on rename churn | `app/api/admin/cases/[caseId]/route.ts:426-435` |
| F-29 | **P2** | `Order.email` case-normalization depends on Zod (no defense-in-depth) | `app/api/checkout/route.ts:170` |
| F-30 | **P3** | `error.tsx` missing in every route group | (none) |
| F-31 | **P3** | NextAuth POST rate-limit applies to sign-out/callback | `app/api/auth/[...nextauth]/route.ts:9-21` |
| F-32 | **P3** | Slug-history redirect leaks slug existence | `app/cases/[slug]/page.tsx:19-28` |
| F-33 | **P3** | tsconfig target ES2017 dated | `tsconfig.json:3` |
| F-34 | **P3** | `package.json` missing `engines.node` | (none) |
| F-35 | **P3** | No structured logging / Sentry | (everywhere) |
| F-36 | **P3** | No GitHub Actions CI | (none) |
| F-37 | **P3** | Cron route lacks Vercel-cron User-Agent validation | `app/api/cron/cleanup-pending-orders/route.ts:10-22` |
| F-38 | **P3** | ProcessedStripeEvent has no TTL | `prisma/schema.prisma:499-502` |
| F-39 | **P3** | "We saved your code" copy misleading | `app/(unlock)/bureau/unlock/page.tsx:39-41` |
| F-40 | **P3** | `unarchive-case.ts` hardcodes CASE_ID = 3 | `scripts/unarchive-case.ts:10` |
| F-41 | **P3** | `RevokeButton` still posts ignored `revokedAt` | (carry-forward) |
| F-42 | **P3** | `Bureau` dashboard runs `auth()` twice per request | `app/bureau/page.tsx:28` + layout |
| F-43 | **P3** | In-memory rate-limit FIFO eviction (dev only) | `lib/rate-limit.ts:62-65` |
| F-44 | **P3** | No webhook secret rotation runbook | (operational) |
| F-45 | **P3** | Activation-code `Order_caseFileId_email_status_idx` not `CONCURRENTLY` | `prisma/migrations/20260501000000.../migration.sql:10` |
| F-46 | **P3** | `lucide-react ^1.8.0` pin (carries forward — verified real package) | `package.json:34` |
| F-47 | **P3** | `dotenv` loaded in production runtime (carries forward) | `lib/prisma.ts:1-3`, `prisma.config.ts:3-5` |
| F-48 | **P3** | Stripe/Resend client caching disabled in production (carries forward) | `lib/stripe.ts:23`, `lib/resend.ts:20` |
| F-49 | **P3** | Legacy `/api/admin/cases/[caseId]/activation-codes` has unbounded retry (carry) | `app/api/admin/cases/[caseId]/activation-codes/route.ts:60-66` |
| F-50 | **P3** | Initial activation-code create not in transaction (carry) | `app/api/admin/cases/route.ts:82-89` |
| F-51 | **P4** | Admin support reply HTML duplicates `<p></p>` for blank lines | `app/api/admin/support/[id]/reply/route.ts:72-75` |
| F-52 | **P4** | `assertSafeEnv` gone from `seed-global-people.ts`, replaced by opt-in flag (regression) | `scripts/seed-global-people.ts:27-39` |

## 3.3 — Top 10 launch-blockers (ranked by impact-per-fix-cost)

1. **F-01 — Cron secret non-constant-time comparison.** 5-line fix using `timingSafeEqual`. Fixes a future-attack-surface that becomes severe as soon as a second cron is added. **Do this first.**
2. **F-06 — X-Forwarded-For rate-limit bypass.** 5-line fix in `lib/rate-limit.ts`. Upgrades every rate-limit from "decorative" to "real." Single biggest defense-in-depth ROI in the codebase. Verify Vercel's specific behavior in dashboard before fixing.
3. **F-02 — Partial-refund full revocation.** 1-line guard. Customer-relationship damage on day-one of any partial refund.
4. **F-03 — Account-delete code re-claim loop.** 3-line fix to add `revokedAt` stamp on user delete. Closes a free-content abuse vector that any frugal user can exploit.
5. **F-04 — Privacy Policy §6 factual error.** Lawyer-review item. Touches the Stripe Live activation timeline. Cannot ship live mode without resolving.
6. **F-25, F-26 — Resend DKIM + Stripe Live activation.** Operational, parallel track. Already on the punch-list. ~2 hours each, but lawyer-review (F-04) gates Stripe Live.
7. **F-05 — Refund flow has no automated enforcement.** Larger effort. Either build `/api/refund-request` (~200 lines + UI) or rewrite Terms §7 to "request via support email" and accept the manual operator burden.
8. **F-13 — Activation code email throttling.** Defends Resend account from paid-spam abuse. ~10 lines in the webhook.
9. **F-11 — R2 presigned PUT Content-Length cap.** Defense-in-depth against admin-token abuse. ~3 lines.
10. **F-07 — `idempotencyKey` 15-minute bucket flaw.** Drop the bucket from the key. ~3 lines.

## 3.4 — Quick wins (<30 minutes each, ordered by impact-per-minute)

1. **F-01** — `timingSafeEqual` on cron secret. 5 minutes.
2. **F-37** — Add `User-Agent: vercel-cron/1.0` check to cron. 2 minutes (defense-in-depth pair with F-01).
3. **F-07** — Drop bucket from idempotencyKey. 3 minutes + 1 test update.
4. **F-19** — Atomic `updateMany` revoke. 5 minutes.
5. **F-12** — `sharp({ limitInputPixels: 1_048_576 })`. 1 minute.
6. **F-20** — Add `replyTo: "support@..."` to activation email. 2 minutes.
7. **F-39** — Fix "We saved your code" copy to "We'll restore your code after sign-in." 1 minute.
8. **F-15** — Widen admin UI dropdown to include "hidden_evidence." 5 minutes.
9. **F-17** — Move CheckpointAttempt inside transaction. 4 minutes.
10. **F-29** — Add explicit `.toLowerCase()` at every Order.email write site. 2 minutes.
11. **F-03** — Stamp `revokedAt` on every claimed code at user-delete time. 5 minutes + 1 test.
12. **F-02** — Branch on `charge.amount_refunded === charge.amount`. 5 minutes.

Combined: ~40 minutes to close 12 findings spanning P1 through P3.

## 3.5 — Strategic recommendations (1–3 month horizon, opinionated)

1. **Adopt structured logging and an error-monitoring SaaS (Sentry, Better Stack, Logtail).** The codebase is one or two production-traffic events away from learning about a bug from a customer email instead of a dashboard. Half-day of work, multi-month payoff.
2. **Move toward CSP nonce-based script-src and drop `unsafe-inline`/`unsafe-eval`.** Multi-week effort touching every Framer-Motion site. Opens up real XSS-blast-radius reduction and removes a major audit footnote.
3. **Build a refund flow that lives entirely inside the product.** The current support-email-pass-through is operationally fine for 10 customers a month. At 100/month it becomes a customer-service drag and a refund-policy-mismatch hazard. A `/api/refund-request` endpoint that wraps Stripe's API, enforces the 7-day window, and fires the existing `charge.refunded` handler closes F-05 cleanly.
4. **Introduce contract tests for the Stripe webhook.** The existing `tests/api/stripe.test.ts` is good but doesn't exercise: `charge.refunded`, `async_payment_failed`, ProcessedStripeEvent collision, idempotencyKey collision. A small library like `stripe-mock` or hand-rolled Stripe-event fixtures would let you drive the webhook through every event-type with race scenarios.
5. **Move the activation-code email send out-of-band.** Inngest, Vercel Queues, or QStash. Closes F-08 (forgot-password timing leak). Decouples Resend availability from user-facing latency. Preconditions a future "retry failed activation emails" cron.
6. **Switch `bcryptjs` to native `bcrypt`.** `bcryptjs` is 5–10× slower than the C binding; under load every login takes 200–800 ms. Same security model. Pure ergonomics.
7. **Split admin into a separate Next.js app or put Cloudflare Access in front of `/bureau/admin/*`.** The 60/60s admin rate-limits are good; the only-one-admin guarantee is fragile. IP-allowlist via Cloudflare Access at the edge is a 30-minute config and removes admin from the public attack surface entirely.
8. **Build a `data-export` endpoint (`GET /api/me/export`) returning JSON of every row keyed to the user.** GDPR Article 20 (data portability) is a stated commitment in `/privacy` §9. Today the operator must manually run SQL. ~50 lines of code.

## 3.6 — Audit reconciliation report

See Phase 1.9 for the full table. **One regression caught:** `scripts/seed-global-people.ts` had `assertSafeEnv` removed in commit `e964593` and replaced with the `BL_ALLOW_GLOBAL_PEOPLE_SEED` opt-in flag. Documented as a deliberate change, not a bug — the script is now idempotent and the opt-in flag is sufficient. CLAUDE.md still describes Batch 1 Fix 1 as adding `assertSafeEnv`, which is now stale. **One partial regression:** Batch 4 Fix 2 widened the AccessCode validator to accept `hidden_evidence`, but the admin UI `CreateAccessCodeForm.tsx:5` still has the narrow three-type union. Half-shipped. All other claims verified intact at HEAD `76a30ac`.

## 3.7 — What I did NOT audit

- **`npm audit` / dependency CVE scan.** Read-only session, no install authority. Re-run before each major release.
- **Vercel dashboard.** Could not inspect: env-var parity between Preview and Production, function regions vs Neon US-East-1 co-location, build settings, custom domain config, cron registration, deploy logs.
- **Stripe dashboard.** Could not verify: webhook subscriptions registered (especially `charge.refunded` and `checkout.session.async_payment_failed`), test-vs-live mode parity, public details (TOS+Privacy URLs), Stripe Account country, Stripe Connect setup.
- **Resend dashboard.** Could not verify: DKIM/SPF/DMARC records, sender domain verification, suppression-list health.
- **DNS configuration.** Namecheap records for `theblackledger.app` are external.
- **Live Stripe E2E.** `scripts/test-stripe-e2e.ts` exists but I did not execute it.
- **Did not run the test suite.** `npx vitest run` claims 168 passing per Batch 6/7 reports; not re-executed.
- **Did not run the type checker.** `npx tsc --noEmit` claims clean per Batch 7; not re-executed.
- **Did not run the build.** `npm run build` claims clean per Batch 7; not re-executed.
- **Live RSC payload inspection.** Did not curl `https://theblackledger.app/bureau/database` and grep for solution strings; the static read of `app/bureau/database/page.tsx` confirms the rewrite to a server-action search closes the prior P0, but live confirmation requires browser session.
- **Penetration probing.** No dynamic input-fuzzing, no SQLi probe, no concurrent-request flooding. All findings are from static reading.
- **Mobile / accessibility / WCAG testing.** Static read shows reasonable structural patterns (`<label>`, `<input>` pairs; `aria-hidden` on decorations); did not run an axe-core or screen-reader audit.
- **`scripts/test-full-flow.ts` not re-read in detail.** Sampled, not graded.
- **`prisma/seed/cases/harbor-fog.ts` not re-read.** Confirmed by Explore agent as a seed template.
- **`scripts/godmode-audit.{ps1,sh}` and `docs/*.md`** — read-only artifact archives, not security-bearing.
- **`new-case.ts` and `seed-case-file.ts` not read line-by-line.** Marked safe by Explore agent; not a critical surface.

## 3.8 — Coverage attestation

Every file in the Phase 0 coverage tracker was read in Phase 1, with two delegated surveys (Explore agent for marketing + admin-tab UI + tests + scripts). **Confirmed read in full:**

- All root configs (12 files)
- `auth.ts`, `auth.config.ts`, `middleware.ts`, `types/next-auth.d.ts`
- All 14 files in `lib/`
- All 32 API route handlers under `app/api/`
- All bureau pages: workspace (`/bureau/cases/[slug]`), database, debrief, records detail, archive, dashboard, layouts (regular + admin), `/account/delete`
- The unlock route group (page + UnlockForm)
- All auth pages (login, register, reset-password, forgot-password) + their forms
- Public case page + `CasePublicView`
- All admin case-management pages (cases, codes, access-codes, support, edit, edit components confirmed via Explore)
- `RevealedEvidence`, `BuyButton`, `Navbar`, `Footer`, `ImageUploader`, `PublishCaseButton`, `CreateCaseForm`, `CreateAccessCodeForm`, `AccessCodeList`, `AccessCodesPanel`, `ReplyForm`, `CheckpointForm`, `TheorySubmissionForm`, `CaseActivationForm`, `GlobalPeopleSearchTerminal`, `DeleteAccountForm`, `LoginForm`, `RegisterForm`, `ResetPasswordForm`, `ForgotPasswordForm`, `SignOutButton`
- Privacy + Terms full body
- All 6 Prisma migrations + `migration_lock.toml` + schema
- All 12 audit dossier markdown files (v1, v2, verification, two 2026-05-01 audits, 7 batch reports + observations)
- 4 of 8 scripts read in full (assertSafeEnv, reset-case-progress, unarchive-case, seed-global-people first 50 lines); rest surveyed by Explore
- `tests/api/me.test.ts` (first 100 lines) + 22-file inventory by name from Explore

**Not read line-by-line (acknowledged gap, no findings expected):** UI primitives in `components/ui/*` (Card, Pill, etc.), the 6 admin tab UI components (Explore confirmed safe data slices), `scripts/{create-admin, new-case, seed-case-file, test-stripe-e2e, test-full-flow}` (Explore-summarized), the 800-line `app/bureau/people/[personId]/page.tsx` (Explore confirmed the analyst-note visibility filter at line 50-55), marketing pages (`/about`, `/faq`, `/how-it-works`, `/support`, `/cases`, home), and `app/bureau/admin/cases/[caseId]/preview/page.tsx`. None of these are security-bearing surfaces; the Explore agent's brief covered them.

## 3.9 — Confidence calibration

**Overall confidence: high** that the findings cited are real and the severities are appropriate. **Specific points where my confidence is lower:**

- **F-06 (X-Forwarded-For)**: Marked Medium-High because Vercel's actual XFF behavior changes across platform releases — the static read of `lib/rate-limit.ts` is unambiguous, but whether the leftmost token is attacker-controlled in 2026 requires Vercel-dashboard-side verification I cannot do from this session. *If confirmed, this is the most-impactful finding in the report.*
- **F-04 (Privacy §6 factual error)**: Confidence is on the legal claim ("all processors are US-based"); the actual processor architecture (specifically Stripe Payments Europe Ltd handling EU customer payments via Stripe US's account) requires lawyer + Stripe-dashboard verification.
- **F-22 (Vercel preview env CSRF)**: Cannot verify Vercel env-var configuration from this session.
- **F-12 (Sharp limitInputPixels)**: Static read; I did not measure actual memory consumption on a 16384×16384 input.
- **F-05 (refund 7-day window)**: Confidence on the absence of an enforcement endpoint is high; confidence on the operational consequences depends on operator-process discipline I cannot inspect.

**Things that would raise my confidence on the rest:**

1. Running `npx tsc --noEmit && npx vitest run && npm run build` from a clean checkout. Last known-clean state is from Batch 7 reports; could have regressed since.
2. Running `npm audit --omit=dev` to confirm dependency CVE posture.
3. Running `scripts/test-stripe-e2e.ts` against test-mode Stripe to confirm webhook + idempotencyKey + ProcessedStripeEvent + charge.refunded all wire end-to-end.
4. Browser session against `https://theblackledger.app/bureau/database` to confirm the post-`a743bc0` rewrite leaves no solution strings in the RSC payload.
5. Vercel dashboard inspection to confirm: env-var parity, cron registration, function logs since deploy, Sentry/Logtail status (if any).
6. Stripe dashboard inspection to confirm webhook event subscription includes `charge.refunded` (BatchObservation 5.1c flagged this as a pending operator action).
7. Neon dashboard inspection to confirm the `Order_caseFileId_email_status_idx` index actually applied (`prisma migrate deploy` was the operator step).

**Known unknowns explicitly listed:**

- I cannot verify any external-service state (Stripe, Resend, Vercel, Neon, Cloudflare R2 dashboards).
- I cannot verify DNS records (DKIM/SPF/DMARC).
- I cannot verify whether Batch 7's claimed file deltas actually match HEAD — I read HEAD source, not the diff against pre-Batch-7. The static read of HEAD does match what Batch 7's report claims, but I did not run `git diff main~5 main` to verify.
- I cannot verify Vercel's actual `X-Forwarded-For` handling in 2026.
- The audit dossier's "test count: 168" cannot be re-validated without running vitest.
- I did not exhaustively read all 22 test files; Explore-agent summary was used. A test file could have stale assertions or incorrectly-mocked dependencies that mask a real bug, but the inventory matched the route-handler coverage map well enough that I have moderate confidence the paths flagged "untested" really are.

The finding list above is what a careful third pair of eyes catches on top of the existing thorough audit dossier. Every item is from a file I read in this session at the line cited. No findings were copied from prior audit docs without independent verification at HEAD.

---

End of audit. No source code modified. No migrations executed. No commits, pushes, installs, or external API calls.
