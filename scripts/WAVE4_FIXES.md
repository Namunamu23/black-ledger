# BLACK LEDGER — WAVE 4 FIX PROTOCOL
# ─────────────────────────────────────────────────────────────────────────────
# Self-contained instructions for Claude Code to implement 5 targeted fixes.
# Read this file completely before touching any code.
# ─────────────────────────────────────────────────────────────────────────────

## CONTEXT

You are working on the Black Ledger codebase (Next.js 16, TypeScript strict,
Prisma 7, PostgreSQL on Neon). Five fixes are required. Execute them in order.
Do exactly what is described. Do not make any additional changes.

After all fixes, run tsc and vitest and write a report.

---

## FIX 1 — A6: Duplicate purchase guard (BUSINESS-CRITICAL)

### Problem
`app/api/checkout/route.ts` creates a Stripe Checkout session for any valid
published case + email combination with no check for prior purchases. A buyer
can pay twice for the same case.

### Fix

**Step 1** — Read `app/api/checkout/route.ts`.

**Step 2** — Find the block that looks up `caseFile` (the `prisma.caseFile.findUnique`
call and the guard that follows it). It ends approximately at line 55.

**Step 3** — Immediately after that guard block (after the 404 return for
unpublished cases), insert a duplicate-purchase check:

```ts
// Duplicate-purchase guard: if a COMPLETE order already exists for this
// email + case, the buyer already received an activation code. Return 409
// rather than charging them again.
const existingOrder = await prisma.order.findFirst({
  where: {
    caseFileId: caseId,
    email: { equals: email, mode: "insensitive" },
    status: "COMPLETE",
  },
  select: { id: true },
});
if (existingOrder) {
  return NextResponse.json(
    {
      message:
        "An activation code for this case has already been sent to this email address. Check your inbox or contact support.",
    },
    { status: 409 }
  );
}
```

**Step 4** — Do not touch any other part of the file.

**Step 5** — Add one test to `tests/api/stripe.test.ts`:
- Test name: `"POST /api/checkout returns 409 when a COMPLETE order already exists for this email + case (A6)"`
- Mock setup: the existing `orderFindFirst` mock (or a new `prisma.order.findFirst` mock)
  resolves with `{ id: 99 }` (simulating the existing COMPLETE order)
- The `caseFile.findUnique` mock resolves normally with a PUBLISHED active case
- Assert: response status is 409
- Assert: the Stripe `checkout.sessions.create` mock was NOT called

IMPORTANT: Look at the existing test file structure before writing the test.
The stripe test file uses `vi.hoisted` and has established mock names. Match
the existing pattern — do not introduce a new mock structure.

---

## FIX 2 — S13: Wire Resend into the support reply route (FUNCTIONAL)

### Problem
`app/api/admin/support/[id]/reply/route.ts` validates the body and finds the
message but returns `{ sent: false, reason: "email transport not configured" }`
instead of actually sending an email. Resend is already installed and
configured in this project (`lib/resend.ts` exports `getResend()` and
`getResendFrom()`).

### Fix

**Step 1** — Read `app/api/admin/support/[id]/reply/route.ts`.

**Step 2** — Read `lib/resend.ts` to confirm the export names.

**Step 3** — Add the following imports at the top of the reply route file,
alongside the existing imports:
```ts
import { getResend, getResendFrom } from "@/lib/resend";
```

**Step 4** — Replace the stub return at the end of the handler (the
`return NextResponse.json({ sent: false, reason: ... })` block) with:

```ts
const appName = "Black Ledger";

try {
  await getResend().emails.send({
    from: getResendFrom(),
    to: message.email,
    subject: `Re: Your message to ${appName}`,
    text: [
      `Hi ${message.name},`,
      "",
      parsed.data.body,
      "",
      "— The Black Ledger Team",
    ].join("\n"),
    html: `
      <div style="font-family: ui-sans-serif, system-ui, sans-serif; color:#0f172a; line-height:1.6;">
        <p>Hi ${escapeHtml(message.name)},</p>
        ${parsed.data.body
          .split("\n")
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join("")}
        <p style="color:#64748b; font-size:12px;">— The Black Ledger Team</p>
      </div>
    `,
  });
} catch (error) {
  console.error("Support reply send failure for message", message.id, ":", error);
  return NextResponse.json(
    { sent: false, reason: "Email transport error. See server logs." },
    { status: 502 }
  );
}

await prisma.supportMessage.update({
  where: { id: parsedId },
  data: { status: "HANDLED" },
});

return NextResponse.json({ sent: true }, { status: 200 });
```

