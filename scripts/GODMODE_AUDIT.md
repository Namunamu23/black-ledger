# ═══════════════════════════════════════════════════════════════════════════
# BLACK LEDGER — GOD MODE FULL-SPECTRUM CODEBASE AUDIT
# ═══════════════════════════════════════════════════════════════════════════
#
# This is a structured protocol for Claude Code to perform a complete,
# multi-expert, line-by-line audit of the Black Ledger codebase.
#
# You are operating in GOD MODE. This means you will use every capability
# available to you, read every single file, and analyze the codebase from
# six simultaneous expert perspectives before synthesizing a final report.
#
# Do not summarize. Do not skip. Do not guess. Every claim must be backed
# by a file path and line number you have actually read.
# ═══════════════════════════════════════════════════════════════════════════

## MISSION

Perform a COMPLETE, EVIDENCE-BASED, MULTI-EXPERT AUDIT of the Black Ledger
codebase located at the current working directory. Read every tracked file.
Analyze every line. Build a full mental model of the system before writing
a single word of your findings.

This is not a casual review. This is a pre-launch security clearance.

---

## PHASE 0 — ENVIRONMENT SETUP (do this first, before reading any files)

Run the following shell commands and record the output. This establishes
ground truth about the repo state before you start reading source files.

```bash
# 1. Full git status
git status --short

# 2. Complete commit log (last 20)
git log --oneline -20

# 3. All tracked files (source of truth — this is your reading list)
git ls-files | grep -v package-lock.json | sort

# 4. TypeScript compilation check
npx tsc --noEmit 2>&1 | head -50

# 5. Full test run
npm test 2>&1 | tail -30

# 6. Dependency audit
npm audit --json 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Vulnerabilities: {d[\"metadata\"][\"vulnerabilities\"]}')" 2>/dev/null || echo "npm audit output above"

# 7. Dead code / unused imports check
npx eslint . --ext .ts,.tsx --format compact 2>&1 | head -50

# 8. Bundle size (if buildable)
# Skip — don't build, just note it as pending
```

Record the exact output of each command. Do not proceed to Phase 1 until
all commands have been run and output captured.

---

## PHASE 1 — FILE-BY-FILE COMPLETE READ

Read EVERY file in the order below. For each file, record:
- File path
- Line count
- Primary responsibility (one sentence)
- Any anomalies noticed (do not analyze yet — just flag)

**Reading order (dependency-respecting — read dependencies before dependents):**

### Tier 0 — Foundation
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `eslint.config.mjs`
- `postcss.config.mjs`
- `.gitattributes`
- `.env.example`
- `prisma.config.ts`

