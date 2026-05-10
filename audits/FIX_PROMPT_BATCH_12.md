# BATCH 12 — FIX PROMPT (UX polish — core flows)

You are a fresh Claude Code session running on Opus 4.7. Apply nine commits: eight surgical UX-polish fixes from the 2026-05-07 dogfooder's audit (`audits/2026-05-07-ux-polish-audit.md`), plus one final report commit. No scope creep. No migrations. No new dependencies.

This batch is the audit's recommended Batch 12 grouping — the highest-impact bundle a real user would notice. All eight fixes are XS effort (≤15 lines each), each in distinct files. Closes one P0 (latent — see urgency note below), four P1s, three P2s.

**Urgency context.** UX-01 is rated P0 by severity but is a **latent** bug — production currently has zero `hidden_evidence` access codes (verified via admin UI screenshots 2026-05-08), so the bug has not fired against any real user. The fix should ship before any `hidden_evidence` access code is ever created. The other seven fixes are independent polish gaps that improve perception of completeness — none are calendar-blocking but all improve the user-facing surface.

Read this prompt first. Then read `audits/2026-05-07-ux-polish-audit.md` (specifically the UX-01, UX-06, UX-12, UX-14, UX-15, UX-22, UX-25, UX-26 finding blocks) and `audits/BATCH_11_REPORT.md` for house style. Then begin.

---

## 1. Operating principles

1. **Nine commits.** Subjects pre-written below — use verbatim.
2. **No migrations.** Pure code change.
3. **No new dependencies.**
4. **No scope creep.** The five starter UX issues from the audit prompt (unlock copy, NextAuth catch-all, missing error.tsx, archive confirmation, AccessCodeList "record #5") are NOT in this batch — they ship later. Stay tight to the audit's named Batch 12 scope.
5. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` passing at the same count or higher.
6. **No env changes, no pushes, no deploys.** The operator runs `git push` after the batch is verified. No migrate-deploy needed (no schema change).
7. **Ground truth = source code at HEAD.** This prompt cites the post-Batch-11 state. Re-confirm against the actual file before each edit.

---

## 2. Pre-flight

```
git rev-parse HEAD                  # at or after `9e259b3` (Batch 11 docs commit)
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 24 files / 197 tests
```

If any fail, stop. Confirm `audits/BATCH_11_REPORT.md` and `audits/2026-05-07-ux-polish-audit.md` are on tree.

---

## 3. The eight fixes + report

### Fix 1 — `feat(unlock): handle hidden_evidence content type in UnlockForm`

**Severity:** P0 (latent — no hidden_evidence codes currently in production). Audit finding **UX-01**.

**File:** `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx` only.

**Current state.** The `Content` discriminated union at lines 5-18 has `RecordContent | PersonContent | HintContent | FallbackContent`. The render switch at lines 137-207 branches on `record`, `person`, falls through to a hint-shaped default that returns "The unlocked hint is no longer available." When the server returns `{ type: "hidden_evidence", hiddenEvidence: {...} }`, the payload doesn't match `record`/`person` (different `type`) and doesn't have a `raw` field, so it falls through to the hint branch and shows the fake error.

**Server contract** (verified at `app/api/access-codes/redeem/route.ts:35-40`):
```ts
if (target?.type === "hidden_evidence") {
  const hiddenEvidence = await prisma.hiddenEvidence.findUnique({ where: { id: target.id } });
  return { type: "hidden_evidence", hiddenEvidence };
}
```

`HiddenEvidence` schema fields (verified at `prisma/schema.prisma:459-468`): `id`, `caseFileId`, `title`, `kind`, `body`, `revealOrder`, `createdAt`. The relevant ones for client display are `id`, `title`, `body`, `kind`.

**Replacement** — add the missing union branch and the matching render branch.

In `UnlockForm.tsx` near the top (around line 5-18), extend the type union:

```ts
type RecordContent = {
  type: "record";
  record: { id: number; title: string; body: string } | null;
};
type PersonContent = {
  type: "person";
  person: { id: number; name: string; summary: string } | null;
};
type HintContent = {
  type: "hint";
  hint: { id: number; title: string; content: string } | null;
};
type HiddenEvidenceContent = {
  type: "hidden_evidence";
  hiddenEvidence: { id: number; title: string; body: string; kind: string } | null;
};
type FallbackContent = { type: string; raw: unknown };
type Content =
  | RecordContent
  | PersonContent
  | HintContent
  | HiddenEvidenceContent
  | FallbackContent;
