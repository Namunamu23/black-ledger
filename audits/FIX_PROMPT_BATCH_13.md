# BATCH 13 — FIX PROMPT (sealed holistic verdict — close the per-component feedback leak)

You are a fresh Claude Code session running on Opus 4.7. Apply five commits: four surgical implementation commits that close a fundamental design flaw in the theory-submission flow, plus one final report commit. No scope creep. **No migrations** — the fix is pure code. No new dependencies.

This batch is **not** in the 2026-05-07 UX-polish audit's recommended Batch 13/14 grouping. Those batches (refund visibility + serial unification, copy fixes + owned-case CTA) are now renumbered to Batch 14 and Batch 15 respectively. **This batch supersedes them in priority** because it closes a brute-force exploit on the climactic interaction in the entire product.

The audit-recommended Batch 13/14 work is queued and unchanged in scope; only the numbering shifts.

---

## Background — the design flaw

The operator (Demetre) discovered in dogfooding: a player who reaches stage 3 of any case can identify the murderer in **N submissions** (N = number of suspects, typically 5) without reading any records or doing any deduction. The exploit:

1. Submit a theory with `suspectName: "Person A"`, `motive: "x" (10 chars padding)`, `evidenceSummary: "x" (10 chars padding)`.
2. Server returns: `"You were correct on suspect, but still need to improve motive, evidence."` OR `"Your current theory does not match the expected suspect, motive, or evidence strongly enough yet."`.
3. The first message tells the player they got the suspect right.
4. Iterate through suspects. After ≤5 attempts, the murderer is known.
5. The deduction game collapses; the kit becomes "an expensive way to read a story."

The leak comes from `lib/case-evaluation.ts:buildFeedback()`, which constructs feedback prose by listing which of `suspectCorrect`, `motiveCorrect`, `evidenceCorrect` matched. The leak is amplified by:
- The route response including `resultLabel` (`"CORRECT" | "PARTIAL" | "INCORRECT"`) and `score` (0-3).
- The workspace's "Recent Submissions" panel (`app/bureau/cases/[slug]/page.tsx:613-660`) showing `score/3`, the result label, and the stored feedback for past attempts.

ChatGPT and Claude independently analyzed this and converged on the same fix pattern: **sealed holistic review** — the system never tells the player which submitted component matched, only whether the whole theory passed the closure standard.

This batch implements that fix.

---

## 1. Operating principles

