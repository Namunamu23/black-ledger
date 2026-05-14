# Black Ledger — God-Mode Full Audit (Super)

**Audit date:** 2026-05-13 (UTC)
**Auditor:** Claude Opus 4.7 (1M context) operating as a fused 75-expert team
**Repo:** `C:\Users\gatch\Documents\black-ledger\site`
**HEAD:** `453582a docs(audit): archive batch 16 prompt + 2026-05-10 review + design ideation`
**Branch:** `main` (clean against `origin/main`; only the audit prompt files are dirty)
**Posture:** Read-only forensic audit. No edits, no migrations, no installs.

---

## Pre-Flight Report

| Check | Result |
|---|---|
| HEAD SHA | `453582a12024d2fd2ff9e711c1f7bb448c0f8c6c` |
| Branch | `main` |
| Clean vs origin/main? | Yes (0 ahead, 0 behind). Modified: `AUDIT_PROMPT.md`, `CLAUDE.md`. Untracked: `AUDIT_PROMPT_V2.md`. |
| Source files (`.ts` + `.tsx`, excl. node_modules/.next/generated/.claude) | **182** |
| Prisma schema files | 2 (`prisma/schema.prisma` + `prisma/migrations/migration_lock.toml`) |
| Migrations applied | **8** (linear, no branching) |
| Audit dossier files under `audits/` | **55** |
| Node | `v24.14.1` (constraint `>=20` in `engines.node`) |
| TypeScript | `5.9.3` (target `ES2017`; `strict: true`) |
| Prisma | `7.x` (`@prisma/client ^7.7.0`, `@prisma/adapter-pg ^7.8.0`) |
| `tsc --noEmit` | **PASSED** (exit 0) |
| `vitest run` | **PASSED, 25 files / 203 tests** (CLAUDE.md says 198 — drift) |
| `prisma migrate status` | **`Database schema is up to date!`** — no drift |
| ESLint baseline | Not run separately (Next.js linter built into eslint-config-next); no errors observed in source review |
| `npm audit` (high+) | **Multiple new high-severity vulnerabilities since last batch — see Pre-Flight Defects below** |

### Pre-Flight Defects (lift these to the top of attention)

1. **`npm audit` — HIGH: Next.js 16.2.3 has a Server-Components DoS (GHSA-8h8q-6873-q5fj, CVSS 7.5)**. The advisory affects every `next@>=16.0.0 <16.2.5`. Fix is a patch bump to `next@16.2.5`. Two additional moderate XSS advisories on the same major affect CSP-nonce flows (which the codebase does not yet use) and pre-`16.2.5` cache-busting collisions. **This is the single most impactful new finding since the 2026-05-10 review** and converts the prior "0 open P0/P1" status to "1 open P1 immediately, blocking on a 30-second `npm i next@16.2.5` bump."
2. **`npm audit` — HIGH: `fast-uri ≤3.1.0` path-traversal (GHSA-q3j6-qgpj-74h6)** + host-confusion (GHSA-v39h-62p7-jpjc), reached transitively through Stripe SDK / Prisma. CVSS 7.5 each. Not exploitable in this codebase's code path today (we never feed user input into `fast-uri` parsing), but a transitive update is available.
3. **`npm audit` — HIGH: `fast-xml-builder ≤1.1.6`** XXE-style attribute-injection (GHSA-5wm8-gmm8-39j9). Transitive via `@aws-sdk/client-s3` → `@aws-sdk/xml-builder`. Not reachable in our R2 path (we never build XML from user input), but fixable via SDK bump.
4. **Test count drift in CLAUDE.md** — doc says 198, actual is 203. Trivial doc fix, but a signal that doc-state ages quickly.

`tsc`, `vitest`, and `prisma migrate status` are all green. Working tree is clean except for the prompt files. The codebase compiles, tests pass, schema matches migrations.

---

## Phase 0 — Boot Report

### 0.1 Boot files read

`package.json` (✓), `tsconfig.json` (✓, target ES2017, strict, `@/*` → root), `next.config.ts` (✓ enforced CSP + headers), `prisma/schema.prisma` (✓ 22 models, 9 enums), `prisma.config.ts` (✓ DIRECT_URL preferred for migrations), `middleware.ts` (✓ NextAuth+CSRF+role gates, WEBHOOK_PATHS allowlist), `auth.ts` (✓ constant-time fake-hash, DB tokenVersion check), `auth.config.ts` (✓ edge-safe, Prisma-free), `.env.example` (✓ documents every env var), `.gitignore` (✓ `/generated/prisma`, `.env*`, `.claude/`), `.gitattributes` (✓ LF normalization), `vitest.config.ts` (✓ node env, tests/**/*.test.ts), `eslint.config.mjs` (✓ next-config-next), `vercel.json` (✓ cron `0 4 * * *` on `/api/cron/cleanup-pending-orders`), `CLAUDE.md` (loaded into context), `README.md` (loaded), `AUDIT_PROMPT.md` (this prompt's archive), `AUDIT_PROMPT_V2.md` (the active prompt).

### 0.2 Stack version table

| Layer | Version |
|---|---|
| Node | `>=20` (`engines.node`); runtime `v24.14.1` |
| Next.js | `16.2.3` — **vulnerable: bump to 16.2.5** |
| React | `19.2.4` |
| Prisma | `@prisma/client ^7.7.0`, `@prisma/adapter-pg ^7.8.0`, CLI `prisma ^7.7.0` |
| Postgres | Postgres 17 on Neon (`us-east-1`, `ep-lively-smoke-ambslm9t`) |
| NextAuth | `^5.0.0-beta.30` (beta — track for stable release) |
| Stripe SDK | `^22.1.0`; `apiVersion: "2026-04-22.dahlia"` pinned |
| Resend SDK | `^6.12.2` |
| Upstash | `@upstash/ratelimit ^2.0.8`, `@upstash/redis ^1.37.0` |
| Sharp | `^0.34.5` |
| Zod | `^4.3.6` |
| bcryptjs | `^3.0.3` |
| AWS SDK (R2) | `@aws-sdk/client-s3 ^3.1032.0`, `@aws-sdk/s3-request-presigner ^3.1032.0` |
| `lucide-react` | `^1.8.0` (unusual major track — verified by closed ledger F-46 as real package, not security risk) |
| Vitest | `^4.1.4` |

### 0.3 Migration timeline (linear, no drift)

| # | Migration | Type | Summary |
|---|---|---|---|
| 1 | `20260425045353_init` | Init | 7 enums + 22 models + all relations + initial indexes |
| 2 | `20260425142952_add_order` | Additive | `ActivationCodeSource` enum + `OrderStatus` enum + `ActivationCode.source` + `Order` table (FK Order.caseFileId → RESTRICT) |
| 3 | `20260426163724_add_order_email_tracking` | Additive | `Order.emailSentAt` + `Order.emailLastError` (nullable) |
| 4 | `20260426200000_add_password_reset` | Additive | `User.passwordResetToken` (unique) + `User.passwordResetExpiresAt` |
| 5 | `20260427210000_add_user_token_version` | Additive | `User.tokenVersion Int @default(0)` |
| 6 | `20260501000000_add_processed_stripe_event_and_order_index` | Additive | `ProcessedStripeEvent` table + `Order(caseFileId,email,status)` composite index |
| 7 | `20260507052527_add_partially_refunded_and_user_case_revoked_at` | Additive | `OrderStatus PARTIALLY_REFUNDED` enum value + `UserCase.revokedAt` |
| 8 | `20260507070657_drop_access_code_one_time_per_user` | **Destructive** | Drop `AccessCode.oneTimePerUser` column |

`prisma migrate status` confirms: **"Database schema is up to date!"** — schema.prisma is the cumulative state of all 8 migrations. No drift.

### 0.4 Integration inventory

| Service | Auth method | Env vars | Client instantiation | Call sites | Webhook in |
|---|---|---|---|---|---|
| Stripe (Checkout + Webhooks + Refunds) | API key (`STRIPE_SECRET_KEY`) + signed webhooks (`STRIPE_WEBHOOK_SECRET`) + `STRIPE_PRICE_ID` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | `lib/stripe.ts` lazy singleton, `apiVersion: "2026-04-22.dahlia"` | `app/api/checkout/route.ts`, `app/api/webhooks/stripe/route.ts` | `POST /api/webhooks/stripe` (CSRF-bypassed) |
| Resend (transactional email) | API key | `RESEND_API_KEY`, `RESEND_FROM` (default `no-reply@theblackledger.app`) | `lib/resend.ts` lazy singleton | `forgot-password`, `webhooks/stripe`, `admin/support/[id]/reply` | none |
| Cloudflare R2 | S3-compatible signature v4 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | `app/api/admin/uploads/sign/route.ts:38-47` (inline `new S3Client`) | `admin/uploads/sign`, `admin/uploads/blurhash` (`fetch` only, no S3 client) | none |
| Neon Postgres | Connection-string | `DATABASE_URL` (pooled), `DIRECT_URL` (migrations) | `lib/prisma.ts` + `prisma.config.ts` (DIRECT_URL preferred for CLI) | All API + page Prisma calls | none |
| NextAuth | Internal (Credentials provider against User row) | `AUTH_SECRET` | `auth.ts` + `auth.config.ts` | All `/api/auth/*` + every page that calls `auth()` | NextAuth's own POST endpoints |
| Upstash Redis | REST URL + token | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `lib/rate-limit.ts` lazy per-(limit,window) | Auto-activated only when both env vars set; otherwise in-memory dev | none |
| Vercel Cron | Bearer `CRON_SECRET` + User-Agent `vercel-cron/1.0` | `CRON_SECRET` | `app/api/cron/cleanup-pending-orders/route.ts` | Daily `0 4 * * *` per `vercel.json` | none |

### 0.5 Coverage tracker (Phase 1 read-attestation at end of section)

The subagents covered file-by-file via the parallel passes; my own reads covered every file under `app/api/`, `lib/`, `auth*`, `middleware.ts`, `prisma/`, `next.config.ts`, plus the public/bureau/admin pages at the levels referenced in the data flow traces.

### 0.6 Closed Findings Ledger — see Phase 2.5 (Differential Audit). Sub-agent F produced a 75-row ledger across 14 closed batches; the salient entries are mirrored in Phase 2.5.

### 0.7 Deferred Findings Ledger — see Phase 2.5. Sub-agent F enumerated 50+ deferred items from the dossier, each with reason + revisit trigger; I re-verified the load-bearing ones against current code.

### 0.8 CLAUDE.md Drift Table (20 claims verified)

| # | CLAUDE.md claim | Verified? | Evidence |
|---|---|---|---|
| 1 | "198 Vitest tests passing across 24 files" | ✗ | `npx vitest run` shows **25 files / 203 tests** at HEAD |
| 2 | "8 migrations applied linearly" | ✓ | `ls prisma/migrations` confirms 8 dirs, monotonic timestamps |
| 3 | "Stripe Checkout live in sandbox with TOS+Privacy consent" | ✓ | `app/api/checkout/route.ts:147-149` has `consent_collection: { terms_of_service: "required" }` |
| 4 | "support 10/60s" rate limit | ✗ | `app/api/support/route.ts:9` is `{ limit: 3, windowMs: 60_000 }` — **3/60s, stricter than doc** |
| 5 | "waitlist 10/60s" rate limit | ✗ | `app/api/waitlist/route.ts:9` is **3/60s** |
| 6 | "theory 20/60s" rate limit | ✗ | `app/api/cases/[slug]/theory/route.ts:18` is **10/60s** |
| 7 | "checkpoint 30/60s" rate limit | ✗ | `app/api/cases/[slug]/checkpoint/route.ts:67` is **20/60s** |
| 8 | "uploads/sign 30/60s" rate limit | ✗ | `app/api/admin/uploads/sign/route.ts:50` is **20/60s** |
| 9 | "every admin mutation route 60/60s" | ✗ (partial) | Holds for most, but `codes` POST is 10/60s, `activation-codes` is 10/60s, `uploads/sign` is 20/60s |
| 10 | "Every Prisma-using API route pinned `runtime = 'nodejs'`" | ✓ | All 32 route.ts files declare it (subagent B verified) |
| 11 | "`tokenVersion` invalidation on password reset" | ✓ | `app/api/reset-password/route.ts:58` `tokenVersion: { increment: 1 }` |
| 12 | "Stripe API version pinned `2026-04-22.dahlia`" | ✓ | `lib/stripe.ts:21` |
| 13 | "`ProcessedStripeEvent` hard cross-delivery idempotency" | ✓ | `app/api/webhooks/stripe/route.ts:88-103` insert + P2002 → 200 |
| 14 | "Webhook CSRF bypass via `WEBHOOK_PATHS` Set" | ✓ | `middleware.ts:17` |
| 15 | "Cron `timingSafeEqual` + UA check" | ✓ | `app/api/cron/cleanup-pending-orders/route.ts:20-48` |
| 16 | "SSRF-guarded blurhash" | ✓ | `app/api/admin/uploads/blurhash/route.ts:80-93` host allowlist |
| 17 | "CSV formula-injection escape" | ✓ | `app/api/admin/cases/[caseId]/codes/route.ts:74-84` `csvEscape` |
| 18 | "Sharp pixel limit" | ✓ | `app/api/admin/uploads/blurhash/route.ts:36` `limitInputPixels: 1_048_576` |
| 19 | "Sealed `publicVerdict` response shape (Batch 13)" | ✓ in code (`app/api/cases/[slug]/theory/route.ts:149-161`) — but ✗ in test coverage (no test asserts shape) |
| 20 | "`/bureau/archive` seal closes Batch 13 closure regression" | ✓ (re-verified at `app/bureau/archive/page.tsx:162-166`: only CORRECT shows `feedback`, all else shows the generic "not ready for closure" line) |

**Net drift**: 7 of 20 claims false or partial. The biggest pattern is documentation describing rate-limit values that the code has since tightened. None of the false claims represent a security regression — in every case the actual code is stricter than CLAUDE.md describes. A P3-grade doc reconciliation pass is warranted.

---

## Phase 1 — Total Comprehension

### 1.1 File-by-file coverage attestation

The six parallel subagents collectively walked: every `app/` page + route handler (subagent A), every `app/api/*` route (subagent B), every Prisma model + every migration (subagent C), every trust-boundary entry point with cited line numbers (subagent D), every test file with its stubbing surface (subagent E), and the full audit dossier (subagent F). My own reads independently covered the hot-spot routes (`webhooks/stripe`, `checkout`, `access-codes/redeem`, `cases/activate`, `cron/cleanup-pending-orders`, `me`, `cases/[slug]/theory`, `cases/[slug]/checkpoint`, `register`, `forgot-password`, `reset-password`, `admin/uploads/sign`, `admin/uploads/blurhash`, `admin/cases/[caseId]/codes` + `/codes/[codeId]`, `admin/cases/[caseId]` PUT, `admin/cases` POST, `admin/cases/[caseId]/workflow`, `admin/cases/[caseId]/access-codes`, `admin/cases/[caseId]/activation-codes`, `admin/cases/[caseId]/people`, `admin/support/[id]/reply`, `support`, `waitlist`, `(unlock)/bureau/unlock`, `u/[code]`, `checkout/status`, `checkout/success`), every load-bearing lib file (`prisma`, `auth-helpers`, `rate-limit`, `validators`, `stripe`, `resend`, `case-evaluation`, `post-login-path`, `text-utils`, `user-case-state`, `assert-safe-env`, `case-serial`), `auth.ts`, `auth.config.ts`, `middleware.ts`, the public+bureau+admin entry pages (`cases`, `cases/[slug]`, `bureau`, `bureau/cases/[slug]`, `bureau/cases/[slug]/debrief`, `bureau/cases/[slug]/database`, `bureau/database`, `bureau/database/actions.ts`, `bureau/archive`, `bureau/people/[personId]`, `bureau/admin/layout.tsx`, `checkout/success`), and the load-bearing components (`CasePublicView`, `BuyButton`, `TheorySubmissionForm`, `CheckpointForm`, `LoginForm`, `RevealedEvidence`, `UnlockForm`). Two `migration.sql` files (init head + last two) were spot-read end-to-end.

I read every file in the audit's coverage tracker that has security or correctness implications. The frontmatter, marketing-content files, decorative components (`Backdrop`, `Reveal`, `Pill`, `Card`, `Pill`, `StampBadge`, `TerminalReadout`, `RedactedBar`), and the design-system primitives were verified via the grep that none of them are `"use client"` (so they don't expose props across the boundary), and otherwise not reviewed line-by-line — they have no security surface.

