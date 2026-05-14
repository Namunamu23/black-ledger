# BLACK LEDGER — GOD-MODE FULL AUDIT v2 (SUPER SCRIPT)

> Paste **everything below the next horizontal rule** into a fresh Claude Code session running Opus 4.7. Do not edit. The session must have:
>
> - Filesystem access to the entire project folder (`C:\Users\gatch\Documents\black-ledger\` including `site/`).
> - The GitHub repo accessible: `https://github.com/Namunamu23/black-ledger.git`.
> - Shell access (Claude Code's Bash tool).
> - Permission to spawn Task subagents.
>
> Expected runtime: 90–180 minutes of model work. Expected output: one continuous markdown report, ~30–60k words, written to `site/audits/<TODAY>-godmode-audit.md`.

---

# BLACK LEDGER — GOD-MODE FULL AUDIT

## ROLE AND MANDATE

You are not a casual code reviewer. For this session you are a **fused expert team operating as one mind**:

- 15 senior full-stack engineers (Next.js 16 App Router, React 19 RSC, TypeScript, Node 20)
- 15 application security professionals (OWASP Top 10, threat modeling, AuthN/AuthZ, crypto, AppSec)
- 15 database / backend engineers (PostgreSQL 17, Prisma 7, transactions, concurrency, migrations, indexing)
- 15 SRE / debugging specialists (race conditions, idempotency, failure modes, observability, incident forensics)
- 15 startup product / engineering managers (risk prioritization, shipping readiness, launch gating, cost containment)

You operate with absolute rigor. You do not skim. You do not assume. You do not rush. You read every file you reference. You cite line numbers. **You verify every claim against the actual code on disk before writing it down.** If you are not sure, you say "needs verification" and explain how to verify it — you never invent.

This is the most important audit this codebase will ever receive. The product is approaching real-money launch. A bug you miss costs the founder real customers, real money, real trust, or real legal exposure. Treat that weight seriously throughout. The codebase has already passed 4 prior god-mode audits and 14 fix batches — easy findings are gone. **What's left is subtle.** Your job is to find what 60 prior expert-eyes missed.

You are forbidden from being lazy, vague, or sycophantic. No "looks good overall" filler. No empty reassurances. Every sentence you write must be load-bearing.

---

## OPERATING PRINCIPLES (read before doing anything)

1. **Ground truth lives on disk and in `git`, not in your head.** Anything you assert about the code must be backed by a file path and line range you actually read in this session. `CLAUDE.md` is a useful map but it is a *summary written by the project owner* — it can be stale or wrong. Treat it as a hypothesis to verify, not a source of truth.

2. **Phases are sequential and gated.** Do not start Phase 2 (issue hunting) until Phase 1 (total comprehension) is complete and you have produced its deliverables. Do not start Phase 3 until Phase 2 is complete. Skipping ahead is the #1 way audits miss critical bugs.

3. **Read-only audit.** Do not edit code, do not run migrations, do not rewrite functions, do not install packages, do not deploy. You may run *read-only* shell commands: `git`, `npm ls`, `npm audit`, `npx tsc --noEmit`, `npx prisma migrate status`, `npx vitest run --reporter=verbose`, `grep`, `find`, `wc`, `cat`, `head`, `tail`. Fixes happen in a follow-up session after the human reviews this report.

4. **Be exhaustive across files, not just across categories.** Every `.ts`, `.tsx`, `.js`, `.mjs`, `.json`, `.sql`, `.prisma`, `.env.example`, `.yml`, `.yaml`, `.toml`, `.config.*`, middleware, route handler, server action, component, hook, lib utility, script, test, and migration must be at minimum visited in Phase 1. Track coverage explicitly.

5. **Cite specifically.** Every finding must include: `file_path:line_range` + a short quoted snippet + the precise problem + the precise impact + a concrete remediation + a verification step. No hand-waving.

6. **Severity discipline.** Use only this scale, defined precisely:
   - **P0 — Critical.** Security breach, data loss, money loss, account takeover, RCE, or product-broken-for-all-users in production. Block launch.
   - **P1 — High.** Likely exploit path, data integrity hazard, broken-for-some-users, regulatory/PCI/GDPR exposure, or anything that becomes P0 under load. Fix before launch.
   - **P2 — Medium.** Real bug or risk that is unlikely to fire on day one but will bite within months. Fix in the next sprint.
   - **P3 — Low.** Code smell, hardening opportunity, minor UX issue. Backlog.
   - **P4 — Nit.** Style, naming, doc polish. Optional.

   Be honest. Do not inflate severity to look thorough. Do not deflate severity to look polite. When in doubt, **escalate** rather than suppress — the cost of a missed P0 is enormous; the cost of an over-flagged P2 is a five-minute conversation.

7. **Adversarial mindset.** When auditing, assume an attacker has read the entire codebase and is patient. Assume any input that crosses a trust boundary (HTTP request body/query/headers, webhooks, file uploads, query params, redirect URLs, cookie values, URL slugs, form fields, env vars in client bundles, IP headers, user-agent strings) is hostile. The six named personas in Phase 2.A are mandatory thinking aids.

8. **Concurrency mindset.** Whenever two requests can hit the same row, ask: what happens if they arrive in the same millisecond? Whenever a webhook can be delivered twice, ask: what's the idempotency story? Whenever an external service can be slow or fail, ask: what does the user see and what state are we left in?

9. **Differential mindset.** This codebase has been audited four times before. **You must not waste a finding re-flagging something already closed.** Phase 0 mandates that you read every prior audit dossier under `site/audits/` so you can (a) avoid duplication and (b) catch *drift* — places where prior fixes have decayed or where new code has reopened old wounds.

10. **No unicode-fluffing the report.** Plain markdown, real line numbers, real file paths. No emojis. No hedging adjectives ("seems okay", "probably fine"). Either it's a finding or it's not.

11. **Length is not a virtue. Density is.** A 30,000-word report of pure signal beats a 100,000-word report of mush. But do not under-deliver: this audit is paid for in the founder's runway. Spend the tokens.

12. **Use subagents.** Phase 1 and Phase 2 are explicitly parallelizable. You MUST spawn Task subagents (general-purpose or appropriate specialist) for the parallel passes specified below. Send them in a single message so they run concurrently. Trust but verify their findings before promoting them into the report.

---

## PHASE −1 — PRE-FLIGHT (mandatory shell verification before anything else)

Before reading a single source file, ground your reality in shell-verified state. Run these commands in order and record the output in a "Pre-Flight Report" section. **If any command fails, document the failure and continue — do not abort the audit.**

```bash
# 1. Confirm location + clean tree
pwd
git rev-parse HEAD
git status --porcelain
git log --oneline -30
git branch --show-current

# 2. Confirm working tree matches origin
git fetch origin --quiet 2>/dev/null
git status -sb
git log --oneline origin/main..HEAD 2>/dev/null
git log --oneline HEAD..origin/main 2>/dev/null

# 3. Count source files (truth, not memory)
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./generated/*" -not -path "./.claude/*" | wc -l
find . -type f -name "*.prisma" -not -path "./node_modules/*" | wc -l
find prisma/migrations -type d -mindepth 1 -maxdepth 1 2>/dev/null | wc -l

# 4. Stack version surfaces
cat package.json | head -120
node --version
npx tsc --version
npx prisma --version 2>&1 | head -5

# 5. Build health — must run, even if slow
npx tsc --noEmit 2>&1 | tail -40
echo "---tsc exit: $?"

# 6. Test health
npx vitest run --reporter=verbose 2>&1 | tail -60
echo "---vitest exit: $?"

# 7. Dependency posture
npm audit --json 2>&1 | head -200
npm ls --depth=0 2>&1 | tail -50

# 8. Migration state vs declared schema
npx prisma migrate status 2>&1 | head -40
ls -la prisma/migrations/

# 9. ESLint baseline (warnings + errors)
npx eslint . --ext .ts,.tsx --max-warnings=999 2>&1 | tail -60

# 10. Env var declaration
cat .env.example 2>/dev/null || echo "NO .env.example"

# 11. Vercel config
cat vercel.json 2>/dev/null || echo "NO vercel.json"

# 12. Existence of prior audit dossier — MANDATORY READ TARGET
ls -la audits/ 2>/dev/null | head -60
```

**Pre-Flight deliverable (write before Phase 0):**

- Current HEAD SHA + branch + clean/dirty.
- Drift between local HEAD and `origin/main`.
- Source file count by extension.
- Stack versions (Node, Next, React, Prisma, TS, Stripe SDK, NextAuth, Zod).
- `tsc --noEmit` result (pass/fail + error count + first 10 errors).
- `vitest run` result (passed/failed counts + first failures).
- `npm audit` summary (high/critical counts + names).
- `prisma migrate status` (applied vs pending).
- ESLint warning/error count.
- Count of files under `audits/`.

**Hard stop:** If `tsc` fails with errors, if `vitest` has failing tests, or if `prisma migrate status` shows pending migrations, **document this prominently at the top of the final report as Pre-Flight Defects**. They become implicit P0/P1 findings (the codebase doesn't compile / doesn't pass its own tests / has drifted schema).

---

## PHASE 0 — BOOT (ground-truth + dossier ingestion)

### 0.1 Read the boot files in this exact order, fully

`package.json` → `package-lock.json` (skim resolved versions of `@prisma/client`, `next-auth`, `stripe`, `resend`, `bcryptjs`, `zod`, `@aws-sdk/*`, `@upstash/*`) → `tsconfig.json` → `next.config.ts` → `prisma/schema.prisma` → `prisma.config.ts` → `middleware.ts` → `auth.ts` → `auth.config.ts` → `.env.example` → `.gitignore` → `.gitattributes` → `vitest.config.ts` (or `vite.config.ts`) → `eslint.config.mjs` → `vercel.json` → `CLAUDE.md` → `README.md`.

### 0.2 Read the entire prior-audit dossier

**This step is non-negotiable.** Open and read every file under `site/audits/` in chronological order. Specifically:

1. The 4 god-mode audit pairs/files: `2026-04-27-godmode-audit-v1.md`, `2026-04-27-godmode-audit-v2.md`, `2026-04-27-verification.md`, `2026-05-01-godmode-audit.md`, `2026-05-01-godmode-audit-cowork.md`, `2026-05-06-godmode-audit.md`, `2026-05-07-ux-polish-audit.md`, `2026-05-10-fullscope-godmode-review.md`.
2. Every `BATCH_*_REPORT.md` and `BATCH_*_OBSERVATIONS.md` (Batches 1–16).
3. Every `FIX_PROMPT_BATCH_*.md` (for context on what was deliberately deferred).

From this dossier, build a **"Closed Findings Ledger"** — a table of every finding that prior audits already caught and a prior batch already fixed. Then build a **"Deferred Findings Ledger"** — every finding that was deliberately punted with a documented reason. You will use these in Phase 2.5 (differential audit) to ensure you don't re-flag closed work and to specifically check whether the deferred items remain valid.

### 0.3 Migration chronology

List every Prisma migration in `prisma/migrations/` in order, with a one-line summary of what each one does. Confirm the migration sequence is linear (no branching), and confirm `schema.prisma` matches the cumulative state of the migrations (no drift).

### 0.4 Integration inventory

List every external service the code talks to (Stripe, Resend, Cloudflare R2, Neon Postgres, NextAuth, Upstash Redis, Vercel Cron, anything else). For each, document: env vars used, auth method, where the client is instantiated, every call site, every webhook/callback received from it.

### 0.5 Coverage tracker

Produce a checklist of every source file you intend to read in Phase 1, grouped by directory. You will tick these off as you go. **At the end of Phase 1 you must attest that this tracker is fully covered** — and if any file was skipped, name it and explain why.

### 0.6 Phase 0 deliverable

A "Boot Report" subsection with: pre-flight summary; stack version table; migration timeline; integration matrix; closed-findings ledger; deferred-findings ledger; coverage tracker. Stop and confirm Phase 0 is complete before starting Phase 1.

---

## PHASE 1 — TOTAL COMPREHENSION (no issue-hunting yet)

The goal of Phase 1 is to understand the system so deeply that you can explain any piece of it from memory. You are not yet looking for bugs — you are building the mental model that will let Phase 2 find them.

### 1.0 Parallel subagent dispatch — MANDATORY

For the file-by-file pass (1.1) and the data-flow traces (1.4), you MUST spawn parallel Task subagents. Send them in a single tool-call message so they run concurrently. Suggested split:

- **Subagent A — Routing & RSC map.** Inventory every page, layout, route group, server action, API route, and middleware. Identify RSC vs client boundaries. Report back in ≤ 2,500 words.
- **Subagent B — API surface map.** For every file under `app/api/`, document: HTTP methods supported, auth guard applied, rate limit applied (or absent), runtime pinned, input validation schema, every external call, every DB write, error response shape. Report back in ≤ 3,500 words.
- **Subagent C — Schema & data layer map.** For every Prisma model: fields, types, defaults, nullability, relations, indexes, unique constraints, cascade behavior. Flag every field holding secrets/PII/money/auth state. Report ≤ 3,000 words.
- **Subagent D — Auth & session map.** Every way to authenticate, every guard helper, every place a session is read or trusted, every place ownership is checked. Full lifecycle of the JWT (creation, refresh, expiry, `tokenVersion` invalidation, edge-vs-node split). Report ≤ 2,500 words.
- **Subagent E — Trust-boundary inventory.** Enumerate every place untrusted input enters the system (HTTP body, query, headers, cookies, route params, webhook payloads, file uploads, redirect URLs, env vars exposed to client bundles, image URLs fetched server-side). For each, note where it's validated, where it's escaped, where it's stored. Report ≤ 2,000 words.
- **Subagent F — Test inventory.** List every test file, what it covers, what it stubs, what's *not* covered. Cross-reference against critical paths. Identify the biggest untested critical paths. Report ≤ 1,500 words.

Wait for all six to return. Then **personally verify their highest-stakes claims** by opening the cited files yourself before promoting anything into the report. Subagent output is a draft, not the truth.

### 1.1 — File-by-file pass

Read every source file in the repo at least once (your subagents above cover most of this — but you personally walk `lib/`, `auth.ts`, `auth.config.ts`, `middleware.ts`, every file matching `app/api/webhooks/**`, `app/api/checkout/**`, `app/api/cron/**`, `app/api/me/**`, `app/api/admin/cases/**`, `app/api/access-codes/**`, `app/api/cases/[slug]/**`, `prisma/schema.prisma` end-to-end). Tick off the coverage tracker. **At the end, confirm every tracked source file has been read.**

### 1.2 — Architecture map

Produce a written architecture map describing:

- Routing layout: every route group, every layout file, every page, every server action, every API route, every middleware. Note auth-gated vs public. Note the `(unlock)` route group's purpose (public carve-out before bureau auth gate).
- Rendering model: which routes are RSC vs client, which use Suspense, which use streaming.
- Data layer: every Prisma model, every relation, every enum, every index. Call out which models touch money, identity, or auth (`User`, `Order`, `ActivationCode`, `AccessCode`, `Session`, `ProcessedStripeEvent`, etc.).
- External boundaries: a text-diagram of every place the app talks to Stripe, Resend, R2, Neon, Upstash, the browser, the user's email client, the QR code workflow, Vercel Cron.

### 1.3 — Auth & authorization model

Document:

- Every authentication entry point (NextAuth credentials provider, register, password reset).
- Every role (`UserRole` values: `ADMIN`, `INVESTIGATOR`) and what each role can do.
- Every guard helper in `lib/auth-helpers.ts` (`requireSession()`, `requireAdmin()`, `getOptionalSession()`, `requireSessionJson()`) and which routes use which guard.
- Every place a session is read or trusted, including `middleware.ts` (edge-safe `auth.config.ts`) and `auth.ts` (Node-only DB-checking session callback).
- Every place ownership is checked (user X is allowed to act on resource Y) — e.g., `UserCase`, `TheorySubmission`, `Order`, `AccessCodeRedemption`.
- The full lifecycle of a session token: creation (`authorize` → JWT with `tokenVersion`), refresh (none / per-request DB check in session callback), expiry (7-day maxAge), invalidation (password reset bumps `tokenVersion`).
- The CSRF model — exactly how it works (origin gate via `new URL(origin).origin`), where it is enforced (`middleware.ts`), where it is bypassed (`WEBHOOK_PATHS` allowlist for `/api/webhooks/stripe`), and why.

### 1.4 — Data flow traces (every step, every file, every failure path)

Trace, end-to-end, the following critical flows. For each, list every file touched in order, every DB write, every external call, every email sent, every state transition, and every failure path:

- **Guest purchase:** BuyButton click → `/api/checkout` (idempotencyKey, PENDING-reuse) → Stripe Checkout session → consent_collection terms_of_service → user pays → `checkout.session.completed` webhook → `ProcessedStripeEvent` insert → `ActivationCode` creation → `Order(COMPLETE)` → Resend email with `?activate=` deep-link → user clicks email → register/login → bureau access form pre-filled → activate → bureau access.
- **Refund:** `charge.refunded` webhook → ProcessedStripeEvent insert → branched handler (full vs partial) → ActivationCode revoke + `UserCase.revokedAt` set → Order status flip (REFUNDED / PARTIALLY_REFUNDED).
- **Async payment failure:** `checkout.session.async_payment_failed` webhook → Order(FAILED).
- **Sign-up + auto-login:** `/register` form → `/api/register` (rate-limited 3/60s, bcrypt 12, uniform-201) → session creation → callbackUrl redirect.
- **Forgot password:** form → `/api/forgot-password` (always-200) → 32-byte token → Resend email → `/reset-password?token=` → `/api/reset-password` → bcrypt 12 → `tokenVersion: { increment: 1 }` → token cleared.
- **Account deletion:** `/account/delete` → password + literal "delete my account" re-auth → `DELETE /api/me` → cascade (UserCase, TheorySubmission, CheckpointAttempt, AccessCodeRedemption) + ActivationCode `claimedByUserId` SetNull → ADMIN refused with 403.
- **Theory submission:** workspace → form → `/api/cases/[slug]/theory` → matcher (Jaccard + normalizeIdentity) → state machine → **sealed holistic feedback** (closure-standard rule from Batch 13 — never per-component leak) → SOLVED gate (idempotent return-200 if already SOLVED).
- **Checkpoint advance:** workspace → form → `/api/cases/[slug]/checkpoint` → atomic `updateMany` with `currentStage` precondition → 409 on conflict.
- **Admin case edit (per-section PATCH):** Tabs UI → `/api/admin/cases/[caseId]/{overview,people,records,hints,checkpoints,solution}` → diff/upsert → `CaseAudit` trail. Plus legacy aggregate PUT.
- **AccessCode redeem:** QR scan → `/u/[code]` → `/bureau/unlock?code=` → sign-in bounce (callbackUrl preserves param) → form auto-submit → `/api/access-codes/redeem` (rate-limited, retiredAt-aware, ownership-checked) → `RevealedEvidence` render at workspace load (record / person / hint / hidden_evidence branches).
- **Image upload:** ImageUploader → `/api/admin/uploads/sign` (MIME allowlist: jpeg/png/webp/gif) → R2 PUT → `/api/admin/uploads/blurhash` (SSRF-guarded by R2_PUBLIC_URL host allowlist) → Sharp → DB.
- **Stripe webhook (full):** signature verify (pinned API version `2026-04-22.dahlia`) → livemode validation → ProcessedStripeEvent idempotency → event dispatch (`checkout.session.completed` / `checkout.session.async_payment_failed` / `charge.refunded`) → DB writes in transaction → Resend email → `emailSentAt` / `emailLastError` tracking.
- **Slug rename:** admin edit → CaseSlugHistory upsert in transaction → public 301 redirect at both `/cases/[slug]` and `/bureau/cases/[slug]`.
- **Support reply:** admin clicks reply → `/api/admin/support/[id]/reply` → Resend with Reply-To support@ → HANDLED on success / 502 on transport error.
- **Cron — stuck PENDING sweep:** Vercel Cron `0 4 * * *` → Authorization Bearer + UA check → mark stale PENDING → FAILED.

### 1.5 — Schema & migration map

For every Prisma model: list its fields, types, defaults, nullability, relations, indexes, unique constraints, and cascade behavior. Flag any field that holds secrets, PII, money, or auth state. List every migration in order and what it changes. **Confirm the live schema matches the cumulative migrations (no drift between `schema.prisma` and the migration history).**

### 1.6 — Environment & secrets surface

List every env var referenced anywhere in the code. For each: where it's read, what it's used for, whether it's required at boot, whether it's exposed to the client (`NEXT_PUBLIC_*`), and whether it appears in `.env.example`. Flag any client-exposed secrets, any server secrets that leak into the bundle, and any required vars missing from `.env.example`.

### 1.7 — Test inventory

List every test file. For each: what it covers, what it stubs, what it leaves uncovered. Identify the **biggest untested critical paths** by cross-referencing against the data flow traces in 1.4.

### 1.8 — Dependency posture

List every direct dependency with its installed version. Note any that are deprecated, > 1 major version behind, known-vulnerable (cross-check against `npm audit` output from Phase −1), or used in only one place (candidate for removal). Special attention: `next-auth ^5.0.0-beta.30` (beta — track stable), `lucide-react ^1.8.0` (unusual major), `@prisma/client ^7.x` (relatively new), `stripe ^22.x` (API version pinning).

### 1.9 — CLAUDE.md drift check

Open `CLAUDE.md`. Pick **20 specific claims** it makes about the codebase (file paths, function names, batch contents, rate-limit values, env vars, line-level behaviors). Verify each one against current source. Build a **CLAUDE.md Drift Table** with three columns: claim, verification result (✓ / ✗ / partial), evidence. Anything ✗ becomes a P3/P4 documentation finding. Anything ✗ that materially misleads a future audit becomes a P2.

**Phase 1 deliverable:** Sections 1.1 through 1.9 written out. Coverage tracker fully ticked. Architecture map complete. Data flow traces complete. CLAUDE.md drift table complete. Stop and confirm Phase 1 is complete before starting Phase 2.

---

## PHASE 2 — FORENSIC AUDIT (now you hunt)

Only begin once Phase 1 is complete. Phase 2 has three sub-phases that run sequentially: 2.A (adversarial war-gaming), 2.B (category-by-category forensic pass), and 2.C (cross-cutting hostile traces). Each finding follows the **Finding Format** at the end of this section.

### Phase 2.A — Adversary war-gaming (mandatory)

For each of the seven personas below, write a "Day in the Life" attack narrative of **at least 250 words per persona**. Each narrative must describe: (1) the persona's goal, (2) what they would try first, (3) what they would try after the first attempt failed, (4) the specific files and lines in this codebase that defend (or fail to defend) against them, (5) at least one concrete attack scenario you can imagine that the current code does not fully prevent (or a verdict of "defended" with evidence). Any successful attack becomes a finding in 2.B.

- **Refund-After-Solve Rita.** Goal: get a full refund after solving the case. Buys a kit, completes the case (SOLVED state, fully redacted evidence revealed), files a chargeback or refund request. Tests `charge.refunded` handler completeness, `UserCase.revokedAt` enforcement at every read path, whether evidence remains accessible to a revoked user, whether the activation-code can be re-claimed.
- **Replay-QR Quinn.** Goal: redeem the same physical QR code multiple times to unlock evidence on multiple accounts. Tests `AccessCodeRedemption` unique constraint, `oneTimePerUser` semantics (now dropped — verify the constraint actually holds), retiredAt enforcement, the QR short URL → unlock flow.
- **Brute-Code Bruno.** Goal: guess valid `AccessCode` strings or `ActivationCode` strings by enumeration. Tests rate-limits on `/api/access-codes/redeem` and `/api/cases/activate`, the code namespace entropy, whether failures leak existence (404 vs 410 vs 401 timing), whether IP rotation defeats the rate-limit (XFF / x-real-ip handling).
- **Insider Ian.** Goal: an ADMIN account that is itself compromised. Tests `requireAdmin()` coverage, audit-trail completeness (`CaseAudit` model — what's logged, what isn't), whether an attacker-admin can exfiltrate user emails / hashed passwords / PII, whether admin actions are mass-revertable, whether ADMIN can self-delete (per BATCH_6 — refused 403 — verify).
- **Cost-Bomb Carla.** Goal: drain the founder's budget. Tests Resend cost-bomb on `/api/forgot-password`, `/api/support`, `/api/waitlist`, support reply path; R2 storage-bomb via image upload (Sharp limits, presigned URL abuse); Stripe API rate-spend; Neon pooled-connection exhaustion; Upstash rate-limit cost; Vercel function invocation flood.
- **Scraper Sven.** Goal: scrape every public case slug, every public-API exposed field, every cached page. Tests public/cases listing pagination + denormalization, the `/bureau/database` page's RSC payload shape (prior P0 was an over-broad Prisma select here — verify Batch 4 fix holds), unauthenticated reads, sitemap exposure, OG tags, source maps shipped to clients, and the `generated/` Prisma-client folder if it's reachable via the bundle.
- **Spoiler-Sniffer Sasha.** Goal: solve any case without playing it, by extracting the answer from the codebase, the API, the RSC payload, or any cached/leaked surface. Tests: do error messages reveal valid suspect names? Does any API response shape leak the answer field even when `correct=false`? Are debriefs reachable before SOLVED? Are seed files content-readable in any deployed environment? Does the OG/meta tag system leak case content? Are `hidden_evidence` rows reachable by unauthenticated reads or via predictable IDs? Does the timing of theory-evaluation leak the correct suspect (longer evaluation on near-miss)? Are admin preview pages reachable by non-admins? Is the public case page caching the post-solve debrief and serving it to other users via shared cache? **The Batch 13 sealed-feedback rule covers the player-facing string only — verify no spoilers leak through any other channel.**

### Phase 2.B — Category-by-category forensic pass

For each of the 20 categories below (2.B.1 through 2.B.20), do a deliberate pass over the relevant files and emit findings. **If a category yields zero findings, say so explicitly and list what you checked** so the founder can see the audit covered it.

#### 2.B.1 — Authentication

- Credential flow correctness (bcrypt cost = 12, timing-safe email lookup, password length policy).
- Session token strength, rotation (`tokenVersion` invalidation), revocation, expiry (7-day).
- Persistent session behavior, "remember me".
- Account enumeration via login, register (now uniform-201), forgot-password (always-200 — but is the *email-send timing* uniform?), redeem, support, waitlist.
- Session fixation, session hijacking surfaces, JWT confusion.
- NextAuth callbackUrl handling and open-redirect risk (`post-login-path.ts` same-origin sanitizer — verify).
- Logout completeness (client + server + cookie clearing).
- The edge-vs-node split (`auth.config.ts` Prisma-free for middleware vs `auth.ts` full DB-checking) — any place this seam leaks?

#### 2.B.2 — Authorization (AuthZ / IDOR)

- Every API route: is there a guard? Is the right guard? Does the guard check ownership of the specific resource, not just role?
- Every admin route: is `requireAdmin()` applied? Every mutation route rate-limited?
- Every user-scoped resource (UserCase, TheorySubmission, Order, AccessCodeRedemption): does every read and write verify the session user owns it?
- Path traversal via slug, code, id params (especially the dynamic route segments `[caseId]`, `[id]`, `[slug]`, `[code]`).
- Privilege escalation via PATCH bodies (e.g. can an INVESTIGATOR set `role: ADMIN` in a profile update? — assess every body schema).
- Per-section PATCH endpoints (`overview/people/records/hints/checkpoints/solution`) — same guard discipline as the legacy aggregate?

#### 2.B.3 — Input validation & injection

- Every Zod schema: is it applied at the API boundary? Strict?
- Any `prisma.$queryRaw` / `$executeRaw` — parameterized?
- Any HTML rendered from user input? `dangerouslySetInnerHTML`?
- File upload MIME validation server-side (allowlist: jpeg/png/webp/gif)?
- Sharp / blurhash bombs, oversized, malformed, SSRF via remote URL fetch.
- Any user-controlled URL fetched server-side without an allowlist? (SSRF.)
- Webhook payload validation — signature *and* schema *and* livemode match *and* ProcessedStripeEvent idempotency?

#### 2.B.4 — CSRF, CORS, headers

- CSRF origin gate in `middleware.ts`: `new URL(origin).origin` comparison — subdomain bypass paths?
- WEBHOOK_PATHS allowlist: explicit and minimal?
- Every state-changing route: GET vs POST/PATCH/DELETE — no state changes via GET.
- CSP: enforced; `script-src` `unsafe-inline`/`unsafe-eval` justified for Next/Framer?; R2 in `img-src`; `frame-ancestors`, `object-src`, `base-uri` set; nonce migration backlog item open.
- Other headers: `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- CORS: any APIs unintentionally exposed cross-origin?

#### 2.B.5 — Rate limiting & abuse

- Every public POST/PATCH/DELETE route rate-limited?
- Rate-limit key: `(ip, route)` — is the IP source trustworthy on Vercel? `x-real-ip` first, `x-forwarded-for` fallback per Batch 9 F-06 fix — verify.
- Bucket sizes: tight enough for register (3/60s), forgot-password (3/60s), reset-password (5/60s), redeem (5/60s), activate (5/60s), legacy admin/activation-codes (10/60s), checkout (5/60s), admin mutation routes (60/60s)?
- Email-send routes capped against Resend cost-bomb? Per-recipient activation-email throttle (3/hour to same normalized email) — verify F-13 closure.
- Activation-code brute-force prevented?

#### 2.B.6 — Money, Stripe, webhooks, idempotency

- Stripe signature verification — strict, version-pinned (`2026-04-22.dahlia`).
- Webhook handler idempotency — `ProcessedStripeEvent` insert inside transaction.
- `checkout.session.completed`: atomic ActivationCode + Order(COMPLETE) + email send. What if email fails after code creation — recoverable?
- Orphan Stripe sessions (no matching local Order) — alerted + recoverable, not silently dropped.
- Duplicate-purchase 409 guard — generic message (no email enumeration). Does it prevent double charges, or only block local order?
- BuyButton double-click race / `idempotencyKey` reuse — verify Batch 5 closure (pass Stripe idempotencyKey, reuse recent PENDING session URL).
- Refund flow — `charge.refunded` revokes code + sets `UserCase.revokedAt`. `PARTIALLY_REFUNDED` branch correct (no full revoke on partial).
- Order email tracking (`emailSentAt`, `emailLastError`) — admin view to retry failed sends present?
- Currency, tax, VAT — handled? International sales = regulatory exposure (Georgia operator, global Stripe acceptance).
- `event.livemode` check — Batch 4 closure — verify still wired.

#### 2.B.7 — Database, transactions, concurrency

- Every multi-write operation wrapped in `prisma.$transaction`?
- Every precondition-bearing state transition atomic via `updateMany` with `where` + count check (checkpoint advance, slug rename, code claim)?
- Race conditions in: code redemption, checkpoint advance, theory submission against SOLVED state, slug rename + redirect, registration uniqueness (P2002 catches), account deletion mid-purchase.
- N+1 query patterns in admin lists, bureau lists, public case page, `/bureau/database` (page-level pagination is a backlog item — verify it hasn't grown teeth).
- Missing indexes on hot paths (email, slug, code, sessionId, userId+caseId). Order has `(caseFileId,email,status)` index per Batch 5 — verify.
- Cascade behavior: when a User or CaseFile is deleted, what happens to dependent rows? `ActivationCode.claimedByUserId` SetNull, `CaseAudit.userId` Restrict (blocks ADMIN self-delete) — assess.
- Soft delete consistency: `retiredAt`, `revokedAt`, `archivedAt` — every read that should respect it actually does.
- Connection pooling: pooled URL for runtime, direct URL for migrations.

#### 2.B.8 — Email & deliverability

- Resend `from` domain — DKIM/SPF/DMARC for `theblackledger.app` (operational, not code — flag if not done).
- Every transactional email content reviewed for phishing-likeness, broken links, unrendered template vars, leaked internal IDs.
- Activation code emails — hard to phish-clone, includes unique purchase reference.
- Support reply path — Reply-To support@ per F-20 closure — verify.
- No spam-relay surface (per F-13 — per-recipient activation throttle).

#### 2.B.9 — File upload pipeline (R2)

- Presigned URL expiry (15 min) — appropriate.
- Object key naming — user-controlled path collision/overwrite?
- Public-read policy on bucket — intentional. Non-public objects mistakenly readable?
- Blurhash endpoint SSRF guard — host allowlist correct under all parsed-URL edge cases (rev DNS rebinding, IPv6, query-string poisoning)?
- Sharp limits — image bomb / decompression DoS?
- Cleanup: orphaned R2 objects (uploaded but never persisted) — sweeper present? (Backlog.)

#### 2.B.10 — Frontend / React / RSC

- Client/server boundary: no server secrets imported into client components (audit `"use client"` files for accidental Prisma/Resend/Stripe imports).
- Hydration mismatches: time-, locale-, random-based values without `suppressHydrationWarning` discipline.
- Suspense boundaries around dynamic content (`useSearchParams`).
- Form double-submit prevention.
- Optimistic UI vs server truth — diverges on error?
- Accessibility WCAG 2.1 AA pass: labels, focus, keyboard nav, color contrast, landmark roles, dialog focus traps. (Run mentally — no axe-core in this session.)
- SEO: every public page has `<title>`, `<meta description>`, OpenGraph, canonical URL, sitemap entry.
- **RSC payload leaks** — every server component's `select`/`include` minimal? (Re-verify Batch 4 `/bureau/database` fix.) Sample 5–10 RSC responses by inspecting the page source and look for fields the client should never see.
- **Source maps in production** — `next.config.ts` `productionBrowserSourceMaps` setting; Vercel default; any `.map` files reachable in the deployed bundle.
- **`generated/` Prisma client folder** — is it in `.gitignore`? Excluded from the deployed bundle? Reachable via any URL?
- **Static assets in `public/`** — anything sensitive (debug builds, untested PDFs, leaked SVGs with embedded scripts, real customer data committed by mistake).
- **Open-redirect coverage beyond `post-login-path`** — every redirect target (`callbackUrl`, `?code=`, `?activate=`, any share-URL, any post-action `redirect()` call) must use the same same-origin sanitizer. Find and verify each.
- **Cache poisoning / shared cache** — any `revalidate`, `force-cache`, `unstable_cache`, or implicit RSC caching that could serve one user's content to another (e.g. a post-solve debrief leaking across sessions).
- **Trusted Types / SRI / Permissions-Policy** — enabled? Configured? If not, document gap.
- **Unicode handling** — names, emails, slugs, search input. NFKC normalization applied consistently? Casefolding for the activation-code `.toUpperCase()` step (Batch 12 closure) — verify it handles Turkish dotted-I and similar locale quirks. Homograph attack surface in slugs?

#### 2.B.11 — TypeScript & code health

- `strict: true`? Any `// @ts-ignore` / `// @ts-expect-error` / `as any` / `as unknown as` — justified?
- Zod-inferred types vs hand-written types — drift?
- Prisma types vs API response shapes — leaking server-only fields to the client?
- Dead code: exports nobody imports, components nobody mounts, routes nobody links to.
- Duplicated logic that should be a shared helper.
- Magic strings / magic numbers — moved to enums/constants?

#### 2.B.12 — Error handling & observability

- Every API route: typed error responses, no leaked stack traces, correct status codes.
- Every external call wrapped in try/catch with a useful log.
- Logging: structured or unstructured? Includes correlation for cross-service tracing? Accidentally logs secrets/tokens/passwords/full webhook payloads?
- **Stray `console.log` / `console.error` in production paths** — grep the whole tree. Each one is either a logging hole or a data leak to Vercel logs.
- Monitoring/alerting hooks: Sentry — known absent (backlog F-12). Stripe orphan alerts — present per Wave 3.
- **Cron observability** — `cleanup-pending-orders` (and any other cron) — does it emit success/failure logs? If it silently fails for 30 days, who knows? Is there a heartbeat?
- **Webhook delivery monitoring** — is there a way to detect Stripe webhook delivery lag, missing deliveries, or repeated failures from Stripe's retry?
- **Audit-log completeness** — `CaseAudit` writes are explicitly missing for workflow PATCH, batch-generate, revoke, and AccessCode create per `CLAUDE.md` backlog. Forensic readiness gap — assess whether any P1-grade admin actions are unlogged.
- `error.tsx` / `not-found.tsx` at every route group?
- **Error message spoiler audit** — error responses for `/api/cases/[slug]/theory` and `/api/cases/[slug]/checkpoint` must not leak the correct answer or hint at it (e.g. validation error revealing valid suspect names, 400 messages enumerating accepted values).

#### 2.B.13 — Migrations & deploy safety

- Every migration: backwards-compatible during rolling deploy?
- Any migration that takes a long lock on a hot table?
- Down-migration story: Prisma support for rollback of this specific change set?
- Seed scripts idempotent? `assertSafeEnv` covers every destructive script? (Per Batch 1 — verify still complete after any new scripts.)

#### 2.B.14 — Vercel / production config

- Build settings: Node 20 declared in `package.json` engines and respected.
- Env var parity: every variable in `.env.example` set in Vercel for both Preview and Production (cannot verify from code — flag for operator).
- Preview deploys: non-prod database, non-prod Stripe key, non-prod Resend domain (cannot verify from code — flag for operator). Verify there is no code path that branches on `VERCEL_ENV === 'preview'` to use prod keys.
- Function regions vs Neon US East 1 — co-located? Operator is in Tbilisi; the round-trip is Tbilisi → US-East-1 → Tbilisi for every request. Assess whether any operator-side latency-sensitive flow (admin editing, support reply) is materially degraded.
- Edge vs Node runtime per route — anything on `edge` that uses Node-only APIs (Prisma, Sharp, NextAuth credentials)? Per Batch 7, `runtime = "nodejs"` pinned on all Prisma-using routes — verify nothing has slipped.
- Cron: `vercel.json` cron entry matches the route handler? CRON_SECRET set?
- **Stripe sandbox→live parity** — sandbox is configured per Week 12, live is pending. Identify every env-conditional branch (`NODE_ENV`, `VERCEL_ENV`, `STRIPE_*` env reads) — any code path that has only been exercised in sandbox and could break on first real charge.
- **Vercel function concurrency limits** — anywhere we hold an open external connection longer than necessary (Stripe, Resend) and could exhaust the per-function limit under burst load?

#### 2.B.15 — Compliance & legal

- PCI: no card data on the server (Stripe Checkout offloads). Verify no Elements / no direct PaymentIntent creation path.
- GDPR / Georgian PDPL: privacy policy at `/privacy`, account deletion flow at `/api/me`, data export?
- Cookie banner / consent — current single NextAuth functional cookie only — needed?
- Email opt-in / unsubscribe link on transactional vs marketing.
- Age gating, ToS acceptance at registration (Stripe consent_collection for checkout — verify still active).
- Operator identity claims on `/privacy` and `/terms` match reality (individual operator, Georgia).

#### 2.B.16 — UX, copy, edge cases

- Every form: empty / loading / error / success / disabled.
- Every list: empty / one / many / paginated / error.
- Every flow: tab-close mid-action, refresh, back-button-spam, double-click.
- Copy clarity in critical moments: post-purchase, post-redeem, post-reset, post-solve.
- Mobile viewport: every page, tap targets ≥ 44px, modal scroll.
- The sealed holistic theory feedback (Batch 13) — verify no per-component leak survived anywhere (`feedback` string, debug logs, API response shape, error messages).

#### 2.B.17 — Anything else a 60-person elite team would catch

You are explicitly authorized to report findings outside the 16 categories above. Examples: business-logic loopholes (gift-self-code, referral abuse, free-eval loopholes), trademark/IP risks in copy, dark-pattern risks, founder bus-factor risks (single-key dependencies), abuse of analytics/telemetry that doesn't exist, supply-chain risks (`postinstall` scripts in dependencies, lockfile poisoning, unpinned transitive versions).

#### 2.B.18 — Performance, DR, observability, and bot defense

Treat this category as first-class — none of these have been audited in prior batches and they are launch-critical.

- **Cold-start latency** — Vercel cold starts for Prisma-using routes. Has the team adopted any cold-start mitigation? What's the typical TTFB on `/api/checkout` from cold?
- **RSC payload byte sizes** — for the 5 highest-traffic pages, what's the wire size of the RSC payload? Anything over ~300KB is a smell. Anything over 1MB is a finding.
- **Database query patterns** — N+1 detection. Use the Prisma logging hook mentally — for each list page, count the queries fired. Index coverage on hot lookups (email, slug, code, sessionId, userId+caseId, Order's `(caseFileId,email,status)` from Batch 5).
- **Connection pool exhaustion** — Neon pooled URL is used. What's the limit? Are we close to it under modest concurrency?
- **Image pipeline performance** — Sharp on the hot path? Off the request thread? Decompression-bomb defense via `limitInputPixels`, `sequentialRead`, max dimensions explicitly set?
- **Disaster recovery** — Neon backup policy (point-in-time recovery window, daily snapshots)? R2 backup / object lifecycle? Documented `pg_dump` cadence? Recovery RPO/RTO? **Absence of a documented DR runbook is itself a P1 launch concern.**
- **Backup verification** — has anyone ever restored from a backup? An untested backup is not a backup.
- **Single-point-of-failure inventory** — every external service is a SPOF. Neon down = site down. Resend down = no purchase emails. Stripe down = no purchases. R2 down = no images. Document each, rate the recovery story.
- **Captcha / bot defense layer** — currently absent. Turnstile (free) or hCaptcha on `/register`, `/forgot-password`, `/waitlist`, `/support`, and the BuyButton email-capture step would be the primary defense against Cost-Bomb Carla and Brute-Code Bruno. Rate limits are second-line. Flag this gap explicitly.
- **CI / branch protection / GitHub config** — is `main` protected? Are PRs required? Is Dependabot enabled? Is there a CI pipeline that runs tests before merge? (Cannot verify from local repo — name the gap and ask the operator to confirm.)
- **Supply chain** — `npm ls` output review: any unexpected packages, any name-squatted look-alikes, any deps with `postinstall` hooks (your own `package.json` has `postinstall: prisma generate` — fine, but assess transitive ones).
- **Production logs visibility** — Vercel log retention is 1 hour on Hobby, 1 day on Pro. Is the plan tier sufficient for incident forensics?
- **Operator handoff readiness** — if you (the founder) are unavailable for two weeks, can anyone else operate this? Is there documentation? Are credentials in a recoverable vault?

#### 2.B.19 — Game-design integrity and content review

This is a mystery game. The Batch 13 sealed-feedback rule closed one spoiler channel. Sweep for all the others.

- **Spoiler-leak channels.** For every place the case answer (suspect / motive / evidence / debrief / hidden_evidence) is read or rendered, prove it requires CASE_CLOSED state or admin role. Channels to check: error messages, 4xx/5xx response bodies, RSC payloads on workspace pages, debug logs, OG/meta tags, the public `/cases/[slug]` page, the admin preview at `bureau/admin/cases/[caseId]/preview`, sitemap content, cached responses, search-engine-indexed snippets.
- **Hidden evidence reachability.** `HiddenEvidence` rows — can they be enumerated by ID? Reached without redeeming the AccessCode? Reached after redemption is `retiredAt`?
- **Theory evaluation timing.** Does the matcher's runtime correlate with how close the guess was to the answer (a longer Jaccard comparison on partial matches)? If yes, that's a timing oracle — a player could binary-search the answer space.
- **Hint exposure ladder.** Each hint has an `unlockStage`. Verify every hint read path respects the stage. Verify no hint is reachable via the admin preview if the user is not admin. Verify the closure-standard rule (Batch 13) is honored — hints must not be diagnostic.
- **Replay / new-game integrity.** What state is reset when a user re-purchases the same case? When they're refunded and re-buy? When their account is deleted and re-registered? Are TheorySubmission rows orphaned? Can a refunded-then-re-bought user see prior submissions?
- **Public case marketing copy.** Audit the public-facing case content (`app/cases/[slug]`) for inadvertent answer leaks in copy — e.g., a synopsis that names the murderer.
- **Seed data exposure.** Are `prisma/seed/cases/*.ts` files reachable in any deployed environment (source maps, bundle inspection, `/generated/`)? If yes, the entire game is one curl away.
- **Email content review.** Activation-code emails, support replies, password resets — do any contain text that would tip off a player about case content? (Unlikely but verify.)

#### 2.B.20 — Privacy, retention, and PDPL/GDPR depth

Account deletion exists per Batch 6. The audit must go deeper.

- **PII inventory.** List every column in every table that contains PII. Cross-check against the privacy policy at `/privacy` — does the policy honestly enumerate what's stored?
- **Retention policy.** What is the documented retention period for each PII column? Is it enforced? (Currently almost certainly not — flag this.)
- **CaseAudit retention.** `CaseAudit.userId` is `RESTRICT`-FK'd (blocks ADMIN self-delete per Batch 6). Does it persist the user's *name/email* anywhere in `changes` JSON or similar? If yes, a deleted user still has their PII in audit trail — right-to-be-forgotten gap.
- **Order rows after account deletion.** Order persists as buyer-of-record (Batch 6 design). Is the buyer email anonymized on user delete? Is this disclosed in `/privacy`?
- **Support inbox messages.** Are these PII? Retention policy?
- **Data export endpoint.** PDPL (and GDPR for any EU customer) requires data portability. Is there a `/api/me/export` endpoint? (Almost certainly not — flag.)
- **Operator address on `/privacy`.** Is the listed address actually reachable? Required for PDPL/GDPR data subject requests.
- **DPA / processor agreements.** Has the operator signed DPAs with Stripe, Resend, Neon, Cloudflare, Upstash, Vercel? (Mostly operational — flag for follow-up.)
- **Cookie audit.** Single NextAuth functional cookie — verify, document, and assess whether a cookie banner is needed for the audience. Georgian PDPL is more permissive than GDPR but the audience is global.

### Phase 2.C — Cross-cutting hostile traces

Pick **five** untrusted inputs and trace each through every layer of the system. For each, write a "thread" narrative naming every line of defense the input touches and exactly how it's handled or mishandled:

1. **`POST /api/checkout` request body from a hostile client.** Trace from `middleware.ts` (CSRF origin gate) → rate-limit → Zod parse → ownership/duplicate-order checks → Stripe API call → response. Where could an attacker inject? Where could they enumerate? Where could they exhaust?
2. **A Stripe webhook delivery from an attacker forging the request.** Trace from `middleware.ts` (WEBHOOK_PATHS bypass) → signature verify → livemode → ProcessedStripeEvent → event-type dispatch → DB writes. What if signature is valid but event is replayed? What if livemode flips? What if `event.account` is wrong (cross-tenant)? What if the event timestamp is six months old (replay window)? What if two valid events arrive in a different order than Stripe sent them (`charge.refunded` before `checkout.session.completed` — what state are we in)?
3. **A QR-code redemption hit from `/u/[code]` from a hostile scanner.** Trace from middleware → `/u/[code]` redirect → `/bureau/unlock` → sign-in bounce → `callbackUrl` preservation → auto-submit → `/api/access-codes/redeem` → ownership + retiredAt + rate-limit → workspace render. Where can the redemption be replayed? Bypassed? Phished? Where is the `?code=` query-string handled — does it survive a same-origin sanitizer, or could `?code=javascript:...` slip past?
4. **A `POST /api/cases/[slug]/theory` submission attempting to extract the answer.** Trace through auth → ownership → state-machine guard → matcher → response. Does the response shape, status code, response body, or response latency leak any information about how close the guess was? (Sealed-feedback rule applies — verify zero leak.)
5. **An image upload from a hostile admin (e.g., compromised admin account).** Trace from `/api/admin/uploads/sign` (MIME allowlist) → R2 PUT → `/api/admin/uploads/blurhash` (SSRF allowlist) → Sharp → DB. Decompression-bomb defense? Per-key collision? Cleanup-on-failure? Can the attacker upload to a key they don't own?

Each trace produces 1–N findings (or a "defended; here's why" verdict).

### Phase 2.5 — Differential audit (vs prior dossier)

Using the Closed Findings Ledger and Deferred Findings Ledger from Phase 0.2, walk:

1. **Closed findings — drift check.** For each closed finding, verify the fix is still in place at HEAD. If a closed fix has decayed (regression), flag as P0/P1 depending on severity.
2. **Deferred findings — re-evaluate.** For each deferred finding, decide whether it's still acceptable to defer or whether circumstances have changed (e.g. F-22 forgot-password timing leak, F-32/33 CSP nonce migration, F-34 `app/layout.tsx` per-render `auth()`, F-12 Sentry/structured logging, UX-09/10 refund visibility, BuyButton double-charge race if still open, etc.).
3. **CLAUDE.md known-follow-ups list.** Walk every item in the "Known follow-ups" section of `CLAUDE.md` and verify it's still valid (not silently fixed and not silently deteriorated).

### FINDING FORMAT (use exactly this for every issue)

```
### [P0|P1|P2|P3|P4] <short title>

**Location:** path/to/file.ts:LINE-LINE  (and any related files)

**Category:** <2.B.X label, or 2.A persona, or 2.C trace, or 2.5 differential>

**What:** One sentence describing what is wrong.

**Evidence:**
```ts
exact quoted snippet from the file
```

**Why it's a problem:** 2–4 sentences explaining the failure mode and the realistic attack/bug scenario. Be specific.

**Impact:** Who is affected and how badly. Quantify if possible.

**Remediation:** Concrete fix in 1–5 sentences. Code sketch only if it clarifies — do not write the full patch.

**Verification:** How a reviewer can confirm the fix worked (specific test, specific manual step).

**Related prior findings:** Any cross-reference to closed batches or other audits.
```

---

## PHASE 3 — SYNTHESIS & EXECUTIVE REPORT

After Phase 2 is complete, produce:

1. **Executive summary (max 500 words).** State of the codebase. What is solid. What is fragile. What would block launch tomorrow. Written so a non-technical co-founder could read it. Lead with the headline (e.g. "Launch-ready except for X, Y, Z." or "Three blockers remain.").

2. **Findings dashboard.** A table listing every finding by severity, with title and one-line impact. Sorted P0 first.

3. **Top 10 launch-blockers.** The ten things that, if not fixed, will hurt the founder most. With your reasoning for the ranking.

4. **Quick-wins list.** Findings that are < 30 minutes of work each, ordered by impact-per-minute. Useful for a "Saturday afternoon hardening" batch.

5. **Strategic recommendations (max 8 bullets).** Architectural moves to consider over the next 1–3 months — not bugs, *direction*. Be opinionated.

6. **What I Almost Missed.** A required mini-section: name 3–5 findings that nearly didn't make it into the report (because they live in a corner you almost didn't open, or because they require a specific attacker move to fire). This forces you to surface low-recall items.

7. **What I did NOT audit.** Every category, file, or surface you could not fully inspect (e.g. "could not run `npm audit fix --force` from this session", "could not verify Vercel dashboard config", "could not test against live Stripe webhooks", "could not connect to Neon to verify migration state matches prod"). The human will close these gaps externally.

8. **Coverage attestation.** Confirm every file in the coverage tracker from Phase 0 was read in Phase 1. If any were skipped, list them and the reason.

9. **Differential summary.** Out of the N closed findings I checked, all are still closed [or list regressions]. Out of the M deferred findings, [list the ones that have now changed status].

---

## PHASE 4 — SELF-AUDIT OF THE AUDIT

Before delivering the report, do a final self-critical pass:

1. **Severity sanity check.** Re-read every P0 and P1 finding. Could you defend the severity in front of a hostile senior engineer? Demote anything you can't. Promote anything you find you've under-rated.
2. **Evidence sanity check.** Re-read every quoted snippet. Confirm the file/line citation matches what you quoted. Confirm no quote is fabricated.
3. **Duplication sanity check.** Confirm no finding duplicates a Phase 0 closed-findings ledger entry (you'd be flagging your own past success as a new bug).
4. **Hedge sanity check.** Grep your own report for the words "seems", "probably", "likely", "perhaps", "might", "appears". Either commit (provide evidence) or delete.
5. **Asymmetry check.** Are findings clustered in one or two files? If yes, did you actually audit the rest of the codebase, or did you anchor on the first interesting target?

Append a short "Self-Audit Notes" section to the report documenting what changed during this pass.

---

## DELIVERY

Write the final report to:

```
site/audits/<YYYY-MM-DD>-godmode-audit-super.md
```

Where `<YYYY-MM-DD>` is today's UTC date.

The file must contain, in order:

- Pre-Flight Report
- Phase 0 Boot Report (with closed-findings ledger + deferred-findings ledger + CLAUDE.md drift table)
- Phase 1 Total Comprehension (1.1 through 1.9, subagent-aggregated)
- Phase 2.A Adversary war-gaming (six personas)
- Phase 2.B Category findings (20 categories — 2.B.1 through 2.B.20)
- Phase 2.C Cross-cutting hostile traces (five)
- Phase 2.5 Differential audit
- Phase 3 Synthesis & Executive Report
- Phase 4 Self-Audit Notes

Then in your final chat message back to the user, output a one-paragraph summary (no more than 200 words) and a link to the file.

---

## HARD RULES (re-read before you begin)

- Read everything you cite. No invented line numbers. No fabricated quotes.
- Sequential phases. Phase 1 deliverables exist before Phase 2 starts. Phase 2 deliverables exist before Phase 3 starts. Phase 4 self-audit runs before delivery.
- Read-only. No edits, no migrations, no installs, no `prisma db push`, no `vercel deploy`. Findings only.
- Use subagents in parallel where mandated. Send the dispatch as a single tool-call message.
- Plain markdown report. No emojis. No filler. No hedging adjectives. Either it's a finding or it's not.
- If a category has no findings, say "No findings. Checked: <specific list of what you checked>." Do not skip the section.
- If you are uncertain about an external behavior, state the uncertainty, document the assumption you'd verify, and continue. Do not stall.
- Length is not a virtue. Density is. Spend tokens proportional to value.
- When in doubt, escalate severity rather than suppress it.
- Cite at least one previous audit dossier reference per major finding so the human can track lineage.

---

## BEGIN

Confirm you have read this entire prompt by writing one sentence acknowledging the mandate. Then begin Phase −1. Do not ask for permission between phases — proceed straight through −1 → 0 → 1 → 2 → 3 → 4, producing the deliverables for each phase as labeled sections of one continuous report written to disk at the path above.

Go.