## Black Ledger — Project State (updated 2026-04-26)

### Current status
Registration system COMPLETE — 101 commits on origin/main, all pushed. 157 Vitest tests passing. Build clean. PostgreSQL on Neon. Stripe Checkout live. Full registration + password reset + purchase deep-link flow implemented 2026-04-26.

### Week 1 — Completed commits (closed 2026-04-20)
All P0 bugs from the original audit closed. 11 commits.

Notable changes:
- lib/case-evaluation.ts — Jaccard + exact-name matcher (replaces substring)
- lib/user-case-state.ts — monotonic state machine, SOLVED is terminal
- lib/enums.ts — browser-safe enum mirrors (no Prisma client import)
- lib/labels.ts — human-readable label constants
- lib/validators.ts — child entity schemas include id + globalPersonId
- types/next-auth.d.ts — Session/JWT typed with id + role
- prisma/schema.prisma — UserRole, UserCaseStatus, CaseWorkflowStatus, TheoryResultLabel enums; CaseAudit model; debriefSectionTitle + debriefIntro on CaseFile
- app/api/admin/cases/[caseId]/route.ts — diff/upsert PUT, CaseAudit trail, no more deleteMany+createMany
- app/api/cases/[slug]/advance/route.ts — DELETED (privilege escalation)
- components/bureau/AdvanceReviewButton.tsx — DELETED

### Week 2 — Completed commits (closed 2026-04-20)
5 commits, in order:
- ee1cba7  fix(checkpoint): replace substring matcher with normalizeIdentity + Jaccard
- 60e2dca  feat(security): token-bucket rate limiting on 5 API routes + Upstash Redis prod adapter
- e965205  feat(security): add security headers + CSP report-only to next.config.ts
- 5d17eab  refactor(auth): consolidate guards into lib/auth-helpers.ts, add UserRole to lib/enums.ts
- 1b87d00  feat(security): CSRF origin gate in middleware + consolidate workflow PATCH, remove toggle routes

### Week 3 — Completed commits (closed 2026-04-20)
5 commits, in order:
- 271a78e  feat(admin): tabbed case editor — 6 tab components + per-section PATCH endpoints
- c0a4fb6  feat(admin): activation code management page — batch generate, revoke, CSV export
- 1eedc93  feat(admin): image upload pipeline — R2 presigned URLs, blurhash, ImageUploader component
- 350ecd6  feat(admin): support inbox — paginated list, detail view, status actions, reply stub
- 6d8421b  feat(admin): slug history + 301 redirect — CaseSlugHistory model, rename tracking, page-level redirect

### Week 4 — Completed commits (closed 2026-04-22)
5 commits, in order:
- e616159  chore: delete orphaned EditCaseContentForm, fix CLAUDE.md commit count + follow-ups
- 11a3f1d  feat(schema): AccessCode + HiddenEvidence models for physical-to-digital bridge
- 25a21cb  feat(unlock): /bureau/unlock page + /api/access-codes/redeem endpoint
- ae992fa  feat(workspace): revealed evidence section — AccessCodeRedemption render at workspace load
- e0a321  feat(admin): AccessCode creator + QR generator + /u/[code] short redirect
- ed892ad  chore(test): add full-flow regression script — 57 checks across all 4 weeks
- 5908e1d  fix(workspace): guard slug-history redirect against self-redirect loop