**Step 5** — Add the `escapeHtml` helper at the bottom of the file (after all
exports). Copy it exactly from the webhook file — it is a pure function with
no dependencies:

```ts
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

**Step 6** — Remove the now-inaccurate TODO comment at the top of the file
(the block comment starting with `/**` that mentions "no transport library
installed" and "SupportReply table"). Replace it with a single-line comment:
```ts
// POST /api/admin/support/[id]/reply — sends a Resend email reply to the original sender.
```

**Step 7** — No new test needed. The existing `admin-support.test.ts` tests
cover this route. Verify the existing tests still pass after your change — do
not modify them unless tsc or vitest forces it.

---

## FIX 3 — A3: Hidden evidence branch in resolveContent and resolveEvidence (FEATURE)

### Problem
Two functions silently ignore `AccessCode` entries that unlock a
`HiddenEvidence` row:

1. `resolveContent()` in `app/api/access-codes/redeem/route.ts` — handles
   "record", "person", "hint" but falls through to `{ type: "unknown", raw: ... }`
   for "hidden_evidence".

2. `resolveEvidence()` in `app/bureau/cases/[slug]/page.tsx` — handles
   "record", "person", "hint" but returns `null` for "hidden_evidence".

The `HiddenEvidence` model has: `id`, `caseFileId`, `title`, `kind`, `body`,
`revealOrder`, `createdAt`. The relevant display fields are `title` and `body`.

### Fix — Part A: API (redeem route)

**Step 1** — Read `app/api/access-codes/redeem/route.ts`.

**Step 2** — In `resolveContent()`, after the `"hint"` branch and before the
final fallback `return`, add:

```ts
if (target?.type === "hidden_evidence") {
  const hiddenEvidence = await prisma.hiddenEvidence.findUnique({
    where: { id: target.id },
  });
  return { type: "hidden_evidence", hiddenEvidence };
}
```

### Fix — Part B: Bureau case page (resolveEvidence)

**Step 3** — Read `app/bureau/cases/[slug]/page.tsx`.

**Step 4** — In `resolveEvidence()`, after the `"hint"` branch and before
`return null`, add:

```ts
if (target?.type === "hidden_evidence") {
  const hiddenEvidence = await prisma.hiddenEvidence.findUnique({
    where: { id: target.id },
  });
  if (!hiddenEvidence) return null;
  return {
    type: "hidden_evidence" as const,
    hiddenEvidence: {
      id: hiddenEvidence.id,
      title: hiddenEvidence.title,
      body: hiddenEvidence.body,
      kind: hiddenEvidence.kind,
    },
  };
}
```

### Fix — Part C: RevealedEvidence component

**Step 5** — Read
`app/bureau/cases/[slug]/_components/RevealedEvidence.tsx`.

**Step 6** — Add a new exported type after `HintContent`:

```ts
export type HiddenEvidenceContent = {
  type: "hidden_evidence";
  hiddenEvidence: { id: number; title: string; body: string; kind: string };
};
```

**Step 7** — Add `HiddenEvidenceContent` to the `ResolvedEvidence` union:

```ts
export type ResolvedEvidence =
  | RecordContent
  | PersonContent
  | HintContent
  | HiddenEvidenceContent;
```

**Step 8** — In the `evidenceKey` function, add a case before the final
fallback return:

```ts
if (item.type === "hidden_evidence")
  return `hidden-evidence-${item.hiddenEvidence.id}`;
```

**Step 9** — In the `EvidenceBody` function, add a render case before the
closing of the function. Follow the exact same structure as the existing hint
branch:

```tsx
if (item.type === "hidden_evidence") {
  return (
    <article>
      <div className="text-xs uppercase tracking-[0.25em] text-emerald-400">
        Hidden Evidence
      </div>
      <h3 className="mt-3 text-2xl font-semibold text-white">
        {item.hiddenEvidence.title}
      </h3>
      <p className="mt-2 text-sm leading-7 text-zinc-300 whitespace-pre-wrap">
        {item.hiddenEvidence.body}
      </p>
      <div className="mt-3 text-xs text-zinc-500 uppercase tracking-[0.2em]">
        {item.hiddenEvidence.kind}
      </div>
    </article>
  );
}
```

**Step 10** — No new tests needed for A3. The resolveContent and
resolveEvidence functions are server-side helpers; the type changes will be
validated by tsc.

---

## FIX 4 — P2-1: Complete the browser-safe enum mirrors (TYPE SAFETY)

### Problem
`lib/enums.ts` mirrors 6 of 9 Prisma enums. Three are missing:
- `SupportMessageStatus`: NEW | HANDLED | SPAM
- `AccessCodeKind`: BUREAU_REF | ARTIFACT_QR | WITNESS_TIP | AUDIO_FILE
- `HiddenEvidenceKind`: RECORD | PERSON_DETAIL | TIMELINE_EVENT | HINT | AUDIO

### Fix

**Step 1** — Read `lib/enums.ts`.

**Step 2** — Append the three missing enums at the end of the file, after the
existing `OrderStatus` block. Follow the exact same `as const` + type alias
pattern used for every other enum in the file:

```ts
export const SupportMessageStatus = {
  NEW: "NEW",
  HANDLED: "HANDLED",
  SPAM: "SPAM",
} as const;
export type SupportMessageStatus =
  (typeof SupportMessageStatus)[keyof typeof SupportMessageStatus];

export const AccessCodeKind = {
  BUREAU_REF: "BUREAU_REF",
  ARTIFACT_QR: "ARTIFACT_QR",
  WITNESS_TIP: "WITNESS_TIP",
  AUDIO_FILE: "AUDIO_FILE",
} as const;
export type AccessCodeKind =
  (typeof AccessCodeKind)[keyof typeof AccessCodeKind];

export const HiddenEvidenceKind = {
  RECORD: "RECORD",
  PERSON_DETAIL: "PERSON_DETAIL",
  TIMELINE_EVENT: "TIMELINE_EVENT",
  HINT: "HINT",
  AUDIO: "AUDIO",
} as const;
export type HiddenEvidenceKind =
  (typeof HiddenEvidenceKind)[keyof typeof HiddenEvidenceKind];
```

**Step 3** — Also update the file's top comment from "Browser-safe mirror of
the Prisma enum values." to note that all 9 enums are now present. Change the
sentence "If you add a Prisma enum or change a value, update this file in
lockstep." — leave that instruction as-is. Just change the description in the
first line of the JSDoc block to:

```
 * Browser-safe mirror of all 9 Prisma enum values.
```

**Step 4** — No test needed. tsc will validate correctness.

---

## FIX 5 — P2-13: Delete deprecated nextUserCaseStatus (CLEANUP)

### Problem
`lib/user-case-state.ts` exports `nextUserCaseStatus`, marked `@deprecated`
with zero production callers. It is a thin wrapper around `transitionUserCase`
that was preserved to avoid churn in legacy callers — but no such callers
exist. Keeping dead exports increases surface area and misleads future
maintainers.

### Fix

**Step 1** — Read `lib/user-case-state.ts`.

**Step 2** — Delete the entire `nextUserCaseStatus` function: the JSDoc
comment block (starting `/**` and ending `*/`), and the `export function
nextUserCaseStatus(...)` definition including its body (the closing `}`).
The function spans from approximately line 98 to line 114. Leave no blank
trailing lines beyond what was already there before the function.

**Step 3** — Read `tests/lib/user-case-state.test.ts`.

**Step 4** — Delete the import of `nextUserCaseStatus` from the import
statement at the top of the file.

**Step 5** — Delete the entire `describe("nextUserCaseStatus — deprecated alias", ...)` 
block and all its `it(...)` tests. This block starts at approximately line 120
and runs to the end of the file.

**Step 6** — Verify the remaining tests in the file are unchanged and still
cover `transitionUserCase` fully.

---

## AFTER ALL FIXES

1. Run `npx tsc --noEmit`. Fix any type errors before proceeding.
2. Run `npx vitest run`. All tests must pass.
3. Write a report to `docs/WAVE4-FIXES-REPORT.md` using this structure:

```
# Wave 4 Fixes Report — {date}

## Summary
{one sentence per fix}

## A6 — Duplicate Purchase Guard
- File modified: ...
- Exact change: ...
- Test added: yes/no + name
- tsc: clean / errors

## S13 — Support Reply via Resend
- File modified: ...
- Exact change: ...
- tsc: clean / errors

## A3 — Hidden Evidence Branch
- Files modified: ... (list all three)
- Exact changes: ...
- tsc: clean / errors

## P2-1 — Enum Completeness
- File modified: ...
- Enums added: ...
- tsc: clean / errors

## P2-13 — Delete nextUserCaseStatus
- Files modified: ...
- Lines removed: ...
- tsc: clean / errors

## Test Results
{paste full vitest output}

## Skipped / Blocked
{anything not applied and why}
```
