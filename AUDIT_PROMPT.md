# BLACK LEDGER — GOD-MODE FULL AUDIT

**Paste everything below this line into a fresh Claude Code session running on Opus 4.7. Do not edit it. The session must have read access to the full project folder and to the GitHub repo at https://github.com/Namunamu23/black-ledger.git**

---

## ROLE AND MANDATE

You are not a casual code reviewer. For this session you are a **fused expert team** operating as one mind:

- 15 senior full-stack engineers (Next.js App Router, Node, TypeScript, React Server Components)
- 15 application security professionals (OWASP, threat modeling, AppSec, AuthZ/AuthN, crypto)
- 15 database / backend engineers (PostgreSQL, Prisma, transactions, concurrency, migrations)
- 15 SRE / debugging specialists (race conditions, failure modes, observability, incident forensics)
- 15 startup product / engineering managers (risk prioritization, shipping readiness, launch gating)

You operate with absolute rigor. You do not skim. You do not assume. You do not rush. You read every file you reference. You cite line numbers. You verify every claim against the actual code on disk before writing it down. If you are not sure, you say "needs verification" and explain how to verify it — you never invent.

This is the most important audit this codebase will ever receive. The product is approaching real-money launch. A bug you miss costs the founder real customers, real money, real trust, or real legal exposure. Treat that weight seriously throughout.

You are forbidden from being lazy, vague, or sycophantic. No "looks good overall" filler. No empty reassurances. Every sentence you write must be load-bearing.

---

## OPERATING PRINCIPLES (read before doing anything)

1. **Ground truth lives on disk, not in your head.** Anything you assert about the code must be backed by a file path and line range you actually read in this session. CLAUDE.md is a useful map but it is a *summary written by the project owner* — it can be stale or wrong. Verify everything against the source.

2. **Phases are sequential and gated.** Do not start Phase 2 (issue hunting) until Phase 1 (total comprehension) is complete and you have produced its deliverables. Skipping ahead is the #1 way audits miss critical bugs.

3. **No fixes during the audit.** Do not edit code, do not run migrations, do not rewrite functions. This session is read-only. Findings only. Fixes happen in a follow-up session after the human reviews this report.

4. **Be exhaustive across files, not just across categories.** Every `.ts`, `.tsx`, `.js`, `.mjs`, `.json`, `.sql`, `.prisma`, `.env.example`, `.yml`, `.yaml`, `.toml`, `.config.*`, middleware, route handler, server action, component, hook, lib utility, script, test, and migration must be at minimum visited in Phase 1. Track coverage explicitly.

5. **Cite specifically.** Every finding must include: `file_path:line_range` + a short quoted snippet + the precise problem + the precise impact + a concrete remediation. No hand-waving.

6. **Severity discipline.** Use only this scale, defined precisely:
   - **P0 — Critical.** Security breach, data loss, money loss, account takeover, RCE, or product-broken-for-all-users in production. Block launch.
   - **P1 — High.** Likely exploit path, data integrity hazard, broken-for-some-users, regulatory/PCI/GDPR exposure, or anything that becomes P0 under load. Fix before launch.
   - **P2 — Medium.** Real bug or risk that is unlikely to fire on day one but will bite within months. Fix in the next sprint.
   - **P3 — Low.** Code smell, hardening opportunity, minor UX issue. Backlog.
   - **P4 — Nit.** Style, naming, doc polish. Optional.

   Be honest. Do not inflate severity to look thorough. Do not deflate severity to look polite.

7. **Adversarial mindset.** When auditing, assume an attacker has read the entire codebase and is patient. Assume any input that crosses a trust boundary (HTTP request body/query/headers, webhooks, file uploads, query params, redirect URLs, cookie values, URL slugs, form fields, env vars in client bundles) is hostile.

8. **Concurrency mindset.** Whenever two requests can hit the same row, ask: what happens if they arrive in the same millisecond? Whenever a webhook can be delivered twice, ask: what's the idempotency story? Whenever an external service can be slow or fail, ask: what does the user see and what state are we left in?

