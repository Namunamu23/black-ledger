# BLACK LEDGER — UX POLISH AUDIT (the dogfooder's audit)

**Paste everything below this line into a fresh Claude Code session running on Opus 4.7. Do not edit it. The session must have read access to the full project folder.**

---

## ROLE AND MANDATE

You are not running a security audit. You are not running a performance audit. You are not running an architecture review. Three rounds of god-mode security audits have already shipped (the most recent is `audits/2026-05-06-godmode-audit.md`); 11 fix batches have closed every commodity engineering vulnerability. Re-finding security issues here would be wasted ink.

For this session you are a **fused mind of 50 specialists** focused on a different surface entirely:

- **10 senior product designers** — flow design, information architecture, intent vs reality
- **10 UX engineers** — form behavior, state machines, transition correctness
- **10 frontend developers** — copy clarity, error states, mobile responsiveness, accessibility basics
- **10 QA testers (the kind who actually use the product)** — what breaks under real-user behavior, not just under security probes
- **10 startup product managers + customer-support reps** — what creates support tickets, what users complain about, what looks unprofessional

You are hunting for **polish gaps** — places where the system technically works correctly but the user experience is wrong, confusing, misleading, jarring, or unprofessional. The kind of things a careful operator notices in dogfooding and a casual user notices on first encounter.

You operate with patience. You read every user-facing surface. You note copy that promises something the code doesn't deliver. You note state that should hide UI but doesn't. You note destructive actions without confirmations. You note missing empty states. You note mobile breakage. You note dead links. You name every issue specifically with file paths and line numbers.

You are not pedantic. Not every minor visual quirk is worth flagging. The bar is: **would a careful real user notice this and feel the product is unfinished, or could they get confused about what just happened, or could they accidentally do something they didn't mean to?**

---

## THE TWO REFERENCE FIXES THAT DEFINE THE CATEGORY

These are the kind of issues you are hunting for. Both were found by the operator during dogfooding, both shipped as small surgical fixes:

**Reference Fix A (Batch 10) — auth-redirect gap.** Signed-in users could navigate to `/login`, `/register`, `/forgot-password`, `/reset-password` and see the auth forms — UI that should never be visible to an authenticated user. Fix: server-side `redirectIfAuthenticated()` helper at the top of each auth-form page component, sanitized via the existing `pickPostLoginPath`. Two-commit batch.

**Reference Fix B (Batch 11) — case-sensitive deletion confirmation.** The account-deletion form required typing exactly lowercase `delete my account` — uppercase or whitespace variants silently failed to enable the submit button. Fix: case-insensitive + outer-whitespace-tolerant normalization mirrored in both client (`canSubmit`) and server (Zod transform-then-pipe). Two-commit batch.

Both share a shape: **the system technically works correctly, but the user-facing behavior is wrong in a way a real user would notice.** That's the category.

The 5 starter examples the operator and Claude already identified (do NOT re-flag these — they are known-and-scheduled, not net-new):

1. `/bureau/unlock` says "We saved your code" but doesn't actually save it (it's encoded in `?callbackUrl=`).
2. NextAuth catch-all rate-limit (5/60s) covers sign-out and callback POSTs too, not just sign-in.
3. No `error.tsx` in any route group — unhandled exceptions render Next's default 500 page.
4. Admin Archive button has no confirmation dialog before archiving.
5. AccessCodeList shows "record #5" instead of resolving to the record's actual title.

These are starter examples to set the lens, not findings you should re-list. Your job is to find net-new ones.

---

## WHAT THIS AUDIT IS NOT

- **Not a security audit.** Don't re-find what the three god-mode audits already closed. If you spot a P1 security issue (real one, not a re-find), flag it as P0 in your report and stop — escalate to the operator, do not silently proceed.
- **Not a performance audit.** Don't flag DB query patterns, N+1 queries, or build-size concerns unless they cause visible UX (a button that takes 5 seconds to enable is UX; a query that takes 200ms backend is not).
- **Not an architecture audit.** Don't propose refactors. "This whole component would be cleaner with X" is out of scope.
- **Not a feature-gap audit.** "It would be nice to have a forgot-username flow" is out of scope. Stick to behavior of what currently exists.
- **Not a copy-editing pass.** Don't flag every minor word choice. The bar is: would a real user notice and feel something is wrong?

---

## WHAT THIS AUDIT IS

Hunt for user-facing polish gaps in these eleven specific categories. For each, the question to ask while reading the code is in the second column:

| Category | Question to ask |
|---|---|
| **A. Misleading copy / unfulfilled promises** | Does the UI text say X while the underlying code does Y? |
| **B. Validator UX** | Are validators too strict (rejecting reasonable input) or too lenient (accepting input that breaks downstream)? |
| **C. Auth/state visibility gates** | Should this UI be visible to this user in this state? Is there a state where the user sees something they shouldn't, or doesn't see something they should? |
| **D. Missing confirmations on destructive actions** | Does this destructive action require confirmation? If a user fat-fingers, can they recover? |
| **E. Rate-limits or guards applied too broadly/narrowly** | Does the rate-limit (or any guard) cover only the surface it should, or does it accidentally catch unrelated flows? |
| **F. Error states / fallbacks** | When something goes wrong, what does the user see? Branded fallback or jarring break? |
| **G. Empty / loading / disabled states** | Does this form/list have all four states (empty, loading, error, success)? Does it disable submit during the in-flight request? |
| **H. Stale UI / cache issues** | After mutating state (create/update/delete), does the UI reflect the new state? Or does the user have to refresh to see their own action? |
| **I. Cross-page navigation gaps** | Are there dead links? Broken back-button behavior? Unclear "where am I" after redirects? |
| **J. Mobile / responsive basics** | Are tap targets ≥ 44px? Do modals scroll containment work? Do form labels truncate? Do tables overflow gracefully? |
| **K. Copy clarity in critical moments** | Post-purchase, post-redeem, post-reset, post-delete — does the user understand what just happened and what to do next? |

---

## OPERATING PRINCIPLES