```

In the `UnlockedContent` render function (around lines 137-207), insert the new branch BEFORE the implicit hint branch (after the `person` branch, before `if (!content.hint) { ... }`):

```tsx
if (content.type === "hidden_evidence") {
  if (!content.hiddenEvidence) {
    return (
      <p className="text-sm text-zinc-400">
        The unlocked evidence is no longer available.
      </p>
    );
  }
  return (
    <article>
      <h2 className="text-2xl font-semibold text-white">
        {content.hiddenEvidence.title}
      </h2>
      <p className="mt-4 whitespace-pre-line text-base leading-7 text-zinc-200">
        {content.hiddenEvidence.body}
      </p>
    </article>
  );
}
```

The placement matters: it must be after `record` and `person` checks, before the fallthrough hint branch (which has no `if content.type === "hint"` guard — it just assumes anything unmatched is a hint).

**Verification:**
- `npx tsc --noEmit` clean. The new type and branch should compile with no errors.
- **Add 1 test** at `tests/components/unlock-form.test.tsx` (new file) OR extend an existing test if one exists. Pattern: render `UnlockedContent` with a `{ type: "hidden_evidence", hiddenEvidence: { id: 1, title: "Test", body: "Body", kind: "RECORD" } }` payload; assert the title and body render. Also test the null-payload case → "no longer available" copy. If the project has no existing component-test infrastructure, add the simplest possible test using `@testing-library/react` if already in `package.json`; if not, skip the test (note in observations) and rely on tsc + manual smoke.
- Mental trace: admin creates a hidden_evidence access code via Batch 8's UI dropdown; user redeems via QR; server returns `{ type: "hidden_evidence", hiddenEvidence: {...} }`; client narrows on the new union branch; the article renders with the title and body. No "no longer available" message.

**Commit subject:** `feat(unlock): handle hidden_evidence content type in UnlockForm`

---

### Fix 2 — `feat(bureau): refresh workspace state after CORRECT theory submission`

**Severity:** P1. Audit finding **UX-06**.

**File:** `components/bureau/TheorySubmissionForm.tsx` only.

**Current state** (lines 55-63): after a successful theory submission, the form clears local fields and renders the result feedback inline, but does NOT call `router.refresh()`. The workspace UI (status pill, "Resolved" stamp, debrief link) all keep their pre-submission render until the user manually refreshes. Most-consequential moment in the product, stale at the climax.

**Sibling pattern** — both `CheckpointForm.tsx:46-47` and `CaseActivationForm.tsx:51-52` correctly call `router.refresh()` after success.

**Edits:**

1. Add `useRouter` import at the top:
```ts
import { useRouter } from "next/navigation";
```

2. Inside the component, alongside the existing `useState` calls:
```ts
const router = useRouter();
```

3. After `setForm({ suspectName: "", motive: "", evidenceSummary: "" });` (around line 63), add:
```ts
router.refresh();
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — existing tests still pass; no behavior change to assert is needed for unit tests (the router refresh is an integration concern). 197 unchanged.
- **Optionally add** one test that mocks `useRouter` and asserts `refreshSpy` is called after a successful submission. Pattern: `vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshSpy, ... }) }))`. Skip if the test infrastructure is heavy for this small a change; document in observations as "covered by mental trace + sibling-form precedent."
- Mental trace: user types a CORRECT theory at stage 3, hits submit, sees the green inline "CORRECT" feedback, AND simultaneously the page header status pill flips to `Resolved`, the "Case Resolved" stamp appears, the `Open Debrief` button materializes. No manual refresh required.

**Commit subject:** `feat(bureau): refresh workspace state after CORRECT theory submission`

---

### Fix 3 — `fix(bureau): replace literal "N" placeholder in search results`

**Severity:** P1. Audit finding **UX-12**.

**File:** `components/bureau/GlobalPeopleSearchTerminal.tsx` only.

**Current state** (line 149): `Showing 10 of N · refine query to narrow` — the letter `N` is a placeholder that was never interpolated. Reads as broken software.

**Replacement** (single line at line 149):

```tsx
Showing top 10 results · refine query to see more
```

The status readout above the result list already says "10 Matches Returned (Truncated)" — this badge complements that with action-oriented copy.

