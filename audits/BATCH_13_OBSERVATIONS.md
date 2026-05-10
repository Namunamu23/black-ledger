# Batch 13 — Observations

Notes the report doesn't have a slot for. Written at end of batch, after all five commits.

---

## 1. Why this batch supersedes the audit's recommended Batch 13/14

The 2026-05-07 UX-polish audit recommended:

- Batch 13 = refund visibility + serial unification (showing refunded UserCases as "Refunded" in the dashboard, unifying the BL-XXXX serial format across pages and emails).
- Batch 14 = copy fixes + owned-case CTA (cleaning up some confusing strings, hiding the BuyButton on cases the player already owns).

Both are valid follow-ups. Neither closes a brute-force exploit on the climactic interaction in the entire product.

The operator's dogfooding turned up a leak that lets a player at stage 3 of any case enumerate the murderer in N submissions (N = number of suspects, typically 5) without reading any records or doing any deduction. The deduction game collapses into a guessing game; the kit becomes "an expensive way to read a story." Nothing else in the audit backlog comes close in severity.

So the numbering shifts:

- **Batch 13** (this batch) — sealed holistic verdict.
- **Batch 14** — refund visibility + serial unification (the audit's original Batch 13). Queued unchanged in scope.
- **Batch 15** — copy fixes + owned-case CTA (the audit's original Batch 14). Queued unchanged in scope.

No work is dropped; only the order shifts.

---

## 2. Operator action — optional one-time data scrub

Old `TheorySubmission` rows in the production DB still have leaky feedback strings persisted from before this batch. Examples likely present in the row history:

- `"You correctly identified the suspect, motive, and key evidence."` (CORRECT rows — fine, kept)
- `"You were correct on suspect, but still need to improve motive, evidence."` (PARTIAL rows — leaky)
- `"You were correct on motive, but still need to improve suspect, evidence."` (PARTIAL rows — leaky)
- `"Your current theory does not match the expected suspect, motive, or evidence strongly enough yet."` (INCORRECT rows — not a leak, but stylistically obsolete)

**Fix 2's render-side suppression already prevents these from displaying to the player.** The Recent Submissions panel derives the rendered feedback string from `submission.resultLabel === "CORRECT" ? submission.feedback : "<sealed sentence>"`. So even rows with leaky `feedback` columns never make it to the DOM.

For forensic cleanliness, the operator may run this SQL one-time after the deploy lands. Recommended but not required:

```sql
UPDATE "TheorySubmission"
SET feedback = ''
WHERE feedback != ''
  AND "resultLabel" != 'CORRECT';
```

Belt-and-suspenders. Runs via Neon SQL Editor. The row count affected depends on dogfooding history — likely small (< 50 rows) at this stage.

---

## 3. Why the matcher AND-tightening was deferred

ChatGPT's analysis of this same exploit recommended also tightening the matcher logic in `lib/case-evaluation.ts`:

> Change `intersection.size >= 2 OR Jaccard >= 0.34` to AND.

This batch keeps the OR. Reason: tightening the matcher could cause false negatives on genuinely correct theories whose vocabulary differs from the canonical phrasing. The current matcher's permissiveness is a feature for honest players who write in their own words.

Example. Solution: `solutionMotive: "Insurance fraud cover-up"`. Honest player writes: "she was hiding insurance fraud." Tokens (after filter): `{insurance, fraud}` from solution, `{hiding, insurance, fraud}` from submission. Intersection 2, union 3, Jaccard 0.667. Under OR: full match (both branches pass). Under AND: still full match (both branches pass). OK.

But: solution `solutionMotive: "Insurance fraud cover-up scheme"` (4 tokens). Honest player: "she committed insurance fraud." Tokens: `{insurance, fraud, cover, scheme}` vs. `{committed, insurance, fraud}`. Intersection 2, union 5, Jaccard 0.4. Under OR: full match. Under AND: still full match.

The AND-tightening only changes behavior when intersection ≥ 2 but Jaccard < 0.34 (rare but possible with very long candidate text), or when intersection = 1 and Jaccard ≥ 0.34 (also rare). Both edge cases are ambiguous; tightening could hurt honest players more than it helps closure.

With sealed feedback in place, the matcher's permissiveness is not a security weakness anymore — it's a UX feature. Tighten only if playtesting shows that sealed-feedback alone doesn't prevent enough probing.

---

## 4. Why character-limit lifts were softer than ChatGPT recommended

ChatGPT proposed `motive.min(80)` and `evidenceSummary.min(150)`. This batch ships `min(30)` and `min(50)`.

Reason. Thoughtful but terse writers can produce real, complete chains in 35–60 characters. Examples:

- Motive: "He killed her to silence the witness who saw the badge access." → 60 characters.
- Motive: "Insurance fraud cover-up." → 25 characters (under min-30 — would frustrate this writer).
- Evidence: "The lighter found at the scene came from his car keys." → 54 characters.
- Evidence: "Lighter at the scene." → 20 characters (under min-50 — would frustrate this writer).

The 30/50 floor frustrates the second pair (terse but technically complete) while min(80)/min(150) would frustrate both pairs. Better to hit the bare minimum that prevents `"x"`-padded junk and tighten further only if dogfooding shows real probing.

Friction lift summary:

| Field    | Before  | This batch | ChatGPT proposed |
| -------- | ------- | ---------- | ---------------- |
| motive   | min 10  | min 30     | min 80           |
| evidence | min 10  | min 50     | min 150          |

If we observe a player iterating with 30/50-character padding (`"abcdefghij" * 5` etc.), tighten to 60/100 in a future batch. The current matcher won't full-match those because no real candidate tokens overlap with random padding, so a 30/50 floor + sealed feedback is enough.

---

## 5. Suspect typo trap — alias-list discipline deferred

A player who types `"Mara Kesler"` (single 's') instead of `"Mara Kessler"` still scores INCORRECT under the exact-match suspect rule (`normalizeIdentity` doesn't fuzz typos), and now sees the sealed "Revision Required" feedback with no signal that the suspect was the only-near-miss.

The fix is per-case author discipline — populate `solutionSuspect` with `"Mara Kessler|Kessler|M. Kessler|Ms. Kessler|Mrs. Kessler"` and any other genuine aliases the player would naturally use. Do NOT include misspellings ("Mara Kesler") — those are the player's responsibility to get right.

This is a content-side discipline change, not a code change. It can ship per-case as authors update their cases — no batch needed. Documented in `CLAUDE.md` (Fix 4) as a standing instruction for future-Demetre.

---

## 6. Hint ladder feature — NOT in this batch

ChatGPT recommended also adding a "Request Case Guidance" panel outside the final form, to give stuck players non-diagnostic hints (e.g. "Reconstruct the final hour before the incident" or "Compare motive against access — a reason is not enough without opportunity"). This is the relief valve that goes with the closed exploit: now that we don't tell you which component matched, we should give you a different way to make progress when stuck.

This batch closes the leak but does NOT add the relief valve. Reason: keeping the batch tight; one structural change at a time.

What already exists:

- `CaseHint` model on the schema, gated by `unlockStage`.
- At stage 3 (the stage where theory submission is unlocked), all hints are already revealed via the existing `RevealedEvidence` flow.
- The current bureau workspace shows hints already-unlocked alongside records and people.

What is missing:

- A dedicated bureau-hint-on-demand UI distinct from the auto-unlocked hint stream.
- Friction (cooldown, count limit, price) on requesting a guidance hint.
- Authoring patterns for non-diagnostic guidance hints versus diagnostic answer-component hints.

Add this in a future batch (Batch 16+) once we see how playtesting goes with sealed feedback alone. The `CLAUDE.md` author-discipline section (Fix 4) explicitly notes that hints must be non-diagnostic — that constraint is now part of the standing authoring rule, applies regardless of when the dedicated UI ships.

---

## 7. Production verification checklist

After `git push` and Vercel auto-deploy, the operator should run this five-minute walk-through against `https://theblackledger.app`:

1. **Sign in as a test investigator** with a case that has stage 3 unlocked and is not refunded. The Batch 12 SQL trick (`UPDATE "UserCase" SET "revokedAt" = NULL WHERE id = ...`) can be used if needed to un-revoke a previously-refunded test row.
2. **Submit a CORRECT theory** matching the canonical solution. Expect:
   - Toast/inline message: "Theory accepted."
   - Verdict pill: emerald "Closure Standard Met" header.
   - Feedback text: "Your theory satisfies the closure standard. The suspect, motive, and supporting evidence form a complete chain."
   - Status pill on the case: flips to Resolved on `router.refresh()`.
3. **Open `/bureau/cases/<slug>` workspace** and look at the Recent Submissions panel. Past attempts should show:
   - A pill that is either "Closure Standard Met" (emerald) or "Revision Required" (amber).
   - **Never** "PARTIAL", "INCORRECT", "CORRECT" raw, or any past leaky feedback string.
   - **Never** an "X/3" score.
4. **Submit a deliberately wrong theory** (e.g. wrong suspect with junk-but-min-30 motive and junk-but-min-50 evidence). Expect:
   - Inline message: "Theory reviewed."
   - Verdict pill: amber "Revision Required" header.
   - Feedback text: "The file is not ready for closure. The Bureau could not verify a complete chain of suspect, motive, and supporting evidence. Reopen the record, pressure-test the timeline, and make sure every claim is tied to case evidence."
   - The feedback text does NOT mention which component (suspect/motive/evidence) was correct or incorrect.
5. **Try the brute-force exploit yourself.** Submit five different suspect names with the same junk-but-passing motive and evidence text. Expect every response to be identical "Revision Required" + sealed sentence. The exploit is closed.
6. **(Optional)** Inspect the Neon DB. The newly-written `TheorySubmission` rows should still have their internal `suspectCorrect`/`motiveCorrect`/`evidenceCorrect`/`score`/`resultLabel` columns populated correctly — only the `feedback` column is now sealed-and-uninformative even for INCORRECT rows. Old rows from before the deploy may still have leaky `feedback` strings; those don't surface to the player anymore (Fix 2 render-side suppression).

If any of the above doesn't behave as described, do not announce the launch fix until the gap is investigated. Most likely cause: a stale browser cache, since the form is a client component — hard refresh (Ctrl-F5) and retry.

---

## 8. Carry-forward items unchanged from Batch 12

The following items were on the carry-forward list at the close of Batch 12 and remain unaddressed by Batch 13. Batch 13 was scoped narrowly to the closure-standard exploit; none of these were in scope.

- Sentry / structured logging (no npm install in scope).
- CSP nonce migration (drop `'unsafe-inline'` and `'unsafe-eval'` from `script-src`).
- `app/layout.tsx` calls `auth()` per render — replace with a request-cached helper.
- `/api/forgot-password` timing leak (legitimate vs. unknown email reveals user existence). Resend test in `tests/api/register.test.ts` would need restructuring.
- No `app/error.tsx` (audit starter #3 from the 2026-05-07 UX-polish audit).
- R2 ContentLength alternative-paths handling for resumable uploads.
- F-04 lawyer brief still pending (Georgia legal review of Privacy + Terms).
- Audit-recommended Batch 14 (refund visibility + BL-XXXX serial unification) — **queued, was originally Batch 13**.
- Audit-recommended Batch 15 (copy fixes + owned-case CTA) — **queued, was originally Batch 14**.

Plus, new from this batch:

- The hint-ladder UI / "Request Case Guidance" feature (§6 above) — relief valve to pair with sealed feedback. Probably Batch 16+.
- One-time SQL data scrub of historical leaky `TheorySubmission.feedback` strings (§2 above) — operator-side, optional.
- Future tightening of the matcher to AND if playtesting shows probing continues (§3 above).
- Future tightening of the validator floors to 60/100 if playtesting shows padded probes (§4 above).
- Per-case `solutionSuspect` alias-list authoring discipline (§5 above) — content-side, no code change.

End of observations.