### Tier 1 — Schema & Data Contract
- `prisma/schema.prisma`
- `prisma/migrations/20260425045353_init/migration.sql`
- `prisma/migrations/20260425142952_add_order/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `types/next-auth.d.ts`

### Tier 2 — Core Library (everything depends on these)
- `lib/prisma.ts`
- `lib/enums.ts`
- `lib/labels.ts`
- `lib/validators.ts`
- `lib/auth-helpers.ts`
- `lib/rate-limit.ts`
- `lib/post-login-path.ts`
- `lib/user-case-state.ts`
- `lib/case-evaluation.ts`
- `lib/case-quality.ts`
- `lib/text-utils.ts`
- `lib/stripe.ts`
- `lib/resend.ts`

### Tier 3 — Auth & Middleware
- `auth.config.ts`
- `auth.ts`
- `middleware.ts`
- `next.config.ts`
- `app/api/auth/[...nextauth]/route.ts`

### Tier 4 — Data Layer (seed + scripts)
- `data/site.ts`
- `prisma/seed/cases/harbor-fog.ts`
- `scripts/create-admin.ts`
- `scripts/seed-case-file.ts`
- `scripts/seed-global-people.ts`
- `scripts/new-case.ts`
- `scripts/reset-case-progress.ts`
- `scripts/test-full-flow.ts`

### Tier 5 — API Routes (player-facing)
- `app/api/cases/activate/route.ts`
- `app/api/cases/[slug]/checkpoint/route.ts`
- `app/api/cases/[slug]/theory/route.ts`
- `app/api/access-codes/redeem/route.ts`
- `app/api/checkout/route.ts`
- `app/api/checkout/status/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/support/route.ts`
- `app/api/waitlist/route.ts`
- `app/u/[code]/route.ts`

### Tier 6 — API Routes (admin)
- `app/api/admin/cases/route.ts`
- `app/api/admin/cases/[caseId]/route.ts`
- `app/api/admin/cases/[caseId]/overview/route.ts`
- `app/api/admin/cases/[caseId]/people/route.ts`
- `app/api/admin/cases/[caseId]/records/route.ts`
- `app/api/admin/cases/[caseId]/hints/route.ts`
- `app/api/admin/cases/[caseId]/checkpoints/route.ts`
- `app/api/admin/cases/[caseId]/solution/route.ts`
- `app/api/admin/cases/[caseId]/workflow/route.ts`
- `app/api/admin/cases/[caseId]/codes/route.ts`
- `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts`
- `app/api/admin/cases/[caseId]/activation-codes/route.ts`
- `app/api/admin/cases/[caseId]/access-codes/route.ts`
- `app/api/admin/uploads/sign/route.ts`
- `app/api/admin/uploads/blurhash/route.ts`
- `app/api/admin/support/[id]/reply/route.ts`
- `app/api/admin/support/[id]/status/route.ts`

### Tier 7 — Application Layout & Root
- `app/layout.tsx`
- `app/globals.css`
- `app/page.tsx`
- `app/not-found.tsx`
- `app/bureau/layout.tsx`
- `app/bureau/admin/layout.tsx`

### Tier 8 — Bureau Pages (authenticated player experience)
- `app/bureau/page.tsx`
- `app/bureau/cases/[slug]/page.tsx`
- `app/bureau/cases/[slug]/_components/RevealedEvidence.tsx`
- `app/bureau/cases/[slug]/database/page.tsx`
- `app/bureau/cases/[slug]/debrief/page.tsx`
- `app/bureau/cases/[slug]/records/[recordId]/page.tsx`
- `app/bureau/archive/page.tsx`
- `app/bureau/database/page.tsx`
- `app/bureau/people/[personId]/page.tsx`
- `app/(unlock)/bureau/unlock/page.tsx`
- `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx`

### Tier 9 — Admin Pages
- `app/bureau/admin/cases/page.tsx`
- `app/bureau/admin/cases/[caseId]/edit/page.tsx`
- `app/bureau/admin/cases/[caseId]/edit/_components/Tabs.tsx`
- `app/bureau/admin/cases/[caseId]/edit/_components/OverviewTab.tsx`
- `app/bureau/admin/cases/[caseId]/edit/_components/PeopleTab.tsx`
- `app/bureau/admin/cases/[caseId]/edit/_components/RecordsTab.tsx`
- `app/bureau/admin/cases/[caseId]/edit/_components/HintsTab.tsx`
- `app/bureau/admin/cases/[caseId]/edit/_components/CheckpointsTab.tsx`
- `app/bureau/admin/cases/[caseId]/edit/_components/SolutionTab.tsx`
- `app/bureau/admin/cases/[caseId]/codes/page.tsx`
- `app/bureau/admin/cases/[caseId]/codes/_components/GenerateCodesForm.tsx`
- `app/bureau/admin/cases/[caseId]/codes/_components/RevokeButton.tsx`
- `app/bureau/admin/cases/[caseId]/codes/_components/ExportCsvButton.tsx`
- `app/bureau/admin/cases/[caseId]/access-codes/page.tsx`
- `app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodeList.tsx`
- `app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodesPanel.tsx`
- `app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx`
- `app/bureau/admin/cases/[caseId]/preview/page.tsx`
- `app/bureau/admin/support/page.tsx`
- `app/bureau/admin/support/[id]/page.tsx`
- `app/bureau/admin/support/[id]/_components/ReplyForm.tsx`
- `app/bureau/admin/support/[id]/_components/StatusActions.tsx`

### Tier 10 — Public Pages
- `app/cases/page.tsx`
- `app/cases/[slug]/page.tsx`
- `app/about/page.tsx`
- `app/faq/page.tsx`
- `app/how-it-works/page.tsx`
- `app/support/page.tsx`
- `app/login/page.tsx`
- `app/checkout/success/page.tsx`

### Tier 11 — Components
- `components/admin/CaseReadinessPanel.tsx`
- `components/admin/CreateCaseForm.tsx`
- `components/admin/GenerateActivationCodeButton.tsx`
- `components/admin/ImageUploader.tsx`
- `components/admin/PublishCaseButton.tsx`
- `components/auth/LoginForm.tsx`
- `components/auth/SignOutButton.tsx`
- `components/bureau/ArchiveStatCard.tsx`
- `components/bureau/BuyButton.tsx`
- `components/bureau/CaseActivationForm.tsx`
- `components/bureau/CaseDatabaseSearch.tsx`
- `components/bureau/CheckpointForm.tsx`
- `components/bureau/GlobalPeopleSearch.tsx`
- `components/bureau/StatusBadge.tsx`
- `components/bureau/TheorySubmissionForm.tsx`
- `components/cases/CasePublicView.tsx`
- `components/forms/SupportForm.tsx`
- `components/forms/WaitlistForm.tsx`
- `components/layout/Footer.tsx`
- `components/layout/Navbar.tsx`
- `components/ui/Button.tsx`
- `components/ui/ButtonLink.tsx`
- `components/ui/Card.tsx`
- `components/ui/InfoCard.tsx`
- `components/ui/PageHero.tsx`
- `components/ui/Pill.tsx`
- `components/ui/RedactedBar.tsx`
- `components/ui/Reveal.tsx`
- `components/ui/SectionHeader.tsx`
- `components/ui/StampBadge.tsx`
- `components/ui/TerminalReadout.tsx`
- `components/ui/index.ts`

### Tier 12 — Tests (all 19 files)
- `tests/api/access-codes-redeem.test.ts`
- `tests/api/admin-cases.test.ts`
- `tests/api/admin-codes.test.ts`
- `tests/api/admin-section-patches.test.ts`
- `tests/api/admin-slug-history.test.ts`
- `tests/api/admin-support.test.ts`
- `tests/api/admin-uploads.test.ts`
- `tests/api/bureau-people.test.ts`
- `tests/api/checkpoint.test.ts`
- `tests/api/stripe.test.ts`
- `tests/api/theory.test.ts`
- `tests/api/workflow.test.ts`
- `tests/lib/auth-helpers.test.ts`
- `tests/lib/case-evaluation.test.ts`
- `tests/lib/case-quality.test.ts`
- `tests/lib/post-login-path.test.ts`
- `tests/lib/rate-limit.test.ts`
- `tests/lib/user-case-state.test.ts`
- `tests/routes/unlock-flow.test.ts`

### Tier 13 — Documentation
- `CLAUDE.md`
- `README.md`
- `docs/BUREAU_BIBLE.md`

---

## PHASE 2 — ARCHITECTURE RECONSTRUCTION

After reading all files, write a complete architecture document from memory.
Do not re-read files for this phase — use what you have learned.

Document these dimensions:

### 2A — Data Flow Map
Trace data from input to database to output for each of these flows:
1. Kit purchase: `BuyButton → POST /api/checkout → Stripe → webhook → ActivationCode email`
2. Case activation: `CaseActivationForm → POST /api/cases/activate → UserCase`
3. Checkpoint answer: `CheckpointForm → POST /api/cases/[slug]/checkpoint → stage advance`
4. Theory submission: `TheorySubmissionForm → POST /api/cases/[slug]/theory → SOLVED`
5. QR code scan: `/u/[code] → /bureau/unlock → POST /api/access-codes/redeem → content`
6. Admin case publish: `OverviewTab → PATCH /api/admin/cases/[caseId]/workflow → PUBLISHED`

For each flow: list every file touched, every DB operation, every external call.

### 2B — Auth & Authorization Matrix
Build a table mapping every route pattern to:
- Auth requirement (public / session / admin)
- How it is enforced (middleware / requireAdmin / requireSession / requireSessionJson)
- Rate limit (yes/no, limit, window)
- CSRF protection (yes/no/exempt)

### 2C — Database Schema Dependency Graph
List all 30 models. For each model:
- Foreign key relationships (parent/child)
- Cascade delete behavior
- Unique constraints
- What creates rows, what reads them, what deletes them

### 2D — Error Path Coverage
For every API route, trace:
- What happens on DB connection failure
- What happens if the authenticated user's ID is invalid
- What happens if an optional field is null when code expects it defined
- Identify any unhandled throw paths

### 2E — State Machine Inventory
Identify all state machines in the codebase:
- `UserCaseStatus` transitions
- `CaseWorkflowStatus` transitions
- `OrderStatus` transitions
- `AccessCode.retiredAt` lifecycle
- `ActivationCode.revokedAt` lifecycle

For each: is the transition logic centralized or scattered? Is it enforced at DB level or only in application code?

---

## PHASE 3 — SIX-EXPERT SIMULTANEOUS ANALYSIS

You are now six experts examining the same codebase at the same time.
Each expert has a specific lens. Each expert is relentless and opinionated.
Do not soften findings. Do not say "could potentially" — say what IS or IS NOT.

---

### EXPERT 1: OFFENSIVE SECURITY ENGINEER / PENETRATION TESTER

Your job: break this app. Assume a motivated attacker with a paid account,
access to the public site, and a decompiled copy of the JavaScript bundle.

Examine every attack surface:

**Authentication attacks**
- JWT secret strength and rotation strategy
- Session fixation opportunities
- Password reset flow (does one exist? what happens without it?)
- Brute force protection on login endpoint
- Cookie flags (HttpOnly, Secure, SameSite) — verify these are set by next-auth
- TOTP / MFA absence

**Authorization attacks**
- Every privilege escalation path: can INVESTIGATOR touch any admin API?
- Horizontal privilege: can user A access user B's case data?
- Insecure direct object references: any route that takes a numeric ID without ownership check?
- The `revokedAt` gap on ActivationCode — confirmed impact
- Mass assignment: do any routes accept arbitrary JSON keys that get spread into DB updates?

**Injection attacks**
- SQL injection: is Prisma parameterized everywhere? (it is, but verify)
- JSON injection: any `unlocksTarget` JSON field that gets eval'd or interpolated into SQL
- Template injection: any string interpolation in email HTML?
- Path traversal: any `publicUrl` fields used in file system operations?

**Business logic attacks**
- Race conditions: identify every non-atomic read-then-write sequence
- Time-of-check / time-of-use (TOCTOU) windows
- Replay attacks: can a Stripe webhook be replayed? (check idempotency)
- Price manipulation: can the checkout price be overridden client-side?
- Code enumeration: how guessable are activation codes? (format: `SLUG-8HEXCHARS` — entropy calculation)
- Free access: any path to create a UserCase without a valid ActivationCode?

**Infrastructure attacks**
- SSRF: R2 blurhash route — is the host allowlist sufficient?
- CORS: what is the CORS policy?
- Clickjacking: X-Frame-Options DENY confirmed — any iframe embeds that need it?
- Open redirect: callbackUrl sanitization — is `pickPostLoginPath` airtight?
- Prototype pollution: any `Object.assign` or spread with user-controlled keys?

**Supply chain**
- `next-auth 5.0.0-beta.30` — check if any known CVEs exist
- Any `eval()`, `Function()`, or `dangerouslySetInnerHTML` usage anywhere?
- Any dynamic `require()` calls with user input?

**Findings format for Expert 1**:
```
[SEC-XX] SEVERITY: CRITICAL/HIGH/MEDIUM/LOW/INFO
File: path/to/file.ts:LINE
Vector: [attack type]
Impact: [what an attacker achieves]
Evidence: [exact code snippet]
Fix: [specific remediation]
```

---

### EXPERT 2: PROFESSIONAL FULL-STACK ARCHITECT

Your job: assess the structural integrity of this application as if you were
the tech lead who will maintain it for the next 3 years.

Examine:

**API design**
- REST consistency: are HTTP status codes correct throughout?
  (201 for creates? 200 for updates? 204 for deletes? 409 for conflicts? 422 for validation?)
- Response shape consistency: are error bodies always `{ message: string }`?
- Are there any routes that return 200 on what should be a 4xx?
- Pagination: which list endpoints have it, which don't, what happens at scale?

**Data modeling**
- Are there any N+1 query patterns in server components or API routes?
- Are there missing indexes? (examine all `findFirst`/`findMany` `where` clauses)
- Any Prisma queries that could be combined into one?
- The `CaseAudit` table: is it complete? What operations skip it?

**Component architecture**
- Client/server boundary: any `"use client"` components doing data fetching they shouldn't?
- Any server components importing browser-only APIs?
- Prop drilling vs. context vs. server-side data passing patterns
- Are there any React key prop issues (list rendering with stable keys)?

**Code quality**
- Any functions over 100 lines that should be split?
- Any duplicated logic that should be extracted to lib?
- TypeScript: any `any` types, unsafe casts (`as Unknown`), non-null assertions (`!`) that could blow up?
- Any `console.log` / `console.error` calls that should be structured logging?
- Any `TODO` / `FIXME` / `HACK` comments?

**Scalability concerns**
- The in-memory rate limiter: what happens under multiple Node instances (e.g., on Vercel)?
- The `activationCode` uniqueness loop: is there a DOS vector if the slug is very short?
- Any unbounded queries (no `take`/`limit`) that could scan the entire table?

**Findings format for Expert 2**:
```
[ARCH-XX] PRIORITY: P1/P2/P3
File: path/to/file.ts:LINE
Pattern: [anti-pattern name]
Impact: [what breaks at scale or over time]
Evidence: [exact code]
Fix: [specific refactor]
```

---

### EXPERT 3: DATA SCIENTIST / DATA ENGINEER

Your job: analyze every data flow, data model, and data quality concern
as if you're the person who has to build dashboards and ML features on top
of this data in 12 months.

Examine:

**Data completeness**
- Which models have optional fields that will be null in practice? What does null mean?
- `UserCase.firstOpenedAt` / `lastViewedAt` / `completedAt`: when are these set? Are there gaps?
- `ActivationCode.kitSerial`: optional, rarely populated — data quality concern for physical kit tracking
- `GlobalPerson.internalNotes`: free text, no schema — future search/categorization concern

**Data integrity**
- Cascade deletes: map all `onDelete: Cascade` relationships. What data is destroyed when a case is deleted?
  (CasePerson, CaseRecord, CaseHint, CaseCheckpoint, TheorySubmission, CheckpointAttempt, CaseAudit,
   AccessCode, AccessCodeRedemption, HiddenEvidence, Order, UserCase)
- Is it safe to delete a CaseFile that has Orders? The Order model FK has no cascade — what happens?
- Any orphan risk: AccessCodeRedemption.caseFileId — is this ever out of sync with accessCode.caseFileId?

**Analytics readiness**
- `UserCaseEvent` table: what events are created? (`ACTIVATE` confirmed in activate route — any others?)
  Search all routes and state machine for `userCaseEvent.create` calls.
- `CaseAudit` table: what is the `diff` JSON shape? Is it consistent across all writing paths?
- `TheorySubmission`: stores scores (0-3) and boolean flags — sufficient for win-rate analytics?
- `CheckpointAttempt`: records all attempts — sufficient for difficulty calibration?

**Data flows**
- Trace the complete life of a `UserCase` row from creation to SOLVED:
  - Created by: activate route
  - Updated by: checkpoint route (currentStage), theory route (status, completedAt)
  - Read by: bureau page, case page, theory route, checkpoint route, redeem route
  - Is `lastViewedAt` ever updated? If not, it's dead data.

**Identifier design**
- `GlobalPerson.bureauId`: unique string, manually assigned. What is the format? How is uniqueness enforced?
- `CaseFile.slug`: human-readable unique identifier. Good for URLs but creates rename complexity (handled via CaseSlugHistory)
- `ActivationCode.code`: format `SLUG-8HEXCHARS`. Entropy = 4 bytes = 4,294,967,296 values per slug.
  At 1 million codes per slug prefix, collision rate is ~0.0023%. Acceptable.

**Findings format for Expert 3**:
```
[DATA-XX] TYPE: INTEGRITY/COMPLETENESS/QUALITY/ANALYTICS
Model/Field: ModelName.fieldName
Concern: [specific issue]
Impact: [what breaks or becomes unmeasurable]
Evidence: [schema line or query that demonstrates the issue]
Recommendation: [specific fix or accepted risk]
```

---

### EXPERT 4: PROFESSIONAL DEBUGGER / QA ENGINEER

Your job: find every edge case, every uncaught exception, every assumption
the code makes that will not hold in production.

Examine:

**Null and undefined paths**
- Every `Number(...)` conversion: what happens if the input is `"abc"` or `undefined`?
  (Note: `Number("abc") === NaN`, and `Number.isInteger(NaN) === false` — is this handled?)
- Every `.find()` on an array: is the possible `undefined` return handled?
- Every optional chaining `?.` call: what is the fallback behavior when it short-circuits?

**Async error handling**
- Every `.catch(() => null)` or `.catch(() => {})`: what gets silently swallowed?
- Every `await request.json().catch(() => null)`: if the body is malformed, the route continues with `null`. Is that null checked?
- Every `Promise.all()`: if one promise rejects, does the whole page crash? 
  (BureauCasePage `revealedEvidence` resolution — one DB failure = whole page 500)

**Type assertion risks**
- Every `as { ... }` cast: what happens if the shape doesn't match at runtime?
  (e.g., `const target = unlocksTarget as UnlocksTarget` — what if `unlocksTarget` is `null` from the DB?)
- `session?.user as { id?: string } | undefined` — this pattern is used in multiple pages.
  What if `session.user.id` is undefined? Number(undefined) = NaN, Number.isInteger(NaN) = false. Handled?

**Race conditions**
- `activate/route.ts`: uses `updateMany({ where: { claimedByUserId: null } })` as optimistic lock.
  What if two concurrent requests both read `claimedByUserId: null` then both try to update?
  The `updateMany` count check handles this — confirm it's correct.
- `access-codes/redeem/route.ts`: the `oneTimePerUser` check is a read-then-write with no transaction.
  A concurrent request between the `findFirst` and `create` could create two redemptions.
  The `@@unique` constraint + P2002 catch handles this — confirm.

**Input validation gaps**
- Every Zod schema: are there fields that are validated as strings but used as numbers?
- The `unlocksTarget` JSON field on AccessCode: no Zod schema validates its internal structure.
  A malformed `{ type: "record", id: "not-a-number" }` would cause `findUnique({ where: { id: NaN } })`.
  What does Prisma do with `id: NaN`?
- `requiresStage` on AccessCode: validated as `Int?` in schema. What happens if someone inserts `requiresStage: 999`?

**Production-specific failures**
- The `_resetForTesting` export from `lib/rate-limit.ts`: is it guarded so it only works in test mode?
  If not, a caller could reset rate limits in production.
- The `scripts/test-full-flow.ts` script: does it write to the production database if run against prod env?
- The seed scripts: do they check the environment before writing?

**Findings format for Expert 4**:
```
[BUG-XX] SEVERITY: CRASH/CORRUPTION/BEHAVIORAL/EDGE_CASE
File: path/to/file.ts:LINE
Trigger: [exact input or condition that triggers the bug]
Expected: [what should happen]
Actual: [what does happen]
Evidence: [exact code]
Fix: [exact patch]
```

---

### EXPERT 5: ML ENGINEER / ALGORITHMIC ANALYST

Your job: analyze every algorithm, scoring function, and decision system
in the codebase as if you're going to A/B test it and tune it for conversion.

This is not a machine learning product, but it CONTAINS scoring algorithms
and matching logic that behave like classifiers. Analyze them with ML rigor.

Examine:

**The Theory Evaluator (`lib/case-evaluation.ts`)**
- What is the exact scoring algorithm? (Jaccard similarity + exact name matching)
- What is the decision threshold? (≥ 0.34 Jaccard OR ≥ 2 matching tokens)
- Is this threshold well-calibrated? 
  - At 0.34 Jaccard: a 3-token answer needs 1 token to match
  - At 2-token match: a very short answer can pass with a common word
- False positive rate: what is the minimum submission that scores CORRECT?
  Write an example of the shortest possible correct answer.
- False negative rate: what is a semantically correct answer that scores INCORRECT?
- The `normalizeIdentity` function: what transformations does it apply?
  (lowercasing, punctuation removal, etc. — enumerate all)
- Is there a whitelist of stop words? What happens with "the", "a", "and", "of"?
- Case insensitivity: confirmed via normalization, but what about unicode characters?
  (e.g., "Anya Vólkov" vs "Anya Volkov")

**The Checkpoint Matcher (`app/api/cases/[slug]/checkpoint/route.ts`)**
- Does it use the same `normalizeIdentity + Jaccard` as theory evaluation?
- What are the thresholds? Same as theory or different?
- Can a player spam wrong answers? (rate-limited at 20/60s)
- Can a player brute-force a short answer? (at 20 req/60s, a 3-char alpha code = 17,576 possibilities = ~14.6 hours minimum)

**The `case-quality.ts` library** (you may not have read this yet — read it now)
- What does it compute?
- Is it used in any route or component?
- Is it tested?

**Scoring analytics**
- `TheorySubmission.score` ranges 0–3. The scoring fields are boolean (suspectCorrect, motiveCorrect, evidenceCorrect).
  Score = sum of true values. Simple, legible. Any concern with this model?
- Are scores stored at submission time or recomputed? (Answer: stored — so changing solution fields doesn't retroactively affect scores)

**Findings format for Expert 5**:
```
[ALG-XX] TYPE: CALIBRATION/FALSE_POSITIVE/FALSE_NEGATIVE/BIAS/EDGE_CASE
Function: lib/case-evaluation.ts:LINE or similar
Concern: [specific algorithmic issue]
Example input: [exact input that triggers the issue]
Expected output: [what should happen]
Actual output: [what does happen]
Impact: [player experience effect]
Fix: [tuning suggestion or code change]
```

---

### EXPERT 6: DEVOPS / INFRASTRUCTURE / DEPLOYMENT ENGINEER

Your job: assess the readiness of this application to be deployed to
production and run reliably at scale.

Examine:

**Environment configuration**
- Map every `process.env.*` reference in the codebase to the `.env.example` file
- Are there any env vars used in code that are NOT in `.env.example`?
- Are there any env vars in `.env.example` that are NOT used in code? (dead config)
- Are any secrets loaded at module initialization time vs. request time?
  (Lazy singletons like `getStripe()` and `getResend()` are better — confirm this pattern everywhere)

**Startup resilience**
- What happens if `DATABASE_URL` is missing at startup? Does the app crash immediately or on first request?
- What happens if `AUTH_SECRET` is missing?
- What happens if `STRIPE_SECRET_KEY` is missing? Does the Stripe client throw at startup or only when called?
- Are there any `process.exit()` calls that could crash the app?

**Connection management**
- Neon Postgres: pooled URL for runtime. What is the `pg` pool size? (default is 10)
  At Vercel's serverless invocation rate, this may need a pgBouncer-style connection limit.
- Upstash Redis: used only when both env vars are present. How gracefully does rate limiting degrade
  in dev mode? Can an in-memory map growth cause OOM in a long-running process?

**Logging and observability**
- Error logging: `console.error(...)` is the only error reporting. No structured logging, no Sentry, no alerting.
  Map every `catch` block that calls `console.error`.
- Request tracing: no request ID header, no correlation ID. Debugging a production error requires guessing.
- What metrics would you need to know if the app is healthy? Which are currently observable?

**Deployment readiness**
- Build: `next build` — any known issues with Prisma 7 + Next.js 16 edge runtime?
  (The Prisma PG adapter requires Node.js runtime, not Edge runtime — confirm no routes use `runtime = "edge"`)
- Static vs. dynamic: which pages are statically rendered? Which require SSR?
- `R2_PUBLIC_URL` env var: is it set in production? Without it, hero images and portraits won't load.

**Backup and recovery**
- Is there a database backup strategy for Neon free tier? (Neon free: 1-day PITR only)
- What is the recovery procedure if the Stripe webhook misses an event?
  (The orphan recovery in the webhook handler helps — but what about events that never arrive?)

**Findings format for Expert 6**:
```
[OPS-XX] SEVERITY: P1/P2/P3
File: path/to/file.ts:LINE or env var
Category: STARTUP/OBSERVABILITY/SCALING/CONFIG/RECOVERY
Concern: [specific operational risk]
Impact: [what fails or degrades in production]
Evidence: [exact code or config]
Fix: [actionable remediation]
```

---

## PHASE 4 — CROSS-EXPERT SYNTHESIS

After all six experts have completed their analysis, synthesize the findings.

### 4A — Interaction Matrix
Identify findings where two or more expert analyses intersect. For example:
- A null-dereference bug (Expert 4) that is also an injection vector (Expert 1)
- A missing index (Expert 2) that also affects analytics queries (Expert 3)
- A startup crash risk (Expert 6) that is also a DoS vector (Expert 1)

### 4B — Risk-ranked Master Finding Table
Combine ALL findings from all six experts into a single table ranked by:
1. Exploitability (how easy to trigger)
2. Impact (what breaks or is exposed)
3. Detectability (how long before it's noticed)

Use a 1-10 scale for each. Overall risk = (Exploitability × Impact) / Detectability.

| ID | Expert | Title | E | I | D | Risk | Status |
|---|---|---|---|---|---|---|---|
| SEC-01 | Security | ... | | | | | |
| ... | | | | | | | |

### 4C — The One Thing To Do Right Now
State the single highest-risk item that is: (a) confirmed by direct source read, (b) fixable in under 60 minutes, and (c) would cause real harm in production if not fixed before first kit sale.

### 4D — The Three Things For This Week
State the three items (beyond #4C) that must be done before public launch.

### 4E — What Is Actually Good
List 10 things the codebase does exceptionally well. This is not padding — good engineering should be acknowledged so it is preserved through future changes.

---

## PHASE 5 — FINAL REPORT

Write a complete audit report with the following sections:

```
# BLACK LEDGER FULL-SPECTRUM AUDIT REPORT
Date: [today]
Auditor: Claude (God Mode — 6-Expert Protocol)
Files read: [count]
Total LOC analyzed: [count]
Tests verified: [count passing / count total]
Audit duration: [session duration]