**Why "Showing top 10 results" rather than interpolating a real total:** the server action would need to be modified to return the total count, which is out of scope for this batch (small API change). The rephrase removes the bug at zero risk.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — 197 unchanged.
- Manual smoke: type a search term that returns >10 results in `/bureau/database`; the truncated badge should now read "Showing top 10 results · refine query to see more" instead of "Showing 10 of N".

**Commit subject:** `fix(bureau): replace literal "N" placeholder in search results`

---

### Fix 4 — `fix(login): replace hardcoded case slug link with /cases catalog`

**Severity:** P1. Audit finding **UX-14**.

**File:** `app/login/page.tsx` only (lines 29-35).

**Current state:** the right-column CTA on the login page reads "View Case 001" and links to `/cases/alder-street-review`. Brittle — if the case is archived without a CaseSlugHistory redirect, the login page CTA 404s. Also wrong copy as soon as Case 002+ ships.

**Replacement:**

```tsx
<Link
  href="/cases"
  className="inline-flex items-center rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-white transition hover:bg-zinc-900"
>
  Browse Cases
</Link>
```

Two changes: `href` from `/cases/alder-street-review` to `/cases`; copy from "View Case 001" to "Browse Cases" (matches the pattern on `app/register/page.tsx:23-28` for consistency).

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — 197 unchanged.
- Manual smoke: visit `/login` while signed out; the CTA reads "Browse Cases" and links to the catalog page.

**Commit subject:** `fix(login): replace hardcoded case slug link with /cases catalog`

---

### Fix 5 — `fix(validators): normalize redeemAccessCodeSchema and createAccessCodeSchema to uppercase`

**Severity:** P1. Audit finding **UX-15**.

**File:** `lib/validators.ts` only (lines 271-273 and 275-284).

**Current state:**
- `redeemAccessCodeSchema.code` (line 272): `z.string().trim().min(1).max(64)` — case-preserving.
- `createAccessCodeSchema.code` (line 276): `z.string().trim().min(1).max(64)` — also case-preserving.
- `activationCodeSchema.code` (line 49) by contrast uses `.trim().toUpperCase()` — already canonical.

The mismatch means an admin creates an AccessCode in mixed case (manually typed instead of via the random-hex generator); a user types it in a different case; redemption fails with "Code not found." Both write-site (admin form/route) and read-site (user redemption) need the same normalization.

**Replacement:**

For `redeemAccessCodeSchema` (around line 271-273):
```ts
export const redeemAccessCodeSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(64),
});
```

For `createAccessCodeSchema` (around line 275-284):
```ts
export const createAccessCodeSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(64),
  kind: z.enum(["BUREAU_REF", "ARTIFACT_QR", "WITNESS_TIP", "AUDIO_FILE"]),
  unlocksTarget: z.object({
    type: z.enum(["record", "person", "hint", "hidden_evidence"]),
    id: z.number().int().positive(),
  }),
  requiresStage: z.number().int().min(0).nullable().optional(),
});
```

Both schemas now match `activationCodeSchema`'s pattern. Existing AccessCode rows in the database may have lowercase codes if any admin created one manually — those will fail to redeem until the row is updated, but verification (per the screenshots) shows current codes are all `randomHex8`-generated uppercase, so this is not a production concern.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — 197 unchanged.
- **Add 1 test** at `tests/api/access-codes-redeem.test.ts`:
  - Setup: a mock AccessCode with `code: "ABCD1234"`.
  - Action: POST to `/api/access-codes/redeem` with `{ code: "abcd1234" }` (lowercase).
  - Assert: the route processes the request and looks up `code: "ABCD1234"` (uppercased) — succeeds.
  - Test count: 197 → 198.
- Mental trace: a user reads a smudged QR code as "abcd1234" instead of "ABCD1234"; types into the unlock form; server validator normalizes to uppercase; lookup succeeds; redemption proceeds.

**Commit subject:** `fix(validators): normalize redeemAccessCodeSchema and createAccessCodeSchema to uppercase`

---

### Fix 6 — `feat(admin): confirm before removing People/Records/Hints/Checkpoints`

**Severity:** P2. Audit finding **UX-22**.

