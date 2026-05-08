# BATCH 12 — FIX REPORT

Eight surgical UX-polish fixes on `main` plus this report.
**No migrations.** **No new dependencies** — neither
`package.json` nor `package-lock.json` is modified. **No env
changes**, no pushes to remote. Closes one P0 (latent — see
note below), four P1s, three P2s from the 2026-05-07
dogfooder's UX-polish audit (`audits/2026-05-07-ux-polish-audit.md`).

The P0 (UX-01, hidden_evidence content type missing in
UnlockForm) is rated by severity — but it is a **latent** bug.
Operator screenshots of the admin AccessCode list dated
2026-05-08 confirm production currently has zero
`hidden_evidence` access codes; no real user has ever
encountered the bug. Fix lands ahead of any future
hidden_evidence code creation. The other seven fixes are
independent polish gaps that improve perception of
completeness — none are calendar-blocking.

## Pre-flight tree state

- `git rev-parse HEAD` at start: `caae2e6` (`docs(audit):
  archive Batch 9, 9B, 10, 11 fix prompts + UX polish audit
  prompt`).
- `git status`: working tree had two untracked
  `audits/`-rooted files — `audits/2026-05-07-ux-polish-audit.md`
  and `audits/FIX_PROMPT_BATCH_12.md`. Per the standard
  fix-prompt-lives-uncommitted pattern, both were left
  untouched throughout this batch by using explicit pathspecs
  on every `git add`.
- Pre-flight `npx tsc --noEmit`: passed (no output).
- Pre-flight `npx vitest run`: 24 files, 197 tests passed.
- `audits/BATCH_11_REPORT.md` read in full for house style;
  `audits/2026-05-07-ux-polish-audit.md` UX-01, UX-06, UX-12,
  UX-14, UX-15, UX-22, UX-25, UX-26 finding indices grepped
  and per-finding line spans located before each edit;
  `app/api/access-codes/redeem/route.ts:35-40` re-confirmed
  for the `hidden_evidence` server contract and
  `prisma/schema.prisma` `HiddenEvidence` field list
  (`id, title, body, kind`) re-confirmed before extending the
  `Content` union.

## Commits

| # | Hash      | Subject |
|---|-----------|---------|
| 1 | `8827b75` | feat(unlock): handle hidden_evidence content type in UnlockForm |
| 2 | `a1847f9` | feat(bureau): refresh workspace state after CORRECT theory submission |
| 3 | `f1cb3d7` | fix(bureau): replace literal "N" placeholder in search results |
| 4 | `5d4013f` | fix(login): replace hardcoded case slug link with /cases catalog |
| 5 | `dc73fe4` | fix(validators): normalize redeemAccessCodeSchema and createAccessCodeSchema to uppercase |
| 6 | `9454848` | feat(admin): confirm before removing People/Records/Hints/Checkpoints |
| 7 | `1403d91` | docs(legal): correct forgot-password page hero copy |
| 8 | `8ee6579` | docs: generalize FAQ Q4 from Case 001-specific to global |
| 9 | _this commit_ | docs(audit): batch 12 report + observations |

## Per-fix results

### Fix 1 — `8827b75` UnlockForm hidden_evidence branch (UX-01, P0 latent)

- **Applied:** yes. 1 file changed.
  - `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx`:
    extended the `Content` discriminated union with a new
    `HiddenEvidenceContent` branch
    (`{ type: "hidden_evidence"; hiddenEvidence: { id, title,
    body, kind } | null }`) — matches the server payload from
    `app/api/access-codes/redeem/route.ts:35-40`. Inserted a
    matching render branch in `UnlockedContent` between the
    `person` branch and the implicit hint fallthrough. Both
    null-payload (graceful "no longer available" copy) and
    populated cases handled.
- **Diff:** 1 file, +35 / −1.
- `tsc --noEmit`: clean. The new union member narrows
  correctly under the existing
  `if ("raw" in content)` discriminator — `FallbackContent`'s
  `type: string` does not muddy the literal-typed branches
  because the early `raw` check returns first.
- `vitest run`: 197 unchanged. Component-level tests for
  `UnlockedContent` would have required adding
  `@testing-library/react` + jsdom or happy-dom — neither
  is installed and the prompt forbids new dependencies.
  Coverage rests on tsc + the mental trace below.
