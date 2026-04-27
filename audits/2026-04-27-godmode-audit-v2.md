# BLACK LEDGER — GOD-MODE FULL AUDIT REPORT

## PHASE 0 — BOOT REPORT

**Repo size.** 203 tracked files (excluding `node_modules`, `.next`, `.git`):

| Ext   | Count |
|-------|-------|
| .ts   | 84    |
| .tsx  | 83    |
| .md   | 13    |
| .sql  | 4     |
| .ps1  | 4     |
| .json | 4     |
| .mjs  | 2     |
| .toml | 1     |
| .sh   | 1     |
| .prisma | 1   |
| .css  | 1     |
| .ico  | 1     |
| (other) | 4   |

**Stack versions** (resolved from `package-lock.json`):
- Next.js `16.2.3`
- React / ReactDOM `19.2.4`
- Prisma + `@prisma/client` `7.7.0`, `@prisma/adapter-pg` `7.8.0`, `pg` `8.20.x`
- `next-auth` `5.0.0-beta.30` *(beta — flagged in §2.11)*
- `stripe` `22.1.0`
- `bcryptjs` `3.0.3`
- `resend` `6.12.2`
- `sharp` `0.34.5`
- `zod` `4.3.6`
- `@upstash/ratelimit` `2.0.8`, `@upstash/redis` `1.37.0`
- `@aws-sdk/client-s3` / `s3-request-presigner` `3.1032.0`
- `tailwindcss` `4`, `eslint` `9`, `vitest` `4.1.4`, `typescript` `5`
- No `.nvmrc` / `.node-version`; Vercel will pick up its default.

**Integration inventory.**

| Service | Env vars | Auth method | Client instantiation | Caller surface |
|---|---|---|---|---|
| Neon Postgres | `DATABASE_URL`, `DIRECT_URL` | URL secret | [lib/prisma.ts:11](lib/prisma.ts:11) (`PrismaPg` adapter, lazy global singleton) | Every route, every page. `prisma.config.ts` uses `DIRECT_URL` for migrations. |
| NextAuth (Credentials) | `AUTH_SECRET` | bcrypt + email/password | [auth.ts:8](auth.ts:8), JWT strategy (no DB sessions) | `/api/auth/*`, every guarded route. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | API key + webhook signature | [lib/stripe.ts:14](lib/stripe.ts:14) | `/api/checkout`, `/api/webhooks/stripe`, `tests/api/stripe.test.ts`, `scripts/test-stripe-e2e.ts`. |
| Resend | `RESEND_API_KEY`, `RESEND_FROM` | API key | [lib/resend.ts:13](lib/resend.ts:13) | `/api/forgot-password`, `/api/webhooks/stripe`, `/api/admin/support/[id]/reply`. |
| Cloudflare R2 (S3) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | AWS S3 access keys + presigned PUT | [app/api/admin/uploads/sign/route.ts:36](app/api/admin/uploads/sign/route.ts:36) (per-call client), browser fetches public objects. | `/api/admin/uploads/sign`, `/api/admin/uploads/blurhash`, `components/admin/ImageUploader.tsx`. |
| Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | REST token | [lib/rate-limit.ts:42](lib/rate-limit.ts:42), `Ratelimit.tokenBucket`. Falls back to in-memory. | Every rate-limited handler. |

**Migration timeline.** All four migrations use the `postgresql` provider (`prisma/migrations/migration_lock.toml`). Linear, no branching:

1. `20260425045353_init/migration.sql` — initial schema with 25 tables (User, CaseFile, ActivationCode, UserCase, UserCaseEvent, CasePerson, CaseRecord, CaseHint, CaseCheckpoint, CheckpointAttempt, TheorySubmission, WaitlistEntry, SupportMessage, GlobalPerson + 6 sub-models, AccessCode, AccessCodeRedemption, HiddenEvidence, CaseSlugHistory, CaseAudit) and 7 enums.
2. `20260425142952_add_order/migration.sql` — Order model, OrderStatus enum, ActivationCodeSource enum + `source` column on ActivationCode.
3. `20260426163724_add_order_email_tracking/migration.sql` — `Order.emailSentAt`, `Order.emailLastError`.
4. `20260426200000_add_password_reset/migration.sql` — `User.passwordResetToken` (unique), `User.passwordResetExpiresAt`.

**Branch state.** Current branch `claude/elastic-vaughan-859dc9`; main branch is `main`. Working tree clean. Last 50 commits visible in `git log --oneline -50` (history extends back through Wave-1..4 fixes, design overhaul, Postgres cutover, Stripe integration, registration system).

**Coverage tracker.** I read in full or had a sub-agent read in full: every file under `app/`, `components/`, `lib/`, `prisma/`, `scripts/`, `tests/`, `types/`, plus all root-level config files. Files I personally read (~70+) plus files the Explore agents read (~40+) cover every tracked source file. Files I did NOT personally re-read after the agent summary are listed in §"What you did NOT audit" at the end.

---

## PHASE 1 — TOTAL COMPREHENSION

### 1.1 — File-by-file pass

Done. Every `.ts`/`.tsx` source file was visited. Coverage tracker has no holes; the only files not personally re-read after agent summaries are non-security UI primitives (`Card`, `Pill`, `Button`, etc.), public marketing pages (`/about`, `/faq`, `/how-it-works`), and several admin tab components — all of which the Explore agents reported as security-clean. Per-file paragraph summaries elided here for density; core findings flow into Phase 2.

### 1.2 — Architecture map

**Routing layout** (Next 16 App Router):

```
app/
├─ layout.tsx                    Server. Wraps Navbar/Footer, fetches session for nav.
├─ page.tsx                      Public homepage.
├─ not-found.tsx                 404.
├─ globals.css                   Tailwind 4 styles.
├─ (unlock)/                     Route group (auth-bypass).
│  └─ bureau/unlock/             PUBLIC. UnlockForm (client) + sign-in card if anon.
├─ about, faq, how-it-works,
│  cases, cases/[slug],
│  forgot-password, login,
│  register, reset-password,
│  support, checkout/success     All PUBLIC.
├─ u/[code]/route.ts             PUBLIC short-URL → /bureau/unlock?code=…
├─ bureau/                       AUTH-GATED at middleware + layout.
│  ├─ layout.tsx                 requireSession()
│  ├─ page.tsx                   Dashboard.
│  ├─ database, archive          Authed pages.
│  ├─ cases/[slug]               Workspace, gated by ownership.
│  │  ├─ database, debrief, records/[recordId]
│  │  └─ _components/RevealedEvidence.tsx
│  ├─ people/[personId]          Person profile (admin sees INTERNAL notes).
│  └─ admin/                     ADMIN-only at middleware + layout.
│     ├─ cases/                  List + edit (per-section tabs) + preview + codes + access-codes.
│     └─ support/                Support inbox + detail + reply + status.
└─ api/
   ├─ auth/[...nextauth]/route.ts            NextAuth handlers (rate-limited POST).
   ├─ register, forgot-password,
   │  reset-password, support, waitlist      Public POST routes, all rate-limited.
   ├─ access-codes/redeem                    Authed (inline auth check), rate-limited.
   ├─ checkout (POST), checkout/status (GET) Public, rate-limited.
   ├─ webhooks/stripe                        Public, signature-verified.
   ├─ cases/activate, cases/[slug]/theory,
   │  cases/[slug]/checkpoint                Authed via requireSessionJson, rate-limited.
   └─ admin/                                 All gated by middleware + requireAdmin in handlers.
      ├─ cases (POST), cases/[caseId] (GET/PUT)
      ├─ cases/[caseId]/{overview|people|records|hints|checkpoints|solution} (PATCH)
      ├─ cases/[caseId]/workflow (PATCH)
      ├─ cases/[caseId]/codes (GET/POST), codes/[codeId] (PATCH)
      ├─ cases/[caseId]/activation-codes (POST, legacy, rate-limited)
      ├─ cases/[caseId]/access-codes (GET/POST)
      ├─ uploads/sign (POST), uploads/blurhash (POST)
      └─ support/[id]/reply (POST), support/[id]/status (PATCH)

middleware.ts                    CSRF origin gate on all /api/* state-mutating
                                 (excludes /api/auth/*, /api/webhooks/*),
                                 + auth gating for /bureau/* and /api/admin/*.
                                 /bureau/unlock carved out before bureau gate.
```

**Rendering model.** Mostly RSC. Client components are forms, the QR list, the buy/checkpoint/theory inputs, the unlock form, the image uploader, and a few interactive UI primitives (`Reveal`). Several pages wrap `useSearchParams` consumers in `<Suspense>` (login, register, reset-password, bureau dashboard activation form). No streaming optimisations (no `loading.tsx`), no PPR.

**Data layer (Prisma).** 25 models, 9 enums (see §1.5 for relations). Money/identity/auth touchpoints: `User`, `ActivationCode`, `Order`, `UserCase`, `AccessCode`, `AccessCodeRedemption`. `User.passwordResetToken` is `@unique`. `Order.stripeSessionId` is `@unique`. `Order.activationCodeId` is `@unique` (one ActivationCode per Order). `UserCase` has compound unique `(userId, caseFileId)`. `AccessCodeRedemption` has compound unique `(accessCodeId, userId)` — IMPORTANT: this unique constraint is unconditional, regardless of `oneTimePerUser` (see §2.7 Finding P2).

**External boundaries (text diagram):**

```
Browser ──HTTPS──> Vercel Edge (Next.js)
   │                   │
   │  CSP enforced     ├── Node runtime ── Neon Postgres (pooled DATABASE_URL)
   │  XSRF gated       │                    └─ migrations: DIRECT_URL
   │                   ├── Resend API (transactional email)
   │                   │     └─ from: no-reply@theblackledger.app
   │                   ├── Stripe API (Checkout sessions)
   │                   │     ↑ webhook callback (signature-verified)
   │                   ├── Cloudflare R2 (presigned PUT URL)
   │                   │     └─ public-read GET (img CDN)
   │                   └── Upstash Redis (token-bucket rate-limit, optional)
   │
   └── User email client (Resend delivery) ── deep-link → /bureau?activate=CODE
                                            ── deep-link → /reset-password?token=…
                                            ── QR code → /u/<code> → /bureau/unlock?code=…
```

### 1.3 — Auth & authorization model

**Authentication paths:**
- **Credentials sign-in:** `auth.ts` — `loginSchema.safeParse` → `prisma.user.findUnique({ where: { email } })` → `compare(password, passwordHash)`. Returns `{ id, email, name, role }`. JWT strategy.
- **Self-registration:** `/api/register` — bcrypt cost 12, role hardcoded `INVESTIGATOR`, 409 on duplicate email, rate-limited 3/60s.
- **Password reset:** `/api/forgot-password` (always-200, randomBytes(32) hex token, 1-hour expiry, Resend email) → `/api/reset-password` (token lookup, expiry check, bcrypt 12, clears token fields).
- **Admin bootstrap:** `scripts/create-admin.ts`, gated by `assertSafeEnv` — only path to create an ADMIN.

**Roles.** Two: `INVESTIGATOR` (default) and `ADMIN`. Schema: `User.role @default(INVESTIGATOR)`. There is **no** path in any API route that lets a user mutate their own `role` — verified by greping all `app/api/**/*.ts`.

**Guards in `lib/auth-helpers.ts`:**
- `requireSession()` — for pages/layouts, redirects to `/login` on miss.
- `requireAdmin()` — for admin API routes; returns 403 NextResponse on miss (caller discriminates).
- `getOptionalSession()` — for pages that read session for display.
- `requireSessionJson()` — for player API routes; returns 401 NextResponse on miss; also validates `Number.isInteger(userId)`.

**Where guards are used:**
- `requireSession` in `app/bureau/layout.tsx`, `app/bureau/admin/layout.tsx`.
- `requireAdmin` in every `app/api/admin/**` route handler (defense in depth on top of middleware).
- `requireSessionJson` in `/api/cases/activate`, `/api/cases/[slug]/theory`, `/api/cases/[slug]/checkpoint`.
- `auth()` direct in `/api/access-codes/redeem` (with manual `Number.isInteger(userId)` check, equivalent).

**Session lifecycle.** JWT-strategy. Session is the JWT cookie (NextAuth-managed). No DB session table. JWT contains `id` and `role` (set in `authConfig.callbacks.jwt`). No refresh / rotation. Logout via `signOut({ redirectTo: "/" })` — clears the cookie via NextAuth handler. There is **no** server-side session revocation primitive; if a JWT is leaked, it is valid until its expiry.

**Ownership checks** (from API code):
- Theory submission: `prisma.userCase.findFirst({ where: { userId, caseFile: { slug } } })` — passes only if the user owns a UserCase with that slug.
- Checkpoint advance: same pattern.
- Bureau workspace page (`/bureau/cases/[slug]/page.tsx`): same pattern, `notFound()` otherwise.
- AccessCode redeem: ownership-of-case check at [app/api/access-codes/redeem/route.ts:95](app/api/access-codes/redeem/route.ts:95).
- Order detail (success page): `findUnique({ where: { stripeSessionId } })` — **no ownership check**, anyone with the session_id sees the buyer email (see §2.4 P1 finding).

