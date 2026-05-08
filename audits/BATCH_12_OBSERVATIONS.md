# BATCH 12 — OBSERVATIONS

Batch 12 is eight surgical UX-polish fixes from the
2026-05-07 dogfooder's audit
(`audits/2026-05-07-ux-polish-audit.md`), applied as XS-effort
patches across distinct files. The notes below capture
design rationale that didn't fit in the per-fix blocks of
`BATCH_12_REPORT.md`, plus carry-forward items.

## 1. UX-01 latent-bug closure

The `hidden_evidence` content branch in
`app/(unlock)/bureau/unlock/_components/UnlockForm.tsx` was
rated P0 by severity in the audit but is a **latent** bug.
Operator screenshots of the admin AccessCode list dated
2026-05-08 confirm production currently has zero
`hidden_evidence` access codes; only `record`, `person`, and
`hint` codes have ever been created. No real user has ever
encountered the broken "no longer available" copy. The fix
ships ahead of any future hidden_evidence code creation —
the operator can now create such codes through the existing
admin UI dropdown without breaking the redemption flow on
the player side.

The server-side branch in
`app/api/access-codes/redeem/route.ts:35-40` and the
workspace-side `RevealedEvidence` rendering for ALREADY-
redeemed hidden_evidence codes were already wired (Wave 4 of
Post-Week-8 fix waves, commit `5a47771`). UX-01 was the only
remaining client-side gap on the unlock-form side specifically
— the route a player walks down the FIRST time they redeem,
which is the only path that hit `UnlockedContent` at all.
The matching workspace renderer for already-redeemed codes
was unaffected by this bug.

## 2. UX-15 normalization caveat

The `redeemAccessCodeSchema` and `createAccessCodeSchema`
relaxation to `.toUpperCase()` is purely additive on the
write path going forward — every NEW AccessCode an admin
creates will be uppercased at the validator boundary, even
if the admin somehow types or pastes a lowercase code into
the create form. Per-operator screenshots, all currently
existing AccessCode rows in the production database are
already uppercase (the admin UI generates codes via
`randomHex8`, which emits uppercase hex), so the fix has no
data-migration tail.

If a one-off lowercase row ever surfaced (e.g. a code created
manually via Prisma Studio in the past), it would continue
to fail redemption until corrected. The remediation is a
one-line UPDATE the operator can run when needed:

```sql
UPDATE "AccessCode" SET code = UPPER(code) WHERE code != UPPER(code);
```

Not run as part of this batch because (a) the screenshots
verify no such rows exist today, and (b) the prompt forbids
migrations / data changes.

## 3. Fix 6 (admin Remove confirms) — coverage note

The four tab components' `Remove` buttons now wrap their
`remove(index)` handlers in a `window.confirm("Remove this
<noun>? This will be saved when you click Save Changes.")`
guard. `window.confirm` interactions are not unit-tested
in this codebase — `components/admin/RevokeButton.tsx`
sets the precedent (its existing `confirm` is also untested),
and adding jsdom-mocked confirm wiring just for these four
new wrappers would have been more test scaffolding than the
fix itself.

Worth a manual smoke during operator verification: open the
case editor at any case, hop through People/Records/Hints/
Checkpoints tabs, click `Remove` on any row, confirm the
browser dialog appears, click Cancel and verify the row
stays, click Remove again and OK and verify the row vanishes
from the in-memory list (still recoverable until Save
Changes).

The "This will be saved when you click Save Changes"
suffix on every dialog's copy is intentional: the diff/upsert
PATCH endpoints only fire on the Save button, so the user
needs to know the in-memory removal is recoverable until
they hit Save. This matches the actual contract of the
admin tab editor — the Remove button is destructive in
intent but not in effect until Save.

## 4. Audit findings still unaddressed in this batch

Per the audit's recommended grouping
(`audits/2026-05-07-ux-polish-audit.md` §"Recommended
batches"), the named Batch 12 was the eight closed here.
The remaining audit items group as:

- **Batch 13 (recommended):** UX-08, UX-03, UX-09, UX-10,
  UX-16, UX-17 — refund-visibility cluster +
  case-serial-display unification. Larger touch surface
  than Batch 12, mostly product-copy work plus one
  data-shape decision (case-serial source-of-truth). Worth
  bundling because the case-serial finding (UX-16) and the
  catalog-card finding (UX-17) share a DB query and edit
  the same render path.

- **Batch 14 (recommended):** UX-02, UX-04, UX-05, UX-07,
  UX-13, UX-19, UX-20, UX-21, UX-23 — copy fixes +
  owned-case CTA on `/cases/[slug]` + post-action
  confirmation polish. Mostly XS each, batches well
  together because they all touch the public-marketing or
  player-flow surface.

- **Deferred (P3 / M-effort):** UX-11 (image consumers —
  needs design call on aspect ratio + cropping), UX-29
  (server-resolved `featuredCase` — needs at least 2
  published cases to make sense), UX-30, UX-34, UX-35,
  UX-28 (P3 nits or M-effort items the operator can
  schedule against business priorities). UX-28 specifically
  is queued behind a product call about whether the
  catalog's "Coming Soon" placeholder should resolve
  against any stub case rows or remain a marketing-only
  string.

The five "starter UX issues" mentioned in the audit prompt
preamble (unlock copy ambiguity, NextAuth catch-all
behavior, missing `error.tsx`, archive-without-confirmation,
AccessCodeList "record #5" raw target labels) are
explicitly NOT in Batch 12's scope and ship later — likely
folded into Batch 13/14 or carved into a small Batch 15
depending on operator priorities.

## 5. Carry-forward items unchanged from Batch 11

Same set of operational and architectural carry-forwards
listed under `audits/BATCH_11_OBSERVATIONS.md` § "Carry-
forward items" remain in flight, none of them addressed by
Batch 12:

- Sentry / structured logging is still console.error-only
  to Vercel logs (P3 hardening).
- CSP nonce migration still queued (script-src has
  'unsafe-inline' / 'unsafe-eval').
- `app/layout.tsx` still calls `auth()` per render — minor
  perf finding from earlier audits, not a correctness bug.
- Forgot-password timing leak unfixed (would break
  Resend-assertion test; queued for a coordinated fix).
- `error.tsx` absence at `app/` root still pending (audit
  starter #3) — known and scheduled.
- R2 ContentLength alternative paths from Batch 8B still
  pending product input.
- F-04 lawyer brief on Privacy / Terms still scheduled
  ahead of first real revenue.
- The original four staged FIX_PROMPT files (9, 9B, 10,
  11) — already archived in commit `032638d` /
  `caae2e6`. The newly-untracked
  `audits/2026-05-07-ux-polish-audit.md` and
  `audits/FIX_PROMPT_BATCH_12.md` will follow the same
  archive pattern at the operator's discretion.

## 6. Test-count drift

Pre-Batch-12 baseline was 24 files / 197 tests. Post-Batch-
12 is 24 files / 198 tests (+1 from Fix 5's lowercase-input
case-normalization assertion). No file count change, no
breakage on the 7 happy/sad existing access-codes-redeem
cases.

## 7. Operator action recap

`git push` only. No `prisma migrate deploy`. No env-var or
Stripe Dashboard work. Hidden_evidence access codes are now
safe to create through the existing admin AccessCode UI.