**Files** (four files, identical pattern):
- `app/bureau/admin/cases/[caseId]/edit/_components/PeopleTab.tsx` (around line 164-170)
- `app/bureau/admin/cases/[caseId]/edit/_components/RecordsTab.tsx` (around line 151-157)
- `app/bureau/admin/cases/[caseId]/edit/_components/HintsTab.tsx` (around line 144-150)
- `app/bureau/admin/cases/[caseId]/edit/_components/CheckpointsTab.tsx` (around line 134-140)

**Current state:** each tab has a `Remove [Person|Record|Hint|Checkpoint]` button whose `onClick={() => remove(index)}` immediately drops the entry from the in-memory list. No confirmation. Save-after-remove is destructive (the per-section PATCH endpoint diff/upserts the deletion to the DB).

**Sibling pattern** — `components/admin/RevokeButton.tsx:18` already uses `if (!window.confirm("Revoke this code?")) return;` for a similar destructive action. Mirror it.

**Replacement** (per file — adjust the noun in the confirm string):

```tsx
<button
  type="button"
  onClick={() => {
    if (!window.confirm("Remove this person? This will be saved when you click Save Changes.")) return;
    remove(index);
  }}
  className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400"
>
  Remove Person
</button>
```

For each file, the noun in the confirm string:
- PeopleTab: `"Remove this person?"`
- RecordsTab: `"Remove this record?"`
- HintsTab: `"Remove this hint?"`
- CheckpointsTab: `"Remove this checkpoint?"`

The "This will be saved when you click Save Changes" tail is consistent across all four — clarifies the recoverable-until-save contract.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — 198 unchanged (no new tests; `window.confirm` is jsdom-mocked or tested via the existing RevokeButton precedent which also has no confirm test).
- Manual smoke: in the admin tab editor, click Remove on any row in any of the four tabs; expect a browser confirm dialog. Click Cancel → row stays. Click OK → row removed from the in-memory list (still recoverable until Save).

**Commit subject:** `feat(admin): confirm before removing People/Records/Hints/Checkpoints`

---

### Fix 7 — `docs(legal): correct forgot-password page hero copy`

**Severity:** P2. Audit finding **UX-25**.

**File:** `app/forgot-password/page.tsx` only (line 16-20, the `<PageHero text=...>` prop).

**Current state:** the page hero text reads `Enter the email address linked to your account and we'll send you a reset link. The link expires in one hour.` This contradicts the API's privacy-correct always-200 response (`If that email is registered, a reset link has been sent.`) — users who mistype get a fake "sent!" experience and never receive an email.

**Replacement** — update the `text` prop:

```tsx
<PageHero
  eyebrow="Account"
  title="Forgot your password?"
  text="Enter your account email. If we have a record of it, we'll send a reset link within a few minutes. The link expires in one hour."
/>
```

Preserves the privacy posture (no enumeration) by using "if we have a record of it" rather than the unconditional "we'll send."

**Verification:**
- No code changes that affect tsc.
- `npx vitest run` — 198 unchanged.
- Manual smoke: visit `/forgot-password`; the hero now sets honest expectations about conditional delivery.

**Commit subject:** `docs(legal): correct forgot-password page hero copy`

---

### Fix 8 — `docs: generalize FAQ Q4 from Case 001-specific to global`

**Severity:** P2. Audit finding **UX-26**.

**File:** `data/site.ts` only (around lines 104-108).

**Current state:** the FAQ Q4 answer is hardcoded as `Case 001 is designed for roughly 90 to 150 minutes...`. As soon as Case 002 ships with different pacing, the FAQ is wrong.

**Replacement:**

```ts
{
  question: "How long does one case take?",
  answer:
    "Most cases run 90 to 150 minutes depending on pace, group size, and how deeply you review the file. Per-case timing is shown on each case detail page.",
},
```

**Verification:**
- No code changes that affect tsc.
- `npx vitest run` — 198 unchanged.
- Manual smoke: visit `/faq`; Q4 now reads as a global statement with a pointer to per-case detail pages.

**Commit subject:** `docs: generalize FAQ Q4 from Case 001-specific to global`

---

### Fix 9 — `docs(audit): batch 12 report + observations`

Two new files mirroring the BATCH_11 structure.

**`audits/BATCH_12_REPORT.md`** (~150-200 lines):

- Pre-flight tree state.
- 8-row commit table for Fixes 1-8.
- Per-fix detail block for each: applied yes/no, files touched, diff stats, tsc + vitest deltas, mental trace, anomalies if any.
- Final verification gate output: `git log --oneline -9`, `git status`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `git diff <pre-batch-SHA>..main --stat`.

