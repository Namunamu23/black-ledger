## Black Ledger — Project State (updated 2026-04-28)

### Current status
Registration system + god-mode audit + 3 surgical fix batches + JWT session invalidation COMPLETE — 124+ commits on origin/main, all pushed and deployed. 161 Vitest tests passing across 21 files. Build clean (no edge-runtime warnings). PostgreSQL on Neon. Stripe Checkout live. Full registration + password reset + purchase deep-link flow implemented 2026-04-26. Two parallel god-mode audits + verification report run 2026-04-27; 13 verified surgical fixes shipped across Batch 1 (5), Batch 2 (5), Batch 3 (3 + 2 follow-up patches). JWT sessions now invalidate on password reset via `User.tokenVersion` increment + DB-checked session callback; verified end-to-end in production (stale JWT redirects to /login, fresh sign-in works). Live at https://theblackledger.app .

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

### Week 10 — God-mode audit + Fix Batches 1 & 2 (closed 2026-04-27)
16 commits — comprehensive parallel god-mode audit + verification + 10 surgical fixes shipped in two disciplined batches. All pushed to origin/main.

**Audit phase (3 commits):**
- **docs(audit)** (e710f39) — Audit prompt published (`AUDIT_PROMPT.md` at repo root).
- **docs(audit)** (2d51be2) — Two parallel god-mode audit reports v1 + v2 saved under `audits/`. Both run independently against the full project tree, ~180 source files each. v2 caught items v1 missed (checkout-success email leak, AccessCodeRedemption unique-key/`oneTimePerUser` flag contradiction, refund-after-solve loophole). v1 caught items v2 missed (JWT non-invalidation, BuyButton race, broad webhook CSRF carve-out).
- **docs(audit)** (fc6bb58) — Verification report (`audits/2026-04-27-verification.md`) — independent ground-truth verification of the 7 highest-value findings against actual code before any fix work. **7/7 confirmed real**, both audits trustworthy on the points checked.

**Batch 1 — surgical hardening (5 fixes + report, 6 commits):**
- **fix(scripts)** (b058c01) — `assertSafeEnv` guard on `seed-global-people.ts`.
- **fix(scripts)** (8f7c343) — `assertSafeEnv` guard on `unarchive-case.ts`.
- **fix(security)** (84985ee) — CSV formula-injection protection in activation-code export (`csvEscape` prefixes `=+-@\t\r` cells with `'`).
- **fix(stripe)** (1e1b61c) — Pin Stripe SDK `apiVersion: "2026-04-22.dahlia"` (the SDK 22.1.0 `LatestApiVersion` literal) to prevent silent SDK-upgrade drift.
- **fix(security)** (3ce8776) — Stamp `revokedAt` server-side on activation-code revoke. `revokeCodeSchema` reduced to `z.object({}).passthrough()`; route writes `new Date()` instead of `new Date(parsed.data.revokedAt)`.
- **docs(audit)** (3820df7) — `audits/BATCH_1_REPORT.md` + `BATCH_1_OBSERVATIONS.md`.

**Batch 2 — privacy + DoS hardening (5 fixes + prompt + report, 7 commits):**
- **docs(audit)** (f716ff5) — Batch 2 fix prompt (`audits/FIX_PROMPT_BATCH_2.md`).
- **fix(security)** (0399a57) — Strip buyer email from `/checkout/success` server page. Drops `email` from Prisma `select`, removes the `email` local, rewrites copy to "the email address you entered at checkout." Wave-1 stripped email from the API; this fix closes the matching server-page leak.
- **fix(security)** (a34a12c) — Tighten webhook CSRF carve-out from `pathname.startsWith("/api/webhooks/")` to explicit `WEBHOOK_PATHS = new Set(["/api/webhooks/stripe"])`. Adding a future webhook now requires explicit allowlist registration with a security-sensitive change comment.
- **fix(admin)** (d9b0510) — Catch `P2002` on `caseFile.create` and return 409 instead of 500. Precheck `findUnique` retained as fast path; catch is the race-safety net.
- **fix(security)** (f991366) — Rate-limit `/api/checkout/status` (30/60s public) and `/api/admin/uploads/blurhash` (30/60s admin). Both routes previously had no rate-limit; pattern mirrors `app/api/admin/uploads/sign/route.ts`.
- **fix(privacy)** (ec6a229) — Generalize duplicate-purchase 409 message from "An activation code for this case has already been sent to this email address" to "We couldn't start checkout. If you've already purchased this case, please check your inbox or contact support." Closes the email × caseId enumeration vector at the message-content layer. Status code (409), guard logic, and `existingOrder` lookup unchanged. **Structural fix (drop guard or move behind Stripe call) deferred to a later batch.**
- **docs(audit)** (8ba5ca6) — `audits/BATCH_2_REPORT.md` + `BATCH_2_OBSERVATIONS.md`.

**Test count drift noted:** CLAUDE.md previously said "157 Vitest tests"; actual baseline at start of Batch 1 was 21 files / 160 tests. Doc-only drift, no breakage. Updated above.