9. **No unicode-fluffing the report.** Plain markdown, real line numbers, real file paths. No emojis unless the human asked for them.

---

## PHASE 0 — BOOT (do this first, in order)

Before reading any source code, establish baseline ground truth. Output a short "Boot Report" at the end of this phase.

1. List the working tree. Use the file system to enumerate every tracked file. Note total file count by extension.
2. Read in this exact order, fully: `package.json`, `package-lock.json` or `pnpm-lock.yaml` (skim for resolved versions), `tsconfig.json`, `next.config.ts`, `prisma/schema.prisma`, `prisma.config.ts`, `middleware.ts`, `.env.example`, `.gitattributes`, `.gitignore`, `vitest.config.ts` (or equivalent), `eslint.config.*`, `vercel.json` if present, `CLAUDE.md`.
3. List every Prisma migration file in `prisma/migrations/` in chronological order with a one-line summary of what each one does. Confirm the migration sequence is linear and not branched.
4. Run `git log --oneline -50` mentally by reading the repo if available, or note that recent commits are not inspectable. Note the current branch and whether the working tree is clean.
5. Identify the runtime targets (Node version, Next.js version, React version, Prisma version, Postgres provider).
6. List every external integration the code talks to (Stripe, Resend, R2/S3, Neon, NextAuth providers, Upstash Redis, anything else). For each, note: env vars used, auth method, where the client is instantiated, where it is called.
7. Build a coverage tracker — a checklist of every file you intend to read in Phase 1, grouped by directory. You will tick these off as you go.

**Phase 0 deliverable:** A "Boot Report" — repo size, stack versions, integration inventory, migration timeline, coverage tracker. Stop and confirm Phase 0 is complete before starting Phase 1.

---

## PHASE 1 — TOTAL COMPREHENSION (no issue-hunting yet)

The goal of Phase 1 is to understand the system so deeply that you can explain any piece of it from memory. You are not yet looking for bugs — you are building the mental model that will let Phase 2 find them.

Do all of the following. Each numbered item produces a labeled deliverable in the final report.

### 1.1 — File-by-file pass
Read every source file in the repo at least once. For each non-trivial file, produce a one-paragraph summary: what it exports, who calls it, what side effects it has, what trust boundaries it crosses. Tick it off the coverage tracker. At the end, confirm every tracked source file has been read.

### 1.2 — Architecture map
Produce a written architecture map describing:
- Routing layout: every route group, every layout file, every page, every server action, every API route, every middleware. Note auth-gated vs public.
- Rendering model: which routes are RSC vs client, which use Suspense, which use streaming.
- Data layer: every Prisma model, every relation, every enum, every index. Call out which models touch money, identity, or auth.
- External boundaries: a diagram (in text/ASCII) of every place the app talks to Stripe, Resend, R2, Neon, Upstash, the browser, the user's email client, the QR code workflow.

### 1.3 — Auth & authorization model
Document:
- Every way a user can authenticate (NextAuth providers, credentials flow, registration, password reset).
- Every role (`UserRole` values) and what each role can do.
- Every guard helper in `lib/auth-helpers.ts` and which routes use which guard.
- Every place a session is read or trusted, including middleware.
- Every place ownership is checked (user X is allowed to act on resource Y).
- The full lifecycle of a session token (creation, refresh, expiry, invalidation).
- The CSRF model — exactly how it works, where it is enforced, where it is bypassed (e.g. webhooks), and why.

### 1.4 — Data flow traces
Trace, end-to-end, the following critical flows. For each, list every file touched in order, every DB write, every external call, every email sent, every state transition, and every failure path:

- Guest purchase: BuyButton click → checkout API → Stripe Checkout → webhook → ActivationCode creation → Resend email → user clicks email → registration deep-link → activate code → bureau access.
- Sign-up + auto-login: register form → `/api/register` → bcrypt → session creation → callback URL redirect.
- Forgot password: form → `/api/forgot-password` → token generation → Resend email → `/reset-password?token=` → `/api/reset-password` → token clearing.
- Theory submission: case workspace → theory form → `/api/cases/[slug]/theory` → matcher → state machine → SOLVED gate.
- Checkpoint advance: workspace → checkpoint UI → atomic `updateMany` precondition → state advance.
- Admin case edit (per-section PATCH): tab UI → `/api/admin/cases/[caseId]/{section}` → diff/upsert → CaseAudit.
- AccessCode redeem: QR scan → `/u/[code]` → `/bureau/unlock` → sign-in bounce → form auto-submit → `/api/access-codes/redeem` → revealed evidence render.
- Image upload: ImageUploader → `/api/admin/uploads/sign` → R2 PUT → `/api/admin/uploads/blurhash` → Sharp → DB.
- Stripe webhook: signature verify → event dispatch → DB writes → email → Order tracking fields.
- Slug rename: admin edit → CaseSlugHistory upsert → public 301 redirect.
- Support reply: admin clicks reply → `/api/admin/support/[id]/reply` → Resend → status flip.

### 1.5 — Schema & migration map
For every Prisma model: list its fields, types, defaults, nullability, relations, indexes, unique constraints, and cascade behavior. Flag any field that holds secrets, PII, money, or auth state. List every migration in order and what it changes. Confirm the live schema matches the latest migration (i.e. no drift between `schema.prisma` and the cumulative migrations).

### 1.6 — Environment & secrets surface
List every env var referenced anywhere in the code. For each: where it's read, what it's used for, whether it's required at boot, whether it's exposed to the client (e.g. `NEXT_PUBLIC_*`), and whether it appears in `.env.example`. Flag any client-exposed secrets, any server secrets that leak into the bundle, and any required vars missing from `.env.example`.

### 1.7 — Test inventory
List every test file. For each: what it covers, what it stubs, what it leaves uncovered. Identify the **biggest untested critical paths** by cross-referencing against the data flow traces in 1.4.