**`audits/BATCH_12_OBSERVATIONS.md`** (~80-120 lines):

1. **UX-01 latent-bug closure.** Note that production had zero hidden_evidence access codes at the time Batch 12 shipped (verified by operator screenshots 2026-05-08), so no real user encountered the bug pre-fix. Future hidden_evidence codes are now safe to create.
2. **UX-15 normalization caveat.** Existing AccessCode rows in the database with lowercase codes will continue to fail redemption. The screenshots show all current codes are uppercase (randomHex8-generated), so this is not a current production concern. If any lowercase rows exist, they need a one-line `UPDATE "AccessCode" SET code = UPPER(code)` correction at the operator's discretion.
3. **Test coverage on Fix 6.** `window.confirm()` interactions are not unit-tested — matching the existing RevokeButton precedent. Worth a manual smoke during operator verification.
4. **Audit findings still unaddressed in this batch.** Per the audit's recommended grouping: Batch 13 covers UX-08, UX-03, UX-09, UX-10, UX-16, UX-17 (refund visibility + case-serial unification). Batch 14 covers UX-02, UX-04, UX-05, UX-07, UX-13, UX-19, UX-20, UX-21, UX-23 (copy fixes + owned-case CTA + post-action confirmations). Deferred: UX-11 (image consumers — needs design call), UX-29 (server-resolved featuredCase — needs 2nd case), UX-30, UX-34, UX-35, UX-28 (P3 nits or M effort).
5. **Carry-forward items unchanged from Batch 11:** Sentry/structured logging, CSP nonce migration, app/layout.tsx auth() per-render, forgot-password timing leak, error.tsx absence (audit starter #3 — known-and-scheduled), R2 ContentLength alternative paths, F-04 lawyer brief pending, the original 4 staged FIX_PROMPT files awaiting an archive commit at the operator's discretion.

**Commit subject:** `docs(audit): batch 12 report + observations`

Then stop. Do not push.

---

## 4. Final verification gate

After all nine commits are on tree:

```
git log --oneline -9                # Fix 1-8 + report in order
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 198 tests passing (197 + 1 new)
npm run build                       # clean (only pre-existing pg SSL informational notice)
git diff <pre-batch-SHA>..main --stat
```

Expected files touched:

```
app/(unlock)/bureau/unlock/_components/UnlockForm.tsx                                 (Fix 1)
tests/components/unlock-form.test.tsx                                                 (Fix 1, new — if test added)
components/bureau/TheorySubmissionForm.tsx                                            (Fix 2)
components/bureau/GlobalPeopleSearchTerminal.tsx                                      (Fix 3)
app/login/page.tsx                                                                    (Fix 4)
lib/validators.ts                                                                     (Fix 5)
tests/api/access-codes-redeem.test.ts                                                 (Fix 5)
app/bureau/admin/cases/[caseId]/edit/_components/PeopleTab.tsx                        (Fix 6)
app/bureau/admin/cases/[caseId]/edit/_components/RecordsTab.tsx                       (Fix 6)
app/bureau/admin/cases/[caseId]/edit/_components/HintsTab.tsx                         (Fix 6)
app/bureau/admin/cases/[caseId]/edit/_components/CheckpointsTab.tsx                   (Fix 6)
app/forgot-password/page.tsx                                                          (Fix 7)
data/site.ts                                                                          (Fix 8)
audits/BATCH_12_REPORT.md                                                             (Fix 9, new)
audits/BATCH_12_OBSERVATIONS.md                                                       (Fix 9, new)
```

If any other file is in the diff, restore it before declaring done.

---

## 5. Begin

Read `audits/2026-05-07-ux-polish-audit.md` UX-01, UX-06, UX-12, UX-14, UX-15, UX-22, UX-25, UX-26 finding blocks. Read `audits/BATCH_11_REPORT.md` for house style. Read each file you'll edit before editing it (line numbers may have drifted since the audit was filed; locate by content not by line number when in doubt).

Start with Fix 1 — the P0. Verify tsc + vitest clean after each commit. Continue through Fix 8. Write the two report files in commit 9.

When you finish, surface the operator-action callout in your closing message: **"Run `git push`. No `prisma migrate deploy` needed — this batch is pure code, no schema change. Hidden_evidence access codes are now safe to create."**

Done.