- **Mental trace.** Admin creates a `hidden_evidence` access
  code via the existing AccessCode admin UI dropdown. User
  scans the QR or types the code. Server route resolves the
  `unlocksTarget`, branches into the
  `target?.type === "hidden_evidence"` arm at
  `redeem/route.ts:35`, fetches the `HiddenEvidence` row, and
  returns `{ type: "hidden_evidence", hiddenEvidence: {...} }`.
  Client narrows on the new union branch, renders the title
  and body in an `<article>` matching the visual treatment of
  `record` and `person`. No "no longer available" message.
- **Anomalies:** none. The pre-existing `FallbackContent` path
  via the `raw` field still catches genuinely unknown
  payload shapes (e.g. an admin creates a code with an
  unknown future `unlocksTarget.type`); that branch returns a
  `<pre>` JSON dump, which is the correct fallback.

### Fix 2 — `a1847f9` TheorySubmissionForm router.refresh() (UX-06, P1)

- **Applied:** yes. 1 file changed.
  - `components/bureau/TheorySubmissionForm.tsx`: added
    `import { useRouter } from "next/navigation";`,
    `const router = useRouter();` alongside the other
    `useState` calls, and `router.refresh();` immediately
    after the form clear in the success branch. Mirrors the
    sibling pattern at `components/bureau/CheckpointForm.tsx:46-47`
    and `components/bureau/CaseActivationForm.tsx:51-52`.
- **Diff:** 1 file, +3 / −0.
- `tsc --noEmit`: clean.
- `vitest run`: 197 unchanged. Per the prompt, no new test —
  the integration concern is covered by the sibling-form
  precedent. Manual smoke remains the verification path.
- **Mental trace.** User types a CORRECT theory at stage 3,
  hits submit. The server returns
  `{ resultLabel: "CORRECT", message, feedback, score }`.
  The form sets `status="success"`, renders the green inline
  CORRECT feedback, clears the local form fields, AND now
  also calls `router.refresh()` — Next re-runs the workspace
  RSC tree against the just-mutated DB row. The page header
  status pill flips from `In Progress` to `Resolved`, the
  "Case Resolved" stamp appears, the `Open Debrief` button
  materializes. No manual refresh required. Climactic moment
  is no longer flat.
- **Anomalies:** none. `router.refresh()` is a no-op in non-
  RSC contexts and a server re-render in RSC contexts — both
  the workspace and any future client-only consumer get the
  correct behavior.

### Fix 3 — `f1cb3d7` GlobalPeopleSearchTerminal "N" → "top 10 results" (UX-12, P1)

- **Applied:** yes. 1 file changed.
  - `components/bureau/GlobalPeopleSearchTerminal.tsx:149`:
    `Showing 10 of N · refine query to narrow` →
    `Showing top 10 results · refine query to see more`. The
    truncated badge now reads as deliberate rather than as
    a placeholder a developer forgot to interpolate.
- **Diff:** 1 file, +1 / −1.
- `tsc --noEmit`: clean.
- `vitest run`: 197 unchanged.
- **Mental trace.** A user searches the global people
  database with a broad term that returns >10 matches. The
  status readout above the result list reads `10 Matches
  Returned (Truncated)`; the badge below the cards now reads
  `Showing top 10 results · refine query to see more`. The
  literal-`N` bug at the most-visible bureau page is gone.
- **Why not interpolate the real total.** Returning the
  actual count would require modifying the server action to
  return the total, and changing the component prop shape —
  both out of scope for an XS UX-polish batch. Rephrase
  removes the bug at zero risk.

### Fix 4 — `5d4013f` Login CTA → /cases catalog (UX-14, P1)

- **Applied:** yes. 1 file changed.
  - `app/login/page.tsx:29-34`: `href` from
    `/cases/alder-street-review` to `/cases`; CTA copy from
    `View Case 001` to `Browse Cases` (matches the pattern
    at `app/register/page.tsx:23-28` for consistency).
- **Diff:** 1 file, +2 / −2.
- `tsc --noEmit`: clean.
- `vitest run`: 197 unchanged.
- **Mental trace.** Signed-out visitor lands on `/login`,
  sees the right-column CTA reading `Browse Cases` rather
  than the brittle `View Case 001`. Click navigates to
  `/cases`, a stable catalog page that doesn't 404 if Case
  001 is ever archived without a `CaseSlugHistory` redirect,
  and that gracefully extends as Case 002+ ships.

