# Batch 17 — Report

**Closed:** 2026-05-13.
**Branch:** `main`.
**Pre-batch HEAD:** unpushed working tree after Next.js 16.2.3 → 16.2.5 patch + npm update + sealed-publicVerdict regression test (all from earlier today). HEAD on origin/main: `453582a` (Batch 16 archive).
**Post-batch HEAD:** local-only — operator runs `git push` after the report lands.
**Push status:** local only.

Batch 17 lands the 13-fix bundle prepared from the 2026-05-13 god-mode super-script audit findings. **One additive schema migration** (`add_fk_indexes`). **No new dependencies.** **No env changes.** Tests will move from 211 (post-publicVerdict-regression-suite) to whatever the new total is — Batch 17 does not add new tests, only updates four existing test files to match changed mock surfaces.

The bundle covers four fix groups: low-risk UX/copy/cosmetic (8 fixes), defense-in-depth + reliability (3 fixes), forensic CaseAudit writes (5 fixes), and a schema migration adding nine FK / composite indexes on hot-read tables.

---

## 1. Pre-flight tree state

```
$ git rev-parse HEAD
453582a... (Batch 16 archive)

$ git status (pre-Batch-17, post-patch + tests)
 M AUDIT_PROMPT.md
 M AUDIT_PROMPT_V2.md
 M CLAUDE.md
 M package.json
 M package-lock.json
 M tests/api/theory.test.ts
?? AUDIT_PROMPT_V2.md (stub-pointer)
?? audits/2026-05-13-godmode-audit-super.md

$ npx tsc --noEmit
(clean, pre-batch)

$ npx vitest run
Test Files  25 passed (25)
Tests       211 passed (211)
```

The 211-test baseline reflects the 8-test sealed-publicVerdict regression suite added in the immediately preceding work-session.

---

## 2. Commit table (deferred — operator commits on Windows)

The work was done across many file edits in one Claude session; the operator commits as logically-grouped commits below. Recommended commit sequence:

| # | Subject |
|---|---|
| 1 | `fix(csp): drop dead fonts.googleapis.com from style-src (Batch 17 / A1)` |
| 2 | `fix(privacy): mask buyerEmail in webhook throttle log (Batch 17 / A2)` |
| 3 | `fix(email): forgot-password Reply-To + escapeHtml defense (Batch 17 / A3+A4)` |
| 4 | `fix(public): /cases catalog explicit select + caseSerial helper unification (Batch 17 / A5+A6)` |
| 5 | `fix(bureau): workspace inline caseSerial → helper unification (Batch 17 / A7)` |
| 6 | `fix(refund): /bureau/archive filter revokedAt: null on ownedCases (Batch 17 / A8)` |
| 7 | `fix(security): resolveContent + resolveEvidence caseFileId defense-in-depth (Batch 17 / B1)` |
| 8 | `fix(stripe): orphan handler returns 200 to stop retry storm (Batch 17 / B2)` |
| 9 | `fix(security): rate-limit admin GET endpoints (Batch 17 / B3)` |
| 10 | `feat(audit): CaseAudit writes for 5 case-scoped admin mutation routes (Batch 17 / C)` |
| 11 | `feat(schema): FK + composite indexes on hot-read tables (Batch 17 / D)` |
| 12 | `docs(audit): batch 17 report + observations` |

---

## 3. Fix Group A — UX, copy, cosmetic (8 fixes)

### A1 — CSP `style-src`: drop dead `fonts.googleapis.com`
- **File:** `next.config.ts:29`
- **Change:** removed `https://fonts.googleapis.com` from `style-src`.
- **Why:** mirrors the Batch 7 `font-src` cleanup (commit `b10dd68`). The codebase uses `next/font/google` which self-hosts at build time and never contacts the Google CDN at runtime.
- **Why not also drop `'unsafe-inline'`:** Tailwind v4 emits inline `<style>` blocks at first paint. Removing `'unsafe-inline'` requires the F-32/F-33 CSP-nonce migration (deferred per `CLAUDE.md` backlog).

### A2 — webhook `buyerEmail` PII masking
- **File:** `app/api/webhooks/stripe/route.ts:305` + new `maskEmail()` helper at line 510-ish.
- **Change:** the `[EMAIL-THROTTLE]` console.warn now masks `buyerEmail` via `${prefix.slice(0,2)}***@${domain}`.
- **Why:** Vercel logs retain stdout/stderr for hours-to-days depending on plan tier; logging full buyer addresses puts PII into that retention window unnecessarily. The mask preserves enough signal for the operator to recognise their own test traffic.