### Architecture additions (Week 10)
- `audits/` directory created at repo root, holds: `2026-04-27-godmode-audit-v1.md`, `2026-04-27-godmode-audit-v2.md`, `2026-04-27-verification.md`, `FIX_PROMPT_BATCH_1.md`, `FIX_PROMPT_BATCH_2.md`, `BATCH_1_REPORT.md`, `BATCH_1_OBSERVATIONS.md`, `BATCH_2_REPORT.md`, `BATCH_2_OBSERVATIONS.md`.
- `middleware.ts` — `WEBHOOK_PATHS` Set-based allowlist replaces prefix carve-out.
- `lib/stripe.ts` — `apiVersion` pinned.
- `lib/validators.ts` — `revokeCodeSchema` reduced to `z.object({}).passthrough()`.
- `app/api/admin/cases/[caseId]/codes/route.ts` — `csvEscape` adds formula-prefix protection.
- `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts` — server-stamps `revokedAt`.
- `app/checkout/success/page.tsx` — no longer selects or renders buyer email.
- `app/api/checkout/route.ts` — generic 409 message.
- `app/api/checkout/status/route.ts` — rate-limited 30/60s.
- `app/api/admin/uploads/blurhash/route.ts` — rate-limited 30/60s.
- `app/api/admin/cases/route.ts` — P2002 catch on create.
- `scripts/seed-global-people.ts`, `scripts/unarchive-case.ts` — `assertSafeEnv` guards added.

### Week 11 — Batch 3: JWT session invalidation (closed 2026-04-28)
5 commits on origin/main + Neon migration applied + Vercel deploy verified. The first schema-touching batch.

**Batch 3 — JWT session invalidation (3 commits + 2 follow-up patches):**
- **feat(schema)** (87cf012) — Add `User.tokenVersion Int @default(0)`. New migration `20260427210000_add_user_token_version` ALTERs the `User` table to add an integer column with default 0. Hand-written SQL (no `prisma migrate dev` ran in the fix session); applied to Neon manually via `npx prisma migrate deploy` after review.
- **fix(security)** (5853ef7) — Capture `tokenVersion` in JWT on sign-in (`auth.ts` authorize returns it; `auth.config.ts` jwt callback stores it). Verify against live DB in session callback: mismatch → clear `session.user`. Bump `tokenVersion: { increment: 1 }` on password reset (`app/api/reset-password/route.ts`). Add `maxAge: 60 * 60 * 24 * 7` (7 days) to session config.
- **test(security)** (dc010a8) — `tests/api/register.test.ts` gets a new test asserting `prisma.user.update` writes `tokenVersion: { increment: 1 }` on successful reset. 160 → 161 tests.
- **fix(auth)** (12c8973) — Split-config follow-up: `auth.config.ts` is now Prisma-free (edge-safe for middleware). The DB-checking session callback was moved to `auth.ts` where Prisma can run. Without this, `next build` produced `node:path` / `node:url` not-supported-in-edge-runtime warnings tracing through `middleware.ts → auth.config.ts → lib/prisma.ts → generated/prisma/client.ts`. After the split, the build is clean and middleware does coarse JWT-only gating while route handlers and pages run the full DB tokenVersion check via `auth()` from `auth.ts`.
- **fix(ui)** (post-deploy) — `components/layout/Navbar.tsx` Navbar guards changed from `session ?` to `session?.user ?`. The session callback returns `{ ...session, user: undefined }` on tokenVersion mismatch (truthy session, undefined user), and the Navbar's old guard treated session-truthy as user-defined and crashed with `TypeError: Cannot read properties of undefined (reading 'email')` on `/login` after a stale-JWT redirect. The `NavbarSession` type now correctly marks `user` as optional. End-to-end retest passed.

**Deployment notes:**
- Neon migration applied via `npx prisma migrate deploy` (uses `DIRECT_URL` from `.env.local`). Output confirmed: "All migrations have been successfully applied."
- Vercel auto-deployed; production at https://theblackledger.app went live with no errors. Error rate stays at 0%.
- End-to-end security test verified: signing in, resetting password from incognito, returning to original browser, refreshing `/bureau` → redirect to `/login` → sign in with new password → fresh session. The whole "I think I'm compromised" recovery flow now actually invalidates the attacker's JWT.

### Architecture additions (Week 11)
- `prisma/schema.prisma` — `User.tokenVersion Int @default(0)` field.
- `prisma/migrations/20260427210000_add_user_token_version/migration.sql` — additive `ALTER TABLE User ADD COLUMN`.
- `auth.config.ts` — edge-safe (no Prisma import). Trivial pass-through session callback for middleware.
- `auth.ts` — full DB-checking session callback overrides the trivial one. `tokenVersion` returned from `authorize`.
- `types/next-auth.d.ts` — augment `User`/`Session.user`/`JWT` with optional `tokenVersion?: number` across both `@auth/core/types` + `next-auth` and `@auth/core/jwt` + `next-auth/jwt` modules.
- `app/api/reset-password/route.ts` — bumps `tokenVersion` via `{ increment: 1 }` in the update.
- `components/layout/Navbar.tsx` — `NavbarSession.user` is optional; all guards use `session?.user`.
- `audits/FIX_PROMPT_BATCH_3.md`, `audits/BATCH_3_REPORT.md`, `audits/BATCH_3_OBSERVATIONS.md` — fix prompt + report + observations under the audits folder.