## EXECUTIVE SUMMARY (3 paragraphs, CTO-readable)

## SYSTEM ARCHITECTURE (1 page — complete mental model)

## SECURITY ANALYSIS (Expert 1 findings)

## ARCHITECTURE ANALYSIS (Expert 2 findings)

## DATA INTEGRITY ANALYSIS (Expert 3 findings)

## BUG & EDGE CASE ANALYSIS (Expert 4 findings)

## ALGORITHMIC ANALYSIS (Expert 5 findings)

## INFRASTRUCTURE ANALYSIS (Expert 6 findings)

## MASTER RISK TABLE (combined, ranked)

## WAVE 1 — CRITICAL (fix before first sale)
## WAVE 2 — HIGH (fix before public launch)
## WAVE 3 — MEDIUM (fix before scaling)
## WAVE 4 — LOW (cleanup pass)

## WHAT IS WORKING WELL

## OPEN QUESTIONS (things that need decisions, not just code)

## CONFIDENCE STATEMENT
(For each finding: state whether you read the relevant source line directly,
or whether this is inferred. No hallucination tolerance.)
```

Save the report to: `docs/GODMODE-AUDIT-[YYYY-MM-DD].md`

---

## RULES FOR THIS AUDIT

1. **No hallucination**: Every finding must cite a file path and line number you read. If you are not sure, say "UNVERIFIED — requires source read" and go read it.

2. **No softening**: Do not say "might potentially" or "could possibly." If you found it, state it. If you did not find it, say it was not found.

3. **No skipping**: If a tier has 20 files, read all 20. Do not sample. Do not approximate.

4. **No duplication without value**: If Expert 4 finds a bug that Expert 1 already catalogued, note the intersection but do not repeat the full finding — reference it.

5. **Maintain running state**: As you read each file, maintain a mental running list of: (a) findings to investigate further, (b) confirmed bugs, (c) confirmed secure/correct behaviors. This running state is what the synthesis draws from.

6. **The report is for Nami**: She is the solo founder and product owner. She is the engineer. Write the report so she can pick up any finding and fix it in one sitting without asking follow-up questions. Every fix recommendation must be specific enough to implement without ambiguity.

---

*Begin Phase 0 immediately. Run the shell commands. Do not proceed to Phase 1 until all Phase 0 commands have been executed and output recorded.*
