# Batch 16 — Observations

Companion to `BATCH_16_REPORT.md`. The report records *what* shipped; this file records *why* — load-bearing reasoning, deferred decisions, and the production verification checklist.

---

## 1. Why this batch supersedes audit-recommended Batch 14 + 15

The 2026-05-07 UX-polish audit recommended Batch 14 (refund visibility + serial unification) and Batch 15 (copy fixes + owned-case CTA). Batch 16 folds both in, then adds:

- The 2026-05-10 full-scope god-mode review's P1: `/bureau/archive` was rendering `THEORY_RESULT_LABEL` + `score/3` + raw stored `feedback` for every past submission, completely bypassing Batch 13's closure-standard sealed-verdict rule. One click from the workspace, the brute-force exploit Batch 13 was meant to close was reopened.
- Phase-1 immersion polish from `BUREAU_IMMERSION_PROMPT.md` + ChatGPT: a Bureau Message Registry (`data/bureau-messages.ts`) that locks the noir-procedural voice register established by Privacy + Terms + Batch 13 into one source of truth, applied across login + unlock + theory submission + per-case database header.
- The F-30 long-tail item from the audit list: no `app/error.tsx` boundary — first uncaught render error showed the unstyled Next.js default.
- Quick-polish bundle (engines.node, admin Link migration, unarchive-case argv, RevokeButton field cleanup) — minor backlog items that don't deserve their own batches.

The numbering jump 13 → 16 is deliberate: it signals "this is larger than either of the audit-recommended individual batches, and folds them in." No prior queued work is dropped.

---

## 2. The closure-standard rule is the load-bearing security invariant

Fix 1 closes the regression at `/bureau/archive`. Fix 6 (theory submission copy pass) **preserves** the invariant — only labels and placeholders moved to the registry; the API response shape (`message` + `publicVerdict` + `feedback`), the form's request/response handling, the verdict-to-tone mapping, and the result-panel JSX are byte-identical to post-Batch-13 state. The sealed-verdict rule documented in CLAUDE.md remains the standing instruction.

The registry's `theorySubmission.closureStandardMet` / `revisionRequired` labels are the same two strings Batch 13 used; they did not need new wording. They moved into the registry purely so future copy edits are a one-place change instead of a code-search-and-update.

---

## 3. The serial unification uses `id`, not `slug`

`id` is immutable. `slug` can rename (CaseSlugHistory tracks aliases). Using `id` for the player-facing serial means renaming a slug never changes the visible serial — the diegetic identifier is stable across the case's lifetime. The old `slug.toUpperCase().replace(/-/g, "").slice(0, 8)` derivation on the debrief page drifted on rename; the new helper does not.

Pad floor is 3, no upper cap (`BL-1037` for id 1037, `BL-001` for id 1). Three-digit floor is the right minimum for the catalog size we're operating at — six-digit ids are already supported without code change.

---

## 4. Owned-case CTA shows "Open Workspace" as the primary action

Alternative considered: hide the entire CTA card for owners on `CasePublicView`. Rejected — the public marketing page is reachable from shared links, search engines, and bookmarks. An owner who landed there via a friend's recommendation should still see "you own this, here's where to continue" rather than the confusing absence of a CTA. The secondary "Return to Bureau" link covers users who want the dashboard.

The `On Your Desk` `Pill` tone is `success` — same as `Available Now` — because both indicate the user can act productively. Only the label differs.

---

## 5. `app/error.tsx` does not import shared UI primitives

If the fault was inside `Card`, `Pill`, `StampBadge`, or any other primitive, the boundary must render without those primitives — otherwise a primitive bug crashes the boundary itself. Fix 5 uses raw Tailwind utilities only.

Phase 2 may extract a `BureauFault` primitive for reuse in route-segment `error.tsx` files (so admin panel faults render differently from player-facing faults). Today, a single root-level boundary is enough; segment-specific boundaries are deferred until there's actual divergence in fault-handling needs.

The `console.error("[bureau:error]", error)` call is a stub — when Sentry lands, the file's inline comment marks the exact line to swap for `captureException(error, { extra: { digest: error.digest } })`.

---

## 6. The Bureau Message Registry excludes theory feedback strings