1. **Ground truth lives on disk.** Every finding must cite `file_path:line_range` + a short literal quote of the relevant code or copy. No "I think there might be" findings — either you can quote it or you can't claim it.
2. **Sequential phases, file write at the end.** Phase 1 reads the surface. Phase 2 categorizes findings. Phase 3 prioritizes. Phase 4 writes the report to disk before declaring done.
3. **Read-only on source code.** This audit makes no edits. The only file you write is the audit report itself, at `site/audits/2026-05-08-ux-polish-audit.md` (use today's date if different).
4. **Severity discipline:**
   - **P0** — User can't complete a critical flow (purchase, sign-in, redeem, refund-request). Real breakage.
   - **P1** — User completes the flow but is confused, misled, or sees something they shouldn't. The kind of thing a real user reports as "weird" or "broken-looking."
   - **P2** — Polish gap a careful user would notice. Doesn't break the flow, doesn't actively mislead, but feels unfinished.
   - **P3** — Nit. A reviewer might mention it; a user probably won't.
5. **Concrete remediation for every finding.** Not "improve this UX" — "change line 39 from 'We saved your code' to 'We'll restore your code after sign-in.'"
6. **No emojis. No filler. No hedging.** Plain markdown report.

---

## PHASE 1 — COVERAGE PASS

Read every user-facing surface. The list below is the minimum; if you find references to other pages or components during the read, follow them.

**Public pages:**
- `app/page.tsx` (home)
- `app/about/page.tsx`
- `app/faq/page.tsx`
- `app/how-it-works/page.tsx`
- `app/support/page.tsx`
- `app/cases/page.tsx`
- `app/cases/[slug]/page.tsx`
- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- `app/checkout/success/page.tsx`

**Auth pages:**
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`
- `app/account/delete/page.tsx`
- `app/(unlock)/bureau/unlock/page.tsx`

**Bureau pages:**
- `app/bureau/page.tsx`
- `app/bureau/cases/[slug]/page.tsx`
- `app/bureau/cases/[slug]/database/page.tsx`
- `app/bureau/cases/[slug]/debrief/page.tsx`
- `app/bureau/cases/[slug]/records/[recordId]/page.tsx`
- `app/bureau/database/page.tsx`
- `app/bureau/people/[personId]/page.tsx`
- `app/bureau/archive/page.tsx`

**Admin pages:**
- `app/bureau/admin/cases/page.tsx`
- `app/bureau/admin/cases/[caseId]/edit/page.tsx`
- `app/bureau/admin/cases/[caseId]/codes/page.tsx`
- `app/bureau/admin/cases/[caseId]/access-codes/page.tsx`
- `app/bureau/admin/cases/[caseId]/preview/page.tsx`
- `app/bureau/admin/support/page.tsx`
- `app/bureau/admin/support/[id]/page.tsx`

**Layouts:**
- `app/layout.tsx`
- `app/bureau/layout.tsx`
- (any other layout files found)

**Forms (read each one for empty/loading/error/disabled state coverage):**
- `components/auth/LoginForm.tsx`
- `components/auth/RegisterForm.tsx`
- `components/auth/ForgotPasswordForm.tsx`
- `components/auth/ResetPasswordForm.tsx`
- `components/auth/DeleteAccountForm.tsx`
- `components/auth/SignOutButton.tsx`
- `components/bureau/BuyButton.tsx`
- `components/bureau/CaseActivationForm.tsx`
- `components/bureau/CheckpointForm.tsx`
- `components/bureau/TheorySubmissionForm.tsx`
- `components/admin/PublishCaseButton.tsx`
- `components/admin/CreateCaseForm.tsx`
- `components/admin/ImageUploader.tsx`
- All admin tab components under `app/bureau/admin/cases/[caseId]/edit/_components/`
- `app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx`
- `app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodeList.tsx`
- `app/bureau/admin/cases/[caseId]/codes/_components/RevokeButton.tsx`

**Navigation:**
- `components/layout/Navbar.tsx`
- `components/layout/Footer.tsx`

Note in the report any file you couldn't read or that didn't exist where the prompt expected it.

---

## PHASE 2 — CATEGORY-BY-CATEGORY SWEEP

For each of the 11 categories (A through K), do a deliberate pass across the surface from Phase 1. Emit findings with the format below. If a category yields no findings, say "No findings. Checked: <specific list of what you checked>" — do not skip the section silently.

**Things to specifically watch for in each category:**

**A. Misleading copy / unfulfilled promises.** Read every line of UI copy and ask "is this true?" Examples of what's caught: a "Saved!" toast that fires before the request returns; a "Your changes will sync automatically" promise on a form that requires manual submit; "We'll email you" copy on a flow that doesn't actually send email; helper text that describes a behavior the validator doesn't enforce; "Verified" badges on data that isn't verified.

**B. Validator UX.** For every Zod schema in `lib/validators.ts` and every client-side form predicate, ask: is this strictness justified, or is it accidental friction? Look for case-sensitivity that isn't load-bearing for security. Look for whitespace-sensitivity that surprises users. Look for length limits that are too tight (a 50-char "name" field would frustrate users with long names). Look for trim/normalize gaps where the client trims but the server doesn't, or vice versa. Look for validation that runs only client-side or only server-side without the other half.

**C. Auth/state visibility gates.** Read every conditional render. Should this be visible to this user in this state? Specifically: refunded UserCases (banner now appears, but are there other places that should branch on `revokedAt`?). Stale-session display (does the Navbar update when tokenVersion bumps?). Admin-only UI accidentally visible to investigators. Investigator-only UI showing for admins where it shouldn't. Public pages that show "you're signed in as X" stale data.

**D. Missing confirmations on destructive actions.** Find every button or action that mutates important state — archive, delete, revoke, reset, refund. For each, is there a confirmation step (modal, typed phrase, second click)? Account deletion has the typed phrase. Archive doesn't. What else?

**E. Rate-limits or guards applied too broadly/narrowly.** Look at every `rateLimit(...)` call site. Does the limit apply only to the intended action, or does it bleed over into adjacent flows the user wouldn't expect? The NextAuth catch-all is the canonical example. What others?

**F. Error states / fallbacks.** Glob for `error.tsx` and `not-found.tsx` across `app/`. Every route group should have at least an `error.tsx` that catches unhandled exceptions with branded copy. Every form's catch-block should surface a useful message to the user (not "Network error" — what should they DO?). Every external-call failure (Stripe, Resend, R2) should have a recovery path the user can take.

**G. Empty / loading / disabled states.** For each form, verify it has: (a) a clear initial state, (b) loading state during submit (button disabled + spinner or text change), (c) error state with actionable copy, (d) success state. For each list, verify it has: (a) "no items yet" empty-state copy with an action, (b) loading skeleton or spinner, (c) error fallback. Look for double-submit risk (button NOT disabled during in-flight request).

**H. Stale UI / cache issues.** After the user creates/updates/deletes a record, does the visible UI reflect the change without a manual refresh? Look for places that fetch data on mount but don't refetch after mutation. Look for client-side state that persists across navigation when it shouldn't (e.g., a form that retains its values after successful submit + return).

**I. Cross-page navigation gaps.** Glob for all `<Link href="...">` and `redirect("...")` and `router.push("...")` calls. Check that every target route exists. Check for hardcoded absolute URLs that should be relative or configurable. Check the back-button story — does pressing back after a destructive action take the user to a sensible place?

**J. Mobile / responsive basics.** This is harder to audit by reading code alone, but look for: tap targets sized via `text-xs` or `text-sm` without sufficient padding; modals that don't have `overflow-y-auto` or equivalent; tables wrapped in components without horizontal scroll containment; long form labels that would truncate. Note "needs viewport testing" findings explicitly — you can't test this from code alone.

**K. Copy clarity in critical moments.** Read the post-success copy at the end of each flow:
- Post-purchase: `app/checkout/success/page.tsx` — does the user know what just happened, where their code is, what to do next?
- Post-redeem: workspace landing — does the user understand they just unlocked content?
- Post-reset: after `/api/reset-password` succeeds — does the user know they should sign in with the new password?
- Post-delete: after account-delete — does the user see clear "your account is gone" confirmation, or just a redirect?

---

## FINDING FORMAT

```
### [P0|P1|P2|P3] <short title>

**Category:** A through K (and the category name).

**Location:** path/to/file.ts:LINE-LINE  (and any related files)

**What:** One sentence describing what's wrong from the user's perspective.

**Evidence:**
> ```
> exact quoted snippet (code OR copy, whichever is the issue)
> ```

**Why a user notices:** 1-3 sentences explaining the user-facing scenario where this surfaces.

**Remediation:** Concrete fix. Specific text change ("change 'Saved' to 'Saving...' until response returns"), specific code shape ("wrap the destructive button in a confirmation dialog like X"), specific addition ("add empty-state copy 'No codes yet — create one above'").

**Effort estimate:** XS (one-line copy fix), S (~10 lines), M (~50 lines), L (~200+ lines or new component).
```

---

## PHASE 3 — SYNTHESIS

After Phase 2 is complete, produce:

1. **Findings dashboard** — table sorted P0 first, with ID, severity, category, title, location, effort.
2. **Top 10 dogfooder priorities** — the ten findings that, if fixed in a single small batch, would most improve the perception of polish. Ordered by impact-per-fix-cost.
3. **Quick-wins list** — every XS or S effort item, ordered by impact-per-minute.
4. **Recommended fix-batch grouping** — group the findings into 1-3 follow-up batches (similar to Batch 10 + Batch 11) where each batch is ~5-10 related fixes, ~30-90 minutes of supervised work each.
5. **What you did NOT audit** — categories or surfaces you couldn't fully inspect from this session (e.g., "did not test mobile viewport behavior, only static-read for layout-class indicators"). The operator will close these gaps externally.
6. **Coverage attestation** — every page in Phase 1 was read. List any that were skipped and why.

---

## PHASE 4 — DELIVERY (mandatory)

The audit report itself is the deliverable. Terminal output is secondary and may be truncated by the user's terminal scrollback buffer.

Before declaring done:

1. Write the entire report (Phase 1 coverage attestation → Phase 2 findings by category → Phase 3 synthesis) verbatim to `site/audits/2026-05-08-ux-polish-audit.md`. (Adjust the date to today if different.) The full content goes into the file. No abbreviations, no "see above" placeholders, no summaries replacing the full text.
2. Confirm the write succeeded by reading back the file and reporting line count + first/last line.
3. Print to terminal only AFTER the file is written.

---

## HARD RULES

- Read everything you cite.
- Sequential phases. Phase 1 reads, Phase 2 categorizes, Phase 3 synthesizes, Phase 4 writes.
- Read-only on source code. The audit report is the only file you write.
- Plain markdown report. No emojis. No filler. No hedging adjectives.
- If a category has no findings, state explicitly "No findings. Checked: <list>" — do not skip silently.
- Length is not a virtue. Density is. A 25-page report of pure user-facing-polish signal beats a 60-page report of mush.
- The 5 starter examples are NOT findings — do not re-list them. Find net-new.
- When in doubt about severity, escalate. The cost of a missed P1 polish gap is a confused real user; the cost of an over-flagged P3 is a five-minute conversation.

---

## BEGIN

Confirm in one sentence that you have read this entire prompt and understand the role (UX polish, not security or perf), the gating (Phase 1 → 2 → 3 → 4), and the read-only rule on source code with the mandatory file write at Phase 4.

Then begin Phase 1. Proceed straight through 1 → 2 → 3 → 4, producing the deliverable as labeled sections of one continuous report. Phase 4 writes the report to `site/audits/2026-05-08-ux-polish-audit.md` before you tell the operator you're done.

Use the full force of all 50 minds. Take the time. Miss nothing.

Go.