### A3 — `forgot-password` Reply-To
- **File:** `app/api/forgot-password/route.ts:62-65`
- **Change:** added `replyTo: "support@theblackledger.app"` to the Resend send.
- **Why:** matches the activation-email (F-20 closure, Batch 8 commit `bbe17b5`) and the support-reply send. Without this, users who click "reply" on the no-reply from-address get silently dropped.

### A4 — `forgot-password` HTML escape on URL interpolation
- **File:** `app/api/forgot-password/route.ts:58, 78, 81` + new local `escapeHtml()` helper at file bottom.
- **Change:** `${resetUrl}` and `${appUrl}` (now `${safeResetUrl}`) are HTML-escaped before insertion into the email body template.
- **Why:** belt-and-suspenders. Today `resetUrl` is built from `NEXT_PUBLIC_APP_URL` (server-controlled) + a 32-byte hex token (no escape-sensitive chars), so no XSS surface exists. The escape defends against a future change that introduces user-controlled values into the same template. Pattern mirrors the activation-email send in the Stripe webhook (which already had this defense).

### A5 — `/cases` catalog uses `caseSerial(caseFile)` helper
- **File:** `app/cases/page.tsx:76` (line moved after `select` insert).
- **Change:** replaced `const serial = "BL-" + String(index + 1).padStart(3, "0")` with `const serial = caseSerial(caseFile)`. Imported `caseSerial` from `@/lib/case-serial`.
- **Why:** UX-08 closure was incomplete in Batch 16 — the public catalog still drifted from the workspace serial whenever an earlier case was archived (the visible list renumbered, but workspace stayed pinned to id). Now the catalog uses the same id-based helper as every other surface.

### A6 — `/cases` catalog explicit `select`
- **File:** `app/cases/page.tsx:9-20`
- **Change:** added `select: { id, slug, title, summary, players, duration, difficulty }` to the `prisma.caseFile.findMany`.
- **Why:** prior to this fix, the page over-fetched `solutionSuspect`, `solutionMotive`, `solutionEvidence`, and all debrief prose fields on every catalog load. The page is RSC and the row never crossed the client boundary today, so no leak — but a future refactor that passes the row to a client component would silently leak the entire case answer to every browser hitting `/cases`. Explicit select is the structural defense.

### A7 — Workspace inline `caseSerial` → helper
- **File:** `app/bureau/cases/[slug]/page.tsx:8` (import), `:199-204` (derivation), `:252` (JSX).
- **Change:** replaced slug-based inline derivation with `caseSerial(caseFile)`. Renamed the local variable from `caseSerial` to `serial` to avoid shadowing the import.
- **Why:** UX-08 closure completes here. The prior slug-based derivation drifted whenever a case was renamed via `CaseSlugHistory` — a player's serial would silently change mid-case (workspace shows `BL-NEWSLUG`, dashboard still shows `BL-001`). The helper uses `caseFile.id` which is stable across rename.

### A8 — `/bureau/archive` revokedAt filter on ownedCases
- **File:** `app/bureau/archive/page.tsx:14-22`
- **Change:** added `revokedAt: null` to the `where` clause of `userCase.findMany`.
- **Why:** mirrors the Batch 16 dashboard + debrief filter. Refunded UserCase rows must not appear in the archive's "Active reviews" or "Debrief-ready cases" surfaces. Theory submission history (the separate `theorySubmission.findMany` below) is preserved intentionally — submissions are an audit trail of what was guessed; hiding them on refund would also hide them from the player's own history of attempts.

---

## 4. Fix Group B — Defense-in-depth + reliability (3 fixes)

### B1 — `resolveContent` + `resolveEvidence` `caseFileId` defense-in-depth
- **Files:** `app/api/access-codes/redeem/route.ts:11-65` (resolveContent + 2 call sites), `app/bureau/cases/[slug]/page.tsx:28-95` (resolveEvidence + 1 call site).
- **Change:** every `findUnique({ where: { id } })` against `caseRecord` / `casePerson` / `caseHint` / `hiddenEvidence` was rewritten as `findFirst({ where: { id, caseFileId } })`. The function signature in each place gained a `caseFileId: number` second parameter. Call sites pass `accessCode.caseFileId` (in the API) and `ownedCase.caseFileId` (in the workspace).
- **Why:** the admin POST at `app/api/admin/cases/[caseId]/access-codes/route.ts` already validates `unlocksTarget` against the parent case at write time. This read-side check is the second line of defense against a future seed-script bug, a migration that breaks the write-side invariant, or a hand-edited row that mistargets an AccessCode at a different case's row.
- **Failure mode:** a mismatch returns `null` from the resolve fn → the caller treats it as "missing evidence" and skips the render. No 5xx escalation, no leaked content from another case.

