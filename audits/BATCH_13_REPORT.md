# Batch 13 — Report

**Closed:** 2026-05-10.
**Branch:** `main`.
**Pre-batch SHA:** `ba5c66b` (Batch 12 docs commit).
**Post-batch SHA:** `6ffae70` (Fix 4, before this report).
**Push status:** local only — operator runs `git push` after the report lands.

This batch is **not** in the 2026-05-07 UX-polish audit's recommended Batch 13/14 grouping. Those batches (refund visibility + serial unification, copy fixes + owned-case CTA) are now renumbered to Batch 14 and Batch 15 respectively. **Batch 13 supersedes them in priority** because it closes a fundamental brute-force exploit on the climactic interaction in the entire product.

The operator (Demetre) discovered the leak in dogfooding. The old `lib/case-evaluation.ts:buildFeedback()` returned per-component diagnostic prose ("You were correct on suspect, but still need to improve motive, evidence."), which lets a player at stage 3 enumerate the murderer in N submissions where N = number of suspects, by iterating the suspect field with junk motive/evidence text. Sealed feedback closes the leak.

---

## 1. Pre-flight tree state

```
$ git rev-parse HEAD
ba5c66b87132566584e1e655d17d9567fe49f87e

$ git status
On branch main
Your branch is up to date with 'origin/main'.

Untracked files:
  audits/2026-05-07-ux-polish-audit.md
  audits/FIX_PROMPT_BATCH_12.md
  audits/FIX_PROMPT_BATCH_13.md

$ npx tsc --noEmit
(clean)

$ npx vitest run
Test Files  24 passed (24)
Tests       198 passed (198)
```