### 1.8 — Dependency posture
List every direct dependency with its installed version. Note any that are: deprecated, > 1 major version behind, known-vulnerable (cross-check against your training data, and flag anything you'd need to verify with `npm audit`), or used in only one place (candidate for removal).

**Phase 1 deliverable:** Sections 1.1 through 1.8 written out. Coverage tracker fully ticked. Architecture map complete. Data flow traces complete. Stop and confirm Phase 1 is complete before starting Phase 2.

---

## PHASE 2 — FORENSIC AUDIT (now you hunt)

Only begin once Phase 1 is complete. For each category below, do a deliberate pass over the relevant files and emit findings. Each finding follows the **Finding Format** at the end of this section.

You are looking for *every* class of issue a senior reviewer in that domain would catch — not just the obvious ones. If a category yields zero findings, say so explicitly and explain what you checked.

### 2.1 — Authentication
- Credential flow correctness (bcrypt cost, timing attacks on email lookup, password length policy).
- Session token strength, rotation, revocation, expiry.
- "Remember me" or persistent session behavior.
- Account enumeration via login, register, forgot-password, redeem flows.
- Session fixation, session hijacking surfaces.
- NextAuth callback URL handling and open-redirect risk.
- Logout completeness (client + server + cookie clearing).

### 2.2 — Authorization (AuthZ / IDOR)
- Every API route: is there a guard? Is the right guard? Does the guard check ownership of the specific resource, not just role?
- Every admin route: is `requireAdmin()` applied?
- Every user-scoped resource (UserCase, TheorySubmission, Order, AccessCodeRedemption): does every read and write verify the session user owns it?
- Path traversal via slug, code, id params.
- Privilege escalation via PATCH bodies (e.g. can an INVESTIGATOR set `role: ADMIN` in a profile update?).

### 2.3 — Input validation & injection
- Every Zod schema: is it applied at the API boundary? Is it strict (`.strict()` or equivalent)?
- Any `prisma.$queryRaw` / `$executeRaw` — parameterized?
- Any HTML rendered from user input? `dangerouslySetInnerHTML`?
- File upload MIME validation — is it enforced server-side, not just client-side? Is the MIME allowlist actually checked before the presigned URL is issued?
- Image processing (Sharp / blurhash): bombs, oversized, malformed, SSRF via remote URL fetch.
- Any user-controlled URL fetched server-side without an allowlist? (SSRF.)
- Webhook payload validation — signature *and* schema.

### 2.4 — CSRF, CORS, headers
- CSRF origin gate in middleware: does it use `new URL(origin).origin`? Are there subdomain bypass paths? Are the carve-outs (webhooks) safe?
- Every state-changing route: GET vs POST/PATCH/DELETE — no state changes via GET.
- CSP: enforced or report-only? Does `script-src` include `unsafe-inline`/`unsafe-eval` and is that justified? Is R2 origin in `img-src`? Are `frame-ancestors`, `object-src`, `base-uri` set?
- Other headers: `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- CORS: are any APIs unintentionally exposed cross-origin?

### 2.5 — Rate limiting & abuse
- Every public POST/PATCH/DELETE route: is it rate-limited?
- The rate-limit key — is it `(ip, route)`? Is the IP source trustworthy on Vercel (use of `x-forwarded-for`)?
- Bucket sizes — are they tight enough for password reset, register, redeem, checkout to resist credential stuffing and code-guessing?
- Email-send routes (forgot-password, support-reply) — capped to prevent Resend cost-bomb?
- Activation-code redemption — is brute-force on the code space prevented?

### 2.6 — Money, Stripe, webhooks, idempotency
- Stripe signature verification on the webhook — strict and version-pinned.
- Webhook handler idempotency — what happens on duplicate delivery? On out-of-order delivery?
- `checkout.session.completed` flow: is the ActivationCode + Order(COMPLETE) + email send atomic? What if email fails after the code is created — is the customer recoverable?
- Orphan Stripe sessions (no matching local Order) — handled with alert + recovery, not silently dropped.
- Duplicate-purchase 409 guard — does it actually prevent double charges, or only block the local order? What if Stripe accepts the charge before the 409?
- Refund flow — exists? Does it revoke the activation code? Does it mark the order REFUNDED?
- Order email tracking (`emailSentAt`, `emailLastError`) — is there an admin view to retry failed sends?
- Currency, tax, VAT — handled? If selling internationally, this is a regulatory exposure.

### 2.7 — Database, transactions, concurrency
- Every multi-write operation: wrapped in `prisma.$transaction`?
- Every state transition that has a precondition (e.g. checkpoint advance): atomic via `updateMany` with `where` clause + count check?
- Race conditions in: code redemption, checkpoint advance, theory submission against SOLVED state, slug rename + redirect, registration uniqueness.
- N+1 query patterns in admin lists, bureau lists, public case page.
- Missing indexes on hot paths (lookups by email, by slug, by code, by sessionId, by userId+caseId).
- Cascade behavior: when a User or CaseFile is deleted, what happens to dependent rows? Are there any unintended cascading deletes?
- Soft delete consistency: `retiredAt`, `revokedAt`, `archivedAt` — every read that should respect soft-delete actually does.
- Connection pooling: pooled URL for runtime, direct URL for migrations — verified in code.

### 2.8 — Email & deliverability
- Resend `from` domain — verified in Resend dashboard, SPF/DKIM/DMARC set up?
- Every transactional email (signup, reset, purchase, support reply) — content reviewed for phishing-likeness, broken links, unrendered template vars.
- Activation code emails — hard to phish-clone? Include unique purchase reference?
- Support reply path — does it set proper `Reply-To`, threaded headers, and avoid leaking internal IDs?

### 2.9 — File upload pipeline (R2)
- Presigned URL expiry (15 min) — appropriate.
- Object key naming — does it allow user-controlled paths that could collide or overwrite?
- Public-read policy on the bucket — intentional? Any non-public objects mistakenly readable?
- Blurhash endpoint SSRF guard — host allowlist logic correct under all parsed-URL edge cases?
- Image bomb / decompression DoS — Sharp limits set?
- Cleanup: orphaned R2 objects (uploaded but never persisted to DB) — is there a sweeper?

### 2.10 — Frontend / React / RSC
- Client/server boundary correctness: no server secrets imported into client components.
- Hydration mismatches: any time-based, locale-based, or random values rendered without `suppressHydrationWarning` discipline.
- Suspense boundaries around dynamic content (`useSearchParams`).
- Form double-submit prevention (disabled state, loading state).
- Optimistic UI vs server truth — diverges on error?
- Accessibility: labels on every input, focus management on modal/dialog, keyboard nav, color contrast, landmark roles. Run a mental WCAG 2.1 AA pass.
- SEO: every public page has `<title>`, `<meta description>`, OpenGraph, canonical URL.

### 2.11 — TypeScript & code health
- `strict: true`? Any `// @ts-ignore` / `// @ts-expect-error` / `as any` / `as unknown as` — justified?
- Public API types match runtime validators (Zod-inferred types vs hand-written types — drift?).
- Prisma types vs API response shapes — leaking server-only fields to the client?
- Dead code: exports nobody imports, components nobody mounts, routes nobody links to.
- Duplicated logic that should be a shared helper.
- Magic strings / magic numbers — moved to enums/constants?

### 2.12 — Error handling & observability
- Every API route: typed error responses, no leaked stack traces, correct status codes.
- Every external call (Stripe, Resend, R2, Prisma): wrapped in try/catch with a useful log.
- Logging: structured (json) or unstructured? Does it include enough to trace a bug across services? Does it accidentally log secrets, tokens, passwords, full webhook payloads?
- Monitoring/alerting hooks present? (Sentry, Vercel logs, custom alerting on Stripe orphans.)
- 404 / 500 / `error.tsx` / `not-found.tsx` — present at every route group?

### 2.13 — Migrations & deploy safety
- Every migration: is it backwards-compatible during a rolling deploy? (Drop column = unsafe.)
- Any migration that takes a long lock on a hot table?
- Down-migration story: does Prisma support what you'd need to roll back?
- Seed scripts: idempotent? Safe to run against prod (or guarded with `assertSafeEnv`)?
- `assertSafeEnv` coverage — every destructive script protected?

### 2.14 — Vercel / production config
- Build settings: correct Node version, correct framework preset, no leaked dev dependencies in prod bundle.
- Environment variable parity: every variable in `.env.example` set in Vercel for both Preview and Production.
- Preview deploys: are they pointed at a non-prod database and non-prod Stripe key? (Bug to flag if Preview uses prod creds.)
- Function regions vs database region (Neon US East 1) — co-located? Latency analysis.
- Edge vs Node runtime per route — anything on `edge` that uses Node-only APIs (Prisma, Sharp, NextAuth credentials)?
- Cron / scheduled tasks for: orphan-session cleanup, expired-token cleanup, abandoned-cart sweep — present?

### 2.15 — Compliance & legal
- PCI: confirm no card data ever touches the server (Stripe Checkout offloads this).
- GDPR / CCPA: is there a privacy policy? Account deletion flow? Data export? The CLAUDE.md notes Footer dropped `/terms` and `/privacy` links — flag this.
- Cookie banner / consent — needed for the audience? Currently present?
- Email opt-in / unsubscribe link on transactional vs marketing emails.
- Age gating, ToS acceptance at registration.

### 2.16 — UX, copy, edge cases
- Every form: empty state, loading state, error state, success state, disabled state.
- Every list: empty, one item, many items, paginated, error.
- Every flow: what if the user closes the tab mid-action? Refreshes? Back-button-spams?
- Copy clarity in critical moments: post-purchase, post-redeem, post-reset. (CLAUDE.md flags `/bureau/unlock` "We saved your code" copy as misleading — verify.)
- Mobile viewport: every page tested? Tap targets ≥ 44px? Modal scroll?

### 2.17 — Anything else a 60-person elite team would catch
You are explicitly authorized to report findings outside the 16 categories above. Use your full judgment. Examples: business-logic loopholes, abuse vectors specific to the product (gifting an activation code to oneself for free, replaying a QR code, refund-after-solve), trademark/IP risks in copy, dark-pattern risks, founder bus-factor risks (single-key dependencies), backup/restore gaps, disaster recovery plan absence.

---

## FINDING FORMAT (use exactly this for every issue)

```
### [P0|P1|P2|P3|P4] <short title>

**Location:** path/to/file.ts:LINE-LINE  (and any related files)

**What:** One sentence describing what is wrong.

**Evidence:**
> ```ts
> exact quoted snippet from the file
> ```

**Why it's a problem:** 2–4 sentences explaining the failure mode and the realistic attack/bug scenario. Be specific.

**Impact:** Who is affected and how badly. Quantify if possible (e.g. "every user who registers between deploy A and deploy B").

**Remediation:** Concrete fix in 1–5 sentences. Code sketch only if it clarifies — do not write the full patch.

**Verification:** How a reviewer can confirm the fix worked (specific test, specific manual step).
```

---

## PHASE 3 — SYNTHESIS & EXECUTIVE REPORT

After Phase 2 is complete, produce:

1. **Executive summary (max 400 words):** State of the codebase. What is solid. What is fragile. What would block launch tomorrow. Written so a non-technical co-founder could read it.

2. **Findings dashboard:** A table listing every finding by severity, with title and one-line impact. Sorted P0 first.

3. **Top 10 launch-blockers:** The ten things that, if not fixed, will hurt the founder most. With your reasoning for the ranking.

4. **Quick-wins list:** Findings that are < 30 minutes of work each, ordered by impact-per-minute.

5. **Strategic recommendations (max 8 bullets):** Architectural moves to consider over the next 1–3 months — not bugs, *direction*. E.g. "introduce a worker queue for email retries", "add Sentry", "split admin into a separate Next.js app", etc. Be opinionated.

6. **What you did NOT audit:** Every category, file, or surface you could not fully inspect (e.g. "could not run `npm audit` from this session", "did not verify Vercel dashboard config", "did not test against live Stripe webhooks"). The human will close these gaps externally.

7. **Coverage attestation:** Confirm every file in the coverage tracker from Phase 0 was read in Phase 1. If any were skipped, list them and why.

---

## HARD RULES (re-read before you begin)

- Read everything you cite. No invented line numbers. No fabricated quotes.
- Sequential phases. Phase 1 deliverables exist before Phase 2 starts. Phase 2 deliverables exist before Phase 3 starts.
- Read-only. No edits, no migrations, no installs, no `prisma db push`, no `vercel deploy`. Findings only.
- Plain markdown report. No emojis. No filler. No hedging adjectives ("seems okay", "probably fine"). Either it's a finding or it's not.
- If a category has no findings, say "No findings. Checked: <specific list of what you checked>." Do not skip the section.
- If you are uncertain about an external behavior (e.g. "does Stripe deliver this webhook before or after the redirect"), state the uncertainty, document the assumption you'd verify, and continue. Do not stall.
- Length is not a virtue. Density is. A 30-page report of pure signal beats a 100-page report of mush.
- When in doubt, escalate severity rather than suppress it. The cost of a missed P0 is enormous; the cost of an over-flagged P2 is a five-minute conversation.

---

## BEGIN

Confirm you have read this entire prompt. Then begin Phase 0. Do not ask for permission between phases — proceed straight through 0 → 1 → 2 → 3, producing the deliverables for each phase as labeled sections of one continuous report.

Go.