### Known follow-ups (updated 2026-04-28)

**From 2026-04-26 audit:** All P0/P1/P2 closed.

**From 2026-04-27 god-mode audit — Batches 1+2+3 closed 13 items. Remaining:**

**P0 (launch blocker, content authoring):**
- Privacy Policy + Terms of Service pages absent. Stripe merchant agreement requires both. GDPR/CCPA disclosure also requires Privacy Policy. Author externally (template-based fine), wire into Footer + Stripe Checkout `consent_collection.terms_of_service: required`.

**P1 (queued for future fix batches):**
- **BuyButton double-charge race / no Stripe `idempotencyKey`.** Two concurrent `/api/checkout` POSTs both pass the COMPLETE-only guard, both create Stripe sessions, both can be paid → double charge. Queued for Batch 4.
- **`hidden_evidence` AccessCode validator gap.** Validator enum excludes `"hidden_evidence"` even though redeem route + workspace renderer both branch on it. Admin can't create such codes via API today. Queued for Batch 4 (small).
- **Stripe `payment_intent.payment_failed` orphan handling.** Handler can't find the Order (no `stripePaymentIntent` set yet on PENDING). Subscribe to `checkout.session.async_payment_failed` instead. Queued for Batch 4.
- **`Order.userId` link missing + no refund webhook handler.** Refund-after-solve undetected. Schema migration + new `charge.refunded` handler. Larger work; Batch 5.
- **Activation-code email goes to attacker-supplied address.** Architectural fix (require account creation pre-checkout, or deliver code via token-link). Needs product input.
- **`AccessCodeRedemption` unique-key vs `oneTimePerUser` flag.** Schema enforces `@@unique([accessCodeId, userId])` unconditionally → `oneTimePerUser=false` is functionally a no-op. Product decision needed: drop the column or drop the unique constraint.
- **No retry / sweeper for failed activation-code emails.** Cron infrastructure required. Order schema already has `emailSentAt` / `emailLastError` for tracking.
- **No account-deletion flow (GDPR/CCPA).** New `DELETE /api/me` endpoint; cascades already wired at schema level.

**P2/P3 backlog (low priority, ordered):**
- `runtime = "nodejs"` not pinned on every API route (only on `/api/webhooks/stripe`).
- CSP allows `'unsafe-inline'` and `'unsafe-eval'` in `script-src` — move to nonce-based.
- No Sentry / structured logging — `console.error` to Vercel logs only.
- No Vercel Cron for stuck PENDING orders, orphan R2 objects, unsent emails.
- Forgot-password email-send timing leaks user existence.
- Login lookup not constant-time (returns `null` immediately for missing email).
- Order missing index on `(caseFileId, email, status)` — duplicate-purchase guard does seq scan as table grows.
- Pre-existing odd indentation in `app/api/admin/cases/route.ts` `data: {}` block.
- `RevokeButton` still sends now-ignored `revokedAt` (cosmetic only — server stamps).
- `unarchive-case.ts` still hard-codes `CASE_ID = 3` (no CLI arg).
- `AccessCodeList` shows "record #5" style target label — enrich GET endpoint.
- No PATCH endpoint for retiring `AccessCodes` (setting `retiredAt`).
- Validator length inconsistency between aggregate `adminCaseSchema` and per-section schemas.
- `CaseAudit` not written for: workflow PATCH, batch-generate, revoke, AccessCode create.
- Archive button on `PublishCaseButton` has no confirmation dialog.
- No `GlobalPerson` admin UI — create/edit via seed scripts only.
- `/bureau/unlock` "We saved your code" copy is misleading.
- `tsconfig` `target: ES2017` is dated.
- `lucide-react ^1.8.0` version pin is unusual — verify package.
- No `engines.node` field in `package.json`.
- Stripe webhook does not verify `event.account` / `session.livemode` matches expectation.
- New rate-limit branches added in Batch 2 (`/api/checkout/status`, `/api/admin/uploads/blurhash`) are functional but untested.
- Fix 3's P2002 catch in `app/api/admin/cases/route.ts` is functional but untested (no race-condition simulation).

**Upcoming major milestones**
- Domain/DNS setup (`theblackledger.app` — Namecheap, verified in Resend, no A/CNAME yet).
- Privacy Policy + Terms of Service authored and live.
- First real kit sale.

### Prompt library location
See black-ledger-prompts.md (uploaded to Cowork session) for Prompts 07–25.
Week 4 prompts (16–19) are outline-level — flesh out before pasting.

### Test credentials (local dev only)
Admin: mycart19@gmail.com
Investigator: test@blackledger.com / Test1234!
Activation code for case #1: ALDERS-D6A5FBA9 (may be claimed — generate a new one if needed)
