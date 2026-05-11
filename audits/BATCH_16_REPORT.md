# Batch 16 — Report

**Closed:** 2026-05-10.
**Branch:** `main`.
**Pre-batch SHA:** `ceba5fa` (Batch 12/13 fix-prompt + UX audit archive).
**Post-batch SHA:** `4bd3bed` (Fix 8, before this report).
**Push status:** local only — operator runs `git push` after the report lands.

Batch 16 supersedes the audit-recommended Batch 14 (refund visibility + serial unification) and Batch 15 (copy fixes + owned-case CTA) and adds a new P1 from the 2026-05-10 full-scope god-mode review (sealed-verdict regression on `/bureau/archive`) plus a Phase-1 immersion polish layer (Bureau Message Registry, error boundary, quick-polish bundle). Eight surgical implementation commits plus this report. **No migrations. No new dependencies. No env changes.**

---

## 1. Pre-flight tree state

```
$ git rev-parse HEAD
ceba5fa6c60686f3bac0d092b37361fcc0c97260

$ git status
On branch main
Your branch is up to date with 'origin/main'.

Untracked files:
  audits/2026-05-10-fullscope-godmode-review.md
  audits/FIX_PROMPT_BATCH_16.md
  design/

$ npx tsc --noEmit
(clean)

$ npx vitest run
Test Files  24 passed (24)
Tests       198 passed (198)

$ npm run build
(clean, only pre-existing SSL alias notice)
```

The 198-tests baseline reflects accumulated test growth since CLAUDE.md was last refreshed (CLAUDE.md still cites 161). Doc-only drift; no breakage. Three untracked entries carried over and remain untracked: the 2026-05-10 god-mode review, this batch's fix prompt, and an ideation `design/` directory.

---

## 2. Commit table

| # | SHA       | Subject                                                                                              | Files                                                                                                                                                                                                                                                                          | +ins / -del |
| - | --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 1 | `98fb771` | fix(security): seal /bureau/archive theory history (close Batch 13 closure regression)                | `app/bureau/archive/page.tsx`                                                                                                                                                                                                                                                  | +9 / −17    |
| 2 | `6c51687` | fix(refund): filter revokedAt on /bureau dashboard + debrief page (UX-09 + UX-10)                     | `app/bureau/page.tsx`, `app/bureau/cases/[slug]/debrief/page.tsx`                                                                                                                                                                                                              | +2 / −1     |
| 3 | `3959cbb` | feat(serial): unify case serial format with single caseSerial(id) helper (UX-08/16/17)                | `lib/case-serial.ts` (new), `tests/lib/case-serial.test.ts` (new), `app/bureau/page.tsx`, `app/bureau/cases/[slug]/debrief/page.tsx`                                                                                                                                            | +55 / −5    |
| 4 | `3e68d85` | fix(public): owned-case CTA + dynamic serial on CasePublicView (UX-03 + UX-04 + UX-05)                | `components/cases/CasePublicView.tsx`                                                                                                                                                                                                                                          | +54 / −30   |
| 5 | `75dc9bd` | feat(reliability): root error.tsx boundary with bureau-themed fallback (F-30)                          | `app/error.tsx` (new)                                                                                                                                                                                                                                                          | +63 / −0    |
| 6 | `c7ee163` | feat(voice): Bureau Message Registry + apply to login/unlock/theory submission                         | `data/bureau-messages.ts` (new), `app/login/page.tsx`, `components/auth/LoginForm.tsx`, `app/(unlock)/bureau/unlock/page.tsx`, `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx`, `components/bureau/TheorySubmissionForm.tsx`                                             | +108 / −24  |
| 7 | `b3ee7d4` | feat(voice): apply registry to per-case database header                                                | `app/bureau/cases/[slug]/database/page.tsx`, `components/bureau/CaseDatabaseSearch.tsx`                                                                                                                                                                                        | +8 / −8     |
| 8 | `4bd3bed` | chore: quick-polish bundle (engines.node, Link migration, argv parsing, RevokeButton field cleanup)    | `package.json`, `app/bureau/admin/cases/page.tsx`, `scripts/unarchive-case.ts`, `app/bureau/admin/cases/[caseId]/codes/_components/RevokeButton.tsx`                                                                                                                            | +21 / −8    |
| 9 | (this)    | docs(audit): batch 16 report + observations                                                            | `audits/BATCH_16_REPORT.md`, `audits/BATCH_16_OBSERVATIONS.md`                                                                                                                                                                                                                 | new         |

---

## 3. Per-fix detail

### Fix 1 — Seal `/bureau/archive` theory history

**Applied:** yes.
**Files:** `app/bureau/archive/page.tsx`.
**Trace.** Dropped `THEORY_RESULT_LABEL` import (only consumer in this file). Replaced the submissions render block: binary `isClosed = submission.resultLabel === "CORRECT"` derives a two-tone badge, score row is gone, the "Feedback" label is now "Bureau Verdict" and renders the leaky historical feedback only for `CORRECT` rows; non-CORRECT rows render the sealed boilerplate. Pattern is identical to the workspace Recent Submissions panel from Batch 13.
**tsc:** clean. **vitest:** 198 passing. **Anomalies:** none.

