# BATCH 16 — FIX PROMPT (Phase-1 immersion polish + UX-polish carry-forwards + safety rails)

You are a fresh Claude Code session running on Opus 4.7. Apply nine commits: eight surgical implementation commits plus one report commit. No scope creep. **No migrations** — the entire batch is pure code. **No new dependencies.** No env changes.

This batch supersedes the audit-recommended Batch 14 (refund visibility + serial unification) and Batch 15 (copy fixes + owned-case CTA) and adds a new P1 found in the 2026-05-10 full-scope god-mode review (`audits/2026-05-10-fullscope-godmode-review.md`) plus the Phase-1 immersion polish layer ideated against `BUREAU_IMMERSION_PROMPT.md` and ChatGPT. The numbering jumps 13 → 16 because the audit-recommended Batch 14 and Batch 15 are folded into this single batch; nothing is dropped.

This is the largest single fix batch since Batch 9. Estimate: ~10 hours code + ~1 hour verification. Sequence the commits exactly as specified — Fix 3 introduces the `caseSerial` helper Fix 4 consumes, and Fix 6 introduces the Bureau Message Registry that Fix 7 consumes.

---

## Background — what this batch closes

**P1 from the 2026-05-10 full-scope god-mode review (the only net-new security-class finding):**
- `/bureau/archive` page (`app/bureau/archive/page.tsx:136-181`) renders raw `THEORY_RESULT_LABEL`, `score/3`, and raw stored `feedback` for every past theory submission. This bypasses Batch 13's closure-standard sealed-verdict rule entirely. The brute-force exploit Batch 13 was meant to close is reopened by one click from the workspace. Fix 1 below closes it by mirroring the workspace Recent Submissions panel pattern: derive display from `submission.resultLabel === "CORRECT"`, never render score, never render the leaky historical feedback string for non-CORRECT rows.

**P1 carry-forwards from the 2026-05-07 UX-polish audit (refund-visibility + display-coherence):**
- UX-09: refunded UserCase still appears in `/bureau` Active Reviews. The list filters `status !== "SOLVED"` but does not filter `revokedAt: null`. Refunded users see a phantom-active case after Batch 9's `charge.refunded` handler revokes them via the soft-revoke pattern.
- UX-10: refunded user retains `/bureau/cases/[slug]/debrief` access. The debrief page (`app/bureau/cases/[slug]/debrief/page.tsx:21-30`) finds by `userId + status: "SOLVED" + caseFile.slug` only. The debrief is the answer-key surface; it must be gated on `revokedAt: null` too.
- UX-03: `components/cases/CasePublicView.tsx:90` hardcodes `"BL-001 / Standalone Investigation"`. Case 002 will ship with BL-001 displayed on its own marketing page.
- UX-04 + UX-05: when an authenticated user already owns the case, `CasePublicView` falls back to `<Link href="/support">Order Investigation Kit</Link>`. The CTA points to the wrong destination with the wrong label.
- UX-08 + UX-16 + UX-17: at least four different case-serial formats drift across the codebase — `BL-001` (CasePublicView hardcoded), `BL-CASE-001` (bureau dashboard active reviews), `BL-{slug-no-dashes-uppercase-trunc8}` (debrief), and database lookups with raw integer `caseFile.id`. Diegetic UI requires a single authoritative serial.

**F-30 carry-forward (defense in depth on first incident):**
- The repo has no `app/error.tsx`. The first uncaught render error shows the unstyled Next.js default page, not a Bureau-themed fallback.

**Phase-1 immersion polish (ChatGPT ideation against `BUREAU_IMMERSION_PROMPT.md`):**
- A single source-of-truth Bureau Message Registry establishes the noir-procedural voice register that Privacy + Terms + Batch 13 already extablished, applied across login, unlock, theory submission, and per-case database. Cheap, high-leverage; locks the voice discipline before more surfaces accumulate ad-hoc copy.
- The registry shape is forward-compatible: Phase 2 (analyst desk grid, file-tab navigation, query transcript) extends the same registry; Phase 3 (handler memos, intel queue) likewise.

**Quick-polish (low cost; closes long-tail backlog):**
- `package.json` has no `engines.node` field (F-34) — Node-version drift at deploy time is undetected.
- `app/bureau/admin/cases/page.tsx:124-150` uses `<a>` instead of `<Link>` (admin lag on full-page nav).
- `scripts/unarchive-case.ts:10` hardcodes `CASE_ID = 3` with a comment "change this if needed" (F-40) — argv is one line.
- `RevokeButton.tsx:29` still posts `{ revokedAt: new Date().toISOString() }` even though Batch 1 Fix 5 made the server stamp `revokedAt` itself and ignore the body field (F-41) — cosmetic but the dangling field invites confusion.

---

## 1. Operating principles

1. **Nine commits.** Subjects pre-written below — use verbatim.
2. **No migrations.** The fix is purely code-side. No `prisma migrate dev`. No `prisma migrate deploy`.
3. **No new dependencies.** No `npm install`.
4. **No scope creep.** Specifically out-of-scope and deferred:
   - The full multi-step intel-drop handshake animation. Phase 1 is copy + button label changes only; the staged animation is Phase 2 work that needs a shared motion vocabulary.
   - The Analyst Desk Grid layout refactor of `/bureau`. Phase 2 batch.
   - `User.callsign` schema field + registration UX. Phase 2 batch (schema + migration).
   - The Closed Files Shelf visual treatment for `/bureau/archive`. Phase 2/3.
   - Sentry instrumentation. Operator-action launch-blocker; not code-fix-prompt material.
   - Marketing-page voice rewrite (`/about`, `/faq`, `/how-it-works`, `/support`). Separate batch — that's its own copy-discipline pass and risks bundling regressions.
5. **Load-bearing invariants — DO NOT touch:**
   - **Closure-standard rule (Batch 13).** `lib/case-evaluation.ts:buildFeedback` is sealed — takes `resultLabel`, returns one of two non-diagnostic strings. The form's response shape is `{ message, publicVerdict, feedback }`. Internal `suspectCorrect`/`motiveCorrect`/`evidenceCorrect`/`score`/`resultLabel` flags stay populated for analytics. **Fix 9 (theory copy pass) MUST NOT alter mechanics — only labels and placeholders.**
   - **Soft-revoke pattern (Batch 9).** UserCase revokes set `revokedAt`; do not delete. Refund visibility filters MUST be additive (`AND revokedAt IS NULL`); do not change anything that writes `revokedAt`.
   - **Auth split-config (Batch 11).** `auth.config.ts` stays Prisma-free for edge runtime; full session callback lives in `auth.ts`. Don't merge.
   - **CSRF Set-based webhook allowlist (Batch 2).** Don't widen the allowlist.
   - **CaseAudit on admin PATCHes.** Don't drop. Not touched in this batch.
6. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` passing.
7. **Existing tests will not need changes for most fixes.** The two exceptions are likely tests in `tests/api/theory.test.ts` if they assert on submit-button text (unlikely) and tests in `tests/api/cases.test.ts` if they assert on the public marketing-page CTA (also unlikely). Verify; if present, update in the same commit.
8. **Operator runs `git push`. No deploys triggered by this prompt.**
9. **Ground truth = source code at HEAD.** This prompt cites the post-Batch-13 state. Re-confirm against the actual file before each edit.

---

## 2. Pre-flight

```
git rev-parse HEAD                  # at or after Batch 13 final commit
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # passing
npm run build                       # clean (only pre-existing notices)
```

If any fail, stop. Confirm `audits/BATCH_13_REPORT.md`, `audits/2026-05-10-fullscope-godmode-review.md`, and `audits/FIX_PROMPT_BATCH_16.md` (this file) are on tree.

Capture the pre-batch HEAD SHA — the report in Fix 9 needs `git diff <pre-batch-SHA>..main --stat` for the verification gate.

---

## 3. The nine commits

### Fix 1 — `fix(security): seal /bureau/archive theory history (close Batch 13 closure regression)`

**File:** `app/bureau/archive/page.tsx` only.

**Current state.** Lines 136-181 cycle a CORRECT/PARTIAL/INCORRECT badge color, render `THEORY_RESULT_LABEL[submission.resultLabel]` directly, render `submission.score/3`, and render raw `submission.feedback` for every submission row. The brute-force exploit Batch 13 was meant to close is fully reopened on this surface.

**Fix.** Mirror the sealed pattern already shipping on the workspace's Recent Submissions panel (per Batch 13 Fix 2c).

**(a) Drop the import** of `THEORY_RESULT_LABEL` on line 8 (no longer referenced after the rewrite).

**(b) Replace the entire submissions render block (lines 136-181, the inner `submissions.map(...)` body)** with this sealed pattern:

```tsx
{submissions.map((submission, index) => {
  const isClosed = submission.resultLabel === "CORRECT";
  const badgeColor = isClosed
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    : "border-amber-500/30 bg-amber-500/10 text-amber-300";

  return (
    <Reveal key={submission.id} delay={index * 0.04}>
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">
              {submission.caseFile.title}
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {submission.suspectName}
            </h3>
          </div>

          <span className={`rounded-full border px-3 py-1 text-xs ${badgeColor}`}>
            {isClosed ? "Closure Standard Met" : "Revision Required"}
          </span>
        </div>

        <div className="mt-4 text-sm text-zinc-400">
          Bureau Verdict
        </div>
        <div className="mt-1 text-sm leading-7 text-zinc-300">
          {isClosed
            ? submission.feedback
            : "The file is not ready for closure. The Bureau could not verify a complete chain of suspect, motive, and supporting evidence."}
        </div>

        <div className="mt-4 text-sm text-zinc-400">
          Submitted
        </div>
        <div className="mt-1 text-sm text-zinc-300">
          {submission.createdAt.toLocaleString()}
        </div>
      </div>
    </Reveal>
  );
})}
```

Differences from the leaky version:
- No `THEORY_RESULT_LABEL` lookup; binary "Closure Standard Met" / "Revision Required" only.
- No `score` field rendered.
- The leaky historical feedback string is suppressed for non-CORRECT rows; CORRECT rows render their (sealed) Batch-13 feedback.
- Identical pattern to the workspace Recent Submissions panel — keeps visual coherence.

**Verification:**
- `npx tsc --noEmit` clean (the dropped `THEORY_RESULT_LABEL` import was the only consumer in this file; verify no other line references it).
- `npx vitest run` passing (no test should fail; the archive page has no direct unit tests today).
- `npm run build` clean.
- Mental trace: a player who submitted 5 wrong theories in their pre-Batch-13 history sees five identical "Revision Required" rows with the same boilerplate text. No score leak, no per-component diagnostic, no historical leaky-feedback render. Batch 13's closure-standard rule is now enforced everywhere.

**Commit subject:** `fix(security): seal /bureau/archive theory history (close Batch 13 closure regression)`

---

### Fix 2 — `fix(refund): filter revokedAt on /bureau dashboard + debrief page (UX-09 + UX-10)`

**Files:**
- `app/bureau/page.tsx`
- `app/bureau/cases/[slug]/debrief/page.tsx`

**Current state.**
- `app/bureau/page.tsx:32-37` queries `prisma.userCase.findMany({ where: { userId } })` — no `revokedAt` filter. Lines 45-46 derive `solvedCases`/`activeCases` from the unfiltered result. Refunded UserCase rows show as phantom-active.
- `app/bureau/cases/[slug]/debrief/page.tsx:21-30` queries `prisma.userCase.findFirst({ where: { userId, status: "SOLVED", caseFile: { slug } } })` — no `revokedAt` filter. A user who solved then was refunded still sees the answer-key debrief.

**Fix (a) — `app/bureau/page.tsx`.**

Replace the `findMany` where clause (line 33):

```ts
where: { userId },
```

with:

```ts
where: { userId, revokedAt: null },
```

That single addition propagates to `solvedCases`/`activeCases`/`latestSolved` because all three derive from `ownedCases`. Stat counts on lines 142-162 also become refund-aware automatically.

**Fix (b) — `app/bureau/cases/[slug]/debrief/page.tsx`.**

Replace the `findFirst` where clause (lines 22-26):

```ts
where: {
  userId,
  status: "SOLVED",
  caseFile: { slug },
},
```

with:

```ts
where: {
  userId,
  status: "SOLVED",
  revokedAt: null,
  caseFile: { slug },
},
```

A refunded user attempting `/bureau/cases/<slug>/debrief` now hits `notFound()` (line 33), which already exists in the page.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` passing.
- Mental trace: User U1 buys Case C1 → solves → status SOLVED, revokedAt null. Refund issued → `charge.refunded` Batch-9 handler sets `revokedAt = now`. U1 visits `/bureau` — Case C1 absent from Active Reviews and Completed Archive (and from stats). U1 visits `/bureau/cases/c1/debrief` — 404 via `notFound()`. The soft-revoke design is now end-to-end consistent.

**Note for the operator:** if the production DB has any refunded UserCase rows where `revokedAt` is set but the row is still showing on someone's dashboard today, this fix will silently un-show them on next page load. That's the expected outcome.

**Commit subject:** `fix(refund): filter revokedAt on /bureau dashboard + debrief page (UX-09 + UX-10)`

---

### Fix 3 — `feat(serial): unify case serial format with single caseSerial(id) helper (UX-08/16/17)`

**Files:**
- `lib/case-serial.ts` (new)
- `app/bureau/page.tsx`
- `app/bureau/cases/[slug]/debrief/page.tsx`
- `tests/lib/case-serial.test.ts` (new)

**Current drift.** The codebase has at least four different serial formats:

| Surface | Current | Stable across surfaces? |
|---|---|---|
| `/bureau` Active Reviews | `BL-CASE-${index+1}` (line 222) | No — derived from list index, changes when list changes |
| `/debrief` page | `"BL-" + slug.toUpperCase().replace(/-/g, "").slice(0, 8)` (line 38) | No — derived from slug, breaks if slug renames (CaseSlugHistory exists) |
| `CasePublicView` | `BL-001` (hardcoded line 90) | No — literal |
| Admin pages | raw `caseFile.id` integer | No — different shape |

**Fix.** Single helper, deterministic, derived from the immutable primary key.

**(a) Create `lib/case-serial.ts`:**

```ts
/**
 * Bureau case serial — the canonical identifier displayed across all
 * player-facing surfaces (workspace, dashboard, debrief, public marketing
 * page, admin tabs).
 *
 * Derivation: zero-padded primary key. `caseFile.id` is the only stable,
 * immutable identifier in the schema — slug can rename (CaseSlugHistory
 * tracks aliases), title is editable, list index changes per query.
 *
 * Format: `BL-XXX` where XXX is the zero-padded id (3-digit minimum).
 * Cases with id ≥ 1000 produce `BL-1000` etc. — the pad floor is 3, not a cap.
 *
 * Usage: pass the case file (or any object with a numeric `id` field).
 *
 *   caseSerial(caseFile)           // "BL-001"
 *   caseSerial({ id: 14 })         // "BL-014"
 *   caseSerial({ id: 1037 })       // "BL-1037"
 */
export function caseSerial(input: { id: number }): string {
  return `BL-${String(input.id).padStart(3, "0")}`;
}
```

**(b) Apply to `app/bureau/page.tsx`** — the active-reviews list:

Add the import at the top of the file (alongside the existing `@/lib/...` imports):

```ts
import { caseSerial } from "@/lib/case-serial";
```

Replace the line at 222 (currently `BL-CASE-${String(index + 1).padStart(3, "0")}`):

```tsx
<div className="mt-1 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
  BL-CASE-{String(index + 1).padStart(3, "0")}
</div>
```

with:

```tsx
<div className="mt-1 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
  {caseSerial(entry.caseFile)}
</div>
```

(Note: changes the displayed serial from index-derived to id-derived. A user with two owned cases at id 7 and id 14 now sees `BL-007` and `BL-014` instead of `BL-CASE-001` and `BL-CASE-002`.)

**(c) Apply to `app/bureau/cases/[slug]/debrief/page.tsx`:**

Add import:

```ts
import { caseSerial } from "@/lib/case-serial";
```

Delete the line at 38:

```ts
const caseSerial = "BL-" + slug.toUpperCase().replace(/-/g, "").slice(0, 8);
```

Replace its usage downstream — find every reference to the local `caseSerial` variable in this file and swap to the imported helper:

```ts
caseSerial(caseFile)
```

(There may be one or two usages within the JSX further down. Walk the file and replace.)

**(d) Add `tests/lib/case-serial.test.ts`:**

```ts
import { describe, expect, it } from "vitest";
import { caseSerial } from "@/lib/case-serial";

describe("caseSerial", () => {
  it("zero-pads single-digit ids to three digits", () => {
    expect(caseSerial({ id: 1 })).toBe("BL-001");
    expect(caseSerial({ id: 7 })).toBe("BL-007");
    expect(caseSerial({ id: 9 })).toBe("BL-009");
  });

  it("zero-pads two-digit ids to three digits", () => {
    expect(caseSerial({ id: 14 })).toBe("BL-014");
    expect(caseSerial({ id: 99 })).toBe("BL-099");
  });

  it("renders three-digit ids as-is", () => {
    expect(caseSerial({ id: 100 })).toBe("BL-100");
    expect(caseSerial({ id: 999 })).toBe("BL-999");
  });

  it("does not truncate ids beyond three digits", () => {
    expect(caseSerial({ id: 1037 })).toBe("BL-1037");
  });

  it("accepts any object with an id field (structural typing)", () => {
    const caseFile = { id: 42, title: "Test", slug: "test" };
    expect(caseSerial(caseFile)).toBe("BL-042");
  });
});
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` passing (5 new tests added).
- Mental trace: every player-facing surface that displays a serial now uses the same pre-padded ID. Renaming a slug doesn't change the displayed serial. Listing order doesn't affect the serial.

**Note:** Fix 4 will use `caseSerial` for `CasePublicView` — sequenced after this commit.

**Commit subject:** `feat(serial): unify case serial format with single caseSerial(id) helper (UX-08/16/17)`

---

### Fix 4 — `fix(public): owned-case CTA + dynamic serial on CasePublicView (UX-03 + UX-04 + UX-05)`

**File:** `components/cases/CasePublicView.tsx` only.