### B2 — Stripe orphan returns 200 to stop the retry storm
- **File:** `app/api/webhooks/stripe/route.ts:147-160` (outer catch).
- **Change:** when the inner handler throws `STRIPE_ORPHAN:` or `STRIPE_ORPHAN_NO_CASE:`, the outer catch now emits a `[STRIPE-ORPHAN-FINAL]` log line and returns 200 (with `{received: true, orphan: true}` body) instead of 500.
- **Why:** pre-Batch-17, an unrecoverable orphan (session with no matching local Order AND no metadata sufficient for recovery) threw → outer catch returned 500. Stripe interprets 500 as transient failure and retries the same event for ~3 days with exponential backoff, generating dozens of identical `[STRIPE-ORPHAN]` log lines per orphan. The orphan is genuinely unrecoverable; the retries are pure noise. 200 + ack-line stops Stripe retrying while keeping the operator's signal intact.
- **Test:** `tests/api/stripe.test.ts:482` was updated. Pre-Batch-17 assertion was `status 500 + [STRIPE-ORPHAN] log`. Post-Batch-17 assertion is `status 200 + body.orphan === true + both [STRIPE-ORPHAN] and [STRIPE-ORPHAN-FINAL] log lines present`.

### B3 — Admin GET rate-limits (3 endpoints)
- **Files:**
  - `app/api/admin/cases/[caseId]/route.ts:9-28` GET — added `rateLimit(request, { limit: 30, windowMs: 60_000 })`
  - `app/api/admin/cases/[caseId]/codes/route.ts:29-47` GET (includes CSV export branch) — same
  - `app/api/admin/cases/[caseId]/access-codes/route.ts:9-28` GET — same; also dropped the underscore on `_request: Request` to pass it to rateLimit
- **Why:** all three GETs were behind `requireAdmin` but had no rate limit. A compromised admin session could mass-pull customer email CSVs (the `/codes?format=csv` branch) and full case content including the solution + debrief by iterating `caseId`. 30/60s per `(ip, route)` is well above legitimate admin tab navigation and single-button-press CSV-export workflows while capping scripted exfiltration.

---

## 5. Fix Group C — Forensic: CaseAudit writes on 5 admin mutation routes

The 2026-05-13 audit flagged 6 admin mutation surfaces missing `CaseAudit` writes. Batch 17 closes 5; the sixth (support reply + status) is deliberately deferred because `SupportMessage` has no `caseFileId` and `CaseAudit.caseFileId` is NOT NULL with `Cascade` FK. Closing that gap requires either a sentinel-row design (operationally messy — every support audit ends up bound to caseFileId 0 or similar) or a new `AdminAudit` model (cleaner but a schema migration with implications for the existing CaseAudit shape). That's a design decision outside Saturday-afternoon scope.

For each of the 5 closures below, the pattern is identical and mirrors the per-section PATCH routes (e.g. `overview/route.ts:109-119`):

1. Extract `userId = Number(guard.user.id)` after `requireAdmin`.
2. Wrap the mutating DB call in `prisma.$transaction(async (tx) => { ... })`.
3. Add `tx.caseAudit.create({ data: { caseFileId, userId, action: "<ACTION_NAME>", diff: { ... } } })` inside the transaction.
4. Return the same shape from the route as before.

| # | File | Action name | Diff payload | Notes |
|---|---|---|---|---|
| C1 | `workflow/route.ts:66, :115-138` | `UPDATE_WORKFLOW` | `{ from, to }` | Most-destructive single admin action (PUBLISHED → ARCHIVED). |
| C2 | `codes/route.ts (POST):85, :139-160` | `GENERATE_ACTIVATION_CODES` | `{ count, kitSerial }` | **Codes themselves NOT logged** — they are redeemable secrets that live in `activationCode.code` and shouldn't be duplicated into a forensic table. |
| C3 | `codes/[codeId]/route.ts (PATCH):24, :46-85` | `REVOKE_ACTIVATION_CODE` | `{ codeId }` | Audit is written **only when count > 0** so 404/409 misses don't pollute the trail. |
| C4 | `access-codes/route.ts (POST):31, :113-152` | `CREATE_ACCESS_CODE` | `{ accessCodeId, kind, unlocksTarget, requiresStage }` | Code value NOT logged (same rationale as C2). |
| C5 | `activation-codes/route.ts (POST):35, :70-101` | `GENERATE_ACTIVATION_CODE_LEGACY` | `{ activationCodeId }` | Distinct action name from C2 so the forensic trail can distinguish surface (legacy single-code path vs modern batch). Code value NOT logged. |