### Fix 2 — Filter `revokedAt` on `/bureau` dashboard + debrief page

**Applied:** yes.
**Files:** `app/bureau/page.tsx`, `app/bureau/cases/[slug]/debrief/page.tsx`.
**Trace.** Added `revokedAt: null` to the bureau dashboard's `userCase.findMany` where clause (propagates to active/solved/latest derivations + stats counts). Added `revokedAt: null` to the debrief page's `findFirst` where clause (refunded user hits the existing `notFound()`). Pure additive filter; nothing else changed.
**tsc:** clean. **vitest:** 198 passing. **Anomalies:** none.

### Fix 3 — Unify case serial format

**Applied:** yes.
**Files:** `lib/case-serial.ts` (new), `tests/lib/case-serial.test.ts` (new), `app/bureau/page.tsx`, `app/bureau/cases/[slug]/debrief/page.tsx`.
**Trace.** Added `caseSerial({ id })` helper returning `BL-${id.padStart(3, "0")}` (3-digit pad floor, no truncation cap). Applied to bureau dashboard active-reviews list (replaces index-derived `BL-CASE-XXX`) and debrief header (replaces slug-derived `BL-{UPPERCASESLUG-TRUNC8}`). 5 new vitest cases exercise single-digit, two-digit, three-digit, and four-digit ids plus structural typing.
**tsc:** clean. **vitest:** 198 → **203** passing (5 new tests in `tests/lib/case-serial.test.ts`). **Anomalies:** removed an unused `index` parameter from the active-reviews `.map` callback in `app/bureau/page.tsx` since `caseSerial` derives from `entry.caseFile.id`, not the list index.

### Fix 4 — Owned-case CTA + dynamic serial on `CasePublicView`

**Applied:** yes.
**Files:** `components/cases/CasePublicView.tsx`.
**Trace.** Imported `caseSerial` and replaced the hardcoded `BL-001 / Standalone Investigation` with `{caseSerial(caseFile)} / Standalone Investigation`. Replaced the right-column CTA block: `canBuy` true branch is unchanged (Available Now / BuyButton / Sign in to Bureau / "Already purchased?"). `canBuy` false branch now reads "On Your Desk" + "This file is assigned to your station" + "Open Workspace" CTA → `/bureau/cases/{slug}` + "Return to Bureau" secondary → `/bureau`. The misleading "Order Investigation Kit → /support" link is gone.
**tsc:** clean. **vitest:** 203 passing. **Anomalies:** none.

### Fix 5 — Root `error.tsx` boundary

**Applied:** yes.
**Files:** `app/error.tsx` (new).
**Trace.** Client component (`"use client"`) per Next.js 16 error-boundary contract, receives `{ error, reset }` props. Logs to `console.error("[bureau:error]", error)` (Vercel function logs today; Sentry swap point comment in place). Renders System Fault eyebrow + "The bureau ran into an unexpected fault" heading + body + optional `error.digest` reference + Retry button (calls `reset()`) + Return to Bureau link. Visual register matches the dashboard system-header pattern but uses raw Tailwind utilities only (no `Card`/`Pill` imports — the boundary must work even if a UI primitive caused the fault).
**tsc:** clean. **vitest:** 203 passing. **Anomalies:** none.

### Fix 6 — Bureau Message Registry + login/unlock/theory

**Applied:** yes.
**Files:** `data/bureau-messages.ts` (new), `app/login/page.tsx`, `components/auth/LoginForm.tsx`, `app/(unlock)/bureau/unlock/page.tsx`, `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx`, `components/bureau/TheorySubmissionForm.tsx`.
**Trace.** Registry is a single `const BUREAU_MESSAGES = { auth, unlock, theorySubmission, caseDatabase } as const` exported with a typed shape, including the docstring carve-out for theory feedback strings (which stay in `lib/case-evaluation.ts` because Batch 13 made them load-bearing for security). Login page eyebrow/heading/body, LoginForm submit button + error message; unlock page pending-vs-active eyebrow/heading/body + buttons, UnlockForm input label/placeholder/submit/banner; TheorySubmissionForm placeholders/helper-text/submit/verdict labels — all now read from the registry. **Form mechanics and API contracts are byte-identical to post-Batch-13 state.** The closure-standard rule is preserved: still binary verdict, still no per-component diagnostic.
**tsc:** clean. **vitest:** 203 passing (no test references the changed strings; no test updates required). **Anomalies:** none.

### Fix 7 — Registry applied to per-case database header

**Applied:** yes.
**Files:** `app/bureau/cases/[slug]/database/page.tsx`, `components/bureau/CaseDatabaseSearch.tsx`.
**Trace.** Page header eyebrow + body now read from `BUREAU_MESSAGES.caseDatabase` (the body is the function form taking `currentStage`). `CaseDatabaseSearch` component-internal eyebrow + heading + input placeholder + body retightened locally to "Query Terminal" / "Query the case index" / "Names, records, evidence, keywords…" — kept in-component (not registry-extracted) per the prompt's Phase-1 boundary discipline.
**tsc:** clean. **vitest:** 203 passing. **Anomalies:** none.