**Current state.**
- Line 90 hardcodes `"BL-001 / Standalone Investigation"`. Case 002 will display `BL-001` on its own marketing page.
- Lines 165-198 render the right-column CTA. When `canBuy` is true, BuyButton renders correctly. When `canBuy` is false (caller's parent verified the user already owns the case — see `app/cases/[slug]/page.tsx:45`), the fallback is `<Link href="/support">Order Investigation Kit</Link>`, which sends owners to a support page with the wrong copy.

**Fix.**

**(a) Add the import** at the top:

```ts
import { caseSerial } from "@/lib/case-serial";
```

**(b) Replace the hardcoded serial on line 90:**

```tsx
<div className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
  BL-001 / Standalone Investigation
</div>
```

with:

```tsx
<div className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
  {caseSerial(caseFile)} / Standalone Investigation
</div>
```

**(c) Replace the right-column CTA block (lines 165-198, the entire second `<Card variant="dossier" padding="lg">` block).** The current block is:

```tsx
<Card variant="dossier" padding="lg">
  <Pill tone="success" label="Available Now" />
  <h2 className="mt-4 text-xl font-semibold text-white">
    Get the investigation kit
  </h2>
  <p className="mt-3 text-sm leading-6 text-zinc-400">
    Order includes the physical case file and lifetime digital
    bureau access. Ships within 3–5 business days.
  </p>
  {canBuy ? (
    <BuyButton caseId={caseFile.id} />
  ) : (
    <Link
      href="/support"
      className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
    >
      Order Investigation Kit
    </Link>
  )}
  <div className="mt-4 flex items-center gap-3">
    <hr className="flex-1 border-zinc-800" />
    <span className="font-mono text-[10px] text-zinc-600">OR</span>
    <hr className="flex-1 border-zinc-800" />
  </div>
  <Link
    href="/login"
    className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
  >
    Sign in to Bureau
  </Link>
  <p className="mt-3 text-center text-xs text-zinc-600">
    Already purchased? Sign in and enter your activation code.
  </p>
</Card>
```

Replace with a `canBuy`-aware variant where the owned-case branch shows the correct CTA pointing to the workspace:

```tsx
<Card variant="dossier" padding="lg">
  {canBuy ? (
    <>
      <Pill tone="success" label="Available Now" />
      <h2 className="mt-4 text-xl font-semibold text-white">
        Get the investigation kit
      </h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Order includes the physical case file and lifetime digital
        bureau access. Ships within 3–5 business days.
      </p>
      <BuyButton caseId={caseFile.id} />
      <div className="mt-4 flex items-center gap-3">
        <hr className="flex-1 border-zinc-800" />
        <span className="font-mono text-[10px] text-zinc-600">OR</span>
        <hr className="flex-1 border-zinc-800" />
      </div>
      <Link
        href="/login"
        className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
      >
        Sign in to Bureau
      </Link>
      <p className="mt-3 text-center text-xs text-zinc-600">
        Already purchased? Sign in and enter your activation code.
      </p>
    </>
  ) : (
    <>
      <Pill tone="success" label="On Your Desk" />
      <h2 className="mt-4 text-xl font-semibold text-white">
        This file is assigned to your station
      </h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        You already own this case. Continue your investigation in the
        bureau.
      </p>
      <Link
        href={`/bureau/cases/${caseFile.slug}`}
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
      >
        Open Workspace
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <hr className="flex-1 border-zinc-800" />
        <span className="font-mono text-[10px] text-zinc-600">OR</span>
        <hr className="flex-1 border-zinc-800" />
      </div>
      <Link
        href="/bureau"
        className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
      >
        Return to Bureau
      </Link>
    </>
  )}
</Card>
```

The owned-case branch:
- Uses `Pill tone="success" label="On Your Desk"` instead of "Available Now" — accurate state.
- Headline + body acknowledge ownership.
- Primary CTA goes to `/bureau/cases/${caseFile.slug}` (the workspace) — the user's actual destination.
- Secondary CTA goes to `/bureau` — fallback if they want the dashboard instead.
- Drops the misleading "Order Investigation Kit → /support" link entirely.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` passing.
- Mental trace: anonymous visitor — `canBuy = true` (via `app/cases/[slug]/page.tsx:45` where `alreadyOwns = false`), buy flow renders. Authenticated owner visits same URL — `canBuy = false`, owned-case branch renders with correct workspace CTA. Authenticated non-owner — `canBuy = true`, BuyButton renders.

**Commit subject:** `fix(public): owned-case CTA + dynamic serial on CasePublicView (UX-03 + UX-04 + UX-05)`

---

### Fix 5 — `feat(reliability): root error.tsx boundary with bureau-themed fallback (F-30)`

**File:** `app/error.tsx` (new).

**Current state.** No `app/error.tsx` exists. First uncaught render error shows the unstyled Next.js default error page. With Sentry not yet wired (deferred to launch-blocker operator-action), there is no in-product feedback when something breaks for a real user.

**Fix.** Create a minimal client-component error boundary that matches the Bureau visual register and offers a single recovery action. Per Next.js 16 conventions, `app/error.tsx` must be a client component and accept `{ error, reset }` props.

**Create `app/error.tsx`:**

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Surface to whatever logging the operator has wired. Today: Vercel
    // function logs. After Sentry lands: switch to a captureException call.
    console.error("[bureau:error]", error);
  }, [error]);

  return (
    <main className="relative min-h-screen bg-[#050507] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(185,28,28,0.18),transparent_28%),linear-gradient(to_bottom,#050507,#09090b_50%,#030304)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-6 py-24">
        <div className="text-xs uppercase tracking-[0.3em] text-red-400">
          System Fault
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">
          The bureau ran into an unexpected fault
        </h1>

        <p className="mt-6 text-base leading-8 text-zinc-300">
          The action could not be completed. The fault has been logged for
          review. You can retry or return to the bureau.
        </p>

        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-zinc-500">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            Retry
          </button>
          <Link
            href="/bureau"
            className="rounded-2xl border border-zinc-700 px-5 py-3 font-semibold text-white transition hover:bg-zinc-900"
          >
            Return to Bureau
          </Link>
        </div>
      </div>
    </main>
  );
}
```

Notes:
- Client component (`"use client"`) — required by Next.js 16's error-boundary contract.
- Logs via `console.error` for now; the comment notes the Sentry swap when that lands.
- `error.digest` is exposed by Next.js when an error is hashed for production logs; show it so support can correlate user-reported faults.
- `reset()` is the framework-provided callback that retries the failed render.
- Visual register matches `/bureau/page.tsx` system-header pattern (red accent, dossier feel) without importing the Card primitive — keeps the boundary dependency-free in case the failure was inside the UI primitives themselves.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` passing.
- `npm run build` clean.
- Manual smoke test (optional): in dev, drop `throw new Error("test boundary")` into any page component, hit the route, confirm the boundary renders with Retry + Return CTAs.

**Commit subject:** `feat(reliability): root error.tsx boundary with bureau-themed fallback (F-30)`

---

### Fix 6 — `feat(voice): Bureau Message Registry + apply to login/unlock/theory submission`

**Files:**
- `data/bureau-messages.ts` (new)
- `app/login/page.tsx`
- `components/auth/LoginForm.tsx`
- `app/(unlock)/bureau/unlock/page.tsx`
- `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx`
- `components/bureau/TheorySubmissionForm.tsx`

This is the largest commit in the batch. It introduces a single source-of-truth voice registry and applies it across three player-facing surfaces. The registry is the foundation Phase 2 batches build on — adding new surfaces should mean adding to the registry, not inventing copy in the consumer.

**(a) Create `data/bureau-messages.ts`:**

```ts
/**
 * Bureau Message Registry — single source of truth for system-voice copy.
 *
 * Centralizes the noir-procedural register established by Privacy + Terms +
 * Batch 13's closure-standard rule. New surfaces should consume from here
 * rather than invent their own copy. Changes here ripple to every consumer
 * on next render, no schema migration.
 *
 * NOT in scope:
 *
 * - Theory-submission *feedback* strings. Those live in
 *   `lib/case-evaluation.ts:buildFeedback` because Batch 13 made the
 *   sealed-verdict rule load-bearing for security; centralizing them here
 *   would create a refactor risk on a security invariant. Forms display
 *   the feedback returned by the API as-is.
 * - Marketing-page voice (about, faq, how-it-works, support). Separate
 *   batch — that's a copy-discipline pass on `data/site.ts` and friends.
 *
 * Phase-1 surfaces covered: login, unlock, theory submission UI labels,
 * per-case database header. Phase-2 surfaces (workspace tabs, checkpoint,
 * intel queue, sign-out, search empty/error states) extend this registry.
 */

export const BUREAU_MESSAGES = {
  auth: {
    signInEyebrow: "Secure access",
    signInHeading: "Sign in",
    signInBody:
      "Sign in to restore your analyst station and continue any open files.",
    submitCta: "Scan Badge",
    submitCtaLoading: "Verifying credentials…",
    submitError: "Credentials rejected. Re-enter and try again.",
  },
  unlock: {
    pendingHeading: "Sign in to redeem code",
    pendingBodyWithCode: (code: string) =>
      `Code ${code} will be applied once you reach the bureau intake terminal.`,
    pendingBodyWithoutCode:
      "Sign in and return to this page to enter your code.",
    pendingCta: "Sign in",
    activeEyebrow: "Bureau",
    activeHeading: "Incoming Artifact Transmission",
    activeBody:
      "Scan or type the code printed on a physical artifact. The Bureau will verify the source and file the intel against your active case.",
    inputLabel: "Access Code",
    inputPlaceholder: "Enter or scan code",
    submitCta: "Transmit Code",
    submitCtaLoading: "Verifying source…",
    successBanner: "Source verified — intel filed to your case desk.",
    alreadyRedeemedBanner:
      "Already filed. This artifact is in your case record.",
  },
  theorySubmission: {
    suspectPlaceholder: "Named responsible party",
    motivePlaceholder:
      "Establish the motive — what drove the responsible party to act.",
    evidencePlaceholder:
      "Cite the specific records, witnesses, or timeline details that complete the chain.",
    helperText:
      "Submit only when your suspect, motive, and evidence form one complete chain. This review does not confirm individual pieces of a theory — only whether the whole case meets the Bureau's closure standard.",
    submitCta: "Seal Packet for Bureau Review",
    submitCtaLoading: "Submitting closure packet…",
    closureStandardMet: "Closure Standard Met",
    revisionRequired: "Revision Required",
  },
  caseDatabase: {
    eyebrow: "Case Index",
    body: (currentStage: number) =>
      `Query the case index. Only cleared subjects, records, and analyst notes are available through Stage ${currentStage}.`,
  },
} as const;

export type BureauMessages = typeof BUREAU_MESSAGES;
```

**(b) Apply to `app/login/page.tsx`.**

Add import:

```ts
import { BUREAU_MESSAGES } from "@/data/bureau-messages";
```

Replace the eyebrow + heading + body block (lines 38-47):

```tsx
<div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
    Secure access
  </div>
  <h2 className="mt-4 text-3xl font-semibold text-white">
    Sign in
  </h2>
  <p className="mt-4 text-sm leading-7 text-zinc-300">
    This login now uses real credentials and a protected bureau session.
  </p>
```

with:

```tsx
<div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-8">
  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
    {BUREAU_MESSAGES.auth.signInEyebrow}
  </div>
  <h2 className="mt-4 text-3xl font-semibold text-white">
    {BUREAU_MESSAGES.auth.signInHeading}
  </h2>
  <p className="mt-4 text-sm leading-7 text-zinc-300">
    {BUREAU_MESSAGES.auth.signInBody}
  </p>
```

(The "now uses real credentials" framing is a leftover from a pre-NextAuth scaffold; replace with the registry's clean Bureau-register sentence.)

**(c) Apply to `components/auth/LoginForm.tsx`.**

Add import:

```ts
import { BUREAU_MESSAGES } from "@/data/bureau-messages";
```

Replace the submit button label (line 70):

```tsx
{status === "loading" ? "Logging in..." : "Log In"}
```

with:

```tsx
{status === "loading"
  ? BUREAU_MESSAGES.auth.submitCtaLoading
  : BUREAU_MESSAGES.auth.submitCta}
```

Replace the error message string (line 36):

```ts
setMessage("Invalid email or password.");
```

with:

```ts
setMessage(BUREAU_MESSAGES.auth.submitError);
```

**(d) Apply to `app/(unlock)/bureau/unlock/page.tsx`.**

Add import:

```ts
import { BUREAU_MESSAGES } from "@/data/bureau-messages";
```

Replace the unauthenticated SectionHeader and pending body (lines 28-41):

```tsx
<SectionHeader
  eyebrow="Bureau"
  title="Sign in to unlock evidence"
  text="You need a Bureau account to redeem an access code. After signing in we'll bring you back to this page with your code pre-filled."
/>
```

…and the conditional body paragraph (lines 38-42):

```tsx
{code
  ? `We saved your code (${code}) and will reapply it once you're signed in.`
  : "Sign in and return to this page to enter your code."}
```

with the registry-backed equivalents:

```tsx
<SectionHeader
  eyebrow="Bureau"
  title={BUREAU_MESSAGES.unlock.pendingHeading}
  text="You need a Bureau account to redeem an access code. After signing in we'll bring you back to this page with your code pre-filled."
/>
```

…and:

```tsx
{code
  ? BUREAU_MESSAGES.unlock.pendingBodyWithCode(code)
  : BUREAU_MESSAGES.unlock.pendingBodyWithoutCode}
```

Then replace the active SectionHeader (lines 62-66):

```tsx
<SectionHeader
  eyebrow="Bureau"
  title="Unlock evidence"
  text="Scan or type the code printed on a physical artifact to reveal its hidden case file."
/>
```

with:

```tsx
<SectionHeader
  eyebrow={BUREAU_MESSAGES.unlock.activeEyebrow}
  title={BUREAU_MESSAGES.unlock.activeHeading}
  text={BUREAU_MESSAGES.unlock.activeBody}
/>
```

**(e) Apply to `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx`.**

Add import:

```ts
import { BUREAU_MESSAGES } from "@/data/bureau-messages";
```

Replace the input label + placeholder (lines 102-109):

```tsx
<label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
  Access Code
</label>
<div className="mt-3 flex flex-col gap-3 sm:flex-row">
  <input
    value={code}
    onChange={(e) => setCode(e.target.value)}
    placeholder="Enter or scan code"
```

with:

```tsx
<label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
  {BUREAU_MESSAGES.unlock.inputLabel}
</label>
<div className="mt-3 flex flex-col gap-3 sm:flex-row">
  <input
    value={code}
    onChange={(e) => setCode(e.target.value)}
    placeholder={BUREAU_MESSAGES.unlock.inputPlaceholder}
```

Replace the submit button label (line 118):

```tsx
{status === "submitting" ? "Unlocking..." : "Unlock"}
```

with:

```tsx
{status === "submitting"
  ? BUREAU_MESSAGES.unlock.submitCtaLoading
  : BUREAU_MESSAGES.unlock.submitCta}
```

Replace the success/already-redeemed banner copy in `UnlockedPanel` (lines 137-145):

```tsx
{payload.alreadyRedeemed ? (
  <p className="mb-6 text-xs uppercase tracking-[0.25em] text-amber-300">
    You&apos;ve already unlocked this evidence.
  </p>
) : (
  <p className="mb-6 text-xs uppercase tracking-[0.25em] text-emerald-400">
    Evidence unlocked
  </p>
)}
```

with:

```tsx
{payload.alreadyRedeemed ? (
  <p className="mb-6 text-xs uppercase tracking-[0.25em] text-amber-300">
    {BUREAU_MESSAGES.unlock.alreadyRedeemedBanner}
  </p>
) : (
  <p className="mb-6 text-xs uppercase tracking-[0.25em] text-emerald-400">
    {BUREAU_MESSAGES.unlock.successBanner}
  </p>
)}
```

**(f) Apply to `components/bureau/TheorySubmissionForm.tsx`.**

Add import:

```ts
import { BUREAU_MESSAGES } from "@/data/bureau-messages";
```

Replace the three input placeholders. Currently:

```tsx
placeholder="Primary suspect"
```

```tsx
placeholder="What do you believe the motive was?"
```

```tsx
placeholder="Summarize the strongest evidence supporting your theory."
```

With:

```tsx
placeholder={BUREAU_MESSAGES.theorySubmission.suspectPlaceholder}
```

```tsx
placeholder={BUREAU_MESSAGES.theorySubmission.motivePlaceholder}
```

```tsx
placeholder={BUREAU_MESSAGES.theorySubmission.evidencePlaceholder}
```

Replace the helper-text paragraph (currently the `<p className="text-xs leading-5 text-zinc-500">` block above the submit button):

```tsx
<p className="text-xs leading-5 text-zinc-500">
  Submit only when your suspect, motive, and evidence form one complete chain. This review does not confirm individual pieces of a theory — only whether the whole case meets the Bureau&apos;s closure standard.
</p>
```

with:

```tsx
<p className="text-xs leading-5 text-zinc-500">
  {BUREAU_MESSAGES.theorySubmission.helperText}
</p>
```

Replace the submit button label:

```tsx
{status === "loading" ? "Submitting..." : "Submit Theory"}
```

with:

```tsx
{status === "loading"
  ? BUREAU_MESSAGES.theorySubmission.submitCtaLoading
  : BUREAU_MESSAGES.theorySubmission.submitCta}
```

Replace the verdict label resolver in the result panel:

```tsx
{verdict === "CASE_CLOSED"
  ? "Closure Standard Met"
  : verdict === "REVISION_REQUIRED"
  ? "Revision Required"
  : ""}
```

with:

```tsx
{verdict === "CASE_CLOSED"
  ? BUREAU_MESSAGES.theorySubmission.closureStandardMet
  : verdict === "REVISION_REQUIRED"
  ? BUREAU_MESSAGES.theorySubmission.revisionRequired
  : ""}
```

**Critical:** the form's mechanics — the API call, the response parse, the verdict-to-tone mapping, the result JSX — are unchanged. Only the labels and placeholders move to the registry. **The Batch 13 closure-standard sealed-verdict rule remains intact.** No diagnostic per-component feedback is introduced.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` passing. If `tests/api/theory.test.ts` asserts on the literal helper text or button label, update those assertions to match the registry strings (unlikely — most tests assert on response shape, not button text).
- `npm run build` clean.
- Mental trace: every login/unlock/theory string in the user journey now reads from one file. Future copy edits are one-place changes. Voice register is consistent with Privacy + Terms + Batch 13.

**Commit subject:** `feat(voice): Bureau Message Registry + apply to login/unlock/theory submission`

---

### Fix 7 — `feat(voice): apply registry to per-case database header`

**Files:**
- `app/bureau/cases/[slug]/database/page.tsx`
- `components/bureau/CaseDatabaseSearch.tsx`

**Current state.**
- `app/bureau/cases/[slug]/database/page.tsx:67-77` shows eyebrow `"Bureau Database"` + body `"Search the unlocked case database for people, evidence records, and bureau hints."` That's website copy; should be Bureau-register.
- `components/bureau/CaseDatabaseSearch.tsx:89-95` shows internal eyebrow `"Bureau Search"` + heading `"Search unlocked case data"` + body that mentions stage. Same issue.

**Fix.**

**(a) Apply to `app/bureau/cases/[slug]/database/page.tsx`.**

Add import:

```ts
import { BUREAU_MESSAGES } from "@/data/bureau-messages";
```

Replace the eyebrow + body block (lines 66-77):

```tsx
<div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
  Bureau Database
</div>

<h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
  {caseFile.title}
</h1>

<p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
  Search the unlocked case database for people, evidence records,
  and bureau hints.
</p>
```

with:

```tsx
<div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
  {BUREAU_MESSAGES.caseDatabase.eyebrow}
</div>

<h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
  {caseFile.title}
</h1>

<p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
  {BUREAU_MESSAGES.caseDatabase.body(currentStage)}
</p>
```

**(b) Apply to `components/bureau/CaseDatabaseSearch.tsx`.**

The component owns its own search-card eyebrow + heading. Phase-1 keeps the layout but tightens the voice. (Phase 2 will refactor this into a richer query-transcript shell; we keep the change minimal here.)

Replace the search-card header block (around lines 88-100):

```tsx
<div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
    Bureau Search
  </div>

  <h2 className="mt-4 text-3xl font-semibold text-white">
    Search unlocked case data
  </h2>

  <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
    Search people, evidence records, and unlocked hints for this case.
    Results only include content available through Stage {currentStage}.
  </p>

  <input
    value={query}
    onChange={(event) => setQuery(event.target.value)}
    placeholder="Search names, records, evidence, or keywords..."
```

with:

```tsx
<div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
    Query Terminal
  </div>

  <h2 className="mt-4 text-3xl font-semibold text-white">
    Query the case index
  </h2>

  <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
    Indexed subjects, records, and analyst notes available through
    Stage {currentStage}. Search by name, keyword, or record fragment.
  </p>

  <input
    value={query}
    onChange={(event) => setQuery(event.target.value)}
    placeholder="Names, records, evidence, keywords…"
```

(Note: the component's eyebrow ("Query Terminal") and inline heading aren't in the registry because they're component-internal labels; only the page-level copy goes through the registry. This keeps the registry as a top-level voice contract, not a component-local string table. Phase 2 may extract these too once a Tabs primitive exists.)

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` passing.
- Mental trace: the per-case database header now reads as Bureau-register: `Case Index / {Case Title} / Query the case index. Indexed subjects, records, and analyst notes available through Stage 3. Search by name, keyword, or record fragment.` The previous "Search the unlocked case database..." is gone.

**Commit subject:** `feat(voice): apply registry to per-case database header`

---

### Fix 8 — `chore: quick-polish bundle (engines.node, Link migration, argv parsing, RevokeButton field cleanup)`

Four small unrelated polish items that don't deserve their own commits, bundled per the established Black-Ledger pattern (Batch 5 Fix 4 was a comparable polish bundle).

**Files:**
- `package.json`
- `app/bureau/admin/cases/page.tsx`
- `scripts/unarchive-case.ts`
- `app/bureau/admin/cases/[caseId]/codes/_components/RevokeButton.tsx`

**(a) `package.json` — add `engines.node`.**

Add the `engines` block after the `private` field, before `scripts`:

```json
"engines": {
  "node": ">=20"
},
```

Rationale: Vercel and Neon both support Node 22; the codebase uses syntax features safe through Node 18+; pinning `>=20` matches the operator's local environment and prevents silent CI/host downgrade. The `>=` form (vs `^20.0.0`) avoids requiring a lockstep bump on every Node minor.

**(b) `app/bureau/admin/cases/page.tsx` — switch `<a>` to `<Link>` for in-app nav.**

The page currently uses raw `<a href="/bureau/admin/cases/X/{edit,preview,codes}">` elements (lines 124-143 area). Each is a full-page reload — Next.js's client-side router is bypassed.

Add the import at the top of the file (alongside existing imports):

```ts
import Link from "next/link";
```

Then replace each of the three `<a>...</a>` blocks (Edit Content, Preview, Manage Codes — lines 124-143) with `<Link href=...>...</Link>`. The className strings stay identical. Three replacements total.

Example — replace this:

```tsx
<a
  href={`/bureau/admin/cases/${caseFile.id}/edit`}
  className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-950"
>
  Edit Content
</a>
```

with:

```tsx
<Link
  href={`/bureau/admin/cases/${caseFile.id}/edit`}
  className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-950"
>
  Edit Content
</Link>
```

Repeat for the Preview and Manage Codes anchors.

**(c) `scripts/unarchive-case.ts` — accept argv.**

Replace the hardcoded line 10:

```ts
const CASE_ID = 3; // change this if needed
```

with:

```ts
const argRaw = process.argv[2];
if (!argRaw) {
  console.error("Usage: tsx scripts/unarchive-case.ts <caseId>");
  process.exit(1);
}
const CASE_ID = Number.parseInt(argRaw, 10);
if (!Number.isInteger(CASE_ID) || CASE_ID <= 0) {
  console.error(`Invalid case id: ${argRaw}`);
  process.exit(1);
}
```

The `assertSafeEnv` guard above stays exactly as-is. The rest of `main()` is unchanged.

**(d) `RevokeButton.tsx` — drop the now-ignored `revokedAt` field from the request body.**

Server-side, Batch 1 Fix 5 made `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts` stamp `revokedAt = new Date()` itself; the schema is `z.object({}).passthrough()`. The button's posted `revokedAt` is silently dropped, but its presence invites confusion ("does the client control this?").

Replace line 29:

```ts
body: JSON.stringify({ revokedAt: new Date().toISOString() }),
```

with:

```ts
body: JSON.stringify({}),
```

(The empty body still passes the `passthrough` schema; the server stamps `revokedAt` itself.)

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` passing.
- `npm run build` clean.
- `node --version` against the local environment (operator: confirm output is ≥20).
- Manual smoke test (optional): in dev, click an admin nav link — should be a client-side route change (no full reload). Run `tsx scripts/unarchive-case.ts 7` — should target case id 7. Click "Revoke" on an activation code — code is still revoked.

**Commit subject:** `chore: quick-polish bundle (engines.node, Link migration, argv parsing, RevokeButton field cleanup)`

---

### Fix 9 — `docs(audit): batch 16 report + observations`

Two new files mirroring the Batch 13 report structure.

**`audits/BATCH_16_REPORT.md`** (~250-350 lines):

- Pre-flight tree state (HEAD SHA, working tree clean, tsc clean, vitest count).
- Commit table: 8 implementation commits + this report row.
- Per-fix detail block for each of Fix 1-8: applied yes/no, files touched, diff stats, tsc + vitest deltas, mental trace, anomalies if any.
- Final verification gate output:
  - `git log --oneline -10`
  - `git status`
  - `npx tsc --noEmit`
  - `npx vitest run`
  - `npm run build`
  - `git diff <pre-batch-SHA>..main --stat`

**`audits/BATCH_16_OBSERVATIONS.md`** (~180-280 lines):

1. **Why this batch supersedes audit-recommended Batch 14 + 15.** The 2026-05-07 UX-polish audit recommended Batch 14 = refund visibility + serial unification, Batch 15 = copy fixes + owned-case CTA. Both are covered here. Plus the 2026-05-10 full-scope audit's P1 archive leak. Plus ChatGPT's Phase-1 immersion polish. Numbering jump (13 → 16) is deliberate — it signals "this is a larger batch than either of the audit-recommended individual ones, and folds them in." No prior queued work is dropped.

2. **The closure-standard rule (Batch 13) is the load-bearing security invariant.** Fix 1 (archive) closes the regression. Fix 9 (theory copy pass in Fix 6) preserves it — only labels and placeholders move to the registry; the API contract and form mechanics are byte-identical to post-Batch-13 state. The sealed-verdict rule documented in CLAUDE.md remains the standing instruction.

3. **The serial unification (Fix 3) deliberately uses `id` instead of `slug`.** `id` is immutable; `slug` can rename (CaseSlugHistory tracks aliases). Using `id` for the player-facing serial means renaming a slug never changes the visible serial — keeps the diegetic identifier stable across the case's lifetime. The `slug`-derived serial in the old debrief code (`"BL-" + slug.toUpperCase().replace(/-/g, "").slice(0, 8)`) drifted on rename; the new helper does not.

4. **The owned-case CTA (Fix 4) shows "Open Workspace" as the primary action.** Alternative considered: hide the CTA card entirely for owners. Rejected — the marketing page is also reachable via shared links; an owner who landed there via a friend's recommendation should still see "you own this, here's where to continue" rather than a confusing absence. The secondary "Return to Bureau" link covers users who want the dashboard.

5. **The `app/error.tsx` boundary (Fix 5) deliberately does not import shared UI primitives.** If the failure was inside `Card` / `Pill` / `StampBadge` rendering, the boundary needs to render without those primitives — otherwise a primitive bug crashes the boundary too. The boundary uses raw Tailwind utilities only. Phase 2 may extract a `BureauFault` primitive for reuse in route-segment `error.tsx` files; today, root-level is enough.

6. **The Bureau Message Registry (Fix 6) intentionally excludes theory feedback strings.** Those live in `lib/case-evaluation.ts:buildFeedback` because Batch 13 made the sealed-verdict invariant load-bearing for security. Centralizing them in the registry would create a refactor risk on a security invariant. Forms display API-returned feedback as-is. Documented in the registry's docstring.

7. **The Bureau Message Registry intentionally excludes marketing-page voice.** `data/site.ts` is the marketing copy source. A unification pass that merges Bureau-system voice with marketing-product voice would change four pages (`/about`, `/faq`, `/how-it-works`, `/support`) in a single batch; the audit-recommended sequencing puts that as its own copy-discipline batch. Today's registry is the system-voice contract only.

8. **The intel-drop handshake animation is NOT in this batch.** ChatGPT's BUREAU_IMMERSION_PROMPT.md ideation #17 ("CODE RECEIVED → ARTIFACT SOURCE VERIFIED → CASE LINK CONFIRMED → INTEL FILE RELEASED" multi-step animation) is Phase 2 work. Phase 1 ships the static copy via the registry: button label changes from "Unlock" to "Transmit Code", banner from "Evidence unlocked" to "Source verified — intel filed to your case desk". The staged animation requires a shared motion vocabulary (Framer Motion is in the project but only used in two surfaces today); a Phase-2 batch will add the animation primitive and apply it to unlock + checkpoint + theory-submission transitions in one sweep.

9. **The Analyst Desk Grid layout refactor of `/bureau` is NOT in this batch.** ChatGPT's Phase 2 work. The Phase 1 voice + filter changes are independent of the layout refactor — both can happen in either order without conflict.

10. **`User.callsign` schema field is NOT in this batch.** Phase 2 work. Requires a migration, registration UX changes, possibly a dedicated profile-settings page. Today's `/bureau` identity block continues to render `userEmail` until that batch lands; ChatGPT's "callsign-from-user-id" interim is also deferred to Phase 2 because changing that display today, then changing it again when the schema lands, would be churn.

11. **Production verification checklist for the operator.** After push + deploy:
    - As a fresh investigator, sign in. Confirm the login button shows "Scan Badge" loading state and the page eyebrow/heading/body are the registry strings.
    - Submit a CORRECT theory. Confirm verdict is "Closure Standard Met" (registry-backed). Confirm the workspace Recent Submissions panel and `/bureau/archive` panel both show "Closure Standard Met" — never a numeric score, never PARTIAL/INCORRECT badges.
    - Submit a deliberately wrong theory. Confirm verdict is "Revision Required". Same panels show "Revision Required" with sealed boilerplate, never the leaky historical feedback.
    - As a refunded user (operator can simulate via SQL: `UPDATE "UserCase" SET "revokedAt" = NOW() WHERE id = X` against a test row): visit `/bureau` — case is absent from Active Reviews and Archive. Visit `/bureau/cases/<slug>/debrief` — 404.
    - Visit a public case page (e.g. `/cases/alder-street-review`) while logged in as an owner — confirm "On Your Desk" + "Open Workspace" CTA pointing to `/bureau/cases/<slug>`. Visit while not signed in — confirm BuyButton renders.
    - Visit a public case page for case 002 (when published) — confirm serial reads `BL-002`, not `BL-001`.
    - Force-trigger an error in dev (`throw new Error("test")` in a route component, then revert) — confirm the bureau-themed error page renders with Retry + Return CTAs.
    - Run `tsx scripts/unarchive-case.ts 7` — confirm it targets case id 7.
    - Click an admin nav link (Edit Content / Preview / Manage Codes) — confirm client-side navigation (no full reload).

12. **Carry-forward items unchanged from Batch 13:** Sentry instrumentation, CSP nonce migration, `app/layout.tsx` per-render `auth()`, forgot-password timing leak, R2 ContentLength alternative paths, F-04 lawyer brief pending. Operational launch-blockers (DKIM/SPF/DMARC, Stripe Live activation, daily pg_dump, GitHub Actions CI) remain external operator tasks; not code-fix-prompt material. Marketing-page voice rewrite remains queued for its own batch.

13. **Carry-forward from this batch (queued for Batch 17 — Phase 2 design layer):**
    - Analyst Desk Grid layout refactor of `/bureau` (multi-panel `grid-template-areas`).
    - File-tab navigation in case workspace.
    - `User.callsign` schema field + registration UX.
    - Intel-drop handshake animation primitive + apply to unlock/checkpoint/theory.
    - Query transcript on global database search.
    - Closed Files Shelf visual treatment for `/bureau/archive`.
    - Evidence Sheet refactor for record detail page.

**Commit subject:** `docs(audit): batch 16 report + observations`

Then stop. Do not push.

---

## 4. Final verification gate

After all nine commits are on tree:

```
git log --oneline -10               # Fix 1-8 + report in order
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # passing (count up by 5 from Fix 3's caseSerial tests)
npm run build                       # clean (only pre-existing notices)
git diff <pre-batch-SHA>..main --stat
```

Expected files touched:

```
app/bureau/archive/page.tsx                                                          (Fix 1)
app/bureau/page.tsx                                                                  (Fix 2 + Fix 3)
app/bureau/cases/[slug]/debrief/page.tsx                                             (Fix 2 + Fix 3)
lib/case-serial.ts                                                                   (Fix 3, new)
tests/lib/case-serial.test.ts                                                        (Fix 3, new)
components/cases/CasePublicView.tsx                                                  (Fix 4)
app/error.tsx                                                                        (Fix 5, new)
data/bureau-messages.ts                                                              (Fix 6, new)
app/login/page.tsx                                                                   (Fix 6)
components/auth/LoginForm.tsx                                                        (Fix 6)
app/(unlock)/bureau/unlock/page.tsx                                                  (Fix 6)
app/(unlock)/bureau/unlock/_components/UnlockForm.tsx                                (Fix 6)
components/bureau/TheorySubmissionForm.tsx                                           (Fix 6)
app/bureau/cases/[slug]/database/page.tsx                                            (Fix 7)
components/bureau/CaseDatabaseSearch.tsx                                             (Fix 7)
package.json                                                                         (Fix 8)
app/bureau/admin/cases/page.tsx                                                      (Fix 8)
scripts/unarchive-case.ts                                                            (Fix 8)
app/bureau/admin/cases/[caseId]/codes/_components/RevokeButton.tsx                   (Fix 8)
audits/BATCH_16_REPORT.md                                                            (Fix 9, new)
audits/BATCH_16_OBSERVATIONS.md                                                      (Fix 9, new)
```

If any other file is in the diff, restore it before declaring done.

---

## 5. Begin

Read these files end-to-end before the first edit:

1. `audits/2026-05-10-fullscope-godmode-review.md` (especially Section 2.1.1 and Section 2.6 P1 list, and Section 3.5 Do-not-touch list).
2. `audits/BATCH_13_REPORT.md` and `audits/BATCH_13_OBSERVATIONS.md` (closure-standard rule context).
3. `CLAUDE.md` Theory submission — closure-standard rule section.
4. The current state of every file in the "expected files touched" list above. Re-confirm line numbers; do not trust this prompt's line numbers blindly — they were captured at the time of writing.

Then start with Fix 1 — the archive sealed-verdict patch. Verify tsc + vitest clean after the commit. Then Fix 2 (refund filtering, two files). Then Fix 3 (caseSerial helper + tests + apply to two consumers). Then Fix 4 (CasePublicView — uses caseSerial introduced in Fix 3, plus the owned-case CTA replacement). Then Fix 5 (error.tsx, new file). Then Fix 6 (registry creation + apply to login + unlock + theory — six files in one commit, the largest of the batch). Then Fix 7 (per-case database header). Then Fix 8 (quick-polish bundle, four files). Then Fix 9 (report + observations).

Between every commit: `npx tsc --noEmit` + `npx vitest run`. If any commit breaks either gate, stop, restore, ask for clarification — do not pile fixes on top.

When you finish, surface the operator-action callout in your closing message: **"Run `git push`. No `prisma migrate deploy` needed — this batch is pure code, no schema change. After deploy, run the production verification checklist in BATCH_16_OBSERVATIONS.md §11. The marketing-page voice rewrite, Sentry instrumentation, Phase 2 design layer (Analyst Desk Grid + File Tabs + caller User.callsign), and operational launch-blockers (DKIM/Stripe Live/lawyer/pg_dump/CI) remain queued — none in scope for this batch."**

Done.