### Fix 5 — `dc73fe4` AccessCode schemas .toUpperCase() (UX-15, P1)

- **Applied:** yes. 2 files changed.
  - `lib/validators.ts:271-273`: `redeemAccessCodeSchema.code`
    gained `.toUpperCase()` between `.trim()` and
    `.min(1)`. Same shape as `activationCodeSchema.code`.
  - `lib/validators.ts:275-284`: `createAccessCodeSchema.code`
    likewise gained `.toUpperCase()` so admins cannot create
    a mixed-case code that no end-user can ever redeem.
  - `tests/api/access-codes-redeem.test.ts`: 1 new test
    appended in a new `describe` block — `code normalization
    (Batch 12 UX-15)`. Sends `{ code: "alder-a1b2c3d4" }`
    (lowercase) to `POST /api/access-codes/redeem`, asserts
    200 and asserts `accessCode.findUnique` was called with
    `{ where: { code: "ALDER-A1B2C3D4" } }`. Test count:
    197 → 198.
- **Diff:** 2 files, +27 / −2.
- `tsc --noEmit`: clean. Zod's `.trim().toUpperCase()`
  composition produces an `infer`-compatible string output;
  no downstream type churn.
- `vitest run`: 198 (197 + 1 new), all green.
- **Mental trace.** A user reads a smudged QR sticker as
  `abcd1234` instead of `ABCD1234`. They type into the
  unlock form. The server validator's
  `.trim().toUpperCase().min(1).max(64)` produces
  `ABCD1234`. The Prisma `findUnique({ where: { code:
  "ABCD1234" } })` matches the row. Redemption proceeds.
- **Anomalies:** none on the write side. Existing AccessCode
  rows are all uppercase per operator screenshots
  (`randomHex8`-generated); see BATCH_12_OBSERVATIONS.md §2.

### Fix 6 — `9454848` Admin tab Remove confirmations (UX-22, P2)

- **Applied:** yes. 4 files changed (identical pattern).
  - `app/bureau/admin/cases/[caseId]/edit/_components/PeopleTab.tsx`
  - `app/bureau/admin/cases/[caseId]/edit/_components/RecordsTab.tsx`
  - `app/bureau/admin/cases/[caseId]/edit/_components/HintsTab.tsx`
  - `app/bureau/admin/cases/[caseId]/edit/_components/CheckpointsTab.tsx`
- Pattern: the `onClick={() => remove(index)}` handler on
  each `Remove [Person|Record|Hint|Checkpoint]` button is
  wrapped in a `window.confirm("Remove this <noun>? This
  will be saved when you click Save Changes.")` guard. The
  noun varies; the suffix is consistent across all four —
  clarifies the recoverable-until-save contract. Mirrors the
  pattern in `components/admin/RevokeButton.tsx:18`.
- **Diff:** 4 files, +36 / −4.
- `tsc --noEmit`: clean.
- `vitest run`: 198 unchanged. `window.confirm` is not
  unit-tested — matching the existing `RevokeButton`
  precedent, also untested.
- **Mental trace.** Admin clicks `Remove Record` on row 3 of
  the Records tab; browser native confirm dialog appears
  with the noun-specific copy. Cancel → row stays put,
  no DOM churn, no DB write. OK → row vanishes from the
  in-memory list; the per-section PATCH does NOT fire until
  the admin clicks `Save Changes`, at which point the diff/
  upsert endpoint writes the deletion. The confirm guards
  the destructive intent without changing the recoverable-
  until-save semantics.

### Fix 7 — `1403d91` Forgot-password hero copy (UX-25, P2)

- **Applied:** yes. 1 file changed.
  - `app/forgot-password/page.tsx:19`: hero `text` prop from
    `Enter the email address linked to your account and
    we'll send you a reset link. The link expires in one
    hour.` to `Enter your account email. If we have a record
    of it, we'll send a reset link within a few minutes. The
    link expires in one hour.`. The `If we have a record of
    it` framing preserves the `/api/forgot-password` always-
    200 privacy posture (no email enumeration) by setting
    honest expectations: users who mistype no longer get a
    fake "sent!" experience that contradicts the silent
    no-op the API actually performs.
- **Diff:** 1 file, +1 / −1.
- `tsc --noEmit`: clean.
- `vitest run`: 198 unchanged.

### Fix 8 — `8ee6579` FAQ Q4 generalization (UX-26, P2)