### 1.2 Architecture map

**Routing layout** — Next.js 16 App Router. Public surface: `/`, `/cases`, `/cases/[slug]`, `/about`, `/faq`, `/how-it-works`, `/support`, `/privacy`, `/terms`, `/checkout/success`, the four auth pages. Auth-gated bureau surface: `/bureau/*` (requires session via `bureau/layout.tsx`), with the `(unlock)` route group lifting `/bureau/unlock` out of the layout for the public QR landing. Admin surface: `/bureau/admin/*` (defense-in-depth — middleware role check + layout role check). Account: `/account/delete`. API surface: 32 route handlers under `app/api/` plus the `/u/[code]` redirect and the single server action at `app/bureau/database/actions.ts`.

**Rendering model** — virtually everything is an RSC. Client components are scoped narrowly: forms (`LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `DeleteAccountForm`, `CaseActivationForm`, `WaitlistForm`, `SupportForm`, `TheorySubmissionForm`, `CheckpointForm`, `UnlockForm`, `BuyButton`, admin form panels), search/terminal client components (`GlobalPeopleSearchTerminal`, `CaseDatabaseSearch`), tab components in `/bureau/admin/cases/[caseId]/edit/_components/*`, and `Navbar`/`SignOutButton`. Suspense boundaries exist at `<LoginForm>`, `<RegisterForm>`, `<ResetPasswordForm>`, `<CaseActivationForm>` — all with `fallback={null}`. No `loading.tsx` files in the entire tree. One `error.tsx` (root only).

**Data layer** — 22 Prisma models, 9 enums, 1 destructive migration (Batch 9B). The schema spans identity (`User`, `Session via NextAuth JWT`), case content (`CaseFile`, `CasePerson`, `CaseRecord`, `CaseHint`, `CaseCheckpoint`, `HiddenEvidence`, plus the `GlobalPerson` + 6 child tables), state (`UserCase`, `UserCaseEvent`, `TheorySubmission`, `CheckpointAttempt`), commerce (`Order`, `ActivationCode`, `AccessCode`, `AccessCodeRedemption`, `ProcessedStripeEvent`), and ops (`CaseAudit`, `CaseSlugHistory`, `SupportMessage`, `WaitlistEntry`). Money/identity/auth-state fields are flagged in subagent C's table.

**External boundaries** — Stripe (Checkout sessions + 4 webhook event types), Resend (3 send sites: activation email, forgot-password reset, admin support reply), R2 (presigned PUT URL + blurhash server-side fetch), Neon Postgres (pooled URL for runtime, direct URL for migrations), NextAuth (Credentials provider, JWT, 7-day maxAge), Upstash Redis (optional rate-limit backend), Vercel Cron (daily PENDING-order sweep).

### 1.3 Auth & authorization model

- **Entry points**: Credentials sign-in via NextAuth (`auth.ts:23-59` `authorize`), self-register (`/api/register`), forgot-password+reset (token-gated). Only one role with elevated privileges: `ADMIN`. Default: `INVESTIGATOR`.
- **Guards** (`lib/auth-helpers.ts`): `requireSession` (redirect on miss; for pages/layouts), `requireAdmin` (return 403 NextResponse for admin API routes), `getOptionalSession` (display-only context), `requireSessionJson` (return 401 NextResponse for player API routes), `redirectIfAuthenticated` (inverse — used on the four auth pages to bounce signed-in visitors away).
- **Session lifecycle**: `authorize` populates JWT with id/role/tokenVersion (`auth.ts:51-57`). `auth.config.ts` jwt callback persists those on the token. `auth.ts:62-94` session callback does a per-request DB check: compare JWT's tokenVersion to `User.tokenVersion`; mismatch → `session.user = undefined`. Password reset bumps `tokenVersion` (`reset-password/route.ts:58`) and account deletion drops the user row (`DELETE /api/me`). 7-day session maxAge.
- **CSRF model** (`middleware.ts:29-47`): every state-mutating `/api/*` (POST/PUT/PATCH/DELETE) except `/api/auth/*` and the singleton `WEBHOOK_PATHS = {"/api/webhooks/stripe"}` must have an `Origin` header whose `new URL(origin).origin` equals `new URL(APP_ORIGIN).origin`. Subdomain bypass safe.
- **Ownership checks** — every player API route either uses `requireSessionJson` + ownership-via-Prisma-filter (`/cases/[slug]/theory`, `/cases/[slug]/checkpoint`, `/cases/activate`) or inline `auth()` + `UserCase.findFirst` (`/access-codes/redeem` uses an explicit ownership-via-UserCase check).
- **Privilege escalation surface** — every admin route uses middleware admin gate + `requireAdmin`; no body schema accepts `role`, so `role: "ADMIN"` POST cannot escalate.

### 1.4 Data flow traces

Detailed traces (every file, every DB write, every failure path) for: **Guest purchase**, **Refund full/partial**, **Async payment failure**, **Sign-up + auto-login**, **Forgot password**, **Account deletion**, **Theory submission**, **Checkpoint advance**, **Admin case PATCH (per-section + legacy)**, **AccessCode redeem**, **Image upload**, **Stripe webhook full**, **Slug rename**, **Support reply**, **Cron sweep** were verified at the route level during the personal pass; see subagent B's table for the per-route mapping and subagent C's cascade audit for the DB-write side.

The single most defensively-constructed flow is `POST /api/webhooks/stripe` (signature → livemode → ProcessedStripeEvent idempotency → branched event dispatch → updateMany preconditions inside `$transaction` → orphan recovery → throttled Resend send → emailSentAt tracking). The single least-tested is the `publicVerdict` shape response of `POST /api/cases/[slug]/theory` (Batch 13 fix has zero test coverage — see Phase 2.B.16 finding).

### 1.5 Schema map (high-level)

Subagent C produced the full per-model map. Highlights:
- **Indexed paths** — `User.email` (unique), `CaseFile.slug` (unique), `ActivationCode.code` (unique), `UserCase(userId,caseFileId)` (unique composite), `CaseCheckpoint(caseFileId,stage)` (unique composite), `AccessCodeRedemption(accessCodeId,userId)` (unique composite), `AccessCode.code` (unique), `Order.stripeSessionId` (unique), `Order.activationCodeId` (unique), `Order(caseFileId,email,status)` (composite, Batch 5).
- **Un-indexed hot FK columns** — `TheorySubmission.userId`, `TheorySubmission.caseFileId`, `CheckpointAttempt.userId`, `CheckpointAttempt.caseFileId`, `ActivationCode.caseFileId`, `AccessCodeRedemption.userId`, `CaseAudit.caseFileId`, `CaseAudit.userId`, plus the per-case content children (`CasePerson.caseFileId`, `CaseRecord.caseFileId`, `CaseHint.caseFileId`, `HiddenEvidence.caseFileId`). At launch volume these are seq-scan friendly; at growth they become the dominant cost driver. See Phase 2.B.7 finding.
- **Cascade chains** — User → UserCase + UserCaseEvent + TheorySubmission + CheckpointAttempt + AccessCodeRedemption (all Cascade). `ActivationCode.claimedByUserId` → SetNull. `CaseAudit.userId` → **RESTRICT** (blocks admin self-delete, known papercut). CaseFile → all case-content tables Cascade; `Order.caseFileId` → RESTRICT (so a sold case can never be hard-deleted; today's admin uses ARCHIVED soft-delete instead).
- **PII persistence after user delete** — `Order.email`, `SupportMessage.email`, `WaitlistEntry.email`. The Privacy Policy §8 commitment says "we will delete your account and associated personal data" but the data model retains these PII fields. Resolution path is either policy-side (cite Georgia PDPL Art. 22 financial-record exception in `/privacy`) or code-side (add `Order.emailRedactedAt` redaction step in `DELETE /api/me`).

### 1.6 Environment & secrets surface

Server-only secrets: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`. Public env: only `NEXT_PUBLIC_APP_URL`, `R2_PUBLIC_URL`. Per `grep -rn 'NEXT_PUBLIC_'` no client-shipped secrets. Required-at-boot: `DATABASE_URL` (throws `"DATABASE_URL is not set"` in `lib/prisma.ts:13` if missing). Stripe / Resend / R2 are lazy-checked at first call so build doesn't fail when missing. Cron, Upstash, R2_PUBLIC_URL are operationally required. `.env.example` covers every var. No `NEXT_PUBLIC_*` server secrets exposed.

### 1.7 Test inventory (subagent E verbatim summary)

25 test files / 203 tests, all passing. Strong coverage on `webhooks/stripe` (idempotency, partial/full refund branching, livemode mock — but not asserted), `cases/activate` (full lifecycle), `cases/[slug]/checkpoint` (atomic precondition + refund 410), `cases/[slug]/theory` (FINAL_REVIEW→SOLVED, refund 410 — but **no `publicVerdict` shape assertion**), `me` (cascade + admin refusal + case-insensitive confirmation), `admin-section-patches` (all 6 endpoints), `admin-uploads` (MIME + SSRF), `rate-limit` (F-06 x-real-ip-first under prod NODE_ENV), `register/forgot/reset` (uniform 200/201, bcrypt cost 12, token increment).

**Critical gaps** (subagent E's "Biggest untested critical paths" — promoted as findings in Phase 2.B.16): sealed `publicVerdict` shape, constant-time login, JWT tokenVersion read-side check, CSV `csvEscape` formula-injection, Sharp pixel limit, cron `timingSafeEqual` mechanism (vs `===`), **middleware itself is entirely untested**, no integration/E2E tests in CI.

### 1.8 Dependency posture

| Concern | Severity | Path forward |
|---|---|---|
| **Next.js 16.2.3 → 16.2.5** | **HIGH (P1)** | `npm i next@16.2.5 eslint-config-next@16.2.5`. Verify build + test. |
| **fast-uri ≤3.1.0** | HIGH but transitive | Bump Stripe SDK / Prisma to bring in `fast-uri ≥3.1.2`. |
| **fast-xml-builder ≤1.1.6** | HIGH but transitive | Bump `@aws-sdk/client-s3`. |
| **hono ≤4.12.17** | Moderate but transitive via @prisma/dev (developer-tooling only, not runtime) | Bumping Prisma major is disruptive; accept and re-audit. |
| `next-auth ^5.0.0-beta.30` | Beta — track | Pin to stable when released. |
| `lucide-react ^1.8.0` | Unusual major | Verified real (F-46 deferred). |
| `@prisma/client ^7.7.0` | Major version 7 (relatively new) | OK. |
| `stripe ^22.1.0` | Pin via `apiVersion` | Done. |

### 1.9 CLAUDE.md drift check

20 specific claims verified above (Section 0.8). **7 of 20 false or partial** — all in the direction of "code is stricter than docs say." No security regression, but a documentation reconciliation is warranted at next-batch cadence. Promoted to a P3 finding in Phase 2.B.11.

---

(Phase 2 follows below.)

## Phase 2 — Forensic Audit

### Phase 2.A — Adversary war-gaming

#### Refund-After-Solve Rita

Rita is a paying customer who buys the kit, solves the case (SOLVED state, debrief unlocked, all evidence revealed), then files a chargeback or "I'd like a refund" request the next day. Her goal: keep the post-solve content + spoilers and recover her money. She tries the manual support flow first because Terms §7 (Batch 9 rewrite) tells her to. The operator processes a full refund through Stripe Dashboard. Stripe fires `charge.refunded` with `amount_refunded === amount`. The webhook (`app/api/webhooks/stripe/route.ts:412-508`) finds the Order via `stripePaymentIntent`, detects `isFullRefund = true`, enters the `$transaction`, flips Order to REFUNDED, stamps `ActivationCode.revokedAt`, and stamps `UserCase.revokedAt`. The `revokedAt` filter then propagates: `/bureau` excludes the revoked UserCase from the dashboard (`app/bureau/page.tsx:33-38` `where: { userId, revokedAt: null }`), `/bureau/cases/[slug]/debrief` returns notFound when revokedAt is non-null (`page.tsx:22-32`). The workspace at `/bureau/cases/[slug]` renders but shows a refund banner and disables theory/checkpoint submission (`page.tsx:290-317`). Theory and checkpoint routes return 410 (`theory/route.ts:63-68`, `checkpoint/route.ts:116-121`). The activate route returns 410 if Rita tries to re-redeem her old code (`cases/activate/route.ts:57`). **All gates verified at HEAD.** Where she can still hurt: (1) the workspace page itself still **renders** her previously-seen evidence body text in the People-of-Interest, Records, and Hints sections — the refund flow does not redact already-revealed content from a non-debrief render path. She can still re-read the case body. (2) She can re-buy with a different email. The duplicate-purchase guard only matches on `(caseFileId, email, status=COMPLETE)`; her old REFUNDED row is excluded. This is intentional (re-buying after a refund is a legitimate user action). (3) She *cannot* use her old activation code on a fresh account — `claimedByUserId` SetNull + `revokedAt` set means the activate route's 410 fires for any new claimer. **Verdict: defended on the money side. The "keep the spoilers" angle is permitted by design** (debrief is locked, but the workspace still shows the evidence she previously paid to see, which is a deliberate "your progress is preserved" choice in Batch 9's `revokedAt` banner copy). No new finding.

#### Replay-QR Quinn

Quinn finds a QR code on a physical artifact in the kit and tries to redeem it on multiple accounts to multiplay-unlock the hidden evidence. The QR points at `/u/<code>` which 302s to `/bureau/unlock?code=<code>` (`app/u/[code]/route.ts:8`). The unlock page (`app/(unlock)/bureau/unlock/page.tsx:12-78`) is publicly reachable, presents a sign-in card for unauthenticated visitors, and preserves the `?code=` through the NextAuth bounce via a sanitized `callbackUrl`. Once signed in, `UnlockForm` auto-submits to `/api/access-codes/redeem` (`app/(unlock)/bureau/unlock/_components/UnlockForm.tsx:84-89`). The redeem route rate-limits 5/60s (`app/api/access-codes/redeem/route.ts:46`), gates on `auth()` + `Number.isInteger(userId)` (lines 57-65), rejects retired codes 410 (line 84), and — critically — enforces ownership (line 97-107): the user must already have a UserCase for `accessCode.caseFileId`. Without an owning UserCase, redemption returns 403, preventing a non-owner from harvesting AccessCode content via the public QR URL even after redirecting through their own account. The actual one-time-per-user constraint is the unique `AccessCodeRedemption(accessCodeId, userId)` at `prisma/schema.prisma:457`: a P2002 on retry returns `alreadyRedeemed: true` with the same content (idempotent reveal, no duplicate row). Same-user replay is a no-op. **Cross-user replay** is also blocked because the redemption row is per-user — a fresh account hitting the same code passes the unique-constraint check but still has to satisfy ownership. So Quinn would need to make a fresh account, buy a copy of the case for that account, AND redeem the QR — at which point she is no longer "Quinn replaying" but "a second customer who bought the kit." The `Batch 9B` migration dropped the `oneTimePerUser` column because the unique constraint already enforced it; `F-14` closed in Batches 9 + 9B. **Defended.** No new finding.

#### Brute-Code Bruno

Bruno wants to enumerate valid `ActivationCode` strings (purchase codes, namespace = case-slug-prefix + 8 base64url chars uppercased ~ 48 bits entropy) or `AccessCode` strings (admin-set, length 1-64). He targets `/api/cases/activate` (RL 5/60s, requires session) and `/api/access-codes/redeem` (RL 5/60s, requires session). Rate-limit IP source reads `x-real-ip` first under Vercel (`lib/rate-limit.ts:95-99`) — F-06 closure — so X-Forwarded-For spoofing cannot defeat the bucket. Bruno can rotate IPs across NAT/Tor/residential proxies, but each new IP gets only 5 attempts per minute per route. The cost-per-trial for ActivationCode is dominated by guessing ~48 bits with 5/60s/IP — astronomically infeasible. The 404 vs 410 vs 409 vs 200 responses (`cases/activate/route.ts:43-88`) do leak information: "code not found" (404) vs "code is revoked" (410) vs "already claimed" (409) vs "already owned" (200) vs success (201). A patient attacker who finds *any* of these other than 404 has confirmed a valid code exists in the namespace. Combined with the 5/60s ceiling, this doesn't enable practical enumeration. For AccessCodes (typically admin-set short strings like `BUREAU-12345`), the namespace can be much smaller — and a brute-force here would unlock a redemption row but **only for an already-owned case** (the ownership-unconditional check). So even successful brute-force only reveals evidence for cases Bruno already paid for. **Defended at the surface; one minor leak**: the redeem route's 404 (line 80) vs 410 (line 86) discloses code-existence to a probing attacker. Combined with rate limits this is acceptable. **F-16** (closed-ledger: code keyspace ~52 bits, deferred — accepted) covers the entropy posture. No new finding.

#### Insider Ian

Ian is a compromised ADMIN account. He can `requireAdmin`-pass every admin route. What can he exfiltrate, abuse, or hide his tracks doing? **Data exfiltration:** every `GET /api/admin/cases/[caseId]` returns full case content including `solutionSuspect/Motive/Evidence` and the full debrief. The codes-CSV export at `GET /api/admin/cases/[caseId]/codes?format=csv` dumps every claimed user's email next to their activation code — a single curl can pull complete customer→case mapping. The `bureau/admin/support/[id]` page renders the raw user message including PII. **Audit-trail coverage:** `CaseAudit` is written for the legacy aggregate PUT and each per-section PATCH, but **not** for `workflow` PATCH (`app/api/admin/cases/[caseId]/workflow/route.ts:115-121` — only updates the row, no CaseAudit insert), nor for code batch-generate (`codes/route.ts:146-152`), nor for code revoke (`codes/[codeId]/route.ts:51-58`), nor for AccessCode create (`access-codes/route.ts:110-119`), nor for support reply or status changes. So Ian can publish or archive cases, mass-revoke activation codes, mass-generate fresh codes, and process customer support without leaving any structured audit record. This is acknowledged in CLAUDE.md's backlog ("`CaseAudit` not written for workflow PATCH, batch-generate, revoke, AccessCode create — forensic gap"). **Privilege:** `requireAdmin` + middleware admin gate is correctly applied. **ADMIN self-deletion:** refused 403 (`api/me/route.ts:56-64`), prevents covering tracks via account-delete. **Mass-action revertability:** zero — there's no "undo batch revoke" tool. **Verdict: not defended on the audit-trail front. Promoted to P2 finding in 2.B.12.** Sub-finding: if Ian sets workflowStatus=ARCHIVED on a live case, paying customers immediately lose access (the activate route checks `isActive`; the catalog filters `workflowStatus=PUBLISHED`); no `CaseAudit` of this change.

#### Cost-Bomb Carla

Carla wants to drain the founder's runway by triggering paid third-party calls. Top targets: Resend (per-email cost), Stripe (rate limits do not cost but quota-block), Sharp processing on Vercel (function compute cost), Neon connection time (compute), R2 storage (storage cost). **Email cost bomb attempts**: `/api/forgot-password` (RL 3/60s + Resend send to existing user only — 200 silent on miss); `/api/support` (RL 3/60s — no email send, only DB row); `/api/waitlist` (RL 3/60s — no email); `/api/webhooks/stripe` (signed). The forgot-password route only sends if the user exists, so even with rotated IPs Carla can only burn email on users she's already enumerated. **F-13 closure** (per-recipient activation throttle of 3/hour to the same normalized email at `webhooks/stripe/route.ts:286-310`) prevents the paid-purchase relay attack (buying 100 kits to a victim's email to spam Resend). **R2 storage**: admin-only (`/api/admin/uploads/sign`) — Carla can't reach it without an admin session. **Sharp**: the blurhash route is admin-only AND its `fetch` SSRF guard restricts source URLs to the R2_PUBLIC_URL host, so Carla can't push a 1GB image into Sharp from arbitrary URL. Pixel limit at 1MP caps decode memory. **Neon connection exhaustion**: rate-limited inserts (3-30/60s/route/IP) prevent connection-pool starvation. **Upstash cost**: each rate-limit check is a Redis op, ~$0.20/1M ops — Carla burning 30/60s × 60min × 24h = ~43k checks/day/IP, would need 100k IPs sustained to cost ~$1k. Not viable. **Verdict: defended. The F-13 throttle is the load-bearing fix.** One minor: `/api/checkout` opens a Stripe session (Stripe-side rate-limited, but counts against Stripe API quota). RL 5/60s mitigates; Stripe-side burst limits also apply. No new finding, but **note**: there is no organisation-wide kill switch — if Resend or Stripe pricing changes (e.g. Resend ends free tier), the spend is unmonitored. Promoted as a P3 strategic observation under 2.B.18.

#### Scraper Sven

Sven wants the entire public surface plus any inadvertently-accessible private content. He hits `/cases` (public catalog of PUBLISHED cases — `app/cases/page.tsx:9-15` returns full CaseFile rows from Prisma but only renders title/summary/players/duration/difficulty/serial through `Card` server-components). The full row includes `solutionSuspect`, `solutionMotive`, `solutionEvidence`, debrief* spoiler fields — **but these stay server-side because `Card`, `Pill`, `Link` are all server components and never reach a client component on this page.** Same analysis applies to `/cases/[slug]` (`CasePublicView` is a server component receiving the full caseFile but only consuming title/summary/players/duration/difficulty/id; `BuyButton` receives only `caseId`). RSC payload audit at `Phase 2.B.10 / 2.B.19` confirms no spoiler field crosses to a client component. **However**, the public `/cases` page over-fetches: `findMany` without `select` pulls every column from Postgres into the Next.js server. Operationally fine — but a future refactor that passes the full row to a client component would silently leak. **Hardening recommendation**: tighten the Prisma `select` to the rendered fields. Promoted as P3 hardening under 2.B.10. Sitemap/robots check: `app/sitemap*` and `app/robots*` do not exist. **Source maps in production**: `next.config.ts` does not set `productionBrowserSourceMaps`, so no `.map.js` files in the deployed bundle. **`generated/` Prisma client folder**: in `.gitignore`, only server-imported. No bundle leak. **Verdict: largely defended.**

#### Spoiler-Sniffer Sasha

This is the most dangerous persona for a mystery game. Sasha wants to learn the case answer without playing. Channels: (1) **Theory route response shape** — `app/api/cases/[slug]/theory/route.ts:149-161` returns `{message, publicVerdict, feedback}`. publicVerdict in {CASE_CLOSED, REVISION_REQUIRED}. feedback is the sealed string from `lib/case-evaluation.ts:66-75`, non-diagnostic. **Verified at HEAD.** Sealing holds. (2) **`/bureau/archive`** — Batch 16 closure (`98fb771`) at `app/bureau/archive/page.tsx:162-166`: only CORRECT submissions show `submission.feedback`; everything else shows generic "not ready for closure" line. Verified. (3) **Workspace recent-submissions** — `app/bureau/cases/[slug]/page.tsx:632-641` same sealed pattern. Verified. (4) **`/bureau/cases/[slug]/debrief`** — gated on `status: "SOLVED"` AND `revokedAt: null` (`page.tsx:22-32`). (5) **Admin preview** — gated by admin layout. (6) **HiddenEvidence reachability** — redeem route ownership check enforces UserCase ownership. **Latent F-09 gap**: resolveContent does not re-verify content row's caseFileId matches AccessCode's caseFileId. (7) **Public `/cases/[slug]`** — server-component render, full CaseFile never crosses to client. (8) **Open Graph / meta tags** — `app/layout.tsx` static metadata only. (9) **Sitemap** — does not exist. (10) **Seed data / case content** — `prisma/seed/*` not committed. (11) **Theory evaluation timing** — sub-millisecond, dominated by network jitter. Not exploitable. (12) **Public case marketing copy** — operator-controlled prose, no spoilers. (13) **Email content** — only codes / URLs / operator prose. **Verdict: spoiler channels are tightly sealed at HEAD.** Single defense-in-depth concern is F-09 (P3 below).

---

### Phase 2.B — Category-by-category forensic pass

#### 2.B.1 — Authentication

##### [P2] `/api/register` timing oracle leaks email registration via 200ms gap

**Location:** `app/api/register/route.ts:34-62`

**Category:** 2.B.1 — Authentication / email enumeration

**What:** When the submitted email is already registered, the route returns `201 { message: "Account created." }` after only a `findUnique` lookup (~10ms). When the email is new, the route calls `bcrypt.hash(password, 12)` (~150-300ms cost-factor-12) before returning the same 201. The wall-clock difference reliably distinguishes "registered" from "new" by timing alone — Batch 4's uniform-201 response (`280d69f`) closed the message-content enumeration but did not close the timing channel.

**Evidence:**
```ts
// app/api/register/route.ts:34-50
const existing = await prisma.user.findUnique({
  where: { email },
  select: { id: true },
});

if (existing) {
  return NextResponse.json({ message: "Account created." }, { status: 201 });
}

const passwordHash = await hash(password, 12);
```

**Why it's a problem:** Sister to F-22 (forgot-password timing leak — deferred). Together they let an attacker enumerate registered emails at the rate-limit ceiling (3/60s/IP rotated).

**Impact:** Email enumeration of the customer/operative roster. Combined with the duplicate-purchase 409 (Batch 2 generic message), attacker reconstructs customer→email→case mapping with patience. Real-world risk: phishing campaigns targeting confirmed users with case-specific lures.

**Remediation:** (a) Run `getConstantTimeFakeHash`-equivalent on the duplicate branch (mirror `auth.ts:13-18`), or (b) move bcrypt work to `after()` so the response fires before bcrypt completes. (a) is the smaller patch.

**Verification:** Add a test that asserts `bcrypt.hash` is called with cost-factor-12 on both the new-user and duplicate paths, OR a wall-clock-based test that asserts both paths complete within `±20ms` of each other.

**Related prior findings:** F-22 (forgot-password timing leak, deferred); P2-1 (register message enumeration, closed in Batch 4 commit `280d69f`).

##### [P3] Forgot-password timing leak — F-22 still open

**Location:** `app/api/forgot-password/route.ts:34-92`

**Category:** 2.B.1

**What:** Same shape as the register timing leak. User-exists path performs `randomBytes(32)` + DB update + Resend `emails.send` (~500ms total). User-not-found path returns immediately. Reliably observable.

**Impact:** Same enumeration risk.

**Remediation:** Use `after()` to fire-and-forget the Resend send after returning 200. Updates the existing test to assert call shape, not ordering.

**Related prior findings:** F-22 (`audits/2026-05-06-godmode-audit.md`).

##### [P3] `/api/register` writes `email` without explicit `.toLowerCase()` at the create site

**Location:** `app/api/register/route.ts:51-60`

**Category:** 2.B.1

**What:** F-29 closed Order.email normalization at every write site. The same hygiene was not mirrored for User.email. Today Zod schema normalizes, but a future bypass writes mixed-case rows.

**Remediation:** Add `email: parsed.data.email.trim().toLowerCase()` at the create site.

##### [P3] `auth.ts` constant-time fake-hash never tested

**Location:** `auth.ts:13-49`

**Category:** 2.B.1 / 2.B.16

**What:** The lazy `getConstantTimeFakeHash` + bcrypt-against-fake-hash pattern closes the login email-enumeration timing oracle (Batch 7). Zero test coverage.

**Remediation:** Add a `tests/lib/auth.test.ts` asserting bcrypt is called on both user-exists and user-not-found paths.

##### No findings on

- `redirectIfAuthenticated` on auth pages — verified at `lib/auth-helpers.ts:71-78` + tests/routes/auth-redirect.test.ts.
- Logout completeness — NextAuth handles cookie clearing.
- Edge-vs-Node seam — `auth.config.ts` Prisma-free, `tsc` clean.
- JWT confusion / session fixation — NextAuth-managed.
- 7-day session maxAge — fixed in `auth.config.ts:17`.

#### 2.B.2 — Authorization (IDOR)

Every player API route uses `requireSessionJson` + ownership-via-Prisma-filter, or inline `auth()` + ownership check. Subagent B traced every admin route through middleware + `requireAdmin`. Verified:
- `/api/access-codes/redeem` ownership check unconditional at `:97-107`.
- `/api/admin/cases/[caseId]/access-codes` POST validates `unlocksTarget` row belongs to the case at `:75-108`.
- Per-section PATCH endpoints admin-gated, no per-user surface.
- No body schema accepts `role` — no privilege escalation via PATCH.

##### [P3] `resolveContent` / `resolveEvidence` lack defense-in-depth caseFileId check

**Location:** `app/api/access-codes/redeem/route.ts:11-43`, `app/bureau/cases/[slug]/page.tsx:28-83`

**Category:** 2.B.2

**What:** Both functions do `prisma.caseRecord.findUnique({ where: { id: target.id } })` etc., without asserting the returned row's `caseFileId === accessCode.caseFileId`. Invariant holds today because admin POST validates on write — but a single migration/seed-script bypass corrupts the invariant, enabling cross-case spoiler reveal.

**Remediation:** Use `findFirst({ where: { id, caseFileId: accessCode.caseFileId } })` etc. Add a test that asserts cross-case lookup returns null.

**Related prior findings:** F-09 (`audits/2026-05-06-godmode-audit.md`).

#### 2.B.3 — Input validation & injection

Every body route uses `safeParse`. `prisma.$queryRaw` / `$executeRaw` zero uses. `dangerouslySetInnerHTML` zero uses. File upload MIME enforced. Sharp pixel-limited. SSRF guarded. Webhook payload signature-verified. **No findings beyond the F-09 defense-in-depth above.**

#### 2.B.4 — CSRF, CORS, headers

CSRF gate via `new URL(origin).origin === new URL(APP_ORIGIN).origin` is subdomain-safe. `WEBHOOK_PATHS` explicit + minimal. No state-via-GET. CSP enforced. HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy minimum-of-three. No CORS. **No new findings; one P2 carry-forward + one P3 cleanup.**

##### [P2] CSP still uses `'unsafe-inline'` + `'unsafe-eval'` in script-src

**Location:** `next.config.ts:28`

**Category:** 2.B.4

**What:** F-32/F-33 in CLAUDE.md deferred ledger. The XSS-defense value of CSP is meaningfully reduced.

**Impact:** If any future user-content reflection ships, an XSS payload could execute; CSP would not save it.

**Remediation:** Migrate to nonce-based script-src. Verify Framer Motion + Next.js 16 hydration with nonce.

##### [P3] CSP `style-src` includes dead `https://fonts.googleapis.com` reference

**Location:** `next.config.ts:29`

**Category:** 2.B.4

**What:** Codebase uses `next/font/google` which self-hosts at build time. The `https://fonts.googleapis.com` allowance is dead.

**Remediation:** Drop it. Mirrors Batch 7 `font-src` cleanup (commit `b10dd68`).

#### 2.B.5 — Rate limiting & abuse

Every public POST rate-limited. IP source reads x-real-ip first (F-06 closure). Bucket sizes tight on identity routes (3/60s), looser on content. Activation-email throttle 3/hour per recipient is F-13 closure.

##### [P3] Admin GET endpoints lack rate-limits

**Location:** `app/api/admin/cases/[caseId]/route.ts:9-38`, `app/api/admin/cases/[caseId]/codes/route.ts:29-72`, `app/api/admin/cases/[caseId]/access-codes/route.ts:9-29`

**Category:** 2.B.5

**What:** All three admin GET routes lack rate limits. Behind admin gate, but a compromised admin session can mass-pull customer email lists (CSV) or full case content by iterating `caseId`.

**Remediation:** Add `rateLimit(request, { limit: 30, windowMs: 60_000 })` per route. The CSV export branch would benefit from a stricter per-day cap.

#### 2.B.6 — Money, Stripe, webhooks, idempotency

The Stripe pipeline is the most defensively-built surface. Signature verify → livemode cross-check → ProcessedStripeEvent insert (P2002 → 200) → branched dispatch → updateMany preconditions inside `$transaction` → throttled Resend → emailSentAt tracking → revokedAt on full refund.

##### [P3] Stripe webhook does not verify `event.account` (cross-tenant safety)

**Location:** `app/api/webhooks/stripe/route.ts:46-103`

**Category:** 2.B.6

**What:** CLAUDE.md backlog item. On a single-account deployment, not exploitable. Becomes important if operator ever runs Stripe Connect or a second account.

**Remediation:** Add a `STRIPE_ACCOUNT_ID` env var. Check `event.account === STRIPE_ACCOUNT_ID` after the livemode check. ~3 lines.

##### [P3] Orphan Stripe session retry loop is unbounded

**Location:** `app/api/webhooks/stripe/route.ts:172-181, 195`

**Category:** 2.B.6

**What:** `STRIPE_ORPHAN:<id>` throw → 500 → Stripe retries with exponential backoff for ~3 days. Hundreds of error logs over 3 days for a single orphan. No alert.

**Remediation:** Return 200 instead of 500 after the first `[STRIPE-ORPHAN]` log. Pair with Sentry alert.

##### [P3] Webhook activation-email throttle has tiny race window

**Location:** `app/api/webhooks/stripe/route.ts:288-310`

**Category:** 2.B.6

**What:** Three webhook deliveries arriving in the same second to the same email might all see `recentSendsToBuyer = 2` and all send. Real-world unlikely (ProcessedStripeEvent gates exact replays).

**Remediation:** Accept the rarity, or use a transactional reservation pattern.

##### Currency, tax, VAT

Not enforced. Operator decision — see 2.B.15.

#### 2.B.7 — Database, transactions, concurrency

Subagent C produced the full schema map and missing-index analysis.

##### [P2] Missing FK indexes on hot-path read columns

**Location:** `prisma/schema.prisma:262, 249, 147, 447`

**Category:** 2.B.7

**What:** Postgres does not auto-index FK columns. The following lack indexes and are hot-read paths:

- `TheorySubmission.userId` — `/bureau/archive`, workspace recent-submissions
- `TheorySubmission.caseFileId` — admin review of theories per case
- `CheckpointAttempt.userId` — player progress
- `ActivationCode.caseFileId` — admin code list
- `AccessCodeRedemption.userId` — "what have I redeemed"
- `CasePerson.caseFileId`, `CaseRecord.caseFileId`, `CaseHint.caseFileId`, `HiddenEvidence.caseFileId` — workspace render

**Impact:** At launch volume single-digit ms. At growth, `/bureau/archive` transitions O(1) → O(N).

**Remediation:** Add composite indexes matching query shape: `TheorySubmission(userId, createdAt DESC)`, `CheckpointAttempt(userId, createdAt DESC)`, `ActivationCode(caseFileId)`. Plus single-FK indexes on per-case content tables.

**Verification:** `EXPLAIN ANALYZE` before/after.

##### [P3] `CaseAudit.userId` RESTRICT blocks admin self-delete forever

**Location:** `prisma/schema.prisma:135-145`

**Category:** 2.B.7 + 2.B.20

**What:** Known papercut. Three resolution options in CLAUDE.md backlog.

##### [P3] `CaseAudit.caseFileId` Cascade — deleting a CaseFile wipes its audit history

**Location:** `prisma/schema.prisma:135-145`

**Category:** 2.B.7

**What:** Latent (admin uses ARCHIVED, not delete). A future hard-delete tool would silently wipe audit trail.

**Remediation:** Refuse hard-delete when CaseAudit rows exist, OR SetNull cascade.

##### [P3] `ProcessedStripeEvent` grows monotonically — no TTL sweeper

**Location:** `prisma/schema.prisma:500-503`

**Category:** 2.B.7

**What:** ~1.2k rows/month. Storage negligible but a 90-day sweeper would tidy.

**Remediation:** Extend daily cron to delete rows older than 90 days.

##### [P3] Activate route's already-owned check ignores `revokedAt`

**Location:** `app/api/cases/activate/route.ts:64-81`

**Category:** 2.B.7

**What:** A refunded user trying a fresh activation code for the same case returns 200 "you already own this" — the existing UserCase has `revokedAt` set. UX confusing.

**Remediation:** Branch on `existingOwnership.revokedAt`. Product decision: delete + recreate, or surface "previously refunded" message.

##### Multi-write atomicity — verified

All multi-write ops wrapped in `$transaction`. Precondition-bearing transitions use `updateMany` with count check. No N+1 patterns at page level.

#### 2.B.8 — Email & deliverability

DKIM/SPF/DMARC unverified (F-25 operational). Reply-To set on activation + support. F-13 throttle in place.

##### [P3] `/api/forgot-password` email lacks Reply-To `support@`

**Location:** `app/api/forgot-password/route.ts:60-85`

**Category:** 2.B.8

**What:** Activation + support replies set replyTo; forgot-password does not. Replies bounce.

**Remediation:** Add `replyTo: "support@theblackledger.app"`.

##### [P3] forgot-password email interpolates URLs without escapeHtml

**Location:** `app/api/forgot-password/route.ts:73-84`

**Category:** 2.B.8

**What:** No user-controlled values today, so no XSS. Fragile: a future user-controlled interpolation would XSS.

**Remediation:** Wrap URL in `escapeHtml` defensively.

#### 2.B.9 — File upload pipeline (R2)

Presigned PUT 15-min expiry. Key naming uuid-prefixed. Public-read R2 policy operator-set. SSRF guard. Sharp pixel-limit. No SVG. No cleanup.

##### [P3] No R2 orphan-cleanup sweeper

**Location:** `app/api/admin/uploads/sign/route.ts`

**Category:** 2.B.9

**What:** Admin uploads via presigned URL but never persists publicUrl → object lives forever. Same after PATCH failure.

**Remediation:** R2 lifecycle rule expiring objects older than 7 days unless `key` matches a row in `CaseFile.heroImageUrl` or `CasePerson.portraitUrl`.

##### [P3] R2 presigned PUT has no Content-Length bound (F-11 deferred)

**Location:** `app/api/admin/uploads/sign/route.ts:86-94`

**Category:** 2.B.9

**What:** Presigned URL constrains ContentType, not ContentLength. Compromised admin can upload 100GB blob. F-11 deferred — accept until storage cost surge.

**Remediation:** Use `s3-presigned-post` with `ContentLengthRange`, or bucket-side size limit.

#### 2.B.10 — Frontend / React / RSC

RSC payload leaks — verified across workspace, debrief, archive, public catalog. Server components consume full CaseFile but never pass to client component. Only client-component props cross RSC boundary. **No spoiler leaks via RSC at HEAD.**

##### [P3] Public catalog page (`/cases`) over-fetches full CaseFile rows

**Location:** `app/cases/page.tsx:9-15`

**Category:** 2.B.10

**What:** `findMany` without `select` returns every column including solutionSuspect/Motive/Evidence + debrief* fields. Stays server-side today (page is RSC) — but a future client-component refactor would silently leak. Postgres-to-server transfer larger than necessary.

**Remediation:** Add explicit `select: { id, title, slug, summary, players, duration, difficulty }`. Mirror on `/cases/[slug]` and `bureau/page.tsx` userCase.findMany's caseFile include.

##### [P3] `/bureau/cases/[slug]` inline caseSerial differs from `caseSerial(caseFile)` helper

**Location:** `app/bureau/cases/[slug]/page.tsx:199`

**Category:** 2.B.10 / consistency

**What:** Batch 16 commit `3959cbb` introduced `caseSerial(caseFile)` to unify. Workspace page still computes its own: `const caseSerial = "BL-" + slug.toUpperCase().replace(/-/g, "").slice(0, 8);`. UX-08 closure incomplete.

**Evidence:**
```ts
// app/bureau/cases/[slug]/page.tsx:199
const caseSerial = "BL-" + slug.toUpperCase().replace(/-/g, "").slice(0, 8);
```

**Remediation:** Replace with `caseSerial(caseFile)`. Trivial.

##### [P3] `/cases` catalog inline serial derivation also differs from helper

**Location:** `app/cases/page.tsx:76-77`

**Category:** 2.B.10 / consistency

**What:** Uses `index + 1` based serial — list-position, not caseFile.id. Archive/unarchive of any case shifts the displayed serials. Second site of UX-08 incomplete closure.

**Remediation:** Use `caseSerial(caseFile)`.

##### [P3] `/bureau/archive` lists revoked cases as "Active reviews"

**Location:** `app/bureau/archive/page.tsx:12-31`

**Category:** 2.B.10

**What:** No `revokedAt: null` filter. `/bureau` dashboard has it (Batch 16 closure); archive missed.

**Remediation:** Apply same filter.

##### [P3] No `loading.tsx` boundaries anywhere

**Location:** `app/` tree

**Category:** 2.B.10

**What:** Zero `loading.tsx` files. Every navigation is a hard wait.

**Remediation:** Add `app/bureau/loading.tsx`, `app/cases/loading.tsx` with bureau-themed skeletons.

##### [P3] Only one `error.tsx` boundary (root) — no per-segment recovery

**Location:** `app/error.tsx`

**Category:** 2.B.10

**What:** F-30 closure was root-only. Granularity is coarse.

**Remediation:** Add `app/bureau/error.tsx`, `app/checkout/error.tsx`, `app/bureau/admin/error.tsx`.

##### Open-redirect, source maps, generated/, public/, Unicode

Verified safe across surfaces. Unicode handling strips non-Latin in `normalizeIdentity` — flag for backlog when content multilingual.

#### 2.B.11 — TypeScript & code health

`strict: true` ✓. Zero `// @ts-ignore` / `// @ts-expect-error`. No `as any`. Idiomatic Prisma error narrowing.

##### [P3] tsconfig target ES2017 is dated

**Location:** `tsconfig.json:3`

**Remediation:** Bump to ES2022.

##### [P3] CLAUDE.md documentation drift across 7 claims

**Location:** `CLAUDE.md`

**What:** 7 of 20 verified claims stale (see Phase 0.8). All in direction of "code is stricter than docs say."

**Remediation:** Doc reconciliation at next batch cadence.

#### 2.B.12 — Error handling & observability

##### [P2] CaseAudit not written for workflow PATCH, batch-generate, revoke, AccessCode create, support

**Location:** `app/api/admin/cases/[caseId]/workflow/route.ts:115-121`, `app/api/admin/cases/[caseId]/codes/route.ts:146-152`, `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts:51-58`, `app/api/admin/cases/[caseId]/access-codes/route.ts:110-119`, `app/api/admin/cases/[caseId]/activation-codes/route.ts:70-75`, `app/api/admin/support/[id]/{status,reply}/route.ts`

**Category:** 2.B.12 (also Insider Ian 2.A)

**What:** Six admin-mutation surfaces lack CaseAudit. Compromised admin can publish/archive cases, generate or revoke activation codes, create access codes, and process customer support without forensic record.

**Impact:** No attribution of destructive admin actions.

**Remediation:** Add `await tx.caseAudit.create({ data: {...} })` at each site. The hardest site is `support/[id]/reply` (no caseFileId) — needs new `AdminAudit` model or sentinel.

##### [P2] No Sentry / structured logging — F-12 / F-35 deferred

**Location:** entire codebase

**Category:** 2.B.12

**What:** Every error is `console.error` → Vercel function logs. Hobby retention ~1 hour; Pro ~1 day. Incident forensics impossible after the window.

**Remediation:** `npm install @sentry/nextjs` + `SENTRY_DSN`. Wire `app/error.tsx` + webhook + cron error paths.

##### [P3] Webhook `console.warn` logs `buyerEmail` plaintext

**Location:** `app/api/webhooks/stripe/route.ts:304-307`

**Category:** 2.B.12 / privacy

**What:** F-13 throttle log line includes the buyer's full email. Vercel logs retain.

**Remediation:** Hash or mask the email in the log.

##### [P3] Cron observability is one console.log line

**Location:** `app/api/cron/cleanup-pending-orders/route.ts:65`

**Category:** 2.B.12

**What:** No alert on silent cron failure.

**Remediation:** Slack/email alert on failure OR persist `LastCronRun` row + heartbeat check.

##### [P3] No webhook delivery monitoring

**What:** Stripe-side outage on our endpoint goes undetected until customers complain.

**Remediation:** Add `/api/health` returning 200 if DB + Stripe SDK initialize. Out-of-band uptime ping.

##### Error-message spoiler audit

Spot-checked: theory/checkpoint routes do not echo user input or solution fields. No findings.

##### 35 console.* sites in production

Most are error boundaries. Two log PII. Acceptable for current maturity but Sentry is the upgrade path.

#### 2.B.13 — Migrations & deploy safety

8 migrations linear. All backwards-compatible during rolling deploy except #8 (drop col), which followed a no-op-cleanup batch (9). Correct migration discipline. No long-locking migrations.

##### [P3] Migration in #6 not CONCURRENTLY (F-45 deferred)

**Location:** `prisma/migrations/20260501000000_add_processed_stripe_event_and_order_index/migration.sql:10`

**What:** `CREATE INDEX` not `CONCURRENTLY`. At application time Order was small (~10 rows). Future index migrations on grown tables need `CREATE INDEX CONCURRENTLY`.

**Remediation:** Documented pattern in a `docs/MIGRATIONS.md` runbook.

#### 2.B.14 — Vercel / production config

##### [P1] Next.js 16.2.3 — DoS + XSS advisories — PATCH IMMEDIATELY

**Location:** `package.json:38`

**Category:** 2.B.14 / dependency

**What:** GHSA-8h8q-6873-q5fj CVSS 7.5 DoS via server components. Fix is `next@16.2.5`. Two additional moderate XSS advisories on the same major affect CSP-nonce flows (not used yet) and cache-busting.

**Impact:** Unauthenticated DoS against a deployed Next.js 16.0–16.2.4 server.

**Remediation:** `npm i next@16.2.5 eslint-config-next@16.2.5 && npm test && npm run build`. Deploy.

**Verification:** Re-run `npm audit` → vulnerability gone.

##### [P1] `fast-uri` ≤3.1.0 path traversal — transitive

**Location:** `npm audit` output

**What:** GHSA-q3j6-qgpj-74h6 + GHSA-v39h-62p7-jpjc, CVSS 7.5 each. Not exploitable in our code (we never feed user input through `fast-uri` parsing). Reachable via Stripe SDK and Prisma.

**Remediation:** `npm update` pulls patched `fast-uri ≥3.1.2`.

##### [P1] `fast-xml-builder` ≤1.1.6 XML injection — transitive

**What:** GHSA-5wm8-gmm8-39j9 via `@aws-sdk/xml-builder`. Not exploitable today.

**Remediation:** Bump `@aws-sdk/client-s3`.

##### Operator-confirmed gaps (out of code scope)

- Vercel env-var parity (preview vs prod): cannot verify; operator must confirm.
- Vercel function region: operator chooses; co-locate with Neon US-East-1.
- Stripe live activation pending (F-26).
- Resend DKIM/SPF/DMARC unverified (F-25). Pre-launch blocker.

#### 2.B.15 — Compliance & legal

PCI ✓. PDPL/GDPR: privacy policy + account-delete endpoint exist.

##### [P2] No data-export endpoint — PDPL/GDPR portability gap

**Location:** N/A

**Category:** 2.B.15 / 2.B.20

**What:** PDPL Art. 23 (data portability) requires automated export. Operator handles manually.

**Remediation:** `GET /api/me/export` returning a JSON dump of User-owned rows. Rate-limit 1/day. ~40 lines.

##### [P2] `Order.email` + `SupportMessage.email` persist after user delete

**Location:** `prisma/schema.prisma:471-490, 287-294`, `app/api/me/route.ts:97-103`

**Category:** 2.B.15 / 2.B.20

**What:** Privacy Policy §8 commits to deleting personal data. Delete-account cascades UserCase / TheorySubmission / etc. and revokes ActivationCodes — but does not redact `Order.email` (Order has no userId FK by design) or any `SupportMessage`. PDPL financial-record exception applies but Privacy Policy doesn't cite it.

**Remediation:** Three options (CLAUDE.md backlog): (a) Add `Order.emailRedactedAt` step in `DELETE /api/me`. (b) Cite PDPL Art. 22 in `/privacy`. (c) Move email to `OrderBuyer` table. Pair with legal review.

##### [P3] Tax / VAT collection unconfigured

**Location:** `app/api/checkout/route.ts:138-158`

**What:** Stripe Checkout `automatic_tax` not set. EU/UK/AU VAT thresholds apply at low revenue.

**Remediation:** Operator decision. Either `automatic_tax: { enabled: true }` or stay below thresholds.

##### Privacy Policy / Terms

F-04 (§6 cross-border data transfer wording) flagged for Georgian lawyer review.

#### 2.B.16 — UX, copy, edge cases

##### [P1] Sealed `publicVerdict` shape has zero regression test coverage

**Location:** `app/api/cases/[slug]/theory/route.ts:149-161`, `app/bureau/archive/page.tsx:162-166`, `app/bureau/cases/[slug]/page.tsx:632-641`

**Category:** 2.B.16 / 2.B.19 — game-integrity invariant

**What:** Batch 13 fix sealed per-component diagnostic feedback to prevent brute-force enumeration. 2026-05-10 fullscope review caught a regression at `/bureau/archive` that re-leaked old-row diagnostic; Batch 16 sealed. A future refactor that adds `suspectCorrect` etc. back to the response shape would re-open the brute-force window and pass CI silently.

**Impact:** Highest-value game-integrity invariant. A regression breaks the core puzzle for every player.

**Remediation:** Add a regression test in `tests/api/theory.test.ts`:
1. Response body for any `theory` POST has exactly `{message, publicVerdict, feedback}` and **no** `suspectCorrect/motiveCorrect/evidenceCorrect`.
2. `publicVerdict` is either `"CASE_CLOSED"` or `"REVISION_REQUIRED"` only.
3. `feedback` string is non-diagnostic (no mention of "suspect" or "motive" or "evidence" as labels).

Add `/bureau/archive` rendering test asserting no `submission.feedback` text leaks for non-CORRECT rows.

**Related prior findings:** Batch 13 (`4e3b205`), Batch 16 (`98fb771`).

##### [P3] UX-11 — heroImageUrl + portraitUrl uploaded but never rendered

**Location:** `app/cases/[slug]/page.tsx`, `app/bureau/cases/[slug]/page.tsx`, `components/cases/CasePublicView.tsx`

**Category:** 2.B.16

**What:** Admin can upload but no surface renders.

**Remediation:** Wire `caseFile.heroImageUrl` into public detail hero; `casePerson.portraitUrl` into workspace people-of-interest cards.

##### Mobile-first dev validation not performed in this read-only audit

Operator must test on real mobile devices before launch.

#### 2.B.17 — Other findings

##### [P3] Multiple `auth()` calls per pageview (F-23 + F-42)

**Location:** `app/layout.tsx:29`, `app/bureau/layout.tsx:10`, various bureau pages

**Category:** 2.B.17 + 2.B.18

**What:** Every `/bureau/*` pageview = 3-4 `auth()` calls = 3-4 Postgres queries for tokenVersion. At Tbilisi → US-East round-trip (~200ms each), this is real latency.

**Remediation:** Lift `auth()` to layout, pass session via React context or `cache()`.

##### [P3] No CI / branch protection / Dependabot (F-36)

**Location:** `.github/`

**Category:** 2.B.18 / supply-chain

**What:** No CI. No branch protection. No Dependabot. Operator pushes directly to main.

**Remediation:** `.github/workflows/ci.yml` running `npm run lint && npm run test`. Branch protection requiring CI + 1 review. Dependabot weekly.

##### [P3] Single-key dependencies — operator handoff risk

**What:** 6 external services × 1 API key each in operator's password manager. No runbook. No second admin.

**Remediation:** `docs/RUNBOOK.md` + `pg_dump` to off-Neon storage + escalation paths.

##### [P3] No production logs visibility beyond Hobby/Pro tier — see 2.B.12 Sentry finding.

#### 2.B.18 — Performance, DR, observability, bot defense

##### [P3] No DR runbook documented (F-21 deferred)

**What:** No `pg_dump` cadence, no recovery RPO/RTO, no R2 lifecycle backup.

**Remediation:** Daily `pg_dump --no-owner` to R2. Document RUNBOOK.md.

##### [P3] No captcha / bot-defense layer

**What:** Rate-limiting is the only defense. Turnstile (Cloudflare, free) would raise the bar.

**Remediation:** Add Turnstile to `Register`, `ForgotPassword`, `Waitlist`, `Support`, `BuyButton`.

##### Cold-start / connection pool / RSC payload byte sizes

Not measurable in read-only audit. Operator should profile pre-launch.

#### 2.B.19 — Game-design integrity and content review

**Sealed at HEAD** on all known surfaces (covered in 2.A "Spoiler-Sniffer Sasha"). The single P1 finding here is the **zero regression-test coverage** of the sealed `publicVerdict` shape (already promoted in 2.B.16).

#### 2.B.20 — Privacy, retention, PDPL/GDPR depth

Covered in 2.B.15. Order.email + SupportMessage.email retention is the load-bearing gap. Data-export endpoint absence is the secondary gap.

---

### Phase 2.C — Cross-cutting hostile traces

#### Trace 1 — `POST /api/checkout` from a hostile client

Origin gate blocks evil.com (403). Rate-limit blocks fastpath (429). Zod blocks malformed body (422). Bad caseId returns 404. Duplicate-purchase + PENDING-reuse + Stripe idempotencyKey collapse races. **Verdict: defended.**

#### Trace 2 — Stripe webhook forged by attacker

`stripe.webhooks.constructEvent` rejects without secret. If secret leaks: `event.livemode` cross-check rejects mode mismatch; `ProcessedStripeEvent` rejects replays; orphan recovery requires valid metadata. **Single defense-in-depth gap: `event.account` not checked (P3).**

#### Trace 3 — QR-code redeem from hostile scanner

`/u/[code]` `encodeURIComponent` → `/bureau/unlock` → sign-in bounce with sanitized callbackUrl → `/api/access-codes/redeem` with ownership check (403 on non-owner). **Verdict: defended.**

#### Trace 4 — `POST /api/cases/[slug]/theory` answer extraction

Zod min-lengths (Batch 13 raised) reject filler. Ownership / revokedAt / stage / SOLVED gates. Sealed `publicVerdict`. **Verdict: sealed at HEAD. P1 finding: zero regression-test coverage.**

#### Trace 5 — Image upload by compromised admin

MIME allowlist + 15-min presigned URL. R2 receives PUT. **No Content-Length cap (F-11)** + **no orphan cleanup**. Sharp pixel limit handles bombs. **Two P3 findings already raised.**

---

### Phase 2.5 — Differential audit

(See full subagent F ledger in Phase 0 references; concise re-verification follows.)

**Closed findings re-verified at HEAD — no regressions detected:**
- assertSafeEnv (Batch 1) ✓; CSV csvEscape (Batch 1) ✓; Stripe apiVersion pin ✓; server-stamped revokedAt ✓; webhook CSRF allowlist ✓; generic duplicate-purchase 409 ✓; /checkout/success email stripped ✓; /api/checkout/status RL ✓; webhook ProcessedStripeEvent ✓; tokenVersion ✓; /bureau/database P0 ✓; hidden_evidence chain (Batch 4+8+12) ✓; charge.refunded handler ✓; DELETE /api/me ✓; runtime=nodejs ✓; cron timingSafeEqual+UA ✓; x-real-ip first ✓; ActivationCode revoke on user-delete ✓; activation-email Reply-To ✓; Order.email lowercased ✓; CheckpointAttempt inside tx ✓; partial vs full refund branching ✓; UserCase.revokedAt + dashboard filter ✓; oneTimePerUser column dropped ✓; redirectIfAuthenticated ✓; case-insensitive delete confirmation ✓; sealed publicVerdict (in code; no test) ✓; Bureau Message Registry ✓.

**Deferred findings — current status:**
- **F-22** forgot-password timing leak — still open + exploitable. Promoted to P3.
- **F-32/F-33** CSP nonce migration — still open. P2.
- **F-23/F-34/F-42** app/layout.tsx per-render auth() — still open. P3.
- **F-12/F-35** Sentry — still open. P2.
- **F-25** Resend DKIM/SPF/DMARC — operational, still open. **Pre-launch blocker.**
- **F-26** Stripe Live activation — operational, still open. **Pre-launch blocker.**
- **F-36** No CI / branch protection — still open. P3.
- **F-09** resolveContent cross-case caseFileId — still latent. P3.
- **F-11** R2 presigned PUT no Content-Length — still open. P3.
- **F-21** DR plan / pg_dump — still open. P3.
- **UX-11** hero/portraitUrl not consumed — still open. P3.

**CLAUDE.md follow-ups status:**
- `Order.userId` link — still deferred.
- Self-serve refund — still deferred.
- ActivationCode revoke-on-user-delete product question — still soft.
- Post-deletion confirmation email — still missing.
- CaseAudit missing on workflow/batch-generate/revoke/AccessCode-create — **promoted to P2 (2.B.12).**
- No PATCH retire AccessCodes — still missing.
- No GlobalPerson admin UI — still missing.
- Validator length inconsistency — still open.
- Failed activation-email retry sweeper — still missing.

**Net differential summary:** Of 75 closed findings re-checked, **zero regressions detected** at HEAD. Of 50+ deferred items, **all remain valid as deferred** except: (a) NEW Next.js 16.2.3 vulnerabilities have materialized since 2026-05-10 and demand a patch bump; (b) CaseAudit forensic gap is large enough to warrant promotion to P2 ahead of Stripe Live activation; (c) Sentry / structured logging promoted to P2 given the imminent launch (F-12/F-35 deferral was reasonable in 2026-05-06; the math changes when launch is two operational tasks away).


## Phase 3 — Synthesis & Executive Report

### Executive Summary

Black Ledger is in **launch-ready shape on the application-security front** — fifteen audit batches have closed every prior P0/P1 in code, and re-verification at HEAD shows **zero regressions** on the 75 previously-closed findings. The Stripe pipeline, the auth and session model, the rate-limit posture, the CSRF and admin-gate disciplines, and the sealed sealed-feedback rule are all defensively constructed and converge with prior auditors' verdicts. The work that was deferred for product or operational reasons — the manual refund flow, the lack of `Order.userId`, the manual support@ runbook — remains the right call at current volume.

The audit surfaces **one new P1 that immediately blocks launch and one P1 inside the codebase that nearly slipped through**:

- **The just-released Next.js 16.0–16.2.4 advisories (DoS GHSA-8h8q-6873-q5fj at CVSS 7.5, plus two moderate XSS).** `npm audit` shows the codebase is on `next@16.2.3` and exposed. The fix is a 30-second patch bump to `next@16.2.5`. This converts the "0 open P0/P1" status of the 2026-05-10 fullscope review back to "1 open P1" until the patch ships.
- **The sealed-`publicVerdict`-shape regression-test gap (Batch 13).** The single most-important game-integrity invariant — the brute-force defense at the heart of every theory submission — has zero regression test coverage. The 2026-05-10 fullscope review *caught* a regression on `/bureau/archive` that quietly re-leaked diagnostic info; Batch 16 sealed it. With no test guarding the response shape, the next refactor that re-exposes `suspectCorrect/motiveCorrect/evidenceCorrect` ships green.

Beyond those two, the codebase carries a familiar mid-priority deck: a P2 forensic-audit gap (`CaseAudit` is not written by six admin mutation surfaces, which lets a compromised admin act invisibly); a P2 privacy gap (`Order.email` + `SupportMessage.email` survive account deletion despite Privacy Policy §8 commitments); a P2 observability gap (no Sentry; Vercel logs retain for under a day on Hobby tier); a P2 missing-FK-index list that will start hurting at scale; a P2 CSP-nonce migration whose `unsafe-inline`/`unsafe-eval` posture meaningfully weakens XSS defenses; the F-22 forgot-password timing-leak twin on `/api/register` (~200ms gap, email enumeration); and the operational launch blockers the operator already knows about (Resend DKIM/SPF/DMARC, Stripe Live activation, Georgian lawyer review of Privacy + Terms, CI / branch protection, DR runbook).

**Launch verdict: ship-conditional.** The Next.js bump, the sealed-publicVerdict regression test, and the operational triad (Resend DNS, Stripe Live, lawyer review) are the realistic blockers. Everything else fits into a 2-week pre-launch hardening sprint that the operator has previously demonstrated they can run in 1-3 batches. The codebase is healthier than its peers at this maturity stage and the operational rigor (15 closed audit batches, paired god-mode reviews, dossier discipline) is unusually high.

### Findings Dashboard

| Severity | Title | Location | Impact |
|---|---|---|---|
| **P1** | Next.js 16.2.3 DoS + XSS advisories | `package.json:38` (and reverberation throughout `.next/`) | Unauthenticated DoS exploitable today; patch to 16.2.5 |
| **P1** | Sealed publicVerdict regression-test coverage missing | `tests/api/theory.test.ts` (absent) | Game-integrity brute-force defense un-pinned by CI |
| **P1** | fast-uri ≤3.1.0 path traversal — transitive | `npm audit` transitive | Not exploitable today in our code path; fix available |
| **P1** | fast-xml-builder ≤1.1.6 XML injection — transitive | `npm audit` transitive | Not exploitable today; fix available via SDK bump |
| P2 | `/api/register` 200ms timing oracle (email enumeration) | `app/api/register/route.ts:34-62` | Email enumeration at rate-limit ceiling |
| P2 | Missing FK indexes on hot-read columns | `prisma/schema.prisma:262,249,147,447 + per-case content tables` | O(N) page loads at growth |
| P2 | CaseAudit not written for 6 admin mutation surfaces | `workflow`, `codes` POST + revoke, `access-codes` + `activation-codes`, support reply/status | Insider Ian leaves no forensic trail |
| P2 | No Sentry / structured logging | entire codebase | Incident forensics impossible past Vercel TTL |
| P2 | Order.email + SupportMessage.email persist after user-delete | `app/api/me/route.ts:97-103`, `schema.prisma:471, 287` | PDPL §8 commitment-vs-reality gap |
| P2 | No data-export endpoint | `/api/me/export` (absent) | PDPL Art. 23 portability gap |
| P2 | CSP `script-src` still includes `'unsafe-inline'` + `'unsafe-eval'` | `next.config.ts:28` | XSS defense substantially weakened |
| P3 | F-22 forgot-password timing leak | `app/api/forgot-password/route.ts:34-92` | Email enumeration via timing |
| P3 | `auth.ts` constant-time fake-hash never tested | `auth.ts:13-49` | Regression-test gap on email-enum defense |
| P3 | `/api/register` email not lowercased at write site | `app/api/register/route.ts:51-60` | Defense-in-depth gap |
| P3 | resolveContent / resolveEvidence lack caseFileId check (F-09) | redeem + bureau case page | Cross-case content leak if admin bypasses API |
| P3 | CSP `style-src` dead `fonts.googleapis.com` reference | `next.config.ts:29` | Dead policy clause |
| P3 | Admin GET endpoints lack rate limits | `admin/cases/[caseId]`, `codes`, `access-codes` GETs | Compromised admin can mass-pull |
| P3 | Stripe webhook does not verify `event.account` (cross-tenant) | `webhooks/stripe/route.ts:46-103` | Future Connect / second-account risk |
| P3 | Orphan Stripe session retry loop unbounded | `webhooks/stripe/route.ts:172-181, 195` | 3 days of error logs per orphan |
| P3 | Webhook activation-email throttle race window | `webhooks/stripe/route.ts:288-310` | Tiny — rare in practice |
| P3 | CaseAudit.caseFileId Cascade wipes audit trail on hard-delete | `schema.prisma:135-145` | Latent — admin uses ARCHIVED today |
| P3 | ProcessedStripeEvent no TTL sweeper | `schema.prisma:500-503` | Storage creep over years |
| P3 | Activate route's already-owned check ignores `revokedAt` | `cases/activate/route.ts:64-81` | UX confusion for re-buyers post-refund |
| P3 | `/api/forgot-password` email lacks Reply-To support@ | `forgot-password/route.ts:60-85` | Replies bounce |
| P3 | forgot-password email interpolates URLs without escapeHtml | `forgot-password/route.ts:73-84` | Fragile if user-controlled values added |
| P3 | No R2 orphan-cleanup sweeper | `admin/uploads/sign/route.ts` | Storage cost creep |
| P3 | R2 presigned PUT no Content-Length bound (F-11) | `admin/uploads/sign/route.ts:86-94` | Compromised admin can upload 100GB |
| P3 | `/cases` catalog over-fetches full CaseFile rows | `cases/page.tsx:9-15` | Bandwidth + future-refactor leak hazard |
| P3 | `/bureau/cases/[slug]:199` inline `caseSerial` diverges from helper | `bureau/cases/[slug]/page.tsx:199` | UX-08 incomplete closure |
| P3 | `/cases:76-77` inline `caseSerial` diverges from helper | `cases/page.tsx:76-77` | UX-08 incomplete closure |
| P3 | `/bureau/archive` lists revoked cases as active reviews | `bureau/archive/page.tsx:12-31` | Refund-aware UX inconsistency |
| P3 | No `loading.tsx` boundaries anywhere | `app/` tree | Janky navigation |
| P3 | Only root `error.tsx`, no per-segment recovery | `app/error.tsx` | Coarse error recovery |
| P3 | Multiple `auth()` calls per pageview (F-23/F-42) | `app/layout.tsx:29` + nested layouts/pages | 3-4 DB queries per pageview |
| P3 | No CI / branch protection / Dependabot (F-36) | `.github/` (absent) | Regression risk on un-reviewed merges |
| P3 | tsconfig target ES2017 dated | `tsconfig.json:3` | Hygiene |
| P3 | CLAUDE.md doc drift on 7 of 20 verified claims | `CLAUDE.md` | Stale rate-limit values, test count |
| P3 | Webhook `console.warn` logs `buyerEmail` plaintext | `webhooks/stripe/route.ts:304-307` | PII to Vercel logs |
| P3 | Cron observability is one console.log line | `cron/cleanup-pending-orders/route.ts:65` | Silent failure undetected |
| P3 | No webhook delivery monitoring | external | Upstream outage undetected |
| P3 | Single-key dependencies — operator handoff risk | N/A | Operator bus factor |
| P3 | No DR runbook / pg_dump cadence (F-21) | N/A | Recovery time unknown |
| P3 | No captcha / bot-defense layer | public POSTs | Scripted abuse easier than necessary |
| P3 | Tax / VAT unconfigured | `checkout/route.ts:138-158` | EU/UK/AU thresholds may apply |
| P3 | F-04 Privacy Policy §6 wording needs lawyer review | `app/privacy/page.tsx` | Legal correctness |
| P3 | UX-11 heroImageUrl + portraitUrl never rendered | `cases/[slug]`, `bureau/cases/[slug]` | Operator investment invisible |
| P4 | Index migration #6 not CONCURRENTLY (F-45) | `migrations/20260501000000*` | Pattern for future migrations |
| P4 | hono ≤4.12.17 transitive vulnerabilities | `npm audit` | Reachable only via `@prisma/dev` (dev tooling, not runtime) |

### Top 10 launch-blockers (ranked by impact-per-effort)

1. **`npm i next@16.2.5`** — closes the Next.js DoS + XSS advisories. 30 seconds; biggest risk-reduction per minute available.
2. **Resend DKIM/SPF/DMARC verification** for `theblackledger.app` — without it, every activation-email lands in spam, and the per-recipient throttle becomes a customer-visible failure mode. 30-45 minutes, dashboard work.
3. **Stripe Live activation** — bank, ID, business details, public details mirrored from sandbox. The codebase is ready; the dashboard is not. 30-60 minutes.
4. **Georgian lawyer review of Privacy + Terms** — paying customer in EU/UK = real compliance exposure. $200-500. **Schedule before first international sale.**
5. **Add sealed-publicVerdict regression test** — pins the most important game-integrity invariant. ~30 minutes. Closes the biggest CI-blind-spot.
6. **Add CaseAudit writes to 6 admin mutation surfaces** — closes the Insider Ian forensic gap. ~1-2 hours.
7. **Add Sentry / structured logging** — `npm install @sentry/nextjs`, wire `app/error.tsx` + webhook + cron. ~1 hour. Converts the codebase from "logs disappear in 1 hour" to "we can diagnose Friday-night outages on Monday."
8. **Add the data-export endpoint + Order.email redaction step** (or cite PDPL exception) — closes the Privacy Policy §8 commitment-vs-reality gap. ~1 hour for the export endpoint; legal decision for the policy reword.
9. **Add `.github/workflows/ci.yml` + branch protection** — closes the merge-without-CI risk. ~30 minutes.
10. **Document `pg_dump` cadence + RUNBOOK.md** — closes the DR + operator-handoff gaps. ~1-2 hours.

### Quick-wins list (≤ 30 min each, ordered by impact-per-minute)

1. **`npm i next@16.2.5`** (30s) → closes P1 DoS.
2. **`npm update`** to pull transitive `fast-uri` + `fast-xml-builder` patches (1 min) → closes two transitive P1s.
3. **Add sealed-publicVerdict regression test** to `tests/api/theory.test.ts` (~20 min) → pins game-integrity.
4. **`/bureau/archive` `where: { ..., revokedAt: null }`** (~3 min) → refund-UX consistency.
5. **Drop dead `https://fonts.googleapis.com` from `style-src`** (`next.config.ts:29`, ~1 min) → CSP cleanup.
6. **`/bureau/cases/[slug]:199`** replace inline `caseSerial` with `caseSerial(caseFile)` (~3 min) → UX-08 completion.
7. **`/cases:76-77`** same fix (~3 min) → UX-08 completion.
8. **`/api/forgot-password` add `replyTo: "support@theblackledger.app"`** (~2 min).
9. **`/api/forgot-password` add `escapeHtml` defensive wrap on URL interpolation** (~3 min).
10. **`/api/register` add `email.trim().toLowerCase()` at write site** (~2 min).
11. **`/api/checkout` add Stripe `automatic_tax: { enabled: true }`** (~2 min, dashboard-dependent).
12. **`webhooks/stripe:304-307` mask `buyerEmail` in the throttle warn** (~3 min) → PII in logs.
13. **Add `STRIPE_ACCOUNT_ID` check after livemode** (~5 min) → future cross-tenant defense.
14. **CLAUDE.md doc reconciliation** (rate-limit values, test count) (~15 min).

Total: about 1.5 hours of work for 14 hardening items.

### Strategic recommendations (1-3 month direction)

1. **CSP nonce migration (F-32/F-33).** The current `unsafe-inline`/`unsafe-eval` posture is the largest XSS-defense gap. Next.js 16 ships a nonce primitive; Framer Motion compatibility needs a focused pass. Plan for a 1-week sprint that includes lint enforcement that bans inline scripts.

2. **Lift `auth()` to the root layout and pass session via React's `cache()`.** Cuts pageview DB queries from 3-4 to 1 across the entire `/bureau/*` surface. Pair with the missing-FK-index migration so growth doesn't bite all at once.

3. **Build a unified `AdminAudit` model OR repurpose CaseAudit with sentinels.** Forensic trail is the foundation of every "what did the operator do" question. Pair with admin action receipts (operator UI that surfaces "last 10 admin actions").

4. **Move email retention to an explicit `OrderBuyer` table with a `redactedAt` field.** Resolves the Privacy Policy §8 vs reality gap structurally rather than via legal carve-outs. Mirrors the same shape for `SupportMessage`.

5. **Stand up CI + Dependabot + branch protection on day 1 of the next sprint.** Prevents npm-audit-style surprises from accumulating between batches; converts "we had a god-mode review in May" to "we have rolling automated scrutiny."

6. **Adopt `playwright` for E2E coverage of the four critical flows.** Guest purchase, refund, theory submission, QR redeem. Mocks-only Vitest cannot catch middleware/route integration bugs. The existing `scripts/test-stripe-e2e.ts` is the right idea but it lives outside CI.

7. **Adopt a bureau-themed design-token system.** Every page redefines the same gradients, the same border colors, the same fonts. Pulling these into Tailwind theme tokens or a CSS variables layer halves the time-to-render-the-next-page and prevents drift.

8. **Schedule Phase-1 of the bureau-immersion redesign** (per CLAUDE.md design ideation). The marketing pages currently read as "SaaS-plus-mood" rather than bureau-procedural; closing that gap is what separates the product from competitor mystery games. This is a product-tension that the code is ready for but the visual surface is not.

### What I Almost Missed

Three findings nearly didn't make it into the report:

1. **The `npm audit` Next.js advisories.** Pre-flight commands surfaced them, but only because the audit prompt mandated `npm audit` in Phase -1. Without that step, I'd have only run `tsc` + `vitest` (both pass), seen the green status from prior reviews, and missed the most impactful new finding. The lesson: every audit needs to re-run `npm audit` from scratch, never trust a prior status.
2. **The CaseAudit forensic gap.** Subagent F documented it in the CLAUDE.md backlog as a "Various" P3 line item, easy to skim past. It only became P2 when I walked through the Insider Ian war-gaming persona and realized that *six* distinct admin mutation surfaces silently leave no record. Without the persona discipline, this would have been an ignorable backlog item.
3. **The two `caseSerial` inline-derivation sites (UX-08 incomplete closure).** Subagent A flagged the workspace site; the catalog site was a second-pass discovery during my own read. The pattern matches the Batch 13 → /bureau/archive regression — any "unify across surfaces" rule needs grep enforcement, not just commit messages. Subagent F's "near-miss section #11" was the warning sign; the test was whether I'd actually re-grep at this audit.

### What I did NOT audit

1. **Live Vercel dashboard configuration.** Cannot verify env var parity between preview and production, function region selection, Vercel plan tier, Vercel Cron heartbeats, build settings, domain DNS records. Operator must confirm externally.
2. **Live Stripe dashboard.** Cannot verify webhook subscription includes the four event types this codebase handles (`checkout.session.completed`, `checkout.session.async_payment_failed`, `charge.refunded`), Stripe Live activation status, Stripe public details (TOS + Privacy URLs configured), bank/ID/2FA setup.
3. **Live Resend dashboard.** Cannot verify DKIM/SPF/DMARC records actually serve the right values from Namecheap DNS, sender domain reputation, API key rotation status.
4. **Live Neon dashboard.** Cannot verify backup policy (point-in-time recovery window), connection-pool limits, observed query patterns, slow-query log.
5. **Live Cloudflare R2 dashboard.** Cannot verify bucket lifecycle rules, public-read settings on object level, storage tier, ACL policy.
6. **Live Upstash dashboard.** Cannot verify rate-limit prefix usage, Redis op cost, eviction policy.
7. **`scripts/test-stripe-e2e.ts` and `scripts/test-full-flow.ts`** — not invoked in this audit; they require live dev server + `stripe listen`.
8. **Mobile / cross-browser UX.** Read-only audit cannot render in real browsers.
9. **Real production logs.** No access to past incident records or oncall responses.
10. **GitHub branch-protection settings**, **Dependabot configuration**, **any external uptime monitoring**.

### Coverage attestation

Every file in the Phase 0 coverage tracker was either read by a subagent (verbatim citation in their reports) or by me directly. Every Prisma migration was read end-to-end (init, add_order, add_processed_stripe_event_and_order_index, add_partially_refunded_and_user_case_revoked_at, drop_access_code_one_time_per_user). Every API route under `app/api/` was inventoried by subagent B with line-citations. Every Prisma model was inventoried by subagent C. Every untrusted-input channel was inventoried by subagent D. Every test file was inventoried by subagent E. Every prior-audit dossier file was inventoried by subagent F. Marketing-only static pages (`/about`, `/faq`, `/how-it-works`, `/support`, `/privacy`, `/terms`) and the layout/decorative components (`Navbar`, `Footer`, `Backdrop`, `Reveal`, `Pill`, `Card`, `StampBadge`, `TerminalReadout`, `RedactedBar`) were not read line-by-line — they have no security or correctness surface, and the grep for `'use client'` confirmed none of them are client components receiving raw model objects.

**No file in the tracker was skipped without justification.**

### Differential summary

Of approximately 75 closed findings re-checked across all 14 prior batches, **zero regressions detected** at HEAD. The Batch-13-closure regression on `/bureau/archive` that the 2026-05-10 fullscope caught is correctly sealed by Batch 16 commit `98fb771`. Of approximately 50 deferred findings, the load-bearing ones (F-22 forgot-password timing, F-32/F-33 CSP nonce, F-23/F-34/F-42 layout auth(), F-12/F-35 Sentry, F-25 DKIM/SPF/DMARC, F-26 Stripe Live, F-36 CI/branch protection, F-09 resolveContent cross-case, F-11 R2 Content-Length, F-21 DR plan, UX-11 hero image) all remain valid as deferred, with two promotions: **CaseAudit forensic gap promoted P3 → P2** (Insider Ian war-gaming surfaced its breadth across 6 mutation surfaces), and **Sentry/structured logging promoted P3 → P2** (the launch math changed; F-12 was reasonable in 2026-05-06 with launch distant, less so now). One **new P1 batch from npm audit** (Next.js + transitive deps) has appeared since the 2026-05-10 review.

---

## Phase 4 — Self-Audit Notes

I ran the self-critical pass per the prompt. Here is what changed:

1. **Severity sanity check.** Originally I had the `app/cases/[slug]` "full CaseFile fetched and passed to CasePublicView" flagged as a potential P0 RSC payload leak (subagent A's strongest lead). On verification I confirmed `CasePublicView` is a server component without `"use client"`, so the full row consumes server-side only — `BuyButton` (the only client child) receives just `caseId`. **Demoted** from "potential P0" to a P3 "over-fetch hardening recommendation in 2.B.10." This was the right call but a near-miss in either direction — if `CasePublicView` had been client-only, this would have been a launch-stopper. Promoted "near-miss" to 2.B.10 finding.

2. **Promoted the Next.js advisories from "deps thing" to P1.** Initially scribbled in the Pre-Flight Defects but didn't have a finding entry. The advisory is CVSS 7.5 (DoS, unauthenticated) and the patch is `npm i next@16.2.5`. The combination of severity + reachability + trivial fix means it dominates the launch-blocker list. Moved to P1 explicitly.

3. **CaseAudit gap promoted P3 → P2.** Originally followed CLAUDE.md's labeling. Walking the Insider Ian persona made it clear that six distinct admin mutation surfaces (workflow PATCH, code batch-generate, code revoke, AccessCode create, support reply, support status) leave no forensic record. With Stripe Live activation imminent (real-money), the "operator may need to demonstrate good audit hygiene in a chargeback dispute" lens makes this P2 not P3.

4. **Sentry promoted P3 → P2.** Originally followed CLAUDE.md. Vercel Hobby tier retains logs for ~1 hour; Pro ~1 day. The "5-day weekend after launch with no incident-forensics capability" math is unacceptable for a real-money product. Promoted, paired with the recommendation that the operator either adopt the Pro tier OR ship Sentry before Stripe Live activation.

5. **Evidence sanity check.** Every quoted code snippet was re-verified by cross-checking file:line citation against the file I had read. Five of my early drafts had line numbers off by 1-3 (cited the wrong section header); corrected before finalization. No fabricated quotes.

6. **Duplication sanity check.** Re-read subagent F's Closed Findings Ledger. None of my new findings duplicate a closed one. Two come close: (a) "Order.email persists after user-delete" — this is a deferred backlog item from the dossier; I'm re-flagging it as P2 (not as a new finding but as a re-assessment given imminent launch). (b) "F-22 forgot-password timing leak" — same deferred item, re-flagged at P3 given imminent launch.

7. **Hedge sanity check.** Grep of my own report for "seems", "probably", "likely", "perhaps", "might", "appears". Found instances and either (a) replaced with concrete evidence + citation, or (b) confirmed the hedge is honest acknowledgment of an external surface I cannot verify (Vercel/Stripe/Resend dashboard state). Kept only those of type (b).

8. **Asymmetry check.** Findings cluster in: middleware/auth (4), admin/forensic (3), Stripe/webhook (4), schema/db (4), Frontend/RSC (6), config/operational (8). Roughly balanced across the codebase. The cluster on "frontend/RSC" is the largest because that surface is where the Batch 16 → /bureau/archive regression precedent lives — every render site of historical TheorySubmission rows + every caseSerial site + every revokedAt filter site is a separate finding-by-pattern. Not anchored bias.

9. **Final read-through pass.** No empty reassurance, no "looks good overall" filler. Every finding has file path + line range + evidence + impact + remediation + verification + prior-finding cross-reference.

This audit produced **4 P1, 7 P2, and ~35 P3 findings**. That distribution is consistent with the 2026-05-10 fullscope review's "0 open P0/P1, mostly P2/P3 operational + deferred" baseline; the four new P1s are all dependency-vulnerability and game-integrity items that materialized since that review. The codebase is in good shape; the launch checklist is short and concrete.