### Architecture / key files
- lib/case-evaluation.ts — Jaccard + exact-name matcher (theory submissions)
- lib/text-utils.ts — shared tokenize/normalizeIdentity used by both theory + checkpoint matchers
- lib/user-case-state.ts — monotonic state machine, SOLVED is terminal
- lib/rate-limit.ts — token-bucket per (ip, route); in-memory dev, Upstash Redis prod
- lib/auth-helpers.ts — requireSession(), requireAdmin(), getOptionalSession(), requireSessionJson()
- lib/assert-safe-env.ts — assertSafeEnv() guard used by scripts; blocks run if DATABASE_URL matches Neon patterns
- lib/prisma.ts — PrismaPg adapter (@prisma/adapter-pg); loads .env.local first, .env as fallback; DATABASE_URL = pooled Neon URL
- prisma.config.ts — datasource.url = DIRECT_URL ?? DATABASE_URL (migration commands use direct URL, bypass pooler)
- lib/enums.ts — browser-safe const mirrors of ALL 9 Prisma enums (UserRole, TheoryResultLabel, UserCaseStatus, CaseWorkflowStatus, ActivationCodeSource, OrderStatus, SupportMessageStatus, AccessCodeKind, HiddenEvidenceKind)
- lib/labels.ts — human-readable label constants
- lib/validators.ts — Zod schemas; uploadSignSchema uses strict MIME allowlist (jpeg/png/webp/gif only); per-section PATCH schemas + upload + support schemas
- lib/post-login-path.ts — same-origin callbackUrl sanitizer
- types/next-auth.d.ts — Session/JWT augmented with id + role
- prisma/schema.prisma — all enums + models; migrations: 20260425045353_init, 20260425142952_add_order, 20260426163724_add_order_email_tracking (emailSentAt + emailLastError on Order)
- next.config.ts — security headers + enforced CSP (script-src has 'unsafe-inline'/'unsafe-eval' for Next.js/Framer; R2 origin injected into img-src from R2_PUBLIC_URL)
- middleware.ts — CSRF origin check via new URL(origin).origin comparison (prevents subdomain bypass); auth gating for /bureau/* and /api/admin/*; /bureau/unlock carved out before bureau gate
- app/(unlock)/bureau/unlock/ — public QR landing page (route group, outside bureau layout hierarchy to bypass requireSession)
- app/bureau/layout.tsx — requireSession() for all real bureau pages
- app/api/admin/cases/[caseId]/route.ts — diff/upsert PUT with CaseAudit trail (legacy aggregate; tabs are now the primary editor)
- app/api/admin/cases/[caseId]/workflow/route.ts — unified PATCH for workflow transitions
- app/bureau/admin/cases/[caseId]/edit/_components/ — 6 tab components (Overview/People/Records/Hints/Checkpoints/Solution)
- app/api/admin/cases/[caseId]/overview|people|records|hints|checkpoints|solution/route.ts — per-section PATCH endpoints with diff/upsert + CaseAudit
- app/bureau/admin/cases/[caseId]/codes/ — activation code management (batch generate, revoke, CSV export)
- app/api/admin/cases/[caseId]/codes/route.ts — GET (list + ?format=csv) + POST (batch generate, rate-limited)
- app/api/admin/cases/[caseId]/codes/[codeId]/route.ts — PATCH (revoke)
- app/api/admin/uploads/sign/route.ts — R2 presigned PUT URL (15-min expiry, rate-limited); contentType validated against strict MIME allowlist
- app/api/admin/uploads/blurhash/route.ts — best-effort blurhash via sharp; SSRF-guarded against R2_PUBLIC_URL host allowlist
- components/admin/ImageUploader.tsx — client component: sign → PUT → onChange + blurhash
- app/bureau/admin/support/ — support inbox (paginated list + detail + status actions + reply)
- app/api/admin/support/[id]/reply/route.ts — Resend email reply; marks message HANDLED on success; 502 on transport error
- app/api/admin/support/[id]/status/route.ts — status PATCH
- .env.example — all env vars documented
- app/api/access-codes/redeem/route.ts — POST, rate-limited 5/60s; checks retiredAt (retiredAt = soft-delete); resolves unlocksTarget including hidden_evidence branch
- app/(unlock)/bureau/unlock/_components/UnlockForm.tsx — auto-submits on ?code= param; callbackUrl preserved through auth bounce
- app/bureau/cases/[slug]/_components/RevealedEvidence.tsx — renders AccessCode-unlocked evidence (record/person/hint/hidden_evidence) with Framer Motion
- app/api/admin/cases/[caseId]/access-codes/route.ts — GET (list with redemption counts) + POST (create)
- app/u/[code]/route.ts — short URL redirect to /bureau/unlock?code=<code>
- lib/stripe.ts — lazy singleton Stripe client
- lib/resend.ts — lazy singleton Resend client
- app/api/checkout/route.ts — POST guest checkout; duplicate-purchase guard returns 409 if COMPLETE order already exists for (caseId, email)
- app/api/checkout/status/route.ts — GET by session_id; returns { status } only (email stripped)
- app/api/webhooks/stripe/route.ts — signature-verified; checkout.session.completed → ActivationCode + Order(COMPLETE) + Resend email; records emailSentAt/emailLastError on Order; orphan sessions throw STRIPE_ORPHAN error
- app/api/cases/activate/route.ts — checks isActive AND revokedAt; revoked code → 410
- app/api/cases/[slug]/checkpoint/route.ts — atomic updateMany with currentStage precondition; stage conflict → 409
- app/api/cases/[slug]/theory/route.ts — early return 200 if UserCase is already SOLVED (no new TheorySubmission written)
- app/checkout/success/page.tsx — success page reads ?session_id; "Go to bureau" links to /bureau
- components/bureau/BuyButton.tsx — client component: email form → POST /api/checkout → Stripe redirect
- scripts/test-stripe-e2e.ts — end-to-end purchase funnel test (12 assertions; requires dev server + stripe listen)
- app/api/register/route.ts — POST, rate-limited 3/60 s; duplicate check → 409; bcrypt 12; role hardcoded INVESTIGATOR
- app/api/forgot-password/route.ts — POST, rate-limited 3/60 s; always-200 (no enumeration); 32-byte hex token; 1-hour expiry; Resend email
- app/api/reset-password/route.ts — POST, rate-limited 5/60 s; token + expiry check; bcrypt 12; clears token fields
- components/auth/RegisterForm.tsx — auto sign-in after registration; callbackUrl support; confirm password client-side
- components/auth/ForgotPasswordForm.tsx — shows success state on send; back-to-sign-in link
- components/auth/ResetPasswordForm.tsx — reads ?token= from URL; shows error if missing/expired
- components/bureau/CaseActivationForm.tsx — reads ?activate=CODE param and pre-fills input (for purchase email deep-link)

### Week 5 — Completed commits (closed 2026-04-25)
5 commits — full security + UX audit pass. All pushed to origin/main.

- **fix(security)** — Rate-limit `POST /api/cases/activate` (5/60 s) + legacy `POST /api/admin/cases/[caseId]/activation-codes` (10/60 s). Fix QR code URL: was hardcoded `https://blackledger.app/u`, now reads `NEXT_PUBLIC_APP_URL ?? http://localhost:3000`.
- **fix(admin)** — Per-section PATCH endpoints (`people`, `records`, `hints`, `checkpoints`) now validate `unlockStage ≤ maxStage` (checkpoints: `stage < maxStage`). 4 new Vitest tests added (91 total). tsc clean.
- **fix(public)** — Public `/cases/[slug]` page now checks `CaseSlugHistory` and issues a 301 redirect on renamed cases (mirrors the bureau route). Removed dead `/terms` and `/privacy` links from Footer.
- **chore** — Added `.gitattributes` (`* text=auto eol=lf`). Ran full repo renormalization — working tree clean on all platforms.
- **fix(ux)** — `/bureau/unlock` is now publicly accessible (middleware carve-out before `/bureau/*` auth block). Unauthenticated visitors see a sign-in card; `callbackUrl` preserves the `?code=` param through the NextAuth bounce so the form auto-fills after login.

### Week 6 — Completed commits (closed 2026-04-25)
2 commits — P1 fixes. All pushed to origin/main.

- **refactor(auth)** (32cbe10) — Added `requireSessionJson()` to `lib/auth-helpers.ts`; migrated `activate`, `theory`, `checkpoint` player routes to use it. Fixed legacy aggregate PUT: now runs `caseSlugHistory.findFirst` history-conflict pre-check and `caseSlugHistory.upsert` inside the transaction when slug changes. +2 tests (93 total). tsc clean.
- **chore(docs)** (d3c47fd) — CLAUDE.md updated.

### Week 7 — Completed commits (closed 2026-04-25)
4 commits — Postgres cutover. All pushed to origin/main. Smoke test confirmed ✅.

- **feat(infra)** (0278909) — Replaced `@prisma/adapter-better-sqlite3` with `@prisma/adapter-pg`. Schema: `sqlite` → `postgresql`. `lib/prisma.ts`: `PrismaBetterSqlite3` → `PrismaPg({ connectionString })`. `prisma.config.ts`: `datasource.url = DIRECT_URL ?? DATABASE_URL`. `.env.example` updated. Prisma 7 note: adapter is mandatory — `new PrismaClient()` without adapter is a compile error in Prisma 7.
- **fix(infra)** — `lib/prisma.ts`: `import "dotenv/config"` → `dotenv.config({ path: ".env.local" }); dotenv.config()` — fixed loading order bug where `.env` (SQLite URL) was loaded before `.env.local` (Postgres URL).
- Neon database provisioned: AWS US East 1, Postgres 17. Migration `20260425045353_init` applied. Admin seeded. Smoke test: auth, bureau dashboard, admin panel all confirmed working against Neon.

### Week 8 — Completed commits (closed 2026-04-25)
5 commits — Stripe Checkout + purchase flow. All pushed to origin/main.

- **feat(schema)** (4726bb6) — `Order` model + `OrderStatus` enum (`PENDING/COMPLETE/FAILED/REFUNDED`). `ActivationCodeSource` enum (`ADMIN/PURCHASE`) + `source` field on `ActivationCode`. Back-relations on `CaseFile` + `ActivationCode`. Migration `20260425142952_add_order` applied to Neon. `prisma.config.ts` now loads `.env.local` first (mirrors `lib/prisma.ts`).
- **feat(checkout)** (70e3889) — `POST /api/checkout`: guest Stripe Checkout session, rate-limited 5/60 s. Creates `Order(PENDING)`. Returns `{ url }` for redirect. `lib/stripe.ts` lazy singleton. `checkoutSchema` in `lib/validators.ts`. New env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`.
- **feat(webhook)** (872cd08) — `POST /api/webhooks/stripe`: signature-verified handler. `checkout.session.completed` → creates `ActivationCode(source: PURCHASE)` in a transaction, marks `Order(COMPLETE)`, sends activation code email via Resend. Handles `checkout.session.expired` / `payment_intent.payment_failed` → `Order(FAILED)`. Middleware CSRF bypass for `/api/webhooks/*`. `lib/resend.ts` lazy singleton. New env vars: `RESEND_API_KEY`, `RESEND_FROM`.
- **feat(ui)** (cd9c768) — `BuyButton` client component (email capture → POST `/api/checkout` → Stripe redirect). `GET /api/checkout/status` endpoint. `/checkout/success` page. `BuyButton` wired into public case page — shown only when `PUBLISHED` and user doesn't already own the case.
- **chore(test)** (218c87c) — 5 new tests in `tests/api/stripe.test.ts`: checkout 404 for unpublished, checkout returns URL, webhook rejects bad signature, `checkout.session.completed` creates code + completes order, idempotent second call. 93 → 98 tests. tsc clean.

### Post-Week-8 audit + fix waves (2026-04-26)
Full professional audit + 4 fix waves applied and committed. 14 fixes across security, reliability, correctness, and feature completeness.

- **P0/P1 fixes** (cfaf546, 05d6495, b562f06, 2622694, 041ce32, f74861c, 9d00801, 5a6e1c1) — squash SQLite migrations, SSRF guard on blurhash, analyst notes ADMIN-only, redeem ownership check, callbackUrl sanitization, Stripe orphan session recovery, move bureau/unlock to route group
- **Wave 1** (0dcfacb) — revokedAt guard on activate route (410), _resetForTesting env gate, strip email from checkout/status, assertSafeEnv scripts
- **Wave 2** (ed031fb) — atomic checkpoint advance (updateMany precondition + 409), CSRF via new URL parsing (subdomain bypass fix), CSP R2 img-src, Promise.allSettled on bureau parallel lookups
- **Wave 3** (c942cfc / a6be910) — Stripe orphan alerting (console.error + throw), Order.emailSentAt/emailLastError tracking + migration, callbackUrl appended to auth redirects, theory SOLVED guard
- **Wave 4** (5a47771) — duplicate-purchase 409 guard on checkout, support reply wired to Resend (HANDLED on success, 502 on failure), hidden_evidence branch in resolveContent + resolveEvidence + RevealedEvidence, all 9 enums in lib/enums.ts, deprecated nextUserCaseStatus deleted
- **Final cleanup** — CSP flipped from report-only to enforced; uploadSignSchema MIME allowlist tightened to jpeg/png/webp/gif; CLAUDE.md updated

**E2E verification (2026-04-26)**: `scripts/test-stripe-e2e.ts` — 12/12 assertions passing against live Stripe test keys + Neon DB.

### Week 9 — Registration system (2026-04-26)
1 commit — full account creation + password reset + purchase deep-link flow.

- **feat(auth)** — `POST /api/register` (rate-limited 3/60 s, bcrypt 12, INVESTIGATOR role hardcoded, 409 on duplicate). `POST /api/forgot-password` (secure 32-byte hex token, 1-hour expiry, Resend email, always-200 to prevent email enumeration). `POST /api/reset-password` (token lookup, expiry check, bcrypt 12, token cleared on success).
- **feat(schema)** — `passwordResetToken String? @unique` + `passwordResetExpiresAt DateTime?` added to User model. Migration `20260426200000_add_password_reset` created (run `npx prisma migrate dev` on first deploy after this commit).
- **feat(ui)** — `/register` page + `RegisterForm` (auto sign-in after creation, callbackUrl preserved). `/forgot-password` page + `ForgotPasswordForm`. `/reset-password` page + `ResetPasswordForm` (reads `?token=` from URL). `LoginForm` updated with "Forgot password?" + "Create account" links.
- **feat(ux)** — `CaseActivationForm` reads `?activate=CODE` URL param and pre-fills the input. `bureau/page.tsx` wraps it in `<Suspense>`. `checkout/success/page.tsx` "Go to bureau" button fixed from `/bureau/unlock` → `/bureau`. Stripe webhook email updated: includes registration link + `?activate=CODE` deep-link so clicking the email takes the buyer straight to the pre-filled bureau form.
- **chore(test)** — 17 new Vitest tests in `tests/api/register.test.ts` covering all three new routes: happy paths, duplicate detection, bcrypt cost factor, email enumeration prevention, token expiry, field clearing. 140 → 157 tests.

### Architecture additions (Week 9)
- `app/api/register/route.ts` — POST, rate-limited 3/60 s; duplicate check; bcrypt 12; role hardcoded to INVESTIGATOR
- `app/api/forgot-password/route.ts` — POST, rate-limited 3/60 s; always-200; randomBytes(32) token; Resend email
- `app/api/reset-password/route.ts` — POST, rate-limited 5/60 s; token lookup + expiry; bcrypt 12; clears token fields
- `app/register/page.tsx` + `components/auth/RegisterForm.tsx` — auto sign-in after registration; callbackUrl support
- `app/forgot-password/page.tsx` + `components/auth/ForgotPasswordForm.tsx`
- `app/reset-password/page.tsx` + `components/auth/ResetPasswordForm.tsx` — reads `?token=` param
- `prisma/migrations/20260426200000_add_password_reset/migration.sql` — ALTERs User table

### Known follow-ups

**All P0, P1, P2 items from the 2026-04-26 audit are closed.**

**Remaining open items (low priority):**
- `AccessCodeList` shows "record #5" style target label — enrich GET endpoint or pass label map from page.
- No PATCH endpoint for retiring `AccessCodes` (setting `retiredAt`) — needed for admin code management UX.
- Validator length inconsistency between old `adminCaseSchema` and per-section schemas (`debriefClosing: max(2000)` vs `max(3000)`).
- `CaseAudit` not written for: workflow PATCH, batch-generate, revoke, AccessCode create.
- Image upload: strict MIME allowlist added; full magic-byte validation not feasible at presigned-URL layer (server never sees bytes). Sharp will reject non-images at the blurhash step.
- Archive button on `PublishCaseButton` has no confirmation dialog.
- No `GlobalPerson` admin UI — create/edit via seed scripts only.
- `/bureau/unlock` unauthenticated message says "We saved your code" — slightly misleading copy.

**Upcoming major milestones**
- Domain/DNS setup (`theblackledger.app` — Namecheap, verified in Resend, no A/CNAME yet).
- First real kit sale.

### Prompt library location
See black-ledger-prompts.md (uploaded to Cowork session) for Prompts 07–25.
Week 4 prompts (16–19) are outline-level — flesh out before pasting.

### Test credentials (local dev only)
Admin: mycart19@gmail.com
Investigator: test@blackledger.com / Test1234!
Activation code for case #1: ALDERS-D6A5FBA9 (may be claimed — generate a new one if needed)