### Fix 8 — Quick-polish bundle

**Applied:** yes.
**Files:** `package.json`, `app/bureau/admin/cases/page.tsx`, `scripts/unarchive-case.ts`, `app/bureau/admin/cases/[caseId]/codes/_components/RevokeButton.tsx`.
**Trace.**
- `package.json`: added `"engines": { "node": ">=20" }` between `private` and `scripts`.
- `app/bureau/admin/cases/page.tsx`: added `import Link from "next/link"`; converted three `<a>` admin nav anchors (Edit Content / Preview / Manage Codes) to `<Link>`. ClassNames preserved.
- `scripts/unarchive-case.ts`: replaced `const CASE_ID = 3;` with argv parsing — usage error if missing, integer validation with positive check. `assertSafeEnv` guard above the new block is unchanged.
- `RevokeButton.tsx`: changed `body: JSON.stringify({ revokedAt: new Date().toISOString() })` to `body: JSON.stringify({})`. Server-side `revokedAt` stamping (Batch 1 Fix 5) is the source of truth; this removes the now-ignored client-supplied field that invited confusion.

**tsc:** clean. **vitest:** 203 passing. **Local node:** v24.14.1 (matches `>=20` engines constraint). **Anomalies:** none.

---

## 4. Final verification gate

```
$ git log --oneline -10
4bd3bed chore: quick-polish bundle (engines.node, Link migration, argv parsing, RevokeButton field cleanup)
b3ee7d4 feat(voice): apply registry to per-case database header
c7ee163 feat(voice): Bureau Message Registry + apply to login/unlock/theory submission
75dc9bd feat(reliability): root error.tsx boundary with bureau-themed fallback (F-30)
3e68d85 fix(public): owned-case CTA + dynamic serial on CasePublicView (UX-03 + UX-04 + UX-05)
3959cbb feat(serial): unify case serial format with single caseSerial(id) helper (UX-08/16/17)
6c51687 fix(refund): filter revokedAt on /bureau dashboard + debrief page (UX-09 + UX-10)
98fb771 fix(security): seal /bureau/archive theory history (close Batch 13 closure regression)
ceba5fa docs(audit): archive Batch 12, 13 fix prompts + 2026-05-07 UX polish audit dossier
5a11ee4 docs(audit): batch 13 report + observations

$ git status
On branch main
Your branch is ahead of 'origin/main' by 8 commits.
  (use "git push" to publish your local commits)

Untracked files:
  audits/2026-05-10-fullscope-godmode-review.md
  audits/FIX_PROMPT_BATCH_16.md
  design/
  audits/BATCH_16_REPORT.md
  audits/BATCH_16_OBSERVATIONS.md

$ npx tsc --noEmit
(clean)

$ npx vitest run
Test Files  25 passed (25)
Tests       203 passed (203)

$ npm run build
(clean — only pre-existing SSL alias warning)

$ git diff ceba5fa..main --stat
 .../bureau/unlock/_components/UnlockForm.tsx       | 13 ++--
 app/(unlock)/bureau/unlock/page.tsx                | 15 ++--
 .../[caseId]/codes/_components/RevokeButton.tsx    |  2 +-
 app/bureau/admin/cases/page.tsx                    | 13 ++--
 app/bureau/archive/page.tsx                        | 26 +++----
 app/bureau/cases/[slug]/database/page.tsx          |  6 +-
 app/bureau/cases/[slug]/debrief/page.tsx           |  6 +-
 app/bureau/page.tsx                                |  7 +-
 app/error.tsx                                      | 63 ++++++++++++++++
 app/login/page.tsx                                 |  7 +-
 components/auth/LoginForm.tsx                      |  7 +-
 components/bureau/CaseDatabaseSearch.tsx           | 10 +--
 components/bureau/TheorySubmissionForm.tsx         | 17 +++--
 components/cases/CasePublicView.tsx                | 84 ++++++++++++++--------
 data/bureau-messages.ts                            | 73 +++++++++++++++++++
 lib/case-serial.ts                                 | 21 ++++++
 package.json                                       |  3 +
 scripts/unarchive-case.ts                          | 11 ++-
 tests/lib/case-serial.test.ts                      | 29 ++++++++
 19 files changed, 320 insertions(+), 93 deletions(-)
```

All expected files touched, no unexpected file in the diff.

---

## 5. Test count

**Pre-batch:** 198 across 24 files.
**Post-batch:** 203 across 25 files.
**Delta:** +5 tests, +1 file (`tests/lib/case-serial.test.ts`).

No existing tests required updates — no assertion in the suite references the changed button labels, placeholders, headers, or CTA copy.

---

## 6. Operator action

Run `git push`. No `prisma migrate deploy` needed — this batch is pure code, no schema change. After deploy, walk the production verification checklist in `BATCH_16_OBSERVATIONS.md §11`.