- **Applied:** yes. 1 file changed.
  - `data/site.ts:104-108` — Q4 answer from `Case 001 is
    designed for roughly 90 to 150 minutes depending on
    pace, group size, and how deeply you review the file.`
    to `Most cases run 90 to 150 minutes depending on pace,
    group size, and how deeply you review the file.
    Per-case timing is shown on each case detail page.`. The
    FAQ no longer hardcodes a single case's timing as a
    catalog-wide statement and the pointer to per-case
    detail pages will scale gracefully when Case 002 ships
    with different pacing.
- **Diff:** 1 file, +1 / −1.
- `tsc --noEmit`: clean.
- `vitest run`: 198 unchanged.

### Fix 9 — _this commit_ Batch 12 report + observations

- **Applied:** yes. 2 new files under `audits/`.
  - `audits/BATCH_12_REPORT.md` — this file.
  - `audits/BATCH_12_OBSERVATIONS.md` — UX-01 latent-bug
    closure note, UX-15 normalization caveat, Fix 6
    test-coverage note, audit-findings-still-unaddressed
    grouping per the audit's recommended Batch 13 / Batch
    14 split, carry-forward items unchanged from Batch 11.

## Final verification

- `git log --oneline -9` (after this commit lands):

  ```
  <docs commit hash> docs(audit): batch 12 report + observations
  8ee6579 docs: generalize FAQ Q4 from Case 001-specific to global
  1403d91 docs(legal): correct forgot-password page hero copy
  9454848 feat(admin): confirm before removing People/Records/Hints/Checkpoints
  dc73fe4 fix(validators): normalize redeemAccessCodeSchema and createAccessCodeSchema to uppercase
  5d4013f fix(login): replace hardcoded case slug link with /cases catalog
  f1cb3d7 fix(bureau): replace literal "N" placeholder in search results
  a1847f9 feat(bureau): refresh workspace state after CORRECT theory submission
  8827b75 feat(unlock): handle hidden_evidence content type in UnlockForm
  ```

- `git status`: clean (after this commit lands, except for
  the two untracked `audits/2026-05-07-ux-polish-audit.md`
  and `audits/FIX_PROMPT_BATCH_12.md` files left untracked
  per pattern).
- `npx tsc --noEmit`: passed (no output).
- `npx vitest run`: 24 files / 198 tests passed (197 + 1 new).
- `npm run build`: clean. Only the pre-existing Next 16
  `middleware → proxy` deprecation notice and the harmless
  pg SSL informational line.
- `git diff caae2e6..main --stat` shows exactly the files
  Fixes 1-8 + 9 authorized:

  ```
   app/(unlock)/bureau/unlock/_components/UnlockForm.tsx               (Fix 1)
   app/bureau/admin/cases/[caseId]/edit/_components/CheckpointsTab.tsx (Fix 6)
   app/bureau/admin/cases/[caseId]/edit/_components/HintsTab.tsx       (Fix 6)
   app/bureau/admin/cases/[caseId]/edit/_components/PeopleTab.tsx      (Fix 6)
   app/bureau/admin/cases/[caseId]/edit/_components/RecordsTab.tsx     (Fix 6)
   app/forgot-password/page.tsx                                        (Fix 7)
   app/login/page.tsx                                                  (Fix 4)
   audits/BATCH_12_OBSERVATIONS.md                                     (Fix 9, new)
   audits/BATCH_12_REPORT.md                                           (Fix 9, new)
   components/bureau/GlobalPeopleSearchTerminal.tsx                    (Fix 3)
   components/bureau/TheorySubmissionForm.tsx                          (Fix 2)
   data/site.ts                                                        (Fix 8)
   lib/validators.ts                                                   (Fix 5)
   tests/api/access-codes-redeem.test.ts                               (Fix 5)
  ```

The two untracked `audits/2026-05-07-ux-polish-audit.md` and
`audits/FIX_PROMPT_BATCH_12.md` files remain untracked at the
operator's discretion — same convention as Batch 11's
`FIX_PROMPT_BATCH_11.md`.

No scope creep. No migrations. No new dependencies. No env
changes. No pushes. The eight UX gaps the dogfooder logged
are closed.

## Operator action

Run `git push`. **No `prisma migrate deploy` needed** — this
batch is pure code, no schema change. Hidden_evidence access
codes are now safe to create.