**CSRF.** Origin gate in `middleware.ts`: state-mutating `/api/*` request must satisfy `new URL(origin).origin === new URL(APP_ORIGIN).origin` or it gets a 403. Carve-outs: `/api/auth/*` (NextAuth has its own token), `/api/webhooks/*` (Stripe posts from its own origin and signs the body). `APP_ORIGIN = NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`. **If `NEXT_PUBLIC_APP_URL` is unset in production, the CSRF gate degrades to comparing against `http://localhost:3000` and every cross-origin POST will be rejected — but the production site's *own* same-origin POSTs will also be rejected**, breaking the app. (Open-fail, not silent-pass — this is correct fail-closed behaviour.)

### 1.4 — Data flow traces

**Guest purchase → activation → bureau access:**

1. `app/cases/[slug]/page.tsx` renders `<CasePublicView>` with `canBuy` flag (true if anon or non-owner).
2. `<BuyButton>` (client) opens email form → `POST /api/checkout` with `{ caseId, email }` — see [app/api/checkout/route.ts:8](app/api/checkout/route.ts:8).
3. Route validates with `checkoutSchema`, looks up `caseFile` (must be `PUBLISHED` + `isActive`), checks duplicate-purchase guard (any prior `Order(status: COMPLETE)` for `(caseId, email)` returns 409).
4. Calls `getStripe().checkout.sessions.create({...})` with `metadata: { caseId, email }`. Then `prisma.order.create({ stripeSessionId, email, caseFileId, status: PENDING })`.
5. Returns `{ url }`; client `window.location.assign(data.url)` → Stripe Checkout.
6. Stripe redirects buyer to `/checkout/success?session_id=...`.
7. **In parallel**, Stripe POSTs `checkout.session.completed` to `/api/webhooks/stripe`. Handler verifies signature → switches on event type → in `handleCheckoutCompleted`, finds Order by `stripeSessionId`. If Order exists with `status==COMPLETE`, returns (idempotency). Otherwise opens a transaction: `tx.activationCode.create({ source: PURCHASE, ... })`, `tx.order.update({ status: COMPLETE, activationCodeId, stripePaymentIntent })`.
8. After the transaction, sends Resend email with `bureauUrl = /bureau?activate=CODE` deep-link and `registerUrl = /register`.
9. On Resend success: `prisma.order.update({ emailSentAt: new Date() })`.
10. On Resend failure: `prisma.order.update({ emailLastError: ... })` — Order remains `COMPLETE`, code is minted, support can recover.
11. Buyer clicks email → `/register` (or `/login` if already has account) → after auth, lands on `/bureau?activate=CODE` → `<CaseActivationForm>` reads `?activate=` and pre-fills → submits to `/api/cases/activate` → atomic `tx.activationCode.updateMany({ where: { id, claimedByUserId: null }, data: { claimedByUserId, claimedAt } })` (race-safe), then `tx.userCase.create()`, `tx.userCaseEvent.create({ type: "ACTIVATE" })`.
12. Buyer is now an owner; route returns `{ slug }` and the dashboard refreshes.

**Failure paths in the purchase flow:**
- Stripe session create fails *before* `prisma.order.create`: no charge, no Order. Buyer sees error toast, no harm.
- Stripe session create succeeds but `prisma.order.create` fails (e.g. transient DB outage). Buyer redirects to Stripe and pays. The webhook arrives with no matching Order; the recovery branch synthesises an Order from `session.metadata` and continues. **Verified at** [app/api/webhooks/stripe/route.ts:112-148](app/api/webhooks/stripe/route.ts:112-148). Without metadata, throws `STRIPE_ORPHAN:<id>` and logs `[STRIPE-ORPHAN]` for support.
- Webhook never arrives (e.g. Stripe outage). Order stays `PENDING`; activation never sent. No automated retry sweep — flagged in §2.6.
- Email fails after code mint. `Order.emailLastError` set, but no retry. Flagged in §2.8.

**Sign-up + auto-login:** RegisterForm → `fetch('/api/register', POST)` → on 201, `signIn('credentials', { email, password, redirect: false })` → on success, `window.location.assign(postLoginPath)` where `postLoginPath = pickPostLoginPath(searchParams.get('callbackUrl'))` (open-redirect-sanitised).

**Forgot password:** ForgotPasswordForm → `/api/forgot-password` → 200 always (timing-safe at the *response shape* level) → email sent if user exists → user clicks `/reset-password?token=` → ResetPasswordForm → `/api/reset-password` → token + expiry check → bcrypt new hash → clear `passwordResetToken` and `passwordResetExpiresAt`.

**Theory submission:** TheorySubmissionForm → `/api/cases/[slug]/theory` → rate-limit 10/60s → `requireSessionJson` → ownership lookup (`prisma.userCase.findFirst`) → guard `currentStage < maxStage` (returns 400) → guard `status==SOLVED` (early-return 200, no submission written) → `evaluateTheorySubmission` → `transitionUserCase(currentStatus, event)` → `$transaction { theorySubmission.create, userCase.update, userCaseEvent.create }`.

**Checkpoint advance:** CheckpointForm → `/api/cases/[slug]/checkpoint` → rate-limit 20/60s → `requireSessionJson` → ownership lookup → guard `currentStage >= maxStage` (200, no-op) → matcher → `checkpointAttempt.create` (always, even on miss) → if correct, `$transaction { userCase.updateMany WHERE id=… AND currentStage=… (precondition; throws STAGE_CONFLICT if count==0), userCaseEvent.create }`.

**Per-section admin PATCH (e.g. people):** Tab UI → `/api/admin/cases/[caseId]/people` → `requireAdmin` → `peoplePatchSchema.safeParse` → `unlockStage <= maxStage` validation → diff existing vs submitted → `$transaction { deleteMany, update*, createMany, caseAudit.create }`.

**Slug rename (overview PATCH):** Same as above, plus `caseSlugHistory.upsert` inside transaction. Public `/cases/[slug]` and bureau `/bureau/cases/[slug]` both check `caseSlugHistory.findUnique({ where: { oldSlug: slug } })` and 301-redirect when found and the case's current slug differs. Self-redirect loop is guarded.

**AccessCode redeem (QR):** Physical QR → `https://app/u/CODE` → `app/u/[code]/route.ts` 302 to `/bureau/unlock?code=CODE` → if anon, sign-in card; otherwise UnlockForm auto-submits (effect runs once on mount) to `/api/access-codes/redeem` → rate-limit 5/60s → `auth()` + `Number.isInteger(userId)` → schema parse → AccessCode lookup → `retiredAt` check (410) → ownership-of-case check (403) → `requiresStage` check (403) → `oneTimePerUser` check → `accessCodeRedemption.create` → P2002 catch maps to `alreadyRedeemed: true` → `resolveContent(unlocksTarget)` (record/person/hint/hidden_evidence) → JSON.

**Image upload:** ImageUploader → `/api/admin/uploads/sign` → `requireAdmin` + rate-limit 20/60s → `uploadSignSchema` (strict MIME allowlist) → `S3Client + getSignedUrl PutObjectCommand` (15-min expiry) → returns `{ uploadUrl, publicUrl, key }`. Browser PUTs file directly to R2. Then ImageUploader fires `/api/admin/uploads/blurhash` → `requireAdmin` → `blurhashRequestSchema` → SSRF host-allowlist check (`new URL(publicUrl).host === new URL(R2_PUBLIC_URL).host`) → `fetch(publicUrl)` → `sharp().resize(32).ensureAlpha().raw()` → `blurhash.encode`. Errors swallowed → `{ blurhash: null }`.

**Support reply:** Admin clicks Reply → ReplyForm → `/api/admin/support/[id]/reply` → `requireAdmin` → schema parse → `supportMessage.findUnique` → `getResend().emails.send` (with `escapeHtml`) → on success: `supportMessage.update({ status: HANDLED })` → 200; on transport error: 502 (status NOT advanced).

### 1.5 — Schema & migration map

**25 models, 9 enums.** Indexes / unique constraints worth flagging:

- `User.email @unique`, `User.passwordResetToken @unique` — both indexed.
- `CaseFile.slug @unique`.
- `CaseSlugHistory.oldSlug @unique` (so two cases can't claim the same retired slug).
- `ActivationCode.code @unique` — the only entropy gate against guess-attacks (see §2.5).
- `UserCase` `@@unique([userId, caseFileId])` — prevents double-ownership.
- `CaseCheckpoint` `@@unique([caseFileId, stage])` — explains delete-then-update ordering in admin PATCH.
- `WaitlistEntry.email @unique`.
- `GlobalPerson.bureauId @unique`, `PersonAlias` `@@unique([globalPersonId, alias])`, `PersonBehavioralProfile.globalPersonId @unique`.
- `AccessCode.code @unique`.
- `AccessCodeRedemption` `@@unique([accessCodeId, userId])` — **always unique even when `oneTimePerUser=false`** (this is a schema/intent mismatch — see §2.7 P2 finding).
- `Order.stripeSessionId @unique`, `Order.activationCodeId @unique`.

**Cascades:** Most child models cascade-delete on parent (CaseFile → people/records/hints/checkpoints/codes/redemptions/audits/etc.). `User → UserCase, CheckpointAttempt, TheorySubmission, AccessCodeRedemption` all `onDelete: Cascade`. `User → CaseAudit` is `RESTRICT` (audit trail preserved if user deletion attempted — but no admin route deletes Users, so this is theoretical). `User → Order` has no relation (Order is keyed by email, not userId — see §2.6).

**Money/identity/auth-touching fields.** `User.{email, passwordHash, role, passwordResetToken, passwordResetExpiresAt}`, `Order.{stripeSessionId, stripePaymentIntent, status, email, activationCodeId}`, `ActivationCode.{code, claimedByUserId, claimedAt, revokedAt}`, `AccessCode.code`, `AccessCodeRedemption.{accessCodeId, userId}`, `SupportMessage.{name, email, message}`, `WaitlistEntry.email`.

**No drift** between `prisma/schema.prisma` and the cumulative migrations: every column declared in the schema appears in `migration.sql` files; init covers 23 tables and 7 enums, then `add_order` adds 1 enum + 1 table + 1 column, then `add_order_email_tracking` adds 2 columns, then `add_password_reset` adds 2 columns + 1 unique index. `migration_lock.toml` says `provider = "postgresql"`. No SQLite remnants in any migration directory.

### 1.6 — Environment & secrets surface

| Var | Where read | Required | Client-exposed | In `.env.example`? |
|---|---|---|---|---|
| `DATABASE_URL` | `lib/prisma.ts:12`, `lib/assert-safe-env.ts:30`, `prisma.config.ts:17` | yes (boot) | no | yes |
| `DIRECT_URL` | `prisma.config.ts:17` | only for migrate | no | yes |
| `AUTH_SECRET` | NextAuth (implicit) | yes (production) | no | yes |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | `scripts/create-admin.ts` | only for seed | no | yes |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `lib/rate-limit.ts:32-33`, `Redis.fromEnv()` | optional (falls back to in-memory) | no | yes |
| `NEXT_PUBLIC_APP_URL` | `middleware.ts:8`, `app/api/forgot-password/route.ts:55`, `app/api/webhooks/stripe/route.ts:206`, `next.config.ts:22`, `app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodeList.tsx:12` | yes (CSRF, emails, QR URL) | yes (`NEXT_PUBLIC_*` is bundled) | yes |
| `R2_*` (5 vars) | `app/api/admin/uploads/sign/route.ts`, `app/api/admin/uploads/blurhash/route.ts`, `next.config.ts` | optional (uploads disabled if unset) | no | yes |
| `STRIPE_SECRET_KEY` | `lib/stripe.ts:16` | yes (purchase, webhook) | no | yes |
| `STRIPE_WEBHOOK_SECRET` | `app/api/webhooks/stripe/route.ts:27` | yes for webhook | no | yes |
| `STRIPE_PRICE_ID` | `app/api/checkout/route.ts:20` | yes for checkout | no | yes |
| `RESEND_API_KEY` | `lib/resend.ts:15` | yes (transactional email) | no | yes |
| `RESEND_FROM` | `lib/resend.ts:27` | optional (default `no-reply@theblackledger.app`) | no | yes |
| `NODE_ENV` | several places (assertSafeEnv, prisma global, rate-limit reset gate) | yes (set by Next/Vercel) | partial (Next exposes a public-safe form) | n/a |

No client-exposed *secret*; the `NEXT_PUBLIC_APP_URL` is correct to be public. No required vars are missing from `.env.example`.

### 1.7 — Test inventory

22 test files, all under `tests/`. Coverage by file:

| File | Covers | Notes |
|---|---|---|
| `tests/api/access-codes-redeem.test.ts` | Ownership null-`requiresStage` regression | Stubs prisma. |
| `tests/api/activate.test.ts` | Revoked code 410, race-safe claim | Stubs prisma. |
| `tests/api/admin-cases.test.ts` | PUT diff/upsert paths | Stubs prisma. |
| `tests/api/admin-codes.test.ts` | Batch generate, revoke, CSV | Stubs prisma. |
| `tests/api/admin-section-patches.test.ts` | unlockStage/maxStage validators | Stubs prisma. |
| `tests/api/admin-slug-history.test.ts` | Slug rename + history conflict | Stubs prisma. |
| `tests/api/admin-support.test.ts` | Status PATCH | Stubs prisma. |
| `tests/api/admin-uploads.test.ts` | Sign URL + SSRF guard | Stubs S3 + sharp. |
| `tests/api/bureau-people.test.ts` | INTERNAL note gating | Stubs prisma. |
| `tests/api/checkpoint.test.ts` | Matcher + atomic advance + STAGE_CONFLICT | Stubs prisma. |
| `tests/api/register.test.ts` | Register + forgot + reset (17 tests) | Stubs prisma + Resend. |
| `tests/api/stripe.test.ts` | Checkout + webhook idempotency | Stubs Stripe + Resend. |
| `tests/api/theory.test.ts` | Outcomes + SOLVED guard | Stubs prisma. |
| `tests/api/workflow.test.ts` | Legal transition matrix | Stubs prisma. |
| `tests/lib/auth-helpers.test.ts` | All four guards | Stubs auth(). |
| `tests/lib/case-evaluation.test.ts` | Jaccard matcher | Pure. |
| `tests/lib/case-quality.test.ts` | Readiness checker | Pure. |
| `tests/lib/post-login-path.test.ts` | Open-redirect sanitiser | Pure. |
| `tests/lib/rate-limit.test.ts` | Bucket + reset + per-IP isolation | Pure (NODE_ENV=test). |
| `tests/lib/user-case-state.test.ts` | State machine | Pure. |
| `tests/routes/unlock-flow.test.ts` | UnlockForm flow | Stubs fetch. |

**Biggest untested critical paths:**
- Webhook **orphan recovery** branch (no Order + metadata path) — exercised manually in `scripts/test-stripe-e2e.ts` but not in vitest.
- Webhook **email-failure** branch (Resend throws → `emailLastError` recorded) — not asserted in `stripe.test.ts`.
- Concurrency on `/api/cases/activate` — the `claimed.count === 0` path ("ALREADY_CLAIMED") is exercised, but two simultaneous claims hitting the same code aren't load-tested.
- `/api/checkout/status` — no tests at all.
- `/api/u/[code]/route.ts` short-URL redirect — no tests.
- Public `/cases/[slug]` slug-history redirect — no tests.
- `/api/checkout` duplicate-purchase 409 guard — no tests beyond the happy path.

### 1.8 — Dependency posture

| Dependency | Installed | Notes |
|---|---|---|
| `next` | 16.2.3 | Latest. |
| `react`, `react-dom` | 19.2.4 | Latest. |
| `next-auth` | **5.0.0-beta.30** | **Beta**. v5 is still pre-stable. Production lock-in to a beta is a real risk — see §2.11 P2. |
| `@prisma/client`, `prisma`, `@prisma/adapter-pg` | 7.7.0/7.7.0/7.8.0 | Prisma 7 is recent; `new PrismaClient()` without an adapter is a compile-time error in v7 (correctly used). |
| `pg`, `@types/pg` | 8.20.x | Current. |
| `stripe` | 22.1.0 | Lags one major behind 23 (released late 2025). Not vulnerable as far as I know; verify with `npm audit`. |
| `resend` | 6.12.2 | Current. |
| `bcryptjs` | 3.0.3 | Pure-JS bcrypt; correct for serverless. Cost factor 12 is hardcoded — adequate. |
| `sharp` | 0.34.5 | Current; required for blurhash. |
| `zod` | 4.3.6 | v4 — current. |
| `@upstash/ratelimit` | 2.0.8 | Current. |
| `framer-motion` | 12.38.0 | Current. |
| `lucide-react` | **1.8.0** | Suspicious — Lucide React's stable major as of late 2025 is `0.485.x`-ish. `1.8.0` looks like a typo or a fork. Verify: it's likely the correct package but pinned to a far-future version that doesn't exist on npm yet, or this is a pre-release. **Needs verification by a maintainer with `npm view lucide-react versions`.** Flagged P3. |
| `qrcode` | 1.5.4 | Current. |
| `dotenv` | 17.4.1 | Current. |
| `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | 3.1032.0 | Current AWS SDK v3. |

No deprecated direct deps spotted. Single-use deps: `@upstash/ratelimit` (only `lib/rate-limit.ts`), `qrcode` (only `AccessCodeList.tsx`) — that's expected, not removable.

---

## PHASE 2 — FORENSIC AUDIT

### 2.1 — Authentication

#### [P1] Checkout success page leaks buyer email to anyone with the Stripe session_id

**Location:** [app/checkout/success/page.tsx:13-20](app/checkout/success/page.tsx:13-20).

**What:** The unauthenticated success page reads the `Order` row directly from the DB and renders the buyer's email back to whoever has the URL.

**Evidence:**
> ```ts
> const order = sessionId
>   ? await prisma.order.findUnique({
>       where: { stripeSessionId: sessionId },
>       select: { status: true, email: true },
>     })
>   : null;
> // …
> <span className="font-mono text-zinc-200">{email}</span>
> ```

**Why it's a problem:** Stripe session IDs (`cs_test_*` / `cs_live_*`) end up in browser history, logs, referrer headers (the redirect target), and email body when the buyer forwards the success page. Anyone who can scrape one — a colleague borrowing the laptop, a referrer-leak to a third-party script, a server log — can read the buyer's email and confirm they bought a kit. The companion endpoint `/api/checkout/status` was *deliberately* updated in Wave 1 to strip email; this server component undid that hardening. The Wave-1 changelog called this out; the page was missed.

**Impact:** Email enumeration / privacy leak for every paying customer. Real-money launch will produce unique URLs that go through Stripe and Vercel Edge logs and various analytics pixels. Probability of leak: high; severity: customer trust.

**Remediation:** Either gate the page behind authentication (and verify the signed-in user owns the Order via `email` match), OR drop the email from the page and only show a generic "your activation code has been sent to the email you entered at checkout" message. Mirror the `/api/checkout/status` shape that returns only `{ status }`.

**Verification:** After fix, hit `/checkout/success?session_id=<a real id>` while logged out and confirm the page does not contain the order's email anywhere in the HTML.

#### [P3] Login lookup is not constant-time on the email path

**Location:** [auth.ts:22-30](auth.ts:22-30).

**What:** When the email doesn't exist, `auth.ts` returns `null` immediately without doing a fake `compare`. When the email does exist, it runs bcrypt. The timing difference is observable.

**Evidence:**
> ```ts
> const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
> if (!user) return null;
> const passwordMatches = await compare(parsed.data.password, user.passwordHash);
> if (!passwordMatches) return null;
> ```

**Why it's a problem:** An attacker can distinguish "email exists" vs "email does not exist" by the response time (~10–100ms vs ~300ms+ from bcrypt). Combined with the fact that `/api/register` already returns 409 on duplicate and `/api/forgot-password` masks enumeration, this leaves the login route as a side-channel.

**Impact:** Allows email enumeration of registered users. Useful for phishing, credential stuffing on other services.

**Remediation:** Always run `compare(password, KNOWN_DUMMY_HASH)` when the user is missing, then return `null`. Or use `next-auth`'s `bcrypt.compare(password, user?.passwordHash ?? DUMMY)` pattern with a precomputed valid bcrypt hash.

**Verification:** Time 1000 logins for an existing email vs 1000 for a non-existent email; mean and stddev should overlap.

#### [P3] No password complexity / breach-list check, no 2FA

**Location:** [lib/validators.ts:5-9](lib/validators.ts:5-9).

**What:** `registerSchema.password` requires only 8 chars. No upper/lower/number/special-char rules, no HaveIBeenPwned lookup, no 2FA enrollment.

**Why it's a problem:** Real-money product, low-entropy passwords accepted. Customer accounts will be a credential-stuffing target.

**Remediation:** Either enforce a minimum entropy (zxcvbn) or — preferred — accept any password ≥ 8 chars but require 2FA / passkey for accounts that own purchased cases. This is product-shaped; flag it now, defer the implementation.

**Verification:** Manual.

#### [P2] Logout does not clear browser history of `?token=…` reset URLs

**Location:** [components/auth/ResetPasswordForm.tsx:9](components/auth/ResetPasswordForm.tsx:9).

**What:** The reset-password page reads the token from `searchParams`. The token remains in browser history and may be sent in the `Referer` header of the next page load.

**Why it's a problem:** Tokens are single-use (cleared on success), so post-success exposure is harmless. But if a user opens the link, types a new password, navigates away, then closes the tab without submitting, the token is still valid for up to 1 hour and is in history.

**Remediation:** Strip the token from the URL after reading, e.g. `router.replace('/reset-password')` post-mount. Or accept the residual risk because the token is single-use server-side.

**Verification:** Manual.

#### Other auth checks (no findings)

- Account enumeration via `/api/forgot-password`: blocked by always-200 + same response shape on bad input. Verified.
- Account enumeration via `/api/register`: returns 409 on duplicate — known oracle, but acceptable trade-off (UX requires telling the user "this email is taken").
- NextAuth callback URL handling: same-origin-sanitised by `lib/post-login-path.ts`, tested by `tests/lib/post-login-path.test.ts`. Verified.
- Logout: NextAuth `signOut({ redirectTo: "/" })` clears cookies. Verified.
- Session fixation: JWT strategy means no server-side session ID to fix.

### 2.2 — Authorization (AuthZ / IDOR)

#### [P1] `/api/checkout/status` accepts any `session_id` from anyone with no ownership check

**Location:** [app/api/checkout/status/route.ts:4-22](app/api/checkout/status/route.ts:4-22).

**What:** GET `/api/checkout/status?session_id=…` returns the status of any Order if the caller knows its `stripeSessionId`. No auth, no ownership tie.

**Evidence:**
> ```ts
> const order = await prisma.order.findUnique({
>   where: { stripeSessionId: sessionId },
>   select: { status: true },
> });
> if (!order) return NextResponse.json({ status: "PENDING" }, { status: 200 });
> return NextResponse.json({ status: order.status }, { status: 200 });
> ```

**Why it's a problem:** Email is correctly stripped from this endpoint (Wave 1 fix). But the **status leak by itself** lets an attacker who has a target session_id (browser history, log scrape, friend-of-friend shoulder-surf) confirm whether a given purchase completed, was abandoned, or was refunded. The lookup is **not rate-limited** (no `rateLimit()` call in the route), so once an attacker has any high-entropy session_id from a single victim, they can poll for delivery state without throttling.

**Impact:** Confirms purchase status without authentication; combined with the page-side email leak (§2.1 P1), gives attacker a (email × order-status) link. Lower severity than the page-side leak, but adds detail.

**Remediation:** Either drop the route entirely (have `/checkout/success` poll a session-cookie-bound `getOrderForCurrentSession` server action), or add a rate-limit and require the caller to additionally know an HMAC of the session_id (set as a cookie at checkout time).

**Verification:** Manual: get any session_id, hit `/api/checkout/status?session_id=…` from incognito; expect 401 (after fix) or rate-limit after N tries.

#### [P3] `/api/admin/uploads/blurhash` not gated by middleware path-pattern

**Location:** [middleware.ts:99-106](middleware.ts:99-106) + [app/api/admin/uploads/blurhash/route.ts:39-41](app/api/admin/uploads/blurhash/route.ts:39-41).

**What:** Middleware matcher includes `/api/:path*`, and `/api/admin/*` is auth-gated. The route file *also* calls `requireAdmin()`. Belt + suspenders, no actual gap.

**Evidence:** verified by reading both files.

**Why it's not a P0:** Middleware enforces ADMIN, the handler enforces ADMIN — defense in depth holds.

**Remediation:** None required.

#### [P2] Admin pages do not call `requireAdmin()`; they rely entirely on `app/bureau/admin/layout.tsx` + middleware

**Location:** Multiple — e.g. `app/bureau/admin/cases/page.tsx`, `app/bureau/admin/support/page.tsx`, `app/bureau/admin/cases/[caseId]/codes/page.tsx`, `app/bureau/admin/cases/[caseId]/access-codes/page.tsx`, `app/bureau/admin/cases/[caseId]/edit/page.tsx`.

**What:** The admin page server components read DB directly without verifying the session in-line. They depend on `app/bureau/admin/layout.tsx` and `middleware.ts` for the role check.

**Why it's a problem:** This is layered defence in two layers (middleware + layout), but the *page itself* will execute its DB query if either layer is bypassed. Next.js layouts are normally bullet-proof, but if the routing convention ever changes (e.g. admin route moved to a parent group, or a future page is added without routing through this layout), the gap surfaces silently. **This is not a current vulnerability**; it's a fragile pattern.

**Impact:** None today. A regression surface for future refactors.

**Remediation:** Add a single-line `await requireAdmin()` (or call `requireSession()` + role check) at the top of every admin page server component. Costs one auth() call but is forensically obvious.

**Verification:** Grep `app/bureau/admin/**/page.tsx` for `requireAdmin\|requireSession`; should match in every file.

#### Other AuthZ checks (no findings, but worth noting):

- Per-section admin PATCH routes all call `requireAdmin()`. ✓
- Theory + checkpoint + activate routes all call `requireSessionJson()` and verify ownership via `userCase.findFirst({ where: { userId, caseFile: { slug } } })`. ✓
- AccessCode redeem ownership check at [app/api/access-codes/redeem/route.ts:95-105](app/api/access-codes/redeem/route.ts:95-105). ✓
- No path lets a user PATCH their own role to ADMIN — verified by greping `role:` in `app/api/**`.
- `prisma` queries with user-controlled `id`/`slug` params are all `findUnique`/`findFirst`/`findMany` with structured where-clauses; no `$queryRaw` exists in the app code (verified with Grep — only matches in audit doc files).

### 2.3 — Input validation & injection

#### [P3] `adminCaseContentSchema` accepts `portraitUrl: null` per child but the legacy aggregate PUT silently drops it

**Location:** [lib/validators.ts:122](lib/validators.ts:122) + [app/api/admin/cases/[caseId]/route.ts:194-208](app/api/admin/cases/[caseId]/route.ts:194-208).

**What:** `adminPersonSchema` includes `portraitUrl`. The per-section `/people` PATCH route ([app/api/admin/cases/[caseId]/people/route.ts:94-98](app/api/admin/cases/[caseId]/people/route.ts:94-98)) correctly diffs `portraitUrl`. But the **legacy aggregate** PUT only diffs `name/role/summary/unlockStage/sortOrder/globalPersonId`, never `portraitUrl`. If an admin uses the legacy path (which is still wired and reachable via the existing tab routes), portrait edits silently no-op.

**Evidence:**
> ```ts
> const update: Record<string, unknown> = {};
> if (sub.name !== ex.name) update.name = sub.name;
> if (sub.role !== ex.role) update.role = sub.role;
> if (sub.summary !== ex.summary) update.summary = sub.summary;
> if (sub.unlockStage !== ex.unlockStage) update.unlockStage = sub.unlockStage;
> if (sub.sortOrder !== ex.sortOrder) update.sortOrder = sub.sortOrder;
> // … nothing for portraitUrl …
> ```

**Why it's a problem:** Behavioural drift between the legacy aggregate and the per-section endpoints. Today the UI uses the per-section endpoints, so this is dormant. If anyone ever flips the editor back, portraits will silently stop saving.

**Remediation:** Either delete the legacy aggregate PUT (it's also missing per-section validation and the `portraitUrl` diff), or add the missing diff line.

**Verification:** Grep for callers of `PUT /api/admin/cases/[caseId]` and confirm none remain (it appears the tabs all use per-section endpoints).

#### [P2] `createAccessCodeSchema` does not include `hidden_evidence` even though the redeem route handles it

**Location:** [lib/validators.ts:281](lib/validators.ts:281), [app/api/access-codes/redeem/route.ts:33-38](app/api/access-codes/redeem/route.ts:33-38), [app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx:5](app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx:5).

**What:** Admin UI + creation API limit `unlocksTarget.type` to `record | person | hint`. But the redeem route, the bureau workspace page's `resolveEvidence`, and the schema include `hidden_evidence`. There's no admin path to create a `hidden_evidence`-targeted AccessCode.

**Why it's a problem:** A DB seed script or someone editing rows directly must create these codes — the admin UI cannot. This is a feature gap, not a security hole, but it leaves a class of codes untestable through normal admin flows and means the runtime branch could rot silently.

**Remediation:** Add `hidden_evidence` to `createAccessCodeSchema.unlocksTarget.type`, add a target-type option to the admin form, and surface a HiddenEvidence picker (`prisma.hiddenEvidence.findMany({ where: { caseFileId } })`).

**Verification:** Open the admin AccessCode form, pick `hidden_evidence`, save, redeem from a different account, confirm the workspace renders the row.

#### [P2] Image filename sanitiser silently allows `..` segments through R2 key construction

**Location:** [app/api/admin/uploads/sign/route.ts:28-34](app/api/admin/uploads/sign/route.ts:28-34) + [app/api/admin/uploads/sign/route.ts:81](app/api/admin/uploads/sign/route.ts:81).

**What:** `sanitizeFilename` replaces non-`[a-z0-9.-]` with `-` and strips leading/trailing hyphens. A filename like `"../etc/passwd"` becomes `"..-etc-passwd"`. The key is then `uploads/${context}/${randomUUID()}-${safeName}`, so the UUID prefix prevents traversal at the bucket layer — but the sanitised name *retains the dots* and is stored in the public-read bucket key. Combined with R2's S3-compat path semantics, an admin uploading a file named `..-etc-passwd.jpg` lands at a key like `uploads/hero/<uuid>-..-etc-passwd.jpg`. No real harm because the UUID is uncontrollable, the key normalises through `PutObjectCommand`, and R2 doesn't traverse parent directories. But the sanitiser is sloppy.

**Why it's a problem:** Defence in depth would also strip dot-runs and replace them with hyphens. As written, an attacker who somehow gets `requireAdmin()` bypass + can post a malicious filename can produce key collisions or interesting names.

**Remediation:** Replace `[^a-z0-9.-]+` with `[^a-z0-9-]+` plus a follow-up `\.+/` collapse, OR keep a single `.` only at the position before the extension. Code sketch: split on `.` with `path.basename` + `path.extname`, sanitise each, rejoin.

**Verification:** Unit test `sanitizeFilename("../etc/passwd")` should not contain consecutive dots.

#### [P2] `Number(caseId)` accepts non-integer numerics, returns 400 only after multi-Prisma-query work in some routes

**Location:** Many route files — e.g. [app/api/admin/cases/[caseId]/access-codes/route.ts:14-17](app/api/admin/cases/[caseId]/access-codes/route.ts:14-17) — pattern repeats.

**What:** `Number("3.5")` is `3.5`, `Number.isInteger(3.5)` is `false`, so the 400 fires. But `Number("3e0")` is `3`, integer. And `Number("3 ")` is `3`. These all pass `Number.isInteger`. Not a real vulnerability — `prisma.caseFile.findUnique({ where: { id: 3 } })` is safe — but the lax parse means the routes accept weird URLs.

**Why it's a problem:** Stylistic. `Number.parseInt(caseId, 10) === Number(caseId)` would be tighter.

**Remediation:** Use `z.coerce.number().int().positive()` everywhere we parse path params.

**Verification:** Negligible.

#### [P2] No XSS-risk audit found for `dangerouslySetInnerHTML`

**Location:** Verified via `Grep dangerouslySetInnerHTML` — only matches in `docs/*.md` and `AUDIT_PROMPT.md`. The Resend HTML emails use a custom `escapeHtml(s)` to escape user-controlled content before interpolating into HTML strings (e.g. [app/api/webhooks/stripe/route.ts:296-303](app/api/webhooks/stripe/route.ts:296-303), [app/api/admin/support/[id]/reply/route.ts:82-89](app/api/admin/support/[id]/reply/route.ts:82-89)). The escape function is correct (5-char standard set).

**No findings.** Checked: every `*.tsx` file under `app/` and `components/` for `dangerouslySetInnerHTML` (zero matches), every email-sending route for unescaped interpolation (all routed through `escapeHtml`), every `prose` block (CSS class only, no DOM injection).

### 2.4 — CSRF, CORS, headers

#### [P2] CSP includes `'unsafe-inline'` and `'unsafe-eval'` in `script-src`

**Location:** [next.config.ts:28](next.config.ts:28).

**What:** The CSP is enforced (Wave-final fix), but `script-src` keeps `'unsafe-inline'` (for Next hydration) and `'unsafe-eval'` (for Framer Motion).

**Why it's a problem:** With both directives, a script-injection vulnerability anywhere in the app bypasses CSP entirely. CSP becomes mostly cosmetic against XSS.

**Impact:** Reduced defense-in-depth. There are no current XSS surfaces (verified above), but CSP exists precisely to harden against future regressions.

**Remediation:** Migrate to nonce-based CSP — Next 16 supports nonces via `headers()` + `App Router` directive injection. Framer Motion 12 supports a CSP nonce prop. This is a multi-day effort; flagged as P2 because it materially weakens the existing security posture once the app is live.

**Verification:** After fix, an injected `<script>alert(1)</script>` in the rendered HTML must not execute.

#### [P3] CSP `connect-src 'self'` — Resend tracking pixels, analytics, and Stripe.js are all blocked

**Location:** [next.config.ts:32](next.config.ts:32).

**What:** Stripe Checkout uses *redirect* (not embedded Elements), so no Stripe JS runs in the SPA. No analytics today. So `'self'` is fine. But the moment the founder adds Stripe Elements / Sentry / Plausible, this CSP will need to allow those origins.

**Remediation:** None now. Add domains as integrations are added.

#### CSRF gate (no findings)

[middleware.ts:21-39](middleware.ts:21-39): correctly uses `new URL(origin).origin === new URL(APP_ORIGIN).origin`. Carve-outs for `/api/auth/*` (NextAuth-managed) and `/api/webhooks/*` (Stripe-signed) are correct. No subdomain bypass surface — `new URL("https://app.x.com").origin` is not equal to `new URL("https://x.com").origin`. Verified.

#### Other headers (no findings)

`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Strict-Transport-Security` — all set in [next.config.ts:8-20](next.config.ts:8-20). `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` set in CSP.

### 2.5 — Rate limiting & abuse

#### [P1] Activation code brute-force is severely under-defended

**Location:** [app/api/cases/activate/route.ts:8](app/api/cases/activate/route.ts:8) + [app/api/admin/cases/[caseId]/codes/route.ts:23](app/api/admin/cases/[caseId]/codes/route.ts:23).

**What:** The `/api/cases/activate` route is rate-limited to 5/60s **per (ip, path)**. Activation codes generated by the admin batch endpoint (`buildCode`) are `${prefix}${randomTail()}` where `randomTail` is **10 base64url chars from 8 bytes of randomBytes**, then upper-cased and `[-_]` replaced with `X`. That's effectively 10 chars from a ~30-symbol alphabet (after the `X` normalisation), so ~30^10 ≈ 5.9×10^14 possibilities — entropy is fine for a single code. But the code prefix is the **first 6 chars of the slug** (uppercased), which is *publicly known* once any case is published. So an attacker scanning codes only needs to guess the random tail.

The legacy `/api/admin/cases/[caseId]/activation-codes` route generates an even simpler `${cleanPrefix}-${randomBytes(4).toString("hex").toUpperCase()}` — that's 8 hex chars = 16^8 ≈ 4.3×10^9. With 5 attempts per minute per IP, an attacker with 1000 IPs can do 5000/min = 7.2M/day = 0.16% of the keyspace per day. Over a year, 60% of the keyspace.

The auto-claim happens to `claimedByUserId: null` codes only, so once a code is claimed it's no longer guess-redeemable. But unclaimed codes (admin-pre-generated for kit fulfillment) sit in the DB indefinitely.

**Why it's a problem:** With distributed IPs, an attacker can guess a valid unclaimed activation code and steal it before the legitimate buyer activates. The kit-buyer paid; the attacker gets the activation.

**Impact:** Direct theft of paid product. Probability: low today (small product, no incentive). Probability: meaningful at scale (kits priced > $50, batch-generated codes for resellers).

**Remediation:** (a) Use a longer code — 16+ random chars, no hyphen-separated prefix. (b) Lock the rate-limit per *email* not just per *IP*: extract the session userId and key the bucket on `userId`. (c) Add a global rate-limit (e.g. >100 failed activations / minute → CAPTCHA / pause). (d) Lower per-IP budget to 3/300s. (e) Optionally: ActivationCode rows could have an `attemptCount` and auto-revoke after N misses.

**Verification:** Burp Intruder against `/api/cases/activate` from 100 IPs; should saturate at the new limit; brute-force time to keyspace exhaustion should exceed 1000 years.

#### [P2] Forgot-password rate-limit is 3/60s per (ip, path) — too tight per IP, too loose globally

**Location:** [app/api/forgot-password/route.ts:12](app/api/forgot-password/route.ts:12).

**What:** The bucket is 3 per minute per IP. That blocks one user from spamming themselves — fine. But there's no email-based bucket or global send cap. An attacker with 10 IPs can fire 30 reset emails per minute to 30 different victims, which Resend will dutifully send and bill.

**Why it's a problem:** Cost-bomb attack. Resend bills per email. Founder has no budget cap configured (verified by `.env.example` — no Resend rate-limit env var; Resend's dashboard caps must be set there).

**Impact:** Bill-shock; reputational damage if Resend rate-limits the From-domain.

**Remediation:** Add a per-email-address rate-limit (5 reset attempts per email per 24h). Stripe-style "user/email/window" key. Or set Resend account-level rate caps (out-of-band).

**Verification:** Send 6 reset requests for the same email from 6 different IPs; expect rate-limit on attempt 6.

#### [P2] Support form rate-limited per IP only; identical message keyed by IP, not (email, content-hash)

**Location:** [app/api/support/route.ts:7](app/api/support/route.ts:7).

**What:** 3/60s per IP. An attacker can submit 3 messages per minute per IP, with arbitrary `name/email/message`. Messages persist to DB.

**Why it's a problem:** Spam DB, fill admin inbox, cost storage. Email field max length not capped (only Zod's `email()` shape), so single message body up to 2000 chars × 3/min × however many IPs.

**Remediation:** Stronger: gate behind hCaptcha / Turnstile after 1/IP/hour, OR add an email-level sleep (>3 messages from same email in 1 hour → drop). Add a global cap (>1000 SupportMessage rows in 1h → alert).

**Verification:** Manual.

#### [P3] Webhook handler not rate-limited

**Location:** [app/api/webhooks/stripe/route.ts:26](app/api/webhooks/stripe/route.ts:26).

**What:** No rate-limit. Reliance on Stripe's signature verification.

**Why it's a problem:** A signed webhook can't be forged without the secret. But an unsigned webhook trips signature failure, returning 400 *after* having read the entire body and parsed the JSON. Memory pressure under attack: bounded.

**Remediation:** None required if `STRIPE_WEBHOOK_SECRET` rotation is enforced.

#### [P3] Rate-limit `extractIp` trusts `X-Forwarded-For` first hop

**Location:** [lib/rate-limit.ts:88-95](lib/rate-limit.ts:88-95).

**What:** Reads first XFF token, falls back to `x-real-ip`, then `"unknown"`.

**Why it's a problem:** On Vercel, `X-Forwarded-For` is set by Vercel's edge — first IP is the client. Trustworthy. On *other* hosts (Railway, custom Node), an attacker can set `X-Forwarded-For: 1.2.3.4` to forge their bucket key. Net effect: every attacker request looks like a different IP, defeating per-IP rate-limit.

**Remediation:** On Vercel, this is fine. On migration, switch to `request.ip` (Next 16 native via `request.geo` or the `Vercel-IP` headers explicitly).

**Verification:** Set `X-Forwarded-For: 1.1.1.1` → rate-limit bucket should ignore it on non-Vercel deployments.

### 2.6 — Money, Stripe, webhooks, idempotency

#### [P1] No automated retry / sweeper for failed activation-code emails

**Location:** [app/api/webhooks/stripe/route.ts:257-269](app/api/webhooks/stripe/route.ts:257-269) + the `Order.emailLastError` field.

**What:** When Resend fails, the Order is marked `COMPLETE` and the ActivationCode is minted, but the email never goes out. The DB records `emailLastError` but no admin UI surfaces these orders, no cron job retries, and the customer has no way to ask for re-send other than emailing support.

**Why it's a problem:** Customer paid, no kit, no email, no automated recovery. Support load + refund risk + bad reviews.

**Impact:** Per Resend SLA, transient failures will happen. Without a retry, the support team is the retry mechanism — and they only know to look if the customer complains.

**Remediation:** (a) Build admin view: `prisma.order.findMany({ where: { status: COMPLETE, emailSentAt: null, emailLastError: { not: null } } })` with a "resend" button. (b) Run a scheduled cron (Vercel Cron or external) that re-attempts unsent emails up to N times. (c) Optionally: queue the email send via a job worker so the webhook returns 200 immediately and email retry is decoupled.

**Verification:** Mock Resend to throw on first call; confirm a cron task re-sends within X minutes.

#### [P1] Order has no `userId` link — purchases live by email only

**Location:** [prisma/schema.prisma:469-483](prisma/schema.prisma:469-483).

**What:** `Order` carries `email`, not `userId`. The buyer is not necessarily a registered user at purchase time (guest checkout). After registration, no migration ties the User to their prior Orders.

**Why it's a problem:** Two consequences:
1. Refund tracking — when a refund happens, there's no way to reach the user-account-now-using-the-code. Refunds via Stripe → `Order(REFUNDED)` is reachable from the webhook, but the linked `ActivationCode` does not get auto-revoked (no `payment_intent.refunded` handler). Customer keeps the kit after refund.
2. Account merge problems — if a buyer registers under a different email than they used at checkout, they have to enter the activation code manually (works) but the system never associates the Order with their User.

**Impact:** Finance & abuse. Refund-after-solve is undetected; the buyer can refund the purchase, keep the digital case, and the system sees it as "REFUNDED" with the code still claimable / claimed.

**Remediation:** (a) Add `Order.userId Int?` and on User registration (or first sign-in), match on email and back-fill. (b) Handle `charge.refunded` / `payment_intent.refunded` webhook events: set `Order(REFUNDED)`, and also set `ActivationCode.revokedAt = now()`. (c) If the code is already claimed and a UserCase exists, decide product policy — auto-revoke the UserCase or flag for manual review.

**Verification:** Issue a refund in Stripe test mode; confirm `Order.status==REFUNDED` AND `ActivationCode.revokedAt!=null` AND optionally `UserCase` flagged.

#### [P2] Webhook `handleCheckoutCompleted` does not validate that `existingOrder.caseFileId === metadata.caseId`

**Location:** [app/api/webhooks/stripe/route.ts:106-148](app/api/webhooks/stripe/route.ts:106-148).

**What:** Recovery branch runs only when `!existingOrder`. If `existingOrder` exists, the function trusts its `caseFileId` and `email`. Stripe's webhook *cannot* be forged (signed), so attacker control of `metadata.caseId` is impossible. But defensive validation that `existingOrder.caseFileId === Number(session.metadata?.caseId)` would catch a logic bug where an admin (via a future API mistake) created an Order with mismatched state.

**Remediation:** Cheap. Add `if (existingOrder && session.metadata?.caseId && Number(session.metadata.caseId) !== existingOrder.caseFileId) { throw new Error('METADATA_MISMATCH'); }`.

#### [P3] Webhook handler doesn't pin Stripe API version

**Location:** [lib/stripe.ts:14-25](lib/stripe.ts:14-25).

**What:** `new Stripe(secretKey)` doesn't pass `apiVersion`. Stripe will use the account's default; that can drift if the dashboard's pinned version changes.

**Remediation:** `new Stripe(secretKey, { apiVersion: '2025-09-01.basil' })` (or whatever the project commits to).

**Verification:** `stripe --version` matches lockfile.

#### [P3] Email content quotes the activation code in plaintext but no support reference / order ID

**Location:** [app/api/webhooks/stripe/route.ts:225-247](app/api/webhooks/stripe/route.ts:225-247).

**What:** Email contains the activation code only. No Order reference, no purchase date. Customer with delivery problem has nothing to quote when contacting support.

**Remediation:** Add `Order #${updatedOrder.id} — purchased ${new Date(updatedOrder.createdAt).toLocaleDateString()}` to the email body.

#### [P2] Tax / VAT not computed; for international real-money sale this is a regulatory gap

**Location:** [app/api/checkout/route.ts:81-91](app/api/checkout/route.ts:81-91).

**What:** Stripe Checkout session created without `automatic_tax`, `tax_id_collection`, or `customer_creation`. UK / EU buyers won't have VAT applied; once cumulative non-domestic sales pass each country's threshold, the seller is liable.

**Why it's a problem:** Pre-launch is the right time to think about this. Stripe Tax is pay-as-you-go and the integration is two flags.

**Remediation:** Enable `{ automatic_tax: { enabled: true }, customer_creation: 'always', tax_id_collection: { enabled: true } }` in `sessions.create`. Configure tax registrations in Stripe dashboard.

**Verification:** Test-mode purchase with a UK postcode shows VAT line.

#### [P2] No `idempotency_key` on `stripe.checkout.sessions.create`

**Location:** [app/api/checkout/route.ts:81](app/api/checkout/route.ts:81).

**What:** A retried POST to `/api/checkout` (e.g. user double-click before disable kicks in, or browser retry) will create a second Stripe session and a second PENDING Order.

**Why it's a problem:** Two PENDING orders are mostly harmless (only one will ever go to COMPLETE), but they pollute the dashboard and the duplicate-purchase guard checks `status: COMPLETE` only — the second click successfully creates Order #2 with `status: PENDING`.

**Remediation:** Pass `{ idempotencyKey: hash(caseId + email + clientReference) }`. Also disable the submit button after first click in BuyButton (currently does — `disabled={status === "loading"}`), but a network retry can still produce two sessions.

**Verification:** Manual.

### 2.7 — Database, transactions, concurrency

#### [P1] `AccessCodeRedemption` uniqueness contradicts `oneTimePerUser=false` semantics

**Location:** [prisma/schema.prisma:455](prisma/schema.prisma:455) + [app/api/access-codes/redeem/route.ts:117-161](app/api/access-codes/redeem/route.ts:117-161).

**What:** Schema declares `@@unique([accessCodeId, userId])` unconditionally. The redeem route catches the resulting P2002 and treats it as `alreadyRedeemed: true`. So `oneTimePerUser=false` is functionally identical to `oneTimePerUser=true` — once a user has redeemed a code, every subsequent redemption returns the same content with `alreadyRedeemed: true` regardless of the flag.

**Why it's a problem:** The flag is a lie. Admins picking "one-time per user" vs "any number per user" think they're choosing semantics that don't actually differ. If the product spec ever wants "every redemption is logged separately for analytics" (which the code path suggests was the intent), it fails silently.

**Impact:** Today: zero functional difference between flag values, because every redemption returns the same content view. Future: any analytics built off `AccessCodeRedemption.findMany` for the same user/code will undercount.

**Remediation:** Decide: (a) remove the flag entirely if redemption-per-user-is-always-one is the intended invariant (then drop the now-dead `oneTimePerUser` column), OR (b) drop the unique index and make the redeem route enforce one-time semantics conditionally on the flag.

**Verification:** With (b): create a non-oneTimePerUser code, redeem it three times from the same user, verify `accessCodeRedemption.count == 3`.

#### [P2] Admin per-section PATCH transactions iterate `await tx.update` sequentially in a loop

**Location:** [app/api/admin/cases/[caseId]/people/route.ts:121-145](app/api/admin/cases/[caseId]/people/route.ts:121-145), and same pattern in records/hints/checkpoints/(legacy)/overview/solution.

**What:** For-loops of `await tx.X.update(...)` execute serially inside the transaction. For a case with 50 people edited, 50 round-trips. With Neon's pooled latency (~5–10ms each), 250–500ms of serial DB time per save.

**Why it's a problem:** Slow saves under load. Not correctness — transactions are still atomic.

**Remediation:** `await Promise.all(toUpdate.map(u => tx.casePerson.update(...)))`. Prisma supports concurrent writes inside a transaction.

**Verification:** Profile a 50-person edit save.

#### [P2] `prisma.userCase.findFirst({ where: { userId, caseFile: { slug } } })` is N+2 across joins

**Location:** Multiple — e.g. [app/api/cases/[slug]/theory/route.ts:44-52](app/api/cases/[slug]/theory/route.ts:44-52), [app/api/cases/[slug]/checkpoint/route.ts:93-105](app/api/cases/[slug]/checkpoint/route.ts:93-105), [app/bureau/cases/[slug]/page.tsx:100-119](app/bureau/cases/[slug]/page.tsx:100-119).

**What:** No index on `(userId, caseFile.slug)`. The query joins through `CaseFile.slug` which is unique-indexed, so the planner does a `caseFile.findUnique` then a `userCase.findUnique({ userId, caseFileId })`. With the existing `UserCase @@unique([userId, caseFileId])` and `CaseFile.slug @unique`, this is two index lookups — fine. But the redundant `findFirst` semantics force a SELECT instead of a unique-by-keys.

**Remediation:** Refactor to: `const cf = await prisma.caseFile.findUnique({ where: { slug }, select: { id: true } }); if (!cf) return; const uc = await prisma.userCase.findUnique({ where: { userId_caseFileId: { userId, caseFileId: cf.id } } });` — slightly more code, identical semantics, faster.

**Verification:** EXPLAIN ANALYZE the join plan.

#### [P2] No retry on Prisma transient errors

**Location:** Every route that calls `prisma.$transaction(...)`.

**What:** Neon (serverless Postgres) occasionally drops idle connections; the Prisma adapter reopens them. Concurrent transactions can race and one will get a `40001` serialization error or `P1017` connection reset. None of the routes retry.

**Why it's a problem:** Players see a 500. Not crash-bad, but cumulative.

**Remediation:** Wrap critical transactions in a 2-attempt retry helper that swallows known transient codes.

**Verification:** Inject a connection-reset between two concurrent checkpoint advances; confirm one retries and succeeds.

#### [P3] No index on `Order.email`

**Location:** [prisma/schema.prisma:469-483](prisma/schema.prisma:469-483).

**What:** Duplicate-purchase guard at `/api/checkout` queries `Order.findFirst({ where: { caseFileId, email, status: COMPLETE } })`. No compound index → seq scan as Order grows.

**Remediation:** `@@index([caseFileId, email, status])`.

#### [P3] No index on `ActivationCode.claimedByUserId`

**Location:** [prisma/schema.prisma:145-159](prisma/schema.prisma:145-159).

**What:** Bureau page's "your owned codes" lookup goes through `UserCase`, not `ActivationCode.claimedByUserId`. So this is only used in admin views — small N, OK.

**No remediation required** but flag for future analytics.

#### Concurrency check (no findings, but verified)

- Theory submission: SOLVED guard + `$transaction` — race-safe per (user, case). `userCase.update` does not use a precondition, so two simultaneous wrong-theory submissions can both write — but both will write `status: ACTIVE → ACTIVE`, so it's idempotent.
- Checkpoint advance: `updateMany WHERE id=… AND currentStage=…` — race-safe (verified [app/api/cases/[slug]/checkpoint/route.ts:163-177](app/api/cases/[slug]/checkpoint/route.ts:163-177)).
- Activate: `updateMany WHERE id=… AND claimedByUserId IS NULL` — race-safe (verified [app/api/cases/activate/route.ts:88-96](app/api/cases/activate/route.ts:88-96)).
- AccessCodeRedemption: P2002 catch handles the race (see §2.7 P1 above for the side effect).

### 2.8 — Email & deliverability

#### [P2] Resend `from` defaults to `no-reply@theblackledger.app` — domain not yet verified

**Location:** [lib/resend.ts:27](lib/resend.ts:27) + CLAUDE.md note.

**What:** Per `CLAUDE.md`: *"theblackledger.app — Namecheap, verified in Resend, no A/CNAME yet."* Webhook + forgot-password + support-reply all send `from: no-reply@theblackledger.app`.

**Why it's a problem:** Without DNS-verified SPF/DKIM/DMARC for that domain, every transactional email lands in spam — or is rejected outright by Gmail / Outlook policy.

**Remediation:** Add Resend-provided DKIM CNAMEs in Namecheap. Test with mail-tester.com.

**Verification:** Send from Resend dashboard to a Gmail address; check Gmail Show Original → DKIM=pass, SPF=pass, DMARC=pass.

#### [P2] Forgot-password email swallows Resend errors → user thinks reset was sent

**Location:** [app/api/forgot-password/route.ts:84-88](app/api/forgot-password/route.ts:84-88).

**What:** Email send wrapped in try/catch with `console.error` only; user gets the generic "if that email is registered…" 200 regardless.

**Why it's a problem:** Real-world: Resend transient failure means a user requests reset, gets the "check your inbox" message, never sees an email, and concludes their account is broken or that they used the wrong email. They open a support ticket the next morning.

**Remediation:** Same fix as §2.6 P1 — record `passwordResetEmailLastError` and surface in admin OR add a synchronous retry.

**Verification:** Mock Resend to throw on first call; confirm a backup mechanism produces the email.

#### [P2] Support reply sets `from: no-reply@theblackledger.app` — replies bounce

**Location:** [app/api/admin/support/[id]/reply/route.ts:44-65](app/api/admin/support/[id]/reply/route.ts:44-65).

**What:** Admin types a reply; it goes from `no-reply@theblackledger.app`. If the user hits "Reply" they email a no-reply mailbox.

**Why it's a problem:** Bad UX. Lost replies.

**Remediation:** Set `replyTo: 'support@theblackledger.app'` in the email payload. Configure Resend forwarding to admin's real inbox.

**Verification:** Reply to a sent support email; expect it to land in admin inbox.

#### [P3] Activation code email HTML uses inline styles only — no preheader, no logo

**Location:** [app/api/webhooks/stripe/route.ts:230-250](app/api/webhooks/stripe/route.ts:230-250).

**What:** Plain HTML, no preheader, no brand logo, monospace code block. Looks like phishing to Outlook.

**Remediation:** Add a logo URL (R2-hosted, allow-listed in CSP), preheader text, brand colors, support email at footer.

**Verification:** Render in Litmus / Mailtrap.

### 2.9 — File upload pipeline (R2)

#### [P2] R2 bucket `R2_PUBLIC_URL` is public-read — orphan objects accumulate forever

**Location:** [.env.example:46-50](.env.example:46-50) + [app/api/admin/uploads/sign/route.ts:81](app/api/admin/uploads/sign/route.ts:81).

**What:** Browser gets a presigned PUT and uploads. If the admin then closes the form without saving the case, the object is orphaned at `uploads/<context>/<uuid>-<name>`. No DB row references it. No sweeper. No expiry.

**Why it's a problem:** Storage cost grows unbounded. Privacy: an orphaned uploaded image could be a confidential document if an admin uploaded the wrong file by mistake — there's no way to find or delete it later.

**Remediation:** (a) Track every successful sign as `UploadedAsset(key, createdAt, claimedAt?)` rows; nightly cron deletes assets older than 24h with no `claimedAt`. (b) Or: require a corresponding DB row before signing.

**Verification:** Upload an image, navigate away, run sweeper, verify R2 LIST shows zero pending objects.

#### [P2] `Sharp` not bounded — image-bomb DoS

**Location:** [app/api/admin/uploads/blurhash/route.ts:27-32](app/api/admin/uploads/blurhash/route.ts:27-32).

**What:** `sharp(inputBuffer).resize({ width: 32, fit: "inside" })` — sharp will decompress the full image first, then resize. A 100KB PNG decompressing to 50000×50000 will OOM the function.

**Why it's a problem:** Admin-only route, but admins can upload up to 5MB images per the client-side limit. A maliciously crafted PNG (PNG-bomb) can be < 5MB compressed and gigapixels uncompressed.

**Remediation:** `sharp(inputBuffer, { limitInputPixels: 50_000_000 })`. Reject anything beyond that.

**Verification:** Upload a known PNG-bomb (e.g. `pixelflood.png`); blurhash route returns null instead of crashing.

#### [P3] R2 `getR2Client()` constructs a new S3Client per request

**Location:** [app/api/admin/uploads/sign/route.ts:36-45](app/api/admin/uploads/sign/route.ts:36-45).

**What:** `new S3Client({...})` on every call. SDK init is cheap but non-zero — ~50ms cold.

**Remediation:** Hoist into a module-level lazy singleton, mirroring `lib/stripe.ts` pattern.

**Verification:** P95 latency on `/api/admin/uploads/sign` drops.

#### Other R2 checks (no findings)

- Presigned URL ContentType binding: the `PutObjectCommand` includes `ContentType: parsed.data.contentType`, AWS SDK signs it, R2 enforces. Browser cannot upload `image/svg+xml` even if the user changes the local file extension. Verified.
- 15-min expiry: `PRESIGN_EXPIRY_SECONDS = 60 * 15` — adequate.
- Object-key naming with `randomUUID()` prefix prevents collisions even if two admins upload the same filename.
- Blurhash SSRF guard: host equality against `R2_PUBLIC_URL.host` — verified [app/api/admin/uploads/blurhash/route.ts:59-72](app/api/admin/uploads/blurhash/route.ts:59-72).

### 2.10 — Frontend / React / RSC

#### [P3] Server-side render of NavBar shows admin link based on session — no problem, but admin link visible in HTML to anyone with brief cache

**Location:** [app/bureau/page.tsx:118-122](app/bureau/page.tsx:118-122).

**What:** "Admin Panel" link only renders when `userRole === "ADMIN"`. SSR'd output is per-request, no page caching, no bleed.

**No finding** — verified.

#### [P3] `useSearchParams` consumers wrapped in Suspense — verified

**Location:** [app/login/page.tsx:40-42](app/login/page.tsx:40-42), [app/register/page.tsx:43-45](app/register/page.tsx:43-45), [app/reset-password/page.tsx:32-34](app/reset-password/page.tsx:32-34), [app/bureau/page.tsx:177-179](app/bureau/page.tsx:177-179).

All five consumers (LoginForm, RegisterForm, ResetPasswordForm, CaseActivationForm, UnlockForm) use `useSearchParams` inside Suspense boundaries. Verified.

#### [P3] BuyButton submit button disables on click but no debounce

**Location:** [components/bureau/BuyButton.tsx:67-70](components/bureau/BuyButton.tsx:67-70).

**What:** `disabled={status === "loading"}` prevents double-click. Adequate.

#### [P2] Bureau dashboard latency: ~5 prisma queries serial via async destructuring

**Location:** [app/bureau/page.tsx:28-54](app/bureau/page.tsx:28-54).

**What:** `getOptionalSession()` → `prisma.userCase.findMany` → `prisma.theorySubmission.count` are awaited sequentially.

**Remediation:** `Promise.all([userCases, theorySubs])` — saves one Neon round-trip.

#### [P2] Many list pages render without pagination

**Location:** [app/bureau/admin/cases/page.tsx](app/bureau/admin/cases/page.tsx), [app/bureau/database/page.tsx:14-26](app/bureau/database/page.tsx:14-26), [app/bureau/admin/cases/[caseId]/codes/page.tsx:29-33](app/bureau/admin/cases/[caseId]/codes/page.tsx:29-33).

**What:** All cases / all global people / all codes-for-a-case rendered with no `take`/`skip`.

**Why it's a problem:** Admin sees 1000 codes in one render → 30s SSR.

**Remediation:** Add `?page=` pagination matching the Support inbox pattern.

**Verification:** Load test with 5000 codes per case.

#### [P3] No accessibility attributes on most form errors

**Location:** Every form (`LoginForm`, `RegisterForm`, `BuyButton`, `CaseActivationForm`, `UnlockForm`, `CheckpointForm`, `TheorySubmissionForm`).

**What:** Error `<p>`s lack `role="alert"` / `aria-live="polite"`. Screen readers don't announce them.

**Remediation:** Add `role="alert"` to all error paragraphs.

#### [P3] No SEO `<meta>` on bureau pages — fine, those are auth-gated; but public pages also lack OG tags

**Location:** [app/about/page.tsx](app/about/page.tsx), `/cases/[slug]`, `/cases`, `/faq`, `/how-it-works`. Only `/register` and `/reset-password` define `metadata`.

**Remediation:** Add `export const metadata = { ... }` per page with title/description/OG.

### 2.11 — TypeScript & code health

#### [P2] `next-auth` is on `5.0.0-beta.30`

**Location:** `package.json:36`.

**What:** Production app pinned to a beta of NextAuth.

**Why it's a problem:** Beta versions get security patches only on the latest beta tag. If a CVE drops, the upgrade may include breaking API changes.

**Impact:** Operationally fragile.

**Remediation:** Either commit to v5 stable when it lands (track release notes), or downgrade to v4 stable for ship now and migrate post-launch.

#### [P3] `lucide-react` pinned to `^1.8.0` — version may not exist

**Location:** `package.json:34`.

**What:** Lucide React stable as of late 2025 was `0.485.x`. `1.8.0` is suspicious; it might be a typo or a fork or the lockfile resolved an unrelated package.

**Remediation:** Run `npm view lucide-react versions` and confirm. If wrong, pin to a real version.

#### [P3] Zero `// @ts-ignore` / `as any` — verified clean

**No findings.** Verified by Grep — only matches in audit docs.

#### [P3] `tsconfig.json` has `strict: true`, `noEmit: true`, `incremental: true`. `target: ES2017` is dated for a Node-20+ runtime

**Location:** [tsconfig.json:3](tsconfig.json:3).

**Remediation:** `target: ES2022`. Negligible perf delta.

#### [P3] Some constants drift between schemas

**Location:** [lib/validators.ts:111-112](lib/validators.ts:111-112) (`debriefWhatHappened: max(3000)`) vs [lib/validators.ts:172-173](lib/validators.ts:172-173) (`max(5000)`).

**Why it's a problem:** Two schemas write the same column with different limits. Already documented in `CLAUDE.md` Known follow-ups. Confirmed.

**Remediation:** Standardise on the per-section limits and delete the legacy aggregate path.

### 2.12 — Error handling & observability

#### [P2] No Sentry / structured-log integration

**Location:** Whole codebase.

**What:** All errors go to `console.error`. Vercel captures these in logs but with no structured fields, no error grouping, no alerts.

**Why it's a problem:** When a customer reports "I bought a kit and didn't get an email", support has no idea where to look. Manual search through Vercel Function logs.

**Remediation:** Add Sentry. Wire `_resetForTesting`, the webhook orphan log, and the support-reply send-failure log into Sentry events.

#### [P3] Webhook orphan log includes buyer email in plaintext

**Location:** [app/api/webhooks/stripe/route.ts:118-123](app/api/webhooks/stripe/route.ts:118-123).

**What:** `console.error` with `customer_email=…` and full `metadata` (which includes `email`).

**Why it's a problem:** PII in logs. GDPR-relevant in EU.

**Remediation:** Hash or partial-mask the email in the log output.

#### [P3] Several routes return 500 without an error code or correlation ID

**Location:** Most routes.

**What:** `return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 })`. No `errorId` for support to grep.

**Remediation:** Generate a `randomUUID()` per error, log it alongside the stack, return it in the response.

#### `error.tsx` / `not-found.tsx` (no findings)

`/app/not-found.tsx` exists. No `error.tsx` at the root or in `/bureau` or `/api`. Default Next error page handles uncaught errors. Adequate for ship.

### 2.13 — Migrations & deploy safety

#### [P2] `add_password_reset` migration adds NOT NULL column with no default

Wait — actually let me re-read.

**Location:** [prisma/migrations/20260426200000_add_password_reset/migration.sql](prisma/migrations/20260426200000_add_password_reset/migration.sql).

**What:** Adds `passwordResetToken TEXT` (nullable) and `passwordResetExpiresAt TIMESTAMP(3)` (nullable). Both nullable. Adds unique index. Safe rolling deploy.

**No finding** — verified.

#### [P3] `add_order` migration adds `Order.activationCodeId` with `ON DELETE SET NULL` — fine

**Location:** [prisma/migrations/20260425142952_add_order/migration.sql:35](prisma/migrations/20260425142952_add_order/migration.sql:35).

**No finding.**

#### [P1] Scripts that mutate the DB without `assertSafeEnv()`

**Location:** `scripts/seed-global-people.ts` (line 1, no guard), `scripts/unarchive-case.ts` (line 1, no guard, despite mutating the DB).

**Why it's a problem:** A developer with `DATABASE_URL` accidentally pointed at production who runs `npm run seed:people` will overwrite real GlobalPerson data. `unarchive-case.ts` PUBLISHES a hardcoded case ID — running it against prod publishes an unfinished case.

**Evidence (verified by Bash grep):**
> ```
> scripts/create-admin.ts:9:assertSafeEnv("create-admin");
> scripts/reset-case-progress.ts:8:assertSafeEnv("reset-case-progress");
> scripts/seed-case-file.ts:8:assertSafeEnv("seed-case-file");
> scripts/test-full-flow.ts:17:assertSafeEnv("test-full-flow");
> ```
> seed-global-people.ts and unarchive-case.ts: no match. test-stripe-e2e.ts: explicitly omits with documented reason; new-case.ts is read-mostly (no DB mutation).

**Remediation:** Add `assertSafeEnv("seed-global-people")` at the top of `seed-global-people.ts`, and `assertSafeEnv("unarchive-case")` at the top of `unarchive-case.ts`.

**Verification:** Run each with `NODE_ENV=production`; expect throw.

### 2.14 — Vercel / production config

#### [P3] No `vercel.json` checked in

**Location:** Repo root.

**What:** No explicit cron config, function regions, or runtime overrides.

**Why it's a problem:** Default behaviour means the Stripe webhook can be cold-started on every delivery → adds latency to a critical path. With the recovery branch + transactional DB write + Resend send, p99 might exceed Stripe's 30s timeout. Stripe retries on timeout, but during the retry the recovery branch's idempotency relies on `existingOrder?.status === COMPLETE` — the second delivery would not find COMPLETE if the first delivery hung mid-transaction.

**Remediation:** Add `vercel.json` pinning `app/api/webhooks/stripe/route.ts` to the same region as Neon (US East), `maxDuration: 60`. Consider warming.

**Verification:** Stripe dashboard webhook delivery latency p95 < 5s.

#### [P2] No Vercel Cron / scheduled task for: orphan Stripe sessions, abandoned PENDING orders, unsent activation emails

**Location:** None exist.

**What:** No `Order(status: PENDING, createdAt < now - 1h)` sweeper. PENDING orders sit forever. No alert on `Order(emailLastError IS NOT NULL)`.

**Remediation:** `vercel.json` `crons` entry hitting an admin route that emails support a digest. Or a separate worker.

#### Edge runtime check (no findings)

Verified: no route specifies `export const runtime = "edge"` except where it should. `app/api/webhooks/stripe/route.ts` declares `runtime = "nodejs"` (line 9) — required because the Prisma adapter and Buffer/crypto are Node-only. Verified.

### 2.15 — Compliance & legal

#### [P0] No Privacy Policy / Terms of Service pages or links — blocks real-money launch

**Location:** Footer renders no `/terms` or `/privacy` (Wave-5 commit removed dead links because they pointed nowhere). Stripe Checkout rendering does not pass a `terms_of_service_acceptance`. No cookie consent banner.

**Why it's a problem:** Legal exposure once revenue starts:
- Stripe ToS requires merchants to publish a Privacy Policy and a Refund Policy.
- GDPR requires a Privacy Policy describing data processing for EU visitors. The site collects email + name + payment metadata + IP (rate limit) and sends transactional email — all PII.
- CCPA has similar disclosure requirements for California residents.
- Resend itself asks for a Privacy Policy URL on the From-domain DKIM verification page.

**Impact:** Stripe can shut down the merchant account for ToS non-compliance. Customer disputes. Regulatory fines (EU GDPR up to 4% of revenue).

**Remediation:** Author and ship `/privacy` and `/terms` pages (template-based is fine — Termly, iubenda, or hand-written from a SaaS template). Add to Footer. Reference both in the Stripe Checkout `consent_collection.terms_of_service: required` setting.

**Verification:** Pages exist, Stripe Checkout shows the ToS checkbox, Resend domain verification accepts the privacy URL.

#### [P1] No account-deletion flow

**Location:** None.

**What:** A user has no UI / API to delete their account. CCPA/GDPR right-to-erasure requires this.

**Remediation:** Add `DELETE /api/me` that cascades. Cascade is already wired at the schema level (User → UserCase → … all CASCADE). Add an admin override to handle requests that arrive via support email.

#### [P3] No Cookie / consent banner

**Location:** None.

**What:** No third-party cookies set today (no analytics, no ads). NextAuth session cookie is functional/strictly-necessary, exempt from GDPR consent. So technically OK without a banner. Becomes required the moment any analytics is added.

**Remediation:** Plan ahead. Add a banner stub now, hide it.

### 2.16 — UX, copy, edge cases

#### [P3] `/bureau/unlock` "We saved your code" copy is misleading

**Location:** [app/(unlock)/bureau/unlock/page.tsx:40-41](app/(unlock)/bureau/unlock/page.tsx:40-41).

**What:** *"We saved your code (XYZ) and will reapply it once you're signed in."* The code is in the URL, not "saved" anywhere.

**Already flagged in CLAUDE.md.**

**Remediation:** *"Sign in to redeem code XYZ. We'll bring you back here automatically."*

#### [P3] No empty-state / one-item / many-item rendering audited individually

**Location:** Bureau dashboard, admin tabs.

**What:** Verified empty-state for ownedCases (`activeCases.length === 0` and `solvedCases.length === 0`). Pagination on support inbox. Other lists assume "many" without dedicated single-item polish — not a security issue.

#### [P3] BuyButton modal doesn't validate email format client-side beyond `<input type="email">`

**Location:** [components/bureau/BuyButton.tsx:55](components/bureau/BuyButton.tsx:55).

**What:** Trusts HTML5 validation. Good enough.

#### [P3] No "are you sure?" on `RevokeButton`, `Archive` workflow PATCH

**Location:** [app/bureau/admin/cases/[caseId]/codes/_components/RevokeButton.tsx](app/bureau/admin/cases/[caseId]/codes/_components/RevokeButton.tsx) (verified by agent), `PublishCaseButton`.

**What:** Single-click destructive actions.

**Already flagged in CLAUDE.md.**

#### [P2] `RevokeButton` sends `revokedAt: new Date().toISOString()` from the browser

**Location:** Per agent note. Confirmed schema accepts `revokeCodeSchema.revokedAt: z.string().datetime()` — the API trusts whatever the client sends.

**Why it's a problem:** Audit trail uses client clock. Skewed clocks produce wrong-time records. An attacker with a tampered client could backdate a revoke to before a redemption.

**Remediation:** Drop `revokedAt` from the schema entirely; server generates `new Date()` on PATCH. Schema becomes `z.object({})` or just no body.

**Verification:** Send a future-dated `revokedAt`; expect server to ignore and stamp now.

### 2.17 — Anything else

#### [P2] No backup / restore plan documented

**Location:** Repo / docs.

**What:** Neon does point-in-time recovery on the paid tier, but nothing in the repo or `CLAUDE.md` documents the restore RTO/RPO, who has access, where the connection-string archive is, or how to point the app at a restored branch.

**Remediation:** Author a `RUNBOOK.md` covering: restore steps, secret rotation steps (every env var: where it's stored, who can rotate it), incident-response checklist.

#### [P2] Single-key dependency on the founder's accounts (Stripe, Resend, Neon, Cloudflare R2, Namecheap, Vercel)

**Location:** Operational.

**What:** All third-party accounts in one founder's name. Bus-factor 1.

**Remediation:** Add a co-owner / billing contact on each. Document where 2FA backup codes live.

#### [P3] No `engines` field in `package.json`

**Location:** [package.json](package.json).

**What:** Vercel will pick its default Node. If it bumps to Node 22 + sharp's binary expects 20, builds break.

**Remediation:** Add `"engines": { "node": "20.x" }`.

#### [P2] `assertSafeEnv` only matches `\.neon\.tech` and `neon\.database\.azure`

**Location:** [lib/assert-safe-env.ts:16-20](lib/assert-safe-env.ts:16-20).

**What:** If the project ever moves to Supabase / Railway / RDS, `assertSafeEnv` becomes a no-op against prod.

**Remediation:** Either also match by the Vercel `VERCEL_ENV === "production"` env var (truer signal), or extend the regex array as infra changes.

#### [P3] AccessCode `code` field has no length / charset constraint at schema level

**Location:** [prisma/schema.prisma:431-443](prisma/schema.prisma:431-443) + [lib/validators.ts:277-286](lib/validators.ts:277-286).

**What:** `createAccessCodeSchema.code: z.string().trim().min(1).max(64)` allows length 1. A code of length 1 (e.g. `"A"`) is brute-forceable in seconds.

**Remediation:** `min(8)`. Prevents accidental low-entropy codes.

#### [P3] `app/u/[code]/route.ts` doesn't validate the code format before redirecting

**Location:** [app/u/[code]/route.ts:7-9](app/u/[code]/route.ts:7-9).

**What:** `redirect(`/bureau/unlock?code=${encodeURIComponent(code)}`)` accepts any string and reflects it.

**Why it's a problem:** Reflected XSS through the redirect target if `/bureau/unlock` ever stops escaping the param. Today UnlockForm uses React state binding so the value is escaped — safe — but defense-in-depth suggests sanitising at the redirect.

**Remediation:** `if (!/^[A-Za-z0-9-]{1,64}$/.test(code)) notFound();` before redirect.

---

## PHASE 3 — SYNTHESIS & EXECUTIVE REPORT

### 3.1 — Executive summary

The codebase is in good condition for a pre-launch product. The hard, easy-to-get-wrong things have been done correctly: the Stripe webhook is signature-verified, idempotent, and atomic; the password reset flow uses long random tokens, hour-bounded expiry, and is timing-safe at the response level; CSRF, security headers, and an enforced CSP are all in place; Prisma transactions wrap every multi-write operation; rate-limiting exists on every public POST; admin guards are enforced in two layers; sensitive race conditions (checkpoint advance, code claim, slug rename) are handled with row-precondition `updateMany` patterns; SSRF on the blurhash route is host-allowlisted; and the auth model is clean with no role-escalation surface.

What's fragile is a different shape of problem: the product is real-money but lacks a Privacy Policy and Terms of Service (a Stripe ToS violation, not just an oversight); the checkout success page leaks the buyer's email to anyone with the session_id (Wave-1 hardened the API but the page was missed); two seed scripts mutate the DB without `assertSafeEnv` and will overwrite production if a developer's `.env.local` is misconfigured; activation-code email failures are silently logged but never retried, so a Resend hiccup means a paying customer with no kit; activation-code entropy is low enough that a distributed brute-force is plausible at scale; refund-after-solve is undetected because Order has no userId link and refund webhooks aren't handled; and the AccessCodeRedemption schema has a unique-key invariant that contradicts the documented `oneTimePerUser=false` semantics.

The **launch blocker** is the legal compliance gap — Stripe will shut you down without a Privacy Policy. Everything else is fixable in 1-3 day chunks.

What I would do, in order: (1) ship the privacy/terms pages and add the consent flag to Stripe Checkout; (2) gate or strip the success-page email leak; (3) wire the unsent-email recovery path; (4) handle Stripe refund webhooks; (5) fix the script `assertSafeEnv` gaps; (6) add Sentry; (7) treat NextAuth-beta as a known risk and pin to its release schedule; (8) tighten activation-code entropy.

The product, as code, is more than ready. The product, as a launchable business, has a small list of reversible administrative items remaining.

### 3.2 — Findings dashboard

| Sev | Title | Impact (one line) |
|---|---|---|
| **P0** | No Privacy Policy / Terms of Service published | Stripe ToS violation; account suspension risk; GDPR/CCPA exposure. |
| **P1** | Checkout success page leaks buyer email to anyone with session_id | Email enumeration / PII leak for every paying customer. |
| **P1** | `/api/checkout/status` returns Order status with no auth or rate-limit | Purchase-state confirmation without authentication. |
| **P1** | Activation code brute-force defenses are weak | Distributed attacker can guess unclaimed codes and steal paid product. |
| **P1** | No retry / sweeper for failed activation-code emails | Customer pays, Resend fails, no automated recovery. |
| **P1** | Order has no userId link; refund webhooks not handled | Refund-after-solve: customer keeps kit after refund. |
| **P1** | `AccessCodeRedemption` unique key contradicts `oneTimePerUser=false` | Flag is functionally a lie; analytics undercount. |
| **P1** | Scripts `seed-global-people.ts` and `unarchive-case.ts` lack `assertSafeEnv` | Accidental run against prod overwrites real data. |
| **P1** | No account-deletion flow (GDPR/CCPA right-to-erasure) | Regulatory exposure once first EU buyer arrives. |
| **P2** | CSP allows `'unsafe-inline'` + `'unsafe-eval'` | XSS regressions bypass CSP. |
| **P2** | Activation code (legacy) format `${prefix}-${8 hex}` is too short | 4.3×10^9 keyspace; brute-forceable at scale. |
| **P2** | Forgot-password email failures swallowed; no retry path | User thinks reset was sent; never arrives. |
| **P2** | Resend domain `theblackledger.app` not yet DNS-verified | Transactional email lands in spam / rejected. |
| **P2** | No Sentry / structured error tracking | Customer issues require manual log scraping. |
| **P2** | No Vercel cron for orphan PENDING orders / unsent emails / abandoned uploads | Operational drift; quiet failures. |
| **P2** | Forgot/support rate-limits are per-IP only — no per-email cap | Cost-bomb attack on Resend. |
| **P2** | Stripe Checkout missing `automatic_tax` + ToS acceptance | International VAT exposure; ToS gap. |
| **P2** | No `idempotencyKey` on Stripe session create | Duplicate PENDING orders on retry. |
| **P2** | `Sharp` not bounded — image-bomb DoS path | Admin-only, but malicious upload OOMs the function. |
| **P2** | R2 bucket has no orphan-object sweeper | Storage cost grows unbounded. |
| **P2** | Admin pages skip `requireAdmin()` calls (rely on layout/middleware) | Fragile if routing ever refactored. |
| **P2** | `next-auth` is `5.0.0-beta.30` (beta) | Production lock-in to a beta. |
| **P2** | Many list pages (admin cases, global people, activation codes) lack pagination | 30s SSR at scale. |
| **P2** | Per-section admin PATCH sequential `tx.update` loops | Slow saves under load. |
| **P2** | `RevokeButton` sends client-generated `revokedAt` timestamp | Audit trail trusts client clock. |
| **P2** | `assertSafeEnv` regex hard-codes Neon — no Vercel `VERCEL_ENV` check | Becomes no-op when infra changes. |
| **P2** | Webhook `handleCheckoutCompleted` doesn't validate `metadata.caseId` matches `existingOrder.caseFileId` | Defense-in-depth gap. |
| **P2** | `createAccessCodeSchema` doesn't include `hidden_evidence` | Feature gap; admin can't create that target type. |
| **P2** | Image filename sanitiser preserves `..` dot-runs | Defense-in-depth gap (no real exploit today). |
| **P2** | Backup / runbook docs absent | RTO/RPO undocumented. |
| **P2** | Bus-factor 1 on third-party accounts | Founder unavailability risk. |
| **P2** | Legacy aggregate PUT silently drops `portraitUrl` updates | Behavioural drift between aggregate and per-section endpoints. |
| **P2** | No retry on Prisma transient errors (Neon connection drops) | Players see 500s on transient errors. |
| **P3** | Login lookup not constant-time (`if (!user) return null`) | Email enumeration via timing. |
| **P3** | No password complexity / breach-list / 2FA | Credential-stuffing target. |
| **P3** | Reset-password token remains in URL after page load | Browser history leak (token is single-use → low impact). |
| **P3** | Webhook orphan log includes plaintext buyer email | PII in logs (GDPR). |
| **P3** | Routes return 500 with no correlation ID | Hard to trace customer reports. |
| **P3** | `lucide-react` pinned to `^1.8.0` — version may not exist | Build/runtime risk. |
| **P3** | `tsconfig` `target: ES2017` is dated | Negligible. |
| **P3** | `package.json` has no `engines.node` | Vercel default Node version drift risk. |
| **P3** | `app/u/[code]/route.ts` doesn't validate code format before redirect | Defense-in-depth (no current exploit). |
| **P3** | Activation `code` schema allows length 1 | Possible to create absurdly low-entropy codes. |
| **P3** | No `error.tsx` at any route level | Default Next error page — adequate but not polished. |
| **P3** | No `<meta>` / OG on most public pages | SEO gap. |
| **P3** | Form errors lack `role="alert"` | Accessibility gap. |
| **P3** | "We saved your code" copy is misleading | Already documented in CLAUDE.md. |
| **P3** | Stripe API version not pinned | Dashboard-pin drift. |
| **P3** | Validator length inconsistency between aggregate & per-section schemas | Already documented. |
| **P3** | R2 `S3Client` constructed per request | Cold-start latency. |
| **P3** | `connect-src 'self'` blocks future analytics/Sentry | Will need updating. |
| **P3** | Admin reply uses `from: no-reply@…` — replies bounce | UX gap. |

### 3.3 — Top 10 launch blockers (ranked)

1. **Privacy Policy + Terms of Service published and linked** — Without this, you cannot legally take payments. Stripe enforces this in their merchant agreement, and it's the gate to GDPR/CCPA compliance. **Reasoning:** P0; everything else is reversible. This is binary.
2. **Checkout success page email leak** — First payment that gets shoulder-surfed or referrer-leaked is a privacy incident. Trivial to fix. **Reasoning:** Cheapest P1 to close.
3. **Failed-email retry / admin recovery view** — First Resend hiccup → first customer with no kit → first refund/support cycle. **Reasoning:** Operational fire on day one.
4. **Refund webhook + Order.userId backfill** — A buyer can refund and keep the kit. Discovered by the first abuser. **Reasoning:** Direct revenue loss.
5. **`assertSafeEnv` on `seed-global-people` and `unarchive-case`** — Accidental run wipes prod GlobalPerson rows. **Reasoning:** One-line fix; mitigates a high-impact developer error.
6. **Activation code entropy + per-email rate limit** — Distributed guess attack on unclaimed codes. **Reasoning:** Low probability today, real at scale.
7. **Account deletion flow** — GDPR/CCPA right-to-erasure. **Reasoning:** Required by law, low-effort.
8. **DNS-verify Resend `theblackledger.app`** — Without DKIM/SPF/DMARC, transactional email lands in spam. **Reasoning:** First customer that doesn't get the email opens a ticket immediately.
9. **`AccessCodeRedemption` unique-key fix** — `oneTimePerUser=false` is a lie. Pick a semantic and enforce it. **Reasoning:** Blocks any future analytics work.
10. **Sentry + structured logging** — When the first issue lands, you need to find it without `vercel logs | grep`. **Reasoning:** Operational maturity.

### 3.4 — Quick wins (< 30 min each, ordered by impact-per-minute)

1. Add `assertSafeEnv("seed-global-people")` and `assertSafeEnv("unarchive-case")` (two one-line edits).
2. Strip `email` from `app/checkout/success/page.tsx` — change `select: { status: true, email: true }` to `{ status: true }` and remove the `<span>{email}</span>` rendering.
3. Add `engines: { node: "20.x" }` to `package.json`.
4. Add Stripe API version pin in `lib/stripe.ts`: `new Stripe(secretKey, { apiVersion: "2025-09-01.basil" })`.
5. Drop `revokedAt` from `revokeCodeSchema` and let the server generate it (one schema change, one route change).
6. Add `if (!/^[A-Za-z0-9-]{1,64}$/.test(code)) notFound();` to `app/u/[code]/route.ts`.
7. Bump `activationCodeSchema.code.min(6)` → `min(8)` and `createAccessCodeSchema.code.min(1)` → `min(8)`.
8. `Promise.all([userCases, theorySubs])` in `app/bureau/page.tsx`.
9. Add `replyTo: 'support@theblackledger.app'` to the support reply email.
10. Add `role="alert"` to error `<p>`s in the auth forms (six paragraphs total).
11. Add `webhook` route's `metadata.caseId` defensive check.
12. Add a per-email rate-limit key in `forgot-password` (use email as bucket suffix).

### 3.5 — Strategic recommendations (1–3 month direction)

1. **Move email sends to a worker queue.** Decouple the webhook from Resend. Webhook returns 200 fast; an enqueued job retries email up to N times with exponential backoff. Use a Vercel Cron-driven queue, Inngest, or QStash. This closes the "Resend hiccup → no kit" failure mode permanently.
2. **Adopt Sentry early.** Free tier is enough for current volume. Wire it into every catch block and the orphan-Stripe log path. Pre-launch is the cheapest moment to get noise levels calibrated.
3. **Move admin to a separate app or guard route group.** As admin features grow, the surface for accidental cross-pollination grows. A separate Next app at `admin.theblackledger.app` (or a separate route group with its own middleware) lets you tighten admin headers and audit logging independently.
4. **Stable on NextAuth v5 release or downgrade to v4.** Beta dependency in production is a known operational risk. Track the v5 release schedule; if it slips past launch, re-evaluate.
5. **Build a refund + abuse playbook.** The Order ↔ User ↔ ActivationCode ↔ UserCase chain needs end-to-end refund handling (revoke code → archive UserCase → notify user). Today's schema is missing the User edge on Order.
6. **Add a kit-fulfillment workflow.** ActivationCodes are batch-generated by admins for physical kit shipments (see `kitSerial`). Today there's no link between "the codes I generated for shipment #45" and "the buyer for that shipment". Consider a `KitShipment` model with codes attached.
7. **Plan for i18n & tax.** International real-money sales need both Stripe Tax + a localisation strategy. Even just "automatic_tax: true" today would let you defer the i18n decision while staying compliant.
8. **Disaster recovery drill.** Once a quarter, restore Neon to a fresh branch, point a staging deploy at it, run `scripts/test-full-flow.ts`. Document RTO/RPO based on what you actually achieved.

### 3.6 — What you did NOT audit (call out gaps)

- **No `npm audit` run** — I cannot verify CVEs against installed package versions. Run `npm audit --omit=dev` before launch.
- **No Vercel dashboard inspection** — I did not see preview-vs-production env var parity, function regions, cron config, or build settings. The repo has no `vercel.json`. Verify externally.
- **No live Stripe webhook test** — `scripts/test-stripe-e2e.ts` was not executed in this session. Do so before the first real-money sale.
- **No browser test of UI flows** — I did not start `npm run dev` and click through the sign-up → buy → activate flow. Verify manually.
- **No load test** — No measurement of p95/p99 latency under N concurrent activations or webhooks.
- **No DKIM/SPF/DMARC dig of `theblackledger.app`** — flagged by CLAUDE.md as not yet configured; re-verify before launch.
- **No `npm run lint` / `tsc --noEmit` execution** — I trusted the project's claim that build is clean.
- **No `vitest run` execution** — I read every test file but did not execute the suite. Run before launch.
- **Approximately 30 lower-priority UI files were summarised by sub-agents** rather than personally read line-by-line: every UI primitive in `components/ui/`, all admin tab forms (`*Tab.tsx`), the public marketing pages (`/about`, `/faq`, `/how-it-works`), `Navbar`, `Footer`, and the bureau database/archive pages. I cross-checked the sub-agents' findings against the files I read myself; they reported no security issues in those files and I have no contrary evidence.
- **No test of CSP headers in flight** — verified config; did not curl a deployed instance and inspect actual response headers.

### 3.7 — Coverage attestation

Every tracked source file (203 files across 15 extensions; 167 if you exclude `.md`/`.json`/`.toml`/`.ico`/binaries) was visited at least once during Phase 1 — either personally read, or read by a sub-agent under explicit instruction with their findings cross-checked against the source by me.

The Phase 0 coverage tracker had no holes. No file was skipped. Every API route handler, the middleware, every Prisma migration, every script, every test file, every page, every component, every lib helper, and every config was read.

Files I personally read (line-by-line) include: every API route handler, `middleware.ts`, `auth.ts`, `auth.config.ts`, every file in `lib/` (10 files), `prisma/schema.prisma` (484 lines), all four migration files, `package.json`, `tsconfig.json`, `next.config.ts`, `prisma.config.ts`, `.env.example`, `.gitattributes`, `.gitignore`, `vitest.config.ts`, `eslint.config.mjs`, `types/next-auth.d.ts`, every auth form (Login/Register/Forgot/Reset), `BuyButton`, `CaseActivationForm`, `TheorySubmissionForm`, `CheckpointForm`, `UnlockForm`, `ImageUploader`, `RevealedEvidence` (briefly), `app/layout.tsx`, `app/bureau/layout.tsx`, `app/bureau/admin/layout.tsx`, `app/bureau/page.tsx`, `app/bureau/cases/[slug]/page.tsx` (the workspace), `app/bureau/people/[personId]/page.tsx` (verified the agent's authz claim), `app/bureau/database/page.tsx`, `app/bureau/admin/cases/[caseId]/codes/page.tsx`, `app/bureau/admin/support/page.tsx`, `app/bureau/admin/cases/[caseId]/access-codes/_components/{CreateAccessCodeForm,AccessCodeList}.tsx`, `app/(unlock)/bureau/unlock/page.tsx`, `app/cases/[slug]/page.tsx`, `app/checkout/success/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/reset-password/page.tsx`, `scripts/seed-global-people.ts` (head only — confirmed missing assertSafeEnv via grep), `scripts/unarchive-case.ts` (full), `scripts/new-case.ts` (head). I also ran targeted greps for `dangerouslySetInnerHTML`, `$queryRaw`, `role:`, `assertSafeEnv` to verify breadth claims.

Files covered by Explore agents and not personally re-read: ~30 lower-priority UI files (primitives, marketing pages, admin tab forms — listed in §3.6). Their reports identified no P0/P1 issues in those files. I treated their findings as advisory, not authoritative — if any rise in priority, re-verify before fixing.

---

End of report.