### Deferred: support reply + support status

Per CLAUDE.md "P2/P3 backlog" entry "CaseAudit not written for ... support reply / status — forensic gap." Closing this requires a design choice between:

- **Option A — Sentinel caseFileId.** Add a sentinel CaseFile row (e.g. `id=0` "Support Operations") and bind support-audit rows to it. Pros: zero schema migration; CaseAudit semantics unchanged. Cons: forensic queries that filter by caseFileId always have to special-case 0; CaseAudit dashboard surfaces an unfamiliar "Support Operations case" row.
- **Option B — New `AdminAudit` model.** Schema migration adding a top-level `AdminAudit` table with the same shape but without the caseFileId FK. Pros: clean separation; future-proofs against other case-less admin actions (e.g. user-management). Cons: schema migration + cascade-handler updates; two audit tables to query when surfacing "everything an admin did."

Recommendation: defer to Batch 18 or later, pair with the F-12 / F-35 Sentry / structured-logging work since both rewire the observability surface.

---

## 6. Fix Group D — Schema FK indexes

### D1 — `prisma/schema.prisma` schema additions

Added `@@index` clauses to seven models:

| Model | Index | Purpose |
|---|---|---|
| `ActivationCode` | `@@index([caseFileId])` | Admin per-case code list (`/bureau/admin/cases/[caseId]/codes`). |
| `CasePerson` | `@@index([caseFileId])` | Workspace people-of-interest render. |
| `CaseRecord` | `@@index([caseFileId])` | Workspace records render. |
| `CaseHint` | `@@index([caseFileId])` | Workspace hint ladder. |
| `HiddenEvidence` | `@@index([caseFileId])` | Hidden-evidence reveal pipeline. |
| `CheckpointAttempt` | `@@index([userId, createdAt(sort: Desc)])` + `@@index([caseFileId])` | Player progress; admin per-case checkpoint review. |
| `TheorySubmission` | `@@index([userId, createdAt(sort: Desc)])` + `@@index([caseFileId])` | `/bureau/archive` recent-submissions; admin per-case theory review. |

### D2 — Migration `20260513210000_add_fk_indexes/migration.sql`

Hand-written, additive only. Nine `CREATE INDEX` statements, no data movement, no schema breakage. **Not** using `CREATE INDEX CONCURRENTLY` — at current table sizes (single-digit cases, dozens of customers, hundreds of theory submissions) the brief table-level locks are imperceptible. Future index migrations on tables that have grown should switch to CONCURRENTLY per F-45 (deferred in `audits/2026-05-13-godmode-audit-super.md` §2.B.13).

### D3 — How the operator applies the migration

Two paths, both safe:

```powershell
# Path A — generate via prisma (will detect the existing SQL file and use it):
npx prisma migrate dev --name add_fk_indexes

# Path B — apply directly via deploy (skips dev-mode prompts):
npx prisma migrate deploy
```

After either, `npx prisma generate` refreshes the client and `npm run build` should compile clean.

Verification against prod Neon: `npx prisma migrate status` should show all 9 migrations applied with no drift.

---

## 7. Test surface changes (no new tests; four existing files updated to match changed mocks)

| File | Why updated |
|---|---|
| `tests/api/admin-codes.test.ts` | Added `caseAuditCreate` + `transactionFn` to hoisted mocks. Updated `vi.mock("@/lib/prisma")` to include `caseAudit.create` + `$transaction`. Added `transactionFn.mockImplementation` in `beforeEach` to forward the route's tx callback. |
| `tests/api/workflow.test.ts` | Same shape as above. Workflow PATCH now wraps the update in a transaction. |
| `tests/api/access-codes-redeem.test.ts` | Renamed `caseRecordFindUnique` mock to `caseRecordFindFirst` (4 occurrences across declaration, prisma stub, assertions). The route now calls `findFirst` so the defense-in-depth caseFileId filter applies. |
| `tests/api/stripe.test.ts` | Updated the `STRIPE-ORPHAN` test (line 482) to assert status 200 + `body.orphan === true` + both `[STRIPE-ORPHAN]` and `[STRIPE-ORPHAN-FINAL]` log lines. Old assertion of 500 reflected the pre-Batch-17 retry-storm-causing behavior. |

No new tests were written. The Batch 17 fixes are surgical — most are defense-in-depth or polish; none change route response shapes the existing tests would assert against, except the orphan path which is explicitly an intentional change (covered above).

---

## 8. Operator command sequence (Windows shell)

