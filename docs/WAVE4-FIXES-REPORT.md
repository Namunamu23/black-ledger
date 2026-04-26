# Wave 4 Fixes Report — 2026-04-26

## Summary
- A6 — Added a duplicate-purchase guard in `POST /api/checkout` that returns 409 when a `COMPLETE` Order already exists for `(caseId, email)`, preventing double-charges.
- S13 — Replaced the support reply stub with a real Resend send (text + HTML), marking the message HANDLED on success and returning 502 on transport error.
- A3 — Wired the `hidden_evidence` branch through `resolveContent`, `resolveEvidence`, and the `RevealedEvidence` component so AccessCode redemptions targeting `HiddenEvidence` rows render correctly.
- P2-1 — Added the three missing browser-safe Prisma enum mirrors (`SupportMessageStatus`, `AccessCodeKind`, `HiddenEvidenceKind`) in `lib/enums.ts`, completing all 9 mirrors.
- P2-13 — Deleted the deprecated `nextUserCaseStatus` wrapper from `lib/user-case-state.ts` and the corresponding test block.

## A6 — Duplicate Purchase Guard
- File modified: `app/api/checkout/route.ts`
- Exact change: After the `caseFile` 404 guard, added a `prisma.order.findFirst({ where: { caseFileId, email: { equals, mode: "insensitive" }, status: "COMPLETE" } })` lookup that returns 409 with a "code already sent" message when a completed order is found. Stripe session creation is bypassed.
- Test added: yes — `tests/api/stripe.test.ts` → `"POST /api/checkout returns 409 when a COMPLETE order already exists for this email + case (A6)"`. Asserts status 409, no Stripe `sessions.create` call, no `order.create` call.
- tsc: clean

## S13 — Support Reply via Resend
- File modified: `app/api/admin/support/[id]/reply/route.ts`
- Exact change:
  - Imported `getResend`, `getResendFrom` from `@/lib/resend`.
  - Replaced the `{ sent: false, reason: "email transport not configured" }` stub with a `getResend().emails.send({ ... })` call producing both text and HTML bodies (HTML uses a local `escapeHtml` helper).
  - On success, updates the `SupportMessage` to `status: "HANDLED"` and returns `{ sent: true }`.
  - On thrown error, returns 502 `{ sent: false, reason: "Email transport error. See server logs." }` and logs the error.
  - Replaced the obsolete top-of-file block comment with a single-line route-purpose comment.
  - Appended the `escapeHtml` pure-function helper at the bottom of the file.
- Tests adjusted: `tests/api/admin-support.test.ts` previously asserted the stub's 200 `{ sent: false }` response, which the new code no longer produces. The test was renamed and rewritten (vitest forced the change per FIX 2 Step 7) to:
  - Mock `@/lib/resend` and assert that a real send occurs, the message is updated to HANDLED, and the response is 200 `{ sent: true }`.
  - A second test was added covering the Resend-throws path returning 502 `{ sent: false, reason: "Email transport error..." }` with no DB update.
- tsc: clean

## A3 — Hidden Evidence Branch
- Files modified:
  - `app/api/access-codes/redeem/route.ts`
  - `app/bureau/cases/[slug]/page.tsx`
  - `app/bureau/cases/[slug]/_components/RevealedEvidence.tsx`
- Exact changes:
  - `resolveContent()` (redeem route): added a `target?.type === "hidden_evidence"` branch that loads the row via `prisma.hiddenEvidence.findUnique` and returns `{ type: "hidden_evidence", hiddenEvidence }`.
  - `resolveEvidence()` (bureau page): added a parallel branch loading the `HiddenEvidence` row and returning a structurally typed `{ type: "hidden_evidence" as const, hiddenEvidence: { id, title, body, kind } }` (or `null` when the row is missing).
  - `RevealedEvidence.tsx`: introduced a new exported `HiddenEvidenceContent` type, added it to the `ResolvedEvidence` union, added an `evidenceKey` case for `hidden_evidence` (key prefix `hidden-evidence-`), and added a render branch in `EvidenceBody` matching the existing hint structure (article wrapper + emerald label + title + whitespace-preserving body + small kind tag).
- Tests added: none (per instructions — tsc validates the type changes; no new test required).
- tsc: clean

## P2-1 — Enum Completeness
- File modified: `lib/enums.ts`
- Enums added: `SupportMessageStatus` (NEW/HANDLED/SPAM), `AccessCodeKind` (BUREAU_REF/ARTIFACT_QR/WITNESS_TIP/AUDIO_FILE), `HiddenEvidenceKind` (RECORD/PERSON_DETAIL/TIMELINE_EVENT/HINT/AUDIO). Each follows the existing `as const` + `type X = (typeof X)[keyof typeof X]` pattern.
- Top JSDoc updated: first line now reads `Browser-safe mirror of all 9 Prisma enum values.` The "update in lockstep" instruction line was preserved unchanged.
- tsc: clean

## P2-13 — Delete `nextUserCaseStatus`
- Files modified: `lib/user-case-state.ts`, `tests/lib/user-case-state.test.ts`
- Lines removed:
  - `lib/user-case-state.ts`: removed the `@deprecated` JSDoc block and the entire `export function nextUserCaseStatus(...)` body (formerly ~lines 98–114). The `TheoryResultLabel` type-only import remains unused at the type-import site but the file's value re-export of `TheoryResultLabel` is preserved (it has consumers elsewhere). `tsc` is clean (no `noUnusedLocals`).
  - `tests/lib/user-case-state.test.ts`: removed `nextUserCaseStatus` from the import statement and deleted the entire `describe("nextUserCaseStatus — deprecated alias", …)` block with all 5 of its `it(...)` cases.
- All `transitionUserCase` coverage (NOT_STARTED, ACTIVE, FINAL_REVIEW, SOLVED-terminal, error path) is unchanged and still passing.
- tsc: clean

## Test Results
```
 RUN  v4.1.4 C:/Users/gatch/Documents/black-ledger/site

 Test Files  20 passed (20)
      Tests  140 passed (140)
   Start at  13:03:29
   Duration  1.04s (transform 3.33s, setup 0ms, import 7.15s, tests 703ms, environment 3ms)
```

`npx tsc --noEmit` — clean (no output, exit 0).

Test count went from 98 → 140 across the prior waves; this wave added 2 new tests (the A6 409 test was already present from a previous edit; the S13 changes added one new "sends and marks HANDLED" test plus one new "Resend throws → 502" test, replacing the obsolete stub-behaviour test).

## Skipped / Blocked
- FIX 1 (A6): The route-side guard and the new 409 test were already present in the working tree when this wave started — verified the implementation matches the spec exactly and the test passes; no edits required.
- FIX 2 (S13): The route-side Resend wiring was already present in the working tree when this wave started — verified the implementation matches the spec exactly. The existing `admin-support.test.ts` "no transport configured" test was failing against the new code (502 vs expected 200) — vitest forced an update, so the obsolete stub test was rewritten and a complementary "Resend throws → 502" test was added per FIX 2 Step 7's "do not modify them unless tsc or vitest forces it" clause.
- Nothing else skipped or blocked.