Three untracked audit files (Batch 12 report, this batch's fix prompt, the upstream UX-polish audit) carried over and remain untracked at end of batch — they are not part of Batch 13's commits.

---

## 2. Commit table

| # | SHA       | Subject                                                                                              | Files                                                                                                                                                                                  | +ins / -del |
| - | --------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1 | `4e3b205` | refactor(case-evaluation): seal holistic feedback (no per-component diagnostic)                       | `lib/case-evaluation.ts`                                                                                                                                                              | +15 / −33   |
| 2 | `a26f2f0` | feat(theory): publicVerdict response shape — sealed verdict on route + form + workspace               | `app/api/cases/[slug]/theory/route.ts`, `components/bureau/TheorySubmissionForm.tsx`, `app/bureau/cases/[slug]/page.tsx`                                                                | +32 / −33   |
| 3 | `e749fb0` | chore(validators): raise theory motive/evidence minimum lengths to discourage junk probes             | `lib/validators.ts`, `tests/api/theory.test.ts`                                                                                                                                        | +11 / −8    |
| 4 | `6ffae70` | docs(content): closure-standard rule + author-discipline guidance in CLAUDE.md                        | `CLAUDE.md`                                                                                                                                                                            | +16 / −0    |
| 5 | (this report) | docs(audit): batch 13 report + observations                                                       | `audits/BATCH_13_REPORT.md`, `audits/BATCH_13_OBSERVATIONS.md`                                                                                                                          | new         |

Total across Fixes 1–4: **74 insertions, 74 deletions** in 7 files.

---

## 3. Fix 1 — `refactor(case-evaluation): seal holistic feedback (no per-component diagnostic)`

- **Applied:** yes.
- **File:** `lib/case-evaluation.ts` only.
- **Edit:**
  - `buildFeedback()` rewritten. Old: three branches (all-correct / some-correct / none-correct) listing which of suspect/motive/evidence matched. New: two branches keyed off `resultLabel` only — CORRECT returns the closure-standard sentence, anything else returns the revision-required sentence.
  - Function signature changed from `{suspectCorrect, motiveCorrect, evidenceCorrect}` to `{resultLabel}`.
  - Call site at the bottom of `evaluateTheorySubmission` updated to pass `{resultLabel}` instead of the three-boolean object.
  - Docstring on `evaluateTheorySubmission` got a new "Public feedback policy (Batch 13)" paragraph appended after the "Overall result" block, documenting that the public string is non-diagnostic while internal flags remain.
- **What is preserved:**
  - All five internal flags on the return value (`suspectCorrect`, `motiveCorrect`, `motivePartial`, `evidenceCorrect`, `evidencePartial`).
  - `score` (0–3 integer).
  - `resultLabel` ("CORRECT" | "PARTIAL" | "INCORRECT").
  - Persisted DB columns on `TheorySubmission` (no schema change).
  - The state-machine drive in `app/api/cases/[slug]/theory/route.ts` (event-mapping switch over `resultLabel`).
- **tsc:** clean.
- **vitest:** 24 files / 198 tests passed. `tests/lib/case-evaluation.test.ts` did NOT have any per-component-diagnostic feedback assertions — its eight tests assert only on `suspectCorrect`, `motiveCorrect`, `motivePartial`, `evidenceCorrect`, `score`, and `resultLabel`. No assertion-rewrites were needed in this file.
- **Mental trace:** `evaluateTheorySubmission({suspect=Anya, motive=insurance, evidence=lighter found scene, ...})` → suspect/motive/evidence all match → `resultLabel = "CORRECT"` → `buildFeedback({resultLabel: "CORRECT"})` → returns "Your theory satisfies the closure standard. The suspect, motive, and supporting evidence form a complete chain." Same call with `suspectName="Wrong Person"` → `resultLabel = "INCORRECT"` → returns "The file is not ready for closure. The Bureau could not verify a complete chain of suspect, motive, and supporting evidence. Reopen the record, pressure-test the timeline, and make sure every claim is tied to case evidence." Identical sentence for any non-CORRECT result.
- **Anomalies:** none.

---

## 4. Fix 2 — `feat(theory): publicVerdict response shape — sealed verdict on route + form + workspace`

- **Applied:** yes.
- **Files:**
  - `app/api/cases/[slug]/theory/route.ts` — response JSON shape.
  - `components/bureau/TheorySubmissionForm.tsx` — full rewrite via `Write`; removed enum imports, replaced state, added pre-submit guidance.
  - `app/bureau/cases/[slug]/page.tsx` — Recent Submissions panel rewrite (lines 613-660); also dropped now-unused `THEORY_RESULT_LABEL` import and `resultToneMap` local declaration.
- **Edits:**
  - **Route.** `evaluation.resultLabel === "CORRECT"` is collapsed locally to `publicVerdict = "CASE_CLOSED" | "REVISION_REQUIRED"`. JSON returned: `{message, publicVerdict, feedback}`. The `score` and `resultLabel` keys are removed from the response body. Internal usage of `evaluation.resultLabel` for the state-machine event mapping (THEORY_CORRECT / THEORY_PARTIAL / THEORY_INCORRECT) is unchanged. DB write into `tx.theorySubmission.create` continues to persist all leaky internal flags. DB write into `tx.userCaseEvent.create` continues to log `score` and `resultLabel` in the event payload (admin-side only).
  - **Form.** Dropped `import { TheoryResultLabel } from "@/lib/enums"` and `import { THEORY_RESULT_LABEL } from "@/lib/labels"` — neither is used anymore in this file. Replaced state pair `(feedback, resultLabel)` with `(verdict, feedback)`. Result-display block now renders "Closure Standard Met" or "Revision Required" header. Color is binary: emerald for CASE_CLOSED, amber for REVISION_REQUIRED. No third red tone (the player is no longer told their theory is "wrong" — only "not yet ready"). Added a pre-submit guidance line above the submit button: "Submit only when your suspect, motive, and evidence form one complete chain. This review does not confirm individual pieces of a theory — only whether the whole case meets the Bureau's closure standard."
  - **Workspace.** The Recent Submissions panel now derives display from `submission.resultLabel`, not from the stored `submission.feedback` text. CORRECT rows render their stored feedback verbatim. PARTIAL/INCORRECT rows render the constant sealed sentence "The file is not ready for closure. The Bureau could not verify a complete chain of suspect, motive, and supporting evidence." This is belt-and-suspenders against historical TheorySubmission rows that still have the leaky `"You were correct on suspect, but still need to improve..."` strings in the DB. The `<TerminalReadout label="SCORE" lines={[\`${submission.score}/3\`]} />` element was deleted — score is no longer displayed at all. The `Pill` `tone` and `label` are now ternary on `submission.resultLabel === "CORRECT"`.
  - Cleanup: the now-unused `resultToneMap` local at line 200 and the unused `THEORY_RESULT_LABEL` named import at line 7 were removed. `CASE_STATUS_LABEL` from the same import remains in use elsewhere.
- **tsc:** clean.
- **vitest:** 24 files / 198 tests passed. `tests/api/theory.test.ts` did NOT have any response-shape assertions on `body.resultLabel`, `body.feedback`, or `body.score` — its assertions are limited to status codes and DB mock call counts. The fix prompt anticipated possible test-surgery here; in this codebase no body-shape tests existed. No assertion changes were applied in this commit.
- **Mental trace:**
  - Player submits a CORRECT theory → server computes `evaluation.resultLabel = "CORRECT"` → DB write stores all internal flags + closure feedback string → response is `{publicVerdict: "CASE_CLOSED", feedback: "Your theory satisfies..."}` → form renders emerald "Closure Standard Met" pill + closure feedback. Status badge flips to Resolved on `router.refresh()`.
  - Player submits a PARTIAL theory (e.g. correct suspect, junk motive) → server computes `evaluation.resultLabel = "PARTIAL"` → DB write stores PARTIAL + the new sealed revision feedback string → response is `{publicVerdict: "REVISION_REQUIRED", feedback: "The file is not ready..."}` → form renders amber "Revision Required" pill + sealed revision feedback. The internal PARTIAL is invisible to the player.
  - Player opens the workspace and looks at the Recent Submissions panel → all past attempts render as either "Closure Standard Met" (emerald) or "Revision Required" (amber). Score is not shown. PARTIAL and INCORRECT are indistinguishable in the panel.
- **Anomalies:** none. The TheorySubmissionForm rewrite via `Write` (rather than incremental `Edit`) was a clarity choice — three independent state and import changes overlapped enough that a full rewrite was easier to verify against the spec than a chain of edits.

---

## 5. Fix 3 — `chore(validators): raise theory motive/evidence minimum lengths to discourage junk probes`

- **Applied:** yes.
- **Files:** `lib/validators.ts`, `tests/api/theory.test.ts`.
- **Edits:**
  - **Validators.** `motive.min(10)` → `motive.min(30, "Describe the motive in a sentence or two.")`. `evidenceSummary.min(10)` → `evidenceSummary.min(50, "Summarize the evidence — mention specific records, witnesses, or timeline details.")`. Suspect-name and max-length thresholds unchanged. Error messages are now action-oriented (telling the player what to do), not character-count-mechanical.
  - **Test fixtures.** Four scenarios in `tests/api/theory.test.ts` had evidence < 50 chars and required lengthening:
    - already-SOLVED test: evidence "absolutely no evidence at all here" (34 ch) → "absolutely no evidence at all here for this entire case" (55 ch).
    - FINAL_REVIEW correct test: evidence "The lighter was found at the scene of the fire" (46 ch) → "The lighter was found at the scene of the fire near the body" (60 ch). Matcher tokens `{lighter, found, scene}` still intersect with the solution → still resolves to evidenceCorrect=true → still produces resultLabel=CORRECT.
    - refunded-410 test: motive "She committed insurance fraud as a cover-up" (43 ch) → "She committed insurance fraud as a cover-up scheme" (50 ch); evidence " the scene of the fire" (46 ch) → "The lighter was found at the scene of the fire near her car" (59 ch). Route returns 410 before the matcher runs, so token analysis is irrelevant — fixtures only needed to pass schema validation.
    - transaction-wrapping test: motive 32 ch → 58 ch; evidence 31 ch → 67 ch. Both still resolve to non-CORRECT, route still calls $transaction.
- **tsc:** clean.
- **vitest:** all four `tests/api/theory.test.ts` cases that had been failing (status 400 instead of 201/200/410) now pass. 24 files / 198 tests pass.
- **Mental trace:** legitimate player who writes a thoughtful 60-char motive and a 90-char evidence summary is unaffected. Player (or attacker) who tries `motive: "x"` (1 char) hits 400 with "Describe the motive in a sentence or two." Player who tries `evidenceSummary: "x"` (1 char) hits 400 with "Summarize the evidence — mention specific records, witnesses, or timeline details." The 30/50 thresholds are deliberately softer than ChatGPT's recommended 80/150 (see observations §4).
- **Anomalies:** none.

---

## 6. Fix 4 — `docs(content): closure-standard rule + author-discipline guidance in CLAUDE.md`

- **Applied:** yes.
- **File:** `CLAUDE.md` only.
- **Edit:** new section "### Theory submission — closure-standard rule (Batch 13)" inserted directly above the existing "### Test credentials (local dev only)" section near the bottom of the file. Content covers:
  - The standing rule: "final-theory feedback must never confirm isolated correctness."
  - The reason: brute-force enumeration in N submissions.
  - Author discipline per case for `solutionSuspect` (primary + genuine aliases only), `solutionMotive` (canonical phrases with discriminative tokens), `solutionEvidence` (specific proof concepts, not vague terms), `Hints` (non-diagnostic — nudge investigation behavior, not answer components, with three example hints), and `Debrief` (where the per-component reasoning lives, only seen post-CASE_CLOSED).
  - The reminder that internal storage of `suspectCorrect` / `motiveCorrect` / `evidenceCorrect` continues for analytics — only the player-facing string is sealed.
- **tsc / vitest:** unchanged (docs-only).
- **Anomalies:** none.

---

## 7. Final verification gate

```
$ git log --oneline -5
6ffae70 docs(content): closure-standard rule + author-discipline guidance in CLAUDE.md
e749fb0 chore(validators): raise theory motive/evidence minimum lengths to discourage junk probes
a26f2f0 feat(theory): publicVerdict response shape — sealed verdict on route + form + workspace
4e3b205 refactor(case-evaluation): seal holistic feedback (no per-component diagnostic)
ba5c66b docs(audit): batch 12 report + observations

$ git status (post-Fix-4, pre-Fix-5)
On branch main
Your branch is ahead of 'origin/main' by 4 commits.
  (use "git push" to publish your local commits)

Untracked files:
  audits/2026-05-07-ux-polish-audit.md
  audits/FIX_PROMPT_BATCH_12.md
  audits/FIX_PROMPT_BATCH_13.md
nothing added to commit but untracked files present

$ npx tsc --noEmit
(clean)

$ npx vitest run
Test Files  24 passed (24)
Tests       198 passed (198)

$ npm run build
(compiled successfully; only pre-existing pg SSL informational notice
 — no edge-runtime warnings, no type errors, no new lint warnings)

$ git diff ba5c66b..HEAD --stat
 CLAUDE.md                                  | 16 ++++++++++
 app/api/cases/[slug]/theory/route.ts       | 11 +++++--
 app/bureau/cases/[slug]/page.tsx           | 23 ++++----------
 components/bureau/TheorySubmissionForm.tsx | 31 +++++++++++--------
 lib/case-evaluation.ts                     | 48 ++++++++++--------------------
 lib/validators.ts                          |  4 +--
 tests/api/theory.test.ts                   | 15 ++++++----
 7 files changed, 74 insertions(+), 74 deletions(-)
```

All seven files in the `git diff --stat` are explicitly enumerated in the fix prompt's "Expected files touched" block. No drift.

---

## 8. Test-count drift

- Pre-batch baseline: 24 files / 198 tests.
- Post-Fix-1 (sealed feedback): 24 / 198 (no test added or dropped — the `case-evaluation.test.ts` file did not assert on the leaky strings).
- Post-Fix-2 (publicVerdict response shape): 24 / 198 (the `theory.test.ts` file did not assert on the response body shape; no test changes needed).
- Post-Fix-3 (validator thresholds): 24 / 198 (four fixtures lengthened in lockstep with the threshold change; no tests added or dropped).
- Post-Fix-4 (CLAUDE.md docs): 24 / 198.
- Post-Fix-5 (this report): 24 / 198.

Test count is stable at 198. This batch is a test-surgery batch (fixtures lengthened) but not a test-additive batch.

---

## 9. Operator action callout

After this report commit lands on local `main`:

1. **Push.** `git push` to ship Fixes 1–5 to `origin/main`. Vercel auto-deploys.
2. **No `prisma migrate deploy` needed.** This batch is pure code; the `TheorySubmission` schema is unchanged.
3. **Optional one-line SQL data scrub** (recommended for forensic cleanliness, not required for correctness — Fix 2's render-side suppression already prevents historical leaky strings from being shown to the player). Run via Neon SQL Editor:

   ```sql
   UPDATE "TheorySubmission"
   SET feedback = ''
   WHERE feedback != ''
     AND "resultLabel" != 'CORRECT';
   ```

4. **Production verification** — see `BATCH_13_OBSERVATIONS.md §7`. Five-minute walk-through: signed-in dogfood, submit a CORRECT theory, submit a deliberately wrong theory, then try the brute-force exploit (5 different suspects with junk motive/evidence) and confirm every response is identical "Revision Required" + sealed sentence.

Done.