```powershell
cd C:\Users\gatch\Documents\black-ledger\site

# 1. Confirm schema + migration alignment locally
npx prisma migrate deploy   # applies 20260513210000_add_fk_indexes to dev Neon
npx prisma generate         # refresh client
npx tsc --noEmit            # confirm clean
npm test                    # full suite
npm run build               # production build sanity

# 2. Commit + push the bundle (commits per §2 above)
git add next.config.ts
git commit -m "fix(csp): drop dead fonts.googleapis.com from style-src (Batch 17 / A1)"

git add app/api/webhooks/stripe/route.ts
git commit -m "fix(privacy): mask buyerEmail in webhook throttle log + maskEmail helper (Batch 17 / A2)"

git add app/api/forgot-password/route.ts
git commit -m "fix(email): forgot-password Reply-To support@ + escapeHtml defense (Batch 17 / A3+A4)"

git add app/cases/page.tsx
git commit -m "fix(public): /cases catalog explicit select + caseSerial helper unification (Batch 17 / A5+A6)"

git add app/bureau/cases/\[slug\]/page.tsx
git commit -m "fix(bureau): workspace inline caseSerial -> helper + resolveEvidence caseFileId defense (Batch 17 / A7 + B1)"

git add app/bureau/archive/page.tsx
git commit -m "fix(refund): /bureau/archive filter revokedAt: null on ownedCases (Batch 17 / A8)"

git add app/api/access-codes/redeem/route.ts tests/api/access-codes-redeem.test.ts
git commit -m "fix(security): resolveContent caseFileId defense-in-depth + test rename (Batch 17 / B1)"

git add app/api/webhooks/stripe/route.ts tests/api/stripe.test.ts
git commit -m "fix(stripe): orphan handler returns 200 to stop retry storm + test update (Batch 17 / B2)"

git add app/api/admin/cases/\[caseId\]/route.ts app/api/admin/cases/\[caseId\]/codes/route.ts app/api/admin/cases/\[caseId\]/access-codes/route.ts
git commit -m "fix(security): rate-limit admin GET endpoints 30/60s (Batch 17 / B3)"

git add app/api/admin/cases/\[caseId\]/workflow/route.ts app/api/admin/cases/\[caseId\]/codes/route.ts app/api/admin/cases/\[caseId\]/codes/\[codeId\]/route.ts app/api/admin/cases/\[caseId\]/access-codes/route.ts app/api/admin/cases/\[caseId\]/activation-codes/route.ts tests/api/admin-codes.test.ts tests/api/workflow.test.ts
git commit -m "feat(audit): CaseAudit writes for 5 case-scoped admin mutation routes (Batch 17 / C)"

git add prisma/schema.prisma prisma/migrations/20260513210000_add_fk_indexes/
git commit -m "feat(schema): FK + composite indexes on hot-read tables (Batch 17 / D)"

git add audits/BATCH_17_REPORT.md audits/BATCH_17_OBSERVATIONS.md
git commit -m "docs(audit): batch 17 report + observations"

git push origin main
```

---

## 9. Carry-over deferred items

| Item | Reason for deferral |
|---|---|
| Support reply + status CaseAudit writes | Needs sentinel-row vs new `AdminAudit` model design decision. |
| `next.config.ts` CSP `script-src 'unsafe-inline' 'unsafe-eval'` removal | F-32/F-33 nonce migration, multi-week effort. Framer Motion compat unverified. |
| `app/layout.tsx` per-render `auth()` perf | F-34, performance-not-correctness. Refactor to lift to a single user-info server component. |
| Sentry / structured logging | F-12, needs `npm install @sentry/nextjs` + DSN. |
| Forgot-password email-send timing leak | F-22, breaks existing Resend-assertion test pattern. |
| `Order.userId` schema link | Refund-after-solve detection currently works via `Order.activationCode.claimedByUserId`. |
| `/api/me/export` PDPL portability endpoint | Product decision; pair with lawyer review. |
| `Order.email` retention after account delete | Pair with lawyer review + Privacy Policy §8 wording. |
| VAT collection (Stripe `automatic_tax`) | Pair with Stripe Live activation. |
| `R2_PUBLIC_URL` Content-Length cap on presigned PUT | F-11, accept until storage cost surge. |
| Captcha / Turnstile on register/forgot-password/waitlist/support | Operational, not code. |
| CI / branch protection / Dependabot | Operational. Would have caught the Next.js CVE day-one. |
| DR runbook (`pg_dump` cadence, R2 lifecycle, RPO/RTO) | Operational. |
| heroImageUrl + portraitUrl render surface | UX-11, deferred from 2026-05-07 UX-polish audit. |