Those live in `lib/case-evaluation.ts:buildFeedback` because Batch 13 made the sealed-verdict invariant load-bearing for security. Centralizing them in `data/bureau-messages.ts` would create a refactor risk on a security invariant — every future copy edit would need to re-prove the diagnostic leak hasn't been reintroduced. Forms display API-returned feedback as-is.

The registry's docstring states this carve-out explicitly so future Phase-2/3 batches don't accidentally absorb the feedback strings.

---

## 7. The registry excludes marketing-page voice

`data/site.ts` is the marketing-product copy source. Unifying Bureau-system voice with marketing-product voice in one batch would touch four pages (`/about`, `/faq`, `/how-it-works`, `/support`) — a separate copy-discipline pass that warrants its own batch. Today's registry is the system-voice contract only.

The discipline boundary: anything inside `/bureau/*` or `/cases/*` (the player-facing system) belongs in the registry. Anything on the home page, FAQ, support, etc. (the product-marketing surface) stays in `data/site.ts`.

---

## 8. Intel-drop handshake animation is NOT in this batch

`BUREAU_IMMERSION_PROMPT.md` ideation #17 ("CODE RECEIVED → ARTIFACT SOURCE VERIFIED → CASE LINK CONFIRMED → INTEL FILE RELEASED" multi-step animation) is Phase 2 work. Phase 1 ships the static copy via the registry: button label changes from "Unlock" to "Transmit Code", banner from "Evidence unlocked" to "Source verified — intel filed to your case desk".

The staged animation requires a shared motion vocabulary (Framer Motion is in the project but only used in two surfaces today). A Phase-2 batch will add the animation primitive and apply it to unlock + checkpoint + theory-submission transitions in one sweep.

---

## 9. Analyst Desk Grid layout refactor is NOT in this batch

ChatGPT's Phase 2 work on `/bureau`. Today's bureau dashboard is a vertical stack of cards; the Phase-2 plan is a multi-panel `grid-template-areas` layout with a left identity column, center active-reviews + activation forms, and right archive + recent submissions. Phase-1 voice + filter changes (Fix 2 + Fix 3) are independent of the layout refactor — both can happen in either order without conflict.

---

## 10. `User.callsign` schema field is NOT in this batch

Phase 2 work. Requires a migration, registration UX changes, possibly a dedicated profile-settings page. Today's `/bureau` identity block continues to render `userEmail` until that batch lands.

ChatGPT proposed a "callsign-from-user-id" interim (e.g., deterministic hash → "OPERATIVE-K9-447"). Rejected for now — changing the display today, then changing it again when the schema lands, would be churn. Defer once to the real-schema batch.

---

## 11. Production verification checklist for the operator

After `git push` triggers the Vercel deploy, walk this:

1. **Login voice.** Visit `/login`. Confirm:
   - Right card eyebrow reads "Secure access".
   - Heading reads "Sign in".
   - Body reads "Sign in to restore your analyst station and continue any open files."
   - Submit button reads "Scan Badge" when idle. Clicking with bad creds shows the loading state "Verifying credentials…" briefly then "Credentials rejected. Re-enter and try again."
2. **Theory submission sealed verdict.** Open any active case workspace. Submit a deliberately wrong theory. Confirm the result panel reads "Revision Required" with the sealed boilerplate — never the per-component diagnostic, never a numeric score. Visit `/bureau/archive`. Same submission appears with the same "Revision Required" boilerplate. Submit a correct theory (or use a test case where you know the answer). Confirm "Closure Standard Met" + the Batch-13 sealed CORRECT feedback. The archive row also reads "Closure Standard Met" with the same feedback string.
3. **Refund visibility.** Simulate refund via SQL on a test row: `UPDATE "UserCase" SET "revokedAt" = NOW() WHERE id = X` (against a non-production-customer row). Reload `/bureau` — that case must be absent from Active Reviews, Completed Archive, and the stats counts. Visit `/bureau/cases/<slug>/debrief` for that case — must 404 via `notFound()`.
4. **Public marketing page.** Visit `/cases/<published-slug>` while signed out. Confirm:
   - Header reads `BL-001 / Standalone Investigation` for case id 1, `BL-002` for case id 2, etc.
   - Right CTA card shows "Available Now" + BuyButton.
   Sign in as a user who owns that case. Reload. Confirm:
   - Right CTA card shows "On Your Desk" + "This file is assigned to your station" + "Open Workspace" CTA → `/bureau/cases/<slug>`.
   - "Return to Bureau" secondary link.