1. **Five commits.** Subjects pre-written below — use verbatim.
2. **No migrations.** The fix is purely code-side. The `TheorySubmission` schema does NOT change — internal `suspectCorrect`/`motiveCorrect`/`evidenceCorrect`/`score`/`resultLabel`/`feedback` columns stay populated for analytics. Only the public-facing API response shape and the displayed feedback strings change.
3. **No new dependencies.**
4. **No scope creep.** Specifically out-of-scope and deferred:
   - Tightening the matcher (changing `intersection.size >= 2 OR Jaccard >= 0.34` to AND). Defer to a future batch after playtesting confirms the current matcher is too permissive in practice.
   - Suspect typo trap (alias-list discipline for `solutionSuspect` per case). Separate concern; defer to a follow-up batch.
   - Adding a "Request Case Guidance" hint ladder feature. Defer to a follow-up batch (audit's UX backlog).
5. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` passing.
6. **Existing tests will need updates.** The route's response shape changes from `{resultLabel, feedback, score}` to `{publicVerdict, feedback}`. Tests that assert on the old shape must be updated within the same commit that changes the shape. Mark this as a test-surgery batch, not a test-additive batch.
7. **No env changes, no pushes, no deploys.** The operator runs `git push` after the batch is verified. No `prisma migrate deploy` (no schema change). One optional post-deploy SQL data scrub (described in observations); operator-side, not Claude Code's responsibility.
8. **Ground truth = source code at HEAD.** This prompt cites the post-Batch-12 state. Re-confirm against the actual file before each edit.

---

## 2. Pre-flight

```
git rev-parse HEAD                  # at or after `ba5c66b` (Batch 12 docs commit)
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 24 files / 198 tests
```

If any fail, stop. Confirm `audits/BATCH_12_REPORT.md`, `audits/2026-05-07-ux-polish-audit.md`, and `audits/FIX_PROMPT_BATCH_13.md` (this file) are on tree.

---

## 3. The five commits

### Fix 1 — `refactor(case-evaluation): seal holistic feedback (no per-component diagnostic)`

**File:** `lib/case-evaluation.ts` only.

**Current state.** `buildFeedback()` (lines 66-98) constructs feedback that explicitly names which of suspect/motive/evidence was correct. Three branches:
- All three correct: `"You correctly identified the suspect, motive, and key evidence."`
- Some correct: `"You were correct on ${correctParts.join(', ')}, but still need to improve ${missingParts.join(', ')}."`
- None correct: `"Your current theory does not match the expected suspect, motive, or evidence strongly enough yet."`

The middle branch is the exploit vector.

**Replacement.** Replace the entire `buildFeedback` function with a non-diagnostic two-branch version:

```ts
function buildFeedback({
  resultLabel,
}: {
  resultLabel: "CORRECT" | "PARTIAL" | "INCORRECT";
}) {
  if (resultLabel === "CORRECT") {
    return "Your theory satisfies the closure standard. The suspect, motive, and supporting evidence form a complete chain.";
  }
  return "The file is not ready for closure. The Bureau could not verify a complete chain of suspect, motive, and supporting evidence. Reopen the record, pressure-test the timeline, and make sure every claim is tied to case evidence.";
}
```

The function signature changes — it now takes `resultLabel` instead of three booleans. Update the call site at line ~179 to pass `resultLabel` instead of `{suspectCorrect, motiveCorrect, evidenceCorrect}`.

**Important: do NOT change the matcher.** `evaluateTheorySubmission` continues to compute `suspectCorrect`, `motiveCorrect`, `motivePartial`, `evidenceCorrect`, `evidencePartial`, `score`, and `resultLabel` exactly as before. Those internals stay populated. Only the public-facing `feedback` string changes. The `score`, `resultLabel`, and three-boolean `suspectCorrect/motiveCorrect/evidenceCorrect` flags are still part of the function's return value — server route + DB persistence + state machine all use them unchanged.

**Update the docstring** at lines 100-134 to note the new public-feedback policy:

Find the line in the docstring (around line 132) that says `"resultLabel = 'CORRECT' when..."` and append a paragraph after the "Overall result" block:

```
 *
 * Public feedback policy (Batch 13):
 *   The string returned in `feedback` is non-diagnostic. It does NOT name
 *   which of suspect/motive/evidence matched. This closes a brute-force
 *   exploit where a player iterating the suspect field with junk
 *   motive/evidence text could enumerate the answer in N submissions.
 *   Internal flags (suspectCorrect, motiveCorrect, evidenceCorrect) are
 *   preserved on the return value for analytics, state-machine drive,
 *   and admin-side surfaces — only the player-facing string is sealed.
```

**Verification:**
- `npx tsc --noEmit` clean. The function-signature change of `buildFeedback` should propagate cleanly because it's only called once inside `evaluateTheorySubmission`.
- `npx vitest run` — `tests/lib/case-evaluation.test.ts` likely has assertions on the old feedback strings. Update those assertions to match the new sealed strings. If any test was written specifically to verify the per-component diagnostic ("returns 'You were correct on suspect'..."), update its description and assertion to the sealed equivalent.
- Test count may drop or stay the same depending on whether old per-component-diagnostic assertions consolidate.

**Commit subject:** `refactor(case-evaluation): seal holistic feedback (no per-component diagnostic)`

---

### Fix 2 — `feat(theory): publicVerdict response shape — sealed verdict on route + form + workspace`

This commit changes the API contract from `{resultLabel, feedback, score}` to `{publicVerdict, feedback}` and updates every consumer in lockstep.

**Files:**
- `app/api/cases/[slug]/theory/route.ts`
- `components/bureau/TheorySubmissionForm.tsx`
- `app/bureau/cases/[slug]/page.tsx` (the Recent Submissions panel)
- `tests/api/theory.test.ts` (response-shape assertions)

**(a) `app/api/cases/[slug]/theory/route.ts`** — change the response JSON:

Find the `return NextResponse.json(...)` block at lines 149-157. Replace:

```ts
return NextResponse.json(
  {
    message: "Theory submitted successfully.",
    resultLabel: evaluation.resultLabel,
    feedback: evaluation.feedback,
    score: evaluation.score,
  },
  { status: 201 }
);
```

with:

```ts
const publicVerdict =
  evaluation.resultLabel === "CORRECT" ? "CASE_CLOSED" : "REVISION_REQUIRED";

return NextResponse.json(
  {
    message:
      publicVerdict === "CASE_CLOSED"
        ? "Theory accepted."
        : "Theory reviewed.",
    publicVerdict,
    feedback: evaluation.feedback,
  },
  { status: 201 }
);
```

The internal `evaluation.resultLabel` is still used for the `transitionUserCase` state-machine call (lines 94-103) and for the `tx.theorySubmission.create` write (lines 110-125). Those usages stay untouched — `resultLabel` remains stored in the DB and drives `UserCase.status` transitions. **Only the JSON sent to the client changes.**

**(b) `components/bureau/TheorySubmissionForm.tsx`** — change the response type and labels:

Replace the response type (around line 44-48):
```ts
const data = (await response.json()) as {
  message?: string;
  resultLabel?: TheoryResultLabel;
  feedback?: string;
  score?: number;
};
```

with:
```ts
const data = (await response.json()) as {
  message?: string;
  publicVerdict?: "CASE_CLOSED" | "REVISION_REQUIRED";
  feedback?: string;
};
```

Replace the `setResultLabel(data.resultLabel ?? "")` line with state for the verdict:

Drop the `resultLabel`/`feedback` state pair currently at lines 23-24 and replace with:
```ts
const [verdict, setVerdict] = useState<"" | "CASE_CLOSED" | "REVISION_REQUIRED">("");
const [feedback, setFeedback] = useState("");
```

Update the post-submit handler — replace `setFeedback(data.feedback ?? "")` and `setResultLabel(data.resultLabel ?? "")` (lines 59-60) with:

```ts
setFeedback(data.feedback ?? "");
setVerdict(data.publicVerdict ?? "");
```

Replace the `resultColor` computation (lines 73-78) with verdict-based coloring:

```ts
const resultColor =
  verdict === "CASE_CLOSED"
    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    : "text-amber-300 border-amber-500/30 bg-amber-500/10";
```

(One color for CASE_CLOSED, one for REVISION_REQUIRED. No third "Incorrect/red" tone — the player isn't told their theory is "wrong" in a strong sense; just "not yet ready.")

Replace the result-display block (lines 131-138) with:

```tsx
{feedback ? (
  <div className={`rounded-2xl border p-4 text-sm leading-7 ${resultColor}`}>
    <div className="text-xs uppercase tracking-[0.2em]">
      {verdict === "CASE_CLOSED"
        ? "Closure Standard Met"
        : verdict === "REVISION_REQUIRED"
        ? "Revision Required"
        : ""}
    </div>
    <div className="mt-2">{feedback}</div>
  </div>
) : null}
```

Drop any remaining imports/usages of `TheoryResultLabel` or `THEORY_RESULT_LABEL` from this file (they're no longer needed in the form). The enum + label map still exist in `lib/enums.ts` and `lib/labels.ts` for use elsewhere (the workspace's recent-submissions panel still uses them — see (c) below).

**Add a pre-submit guidance line** above the submit button. Insert before the `<button type="submit"...>` line (around line 113):

```tsx
<p className="text-xs leading-5 text-zinc-500">
  Submit only when your suspect, motive, and evidence form one complete chain. This review does not confirm individual pieces of a theory — only whether the whole case meets the Bureau&apos;s closure standard.
</p>
```

**(c) `app/bureau/cases/[slug]/page.tsx`** — clean up the Recent Submissions panel (lines 613-660):

This is the panel that currently shows `score/3`, the result label pill, and the stored feedback for past attempts. Each of these leaks information.

Replace the `<TerminalReadout label="SCORE" lines={[`${submission.score}/3`]} />` element (around line 644-649) with: **delete it entirely.** No score display.

Replace the result-label pill rendering. Currently:
```tsx
<Pill
  tone={resultToneMap[submission.resultLabel] ?? "neutral"}
  label={THEORY_RESULT_LABEL[submission.resultLabel]}
/>
```

Replace with:
```tsx
<Pill
  tone={submission.resultLabel === "CORRECT" ? "success" : "warning"}
  label={submission.resultLabel === "CORRECT" ? "Closure Standard Met" : "Revision Required"}
/>
```

(The `submission.resultLabel` here comes from the DB — it may still be `"CORRECT"`, `"PARTIAL"`, or `"INCORRECT"` for historical rows. The render layer collapses PARTIAL and INCORRECT to the public "Revision Required" without disclosing which was internally PARTIAL vs INCORRECT.)

Replace the feedback render line (around line 650-652):
```tsx
<p className="mt-2 text-sm text-zinc-400">
  {submission.feedback}
</p>
```

with a derived-from-resultLabel version that ignores stored leaky feedback for non-CORRECT historical rows:

```tsx
<p className="mt-2 text-sm text-zinc-400">
  {submission.resultLabel === "CORRECT"
    ? submission.feedback
    : "The file is not ready for closure. The Bureau could not verify a complete chain of suspect, motive, and supporting evidence."}
</p>
```

This way, even if a historical TheorySubmission row has the old leaky `"You were correct on suspect, but still need to improve..."` feedback string in the DB, it never renders to the player. Belt-and-suspenders against the optional data scrub described in observations.

**(d) `tests/api/theory.test.ts`** — update assertions:

The test file likely asserts on the old response shape (`resultLabel`, `score`, etc.). Update each affected test:
- Where the test asserts `body.resultLabel === "CORRECT"`, change to `body.publicVerdict === "CASE_CLOSED"`.
- Where the test asserts `body.resultLabel === "PARTIAL"` or `"INCORRECT"`, change to `body.publicVerdict === "REVISION_REQUIRED"`.
- Where the test asserts `body.score === N`, **delete that assertion** entirely (score is no longer in the response).
- Where the test asserts on `body.feedback`, update to expect the sealed feedback string from Fix 1's new buildFeedback.

**Verification:**
- `npx tsc --noEmit` clean. The route, form, and workspace are now in lockstep on the new shape.
- `npx vitest run` — all tests pass after the assertion updates. Test count may stay flat or shift slightly.
- Mental trace: player submits a CORRECT theory → server computes evaluation with `resultLabel: "CORRECT"` → stores it in DB → returns `{publicVerdict: "CASE_CLOSED", feedback: "Your theory satisfies..."}` → form renders "Closure Standard Met" + closure feedback. Player submits a PARTIAL theory → server returns `{publicVerdict: "REVISION_REQUIRED", feedback: "The file is not ready..."}` → form renders "Revision Required" + revision feedback. Internal DB still has `resultLabel: "PARTIAL"` for analytics; player never sees "PARTIAL" anywhere.

**Commit subject:** `feat(theory): publicVerdict response shape — sealed verdict on route + form + workspace`

---

### Fix 3 — `chore(validators): raise theory motive/evidence minimum lengths to discourage junk probes`

**File:** `lib/validators.ts` only.

**Current state** (lines 65-81):
```ts
export const theorySubmissionSchema = z.object({
  suspectName: z.string().trim().min(2, "Suspect name is required.").max(120, ...),
  motive: z.string().trim().min(10, "Motive must be at least 10 characters.").max(1000, ...),
  evidenceSummary: z.string().trim().min(10, "Evidence summary must be at least 10 characters.").max(2000, ...),
});
```

**Replacement** — bump motive and evidence minimums to discourage junk-padded probes:

```ts
export const theorySubmissionSchema = z.object({
  suspectName: z
    .string()
    .trim()
    .min(2, "Suspect name is required.")
    .max(120, "Suspect name is too long."),
  motive: z
    .string()
    .trim()
    .min(30, "Describe the motive in a sentence or two.")
    .max(1000, "Motive is too long."),
  evidenceSummary: z
    .string()
    .trim()
    .min(50, "Summarize the evidence — mention specific records, witnesses, or timeline details.")
    .max(2000, "Evidence summary is too long."),
});
```

The error messages are now action-oriented (telling the player what to do, not just a character count). The thresholds (30 / 50) are deliberately softer than the more aggressive 80 / 150 floor ChatGPT proposed — this batch favors a lighter friction lift while we observe playtesting feedback. Tighten further in a follow-up batch only if junk probes empirically continue.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — `tests/api/theory.test.ts` and possibly `tests/lib/case-evaluation.test.ts` may have fixtures with `motive: "x"` or similar short strings. Update those fixtures to use ≥30 / ≥50 character versions. If any test was specifically asserting "min-10 passes" behavior, update to "min-30 / min-50 passes."
- Mental trace: existing legitimate players who write thoughtful motives/evidence (>30 / >50 chars) are unaffected. Players (or attackers) who try to submit "x" or 10-char filler hit a 400 with the action-oriented error message.

**Commit subject:** `chore(validators): raise theory motive/evidence minimum lengths to discourage junk probes`

---

### Fix 4 — `docs(content): closure-standard rule + author-discipline guidance in CLAUDE.md`

**File:** `CLAUDE.md` only (in the project root, not in `audits/`).

**What:** add a short author-discipline section to CLAUDE.md so future case authors (including future-Demetre) understand the closure-standard rule and don't accidentally re-introduce per-component diagnostic feedback.

**Where to insert:** find the "### Test credentials (local dev only)" section near the bottom of CLAUDE.md and insert the new section directly before it.

**Content to insert:**

```markdown
### Theory submission — closure-standard rule (Batch 13)

Final-theory feedback **must never confirm isolated correctness**. The Bureau's review is binary at the public layer: either the case meets closure standard (suspect + motive + evidence form a complete chain) or it does not. The system never tells the player "you got the suspect right but need to improve the motive."

Why: per-component feedback is a brute-force exploit. A player iterating the suspect field with junk motive/evidence text can enumerate the answer in N submissions where N = number of suspects. Sealed feedback closes the leak completely.

Author discipline per case:

- **`solutionSuspect`**: primary name plus genuine aliases only. Pipe-separate (`Mara Kessler|Kessler|M. Kessler`). Do not include junk variants ("Mara Kesler" with typos) — those are the player's responsibility to get right.
- **`solutionMotive`**: canonical motive phrases with discriminative tokens. Pipe-separate genuine paraphrases only. Avoid generic words ("money", "jealousy", "argument") that overlap with many incorrect motives.
- **`solutionEvidence`**: required proof concepts, not vague terms. Mention specific records, witnesses, or timeline details that distinguish the correct theory from plausible alternatives.
- **Hints**: 3–5 non-diagnostic hints per case that nudge investigation behavior, not answer components. Examples: "Reconstruct the final hour before the incident." "Compare motive against access — a reason is not enough without opportunity." "Find the record that turns suspicion into proof." Do NOT write hints like "Look at the third suspect" or "The motive is fraud-related."
- **Debrief**: explains the exact correct chain after the case is solved. The debrief is where the per-component reasoning lives — the player only sees it after CASE_CLOSED.

Internal storage of `suspectCorrect` / `motiveCorrect` / `evidenceCorrect` flags on `TheorySubmission` continues — those are useful for analytics and admin views. Only the player-facing `feedback` string and the API response are sealed.
```

**Verification:**
- No code changes that affect tsc.
- `npx vitest run` unchanged.
- Manual: re-read the inserted section and confirm it's accurate against the implementation in Fix 1 and Fix 2. The rule "Final-theory feedback must never confirm isolated correctness" is the standing instruction.

**Commit subject:** `docs(content): closure-standard rule + author-discipline guidance in CLAUDE.md`

---

### Fix 5 — `docs(audit): batch 13 report + observations`

Two new files mirroring the BATCH_12 structure.

**`audits/BATCH_13_REPORT.md`** (~200-280 lines):

- Pre-flight tree state.
- 4-row commit table for Fixes 1-4.
- Per-fix detail block for each: applied yes/no, files touched, diff stats, tsc + vitest deltas, mental trace, anomalies if any.
- Final verification gate output: `git log --oneline -5`, `git status`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `git diff <pre-batch-SHA>..main --stat`.

**`audits/BATCH_13_OBSERVATIONS.md`** (~120-180 lines):

1. **Why this batch supersedes the audit's recommended Batch 13/14.** The 2026-05-07 UX-polish audit recommended Batch 13 = refund visibility + serial unification, Batch 14 = copy fixes + owned-case CTA. Both are valid follow-ups but neither closes a brute-force exploit on the climactic interaction. Numbering shifts: refund-visibility batch is now Batch 14, copy-fixes batch is Batch 15. No work is dropped.

2. **Operator-action: optional one-time data scrub for historical TheorySubmission rows.** Old rows in the DB still have leaky feedback strings (e.g. `"You were correct on suspect, but still need to improve motive, evidence."`). Fix 2's render-side suppression already prevents these from displaying to the player — the panel derives display from `submission.resultLabel`, not from `submission.feedback`. But for forensic cleanliness, the operator may run this SQL one-time after the deploy lands:

   ```sql
   UPDATE "TheorySubmission"
   SET feedback = ''
   WHERE feedback != ''
     AND "resultLabel" != 'CORRECT';
   ```

   Belt-and-suspenders. Not required for correctness; recommended for hygiene. Run via Neon SQL Editor.

3. **Why the matcher AND-tightening was deferred.** ChatGPT recommended changing `intersection.size >= 2 OR Jaccard >= 0.34` to AND. This batch keeps OR. Reason: tightening the matcher could cause false negatives on genuinely correct theories whose vocabulary differs from the canonical phrasing. The current matcher's permissiveness is a feature for honest players. Tighten only if playtesting shows that sealed-feedback alone doesn't prevent enough probing.

4. **Why character-limit lifts were softer than ChatGPT recommended.** ChatGPT proposed motive min-80 / evidence min-150. This batch ships min-30 / min-50. Reason: thoughtful but terse writers (the kind who write "He killed her to silence the witness who saw the badge access discrepancy") might naturally produce 35-character motives. min-80 would frustrate them. min-30 is enough friction to discourage `"x"`-padded junk while not punishing real writers. Tighten further only if playtesting shows real probing.

5. **Suspect typo trap (alias-list discipline) deferred.** A player who types "Mara Kesler" instead of "Mara Kessler" still scores INCORRECT (and now sees the sealed "revision required" feedback, with no signal about which field tripped). The fix is per-case author discipline: populate `solutionSuspect` with `"Mara Kessler|Kessler|M. Kessler|Ms. Kessler"` etc. This is a content-side discipline change, not a code change — it can ship per-case as authors update their cases, no batch needed. Documented in CLAUDE.md (Fix 4).

6. **The hint ladder feature is NOT in this batch.** ChatGPT recommended adding a "Request Case Guidance" panel outside the final form to give stuck players non-diagnostic hints. This batch closes the leak but doesn't add the relief valve. Reason: keeping the batch tight. Hints already exist in the schema (CaseHint model, gated by stage). At stage 3 all hints are unlocked. Add a dedicated bureau-hint-on-demand UI in a future batch (Batch 16+).

7. **Production verification checklist for the operator.** After push + deploy:
   - Sign in as test investigator (un-revoked UserCase per the Batch 12 SQL trick).
   - Submit a CORRECT theory with the canonical solution → expect "Closure Standard Met" verdict + sealed closure feedback. Status pill flips to Resolved.
   - Open `/bureau/cases/<slug>` workspace. Recent Submissions panel should show the past attempts as either "Closure Standard Met" or "Revision Required" — never "PARTIAL", never "INCORRECT", never "1/3" or "2/3".
   - Submit a deliberately wrong theory (e.g. wrong suspect, junk motive that meets min-30) → expect "Revision Required" + sealed revision feedback. The feedback text says "The file is not ready for closure..." — does NOT mention which component was correct.
   - Try the brute-force exploit yourself: submit 5 different suspects with junk motive/evidence. Each should return identical "Revision Required" feedback. The exploit is closed.

8. **Carry-forward items unchanged from Batch 12:** Sentry, CSP nonce migration, app/layout.tsx auth() per-render, forgot-password timing leak, error.tsx absence (audit starter #3), R2 ContentLength alternative paths, F-04 lawyer brief pending. Plus the audit-recommended Batch 14 (refund visibility) and Batch 15 (copy fixes) are queued.

**Commit subject:** `docs(audit): batch 13 report + observations`

Then stop. Do not push.

---

## 4. Final verification gate

After all five commits are on tree:

```
git log --oneline -5                # Fix 1-4 + report in order
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # passing (count may shift slightly due to test-surgery in Fix 2)
npm run build                       # clean (only pre-existing pg SSL informational notice + middleware deprecation note)
git diff <pre-batch-SHA>..main --stat
```

Expected files touched:

```
lib/case-evaluation.ts                                                              (Fix 1)
tests/lib/case-evaluation.test.ts                                                   (Fix 1, if exists)
app/api/cases/[slug]/theory/route.ts                                                (Fix 2)
components/bureau/TheorySubmissionForm.tsx                                          (Fix 2)
app/bureau/cases/[slug]/page.tsx                                                    (Fix 2)
tests/api/theory.test.ts                                                            (Fix 2)
lib/validators.ts                                                                   (Fix 3)
CLAUDE.md                                                                           (Fix 4)
audits/BATCH_13_REPORT.md                                                           (Fix 5, new)
audits/BATCH_13_OBSERVATIONS.md                                                     (Fix 5, new)
```

If any other file is in the diff, restore it before declaring done.

---

## 5. Begin

Read `lib/case-evaluation.ts` end-to-end before editing — pay close attention to `buildFeedback` (lines 66-98) and how it's called from `evaluateTheorySubmission` (around line 179). Read `app/api/cases/[slug]/theory/route.ts` end-to-end. Read the Recent Submissions panel in `app/bureau/cases/[slug]/page.tsx` (lines 613-660). Read `components/bureau/TheorySubmissionForm.tsx` end-to-end. Read `tests/api/theory.test.ts` and `tests/lib/case-evaluation.test.ts` (if it exists) to know which assertions need updating in lockstep with the code change.

Then start with Fix 1 — the matcher's `buildFeedback` rewrite. Verify tsc + vitest clean (with test-assertion updates) after the commit. Then Fix 2 — the response-shape change touching four files. Then Fix 3 — the validator length lifts. Then Fix 4 — the CLAUDE.md authoring rule. Then Fix 5 — the two report files.

When you finish, surface the operator-action callout in your closing message: **"Run `git push`. No `prisma migrate deploy` needed — this batch is pure code, no schema change. Optional post-deploy: run the one-line SQL data scrub in Neon SQL Editor (documented in BATCH_13_OBSERVATIONS.md §2) to clear leaky historical feedback strings. Then run the production verification checklist in BATCH_13_OBSERVATIONS.md §7."**

Done.