5. **Unlock voice.** Visit `/bureau/unlock` while signed in. Confirm SectionHeader reads "Bureau / Incoming Artifact Transmission". Input placeholder "Enter or scan code". Submit a known valid code. Confirm success banner reads "Source verified — intel filed to your case desk." Submit it again. Confirm banner reads "Already filed. This artifact is in your case record."
6. **Per-case database voice.** Open `/bureau/cases/<slug>/database` for a case at stage 3. Confirm page header eyebrow "Case Index", body "Query the case index. Only cleared subjects, records, and analyst notes are available through Stage 3." Search card eyebrow "Query Terminal", heading "Query the case index". Input placeholder "Names, records, evidence, keywords…".
7. **Error boundary.** Optional — in dev only — drop `throw new Error("test")` into any page component, hit the route, confirm the boundary renders System Fault eyebrow + "The bureau ran into an unexpected fault" heading + Retry + Return to Bureau CTAs. Revert.
8. **Admin nav speed.** Sign in as ADMIN. Visit `/bureau/admin/cases`. Click "Edit Content" / "Preview" / "Manage Codes" on any case row. Confirm client-side route transition (no full page reload — verify via DevTools Network tab, no full document request).
9. **Unarchive script.** From a local shell: `npx tsx scripts/unarchive-case.ts 7` (against a non-production env) — should target case id 7. Run without an argument — should print usage and exit 1. Run with `foo` — should print "Invalid case id" and exit 1.
10. **Revoke button.** As ADMIN, open a Manage Codes page, click Revoke on a code. Confirm the code's `revokedAt` is stamped server-side (check via Prisma or activation flow). The client now sends `{}` not `{ revokedAt: ... }`.

If any of these fail, do not push more code — diagnose first. Most likely cause for an unexpected fail is browser cache; hard-reload before treating as a real regression.

---

## 12. Carry-forwards unchanged from Batch 13

Still queued for later batches; none in scope for Batch 16:

- Sentry instrumentation (operator-action launch-blocker; needs npm install + DSN config).
- CSP nonce migration (drop `'unsafe-inline'` / `'unsafe-eval'` from script-src).
- `app/layout.tsx` runs `auth()` on every render — performance-sensitive only for ADMIN nav decisions, not a security gate.
- Forgot-password timing leak (would break existing Resend-assertion test if fixed today; needs test refactor first).
- R2 ContentLength alternative paths in webhook + presign (deferred to refund/operations batch).
- F-04 lawyer brief still pending — operator task, not code.
- Operational launch-blockers: Resend DKIM/SPF/DMARC, Stripe Live activation, daily pg_dump, GitHub Actions CI. All external operator tasks; not code-fix-prompt material.
- Marketing-page voice rewrite (`/about`, `/faq`, `/how-it-works`, `/support`). Separate batch — see §7.

---

## 13. Carry-forwards from this batch (queued for Batch 17 — Phase 2 design layer)

These were called out in the fix prompt as out-of-scope; recording here as the persistent backlog so Batch 17 has a clean handoff:

- **Analyst Desk Grid layout refactor** of `/bureau` (multi-panel `grid-template-areas`).
- **File-tab navigation** in case workspace.
- `User.callsign` schema field + registration UX + identity-block render swap.
- **Intel-drop handshake animation** primitive + apply to unlock/checkpoint/theory.
- **Query transcript** on global database search (Phase 2 of CaseDatabaseSearch).
- **Closed Files Shelf** visual treatment for `/bureau/archive`.
- **Evidence Sheet refactor** for record detail page.

Also noted from Batch 16's own scope boundary:

- `CaseDatabaseSearch` component-internal eyebrow + heading remained in-component, not registry-extracted. Phase 2 should extract them when a Tabs primitive lands so the registry stays a top-level voice contract rather than a component-local string table.
- Account-deletion confirmation email (P2 from earlier batches) still pending.
- Cron sweeper for failed activation-code emails — schema is ready, infra is not.

---

## 14. Test count drift note

CLAUDE.md still cites 161 Vitest tests. Actual baseline at start of Batch 16 was 198 across 24 files; post-batch is 203 across 25 files. Doc-only drift, no breakage. The CLAUDE.md figure has been stale since at least Batch 13 — a one-line refresh would be welcome but is not load-bearing and is therefore out of scope for this batch.
