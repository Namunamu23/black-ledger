# BLACK LEDGER — UX POLISH AUDIT
## 2026-05-07 — the dogfooder's audit

**Mandate.** Polish gaps, not security or perf. Hunting for places where the system technically works but the user experience is wrong, confusing, misleading, jarring, or unprofessional.

**Method.** Read every user-facing surface (Phase 1), categorize findings A–K (Phase 2), synthesize into a punch list (Phase 3), and write this report (Phase 4). Source code is read-only; this file is the only artifact created.

**Severity ladder.**
- **P0** — User cannot complete a critical flow, or sees clearly broken output.
- **P1** — User completes the flow but is confused, misled, or sees something they shouldn't.
- **P2** — Polish gap a careful user would notice; doesn't break the flow.
- **P3** — Nit. A reviewer might mention it; a user probably won't.

**Out of scope.** The 5 starter examples named in the audit prompt (unlock copy, NextAuth catch-all rate-limit, missing `error.tsx`, archive confirmation dialog, AccessCodeList "record #5") are known-and-scheduled. They are not re-listed below.

---

## PHASE 1 — COVERAGE ATTESTATION

Every page, layout, and form named in the audit prompt was read. Inventory:

**Public pages read:** `app/page.tsx`, `app/about/page.tsx`, `app/faq/page.tsx`, `app/how-it-works/page.tsx`, `app/support/page.tsx`, `app/cases/page.tsx`, `app/cases/[slug]/page.tsx` (+ `components/cases/CasePublicView.tsx`), `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/checkout/success/page.tsx`.

**Auth pages read:** `app/login/page.tsx`, `app/register/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `app/account/delete/page.tsx`, `app/(unlock)/bureau/unlock/page.tsx` (+ `_components/UnlockForm.tsx`).

**Bureau pages read:** `app/bureau/page.tsx`, `app/bureau/cases/[slug]/page.tsx`, `app/bureau/cases/[slug]/database/page.tsx`, `app/bureau/cases/[slug]/debrief/page.tsx`, `app/bureau/cases/[slug]/records/[recordId]/page.tsx`, `app/bureau/database/page.tsx`, `app/bureau/people/[personId]/page.tsx`, `app/bureau/archive/page.tsx`.

**Admin pages read:** `app/bureau/admin/cases/page.tsx`, `app/bureau/admin/cases/[caseId]/edit/page.tsx` (+ all 6 tab components in `_components/`), `app/bureau/admin/cases/[caseId]/codes/page.tsx` (+ 3 `_components/`), `app/bureau/admin/cases/[caseId]/access-codes/page.tsx` (+ 3 `_components/`), `app/bureau/admin/cases/[caseId]/preview/page.tsx`, `app/bureau/admin/support/page.tsx`, `app/bureau/admin/support/[id]/page.tsx` (+ `ReplyForm`, `StatusActions`).

**Layouts read:** `app/layout.tsx`, `app/bureau/layout.tsx`, `app/bureau/admin/layout.tsx`. (No additional layouts exist.)

**Forms read:** `LoginForm.tsx`, `RegisterForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`, `DeleteAccountForm.tsx`, `SignOutButton.tsx`, `BuyButton.tsx`, `CaseActivationForm.tsx`, `CheckpointForm.tsx`, `TheorySubmissionForm.tsx`, `PublishCaseButton.tsx`, `CreateCaseForm.tsx`, `ImageUploader.tsx`, `GenerateActivationCodeButton.tsx`, `CaseReadinessPanel.tsx`, `WaitlistForm.tsx`, `SupportForm.tsx`, `CaseDatabaseSearch.tsx`, `GlobalPeopleSearchTerminal.tsx`.

**Navigation:** `Navbar.tsx`, `Footer.tsx`. **Other UI:** `RevealedEvidence.tsx`.

**Supporting libs verified:** `lib/validators.ts`, `lib/auth-helpers.ts`, `middleware.ts`, `app/api/access-codes/redeem/route.ts`, `app/api/checkout/route.ts`, `app/api/cases/activate/route.ts`, `app/api/cases/[slug]/theory/route.ts`, `app/api/cases/[slug]/checkpoint/route.ts`, `app/api/me/route.ts`, `app/api/forgot-password/route.ts`, `app/api/register/route.ts`, `app/api/waitlist/route.ts`, `app/api/support/route.ts`, `data/site.ts`.

**Files expected by prompt that were NOT found / paths that differed:**
- `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx` exists at the expected path (file present, audit complete).
- All paths in the prompt resolved.

**Globals:**
- No `error.tsx` exists anywhere under `app/` (matches starter example #3, not re-flagged).
- The only `not-found.tsx` is `app/not-found.tsx`. No route-group `not-found.tsx`s.

---

## PHASE 2 — FINDINGS BY CATEGORY

### A. Misleading copy / unfulfilled promises

#### [P0] UX-01 — Hidden-evidence access codes render "no longer available" after a successful redemption

**Category:** A (also F: error states).

**Location:** `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx:137-207` (renderer); cross-checked against `app/api/access-codes/redeem/route.ts:35-40` (server).

**What:** When a user redeems an `AccessCode` whose target is `hidden_evidence` via the public unlock page, the API succeeds and returns the unlocked content, but the renderer falls through to the "hint" branch and shows "The unlocked hint is no longer available." The user sees what looks like a failure even though the redemption worked.

**Evidence:**

Server returns the typed payload:
```ts
// app/api/access-codes/redeem/route.ts:35-40
if (target?.type === "hidden_evidence") {
  const hiddenEvidence = await prisma.hiddenEvidence.findUnique({...});
  return { type: "hidden_evidence", hiddenEvidence };
}
```

Client renderer's discriminated union does not include `hidden_evidence`:
```ts
// app/(unlock)/bureau/unlock/_components/UnlockForm.tsx:5-18
type RecordContent  = { type: "record";  record: ... | null };
type PersonContent  = { type: "person";  person: ... | null };
type HintContent    = { type: "hint";    hint:   ... | null };
type FallbackContent = { type: string; raw: unknown };
type Content = RecordContent | PersonContent | HintContent | FallbackContent;
```

The render switch never matches a hidden_evidence response and falls into the implicit hint branch:
```ts
// UnlockForm.tsx:142-207 (abbreviated)
if ("raw" in content) { ...JSON dump... }
if (content.type === "record") { ... }
if (content.type === "person") { ... }
if (!content.hint) {
  return <p>The unlocked hint is no longer available.</p>;
}
```

A `{ type: "hidden_evidence", hiddenEvidence: {...} }` payload has no `raw`, doesn't match `record`/`person`, and lacks `content.hint`, so the user sees "The unlocked hint is no longer available." every time.

**Why a user notices:** This is the specific physical→digital flow Black Ledger sells: a buyer scans a QR code on an artifact in the kit, lands on the unlock form, the API redeems, and the user expects the hidden evidence to appear. Instead they see an error message. Their next move is to email support (or assume the kit is broken). Production-impacting if any shipping kit has hidden_evidence access codes.

**Remediation:** Add a branch in `UnlockForm.tsx`:
```ts
type HiddenEvidenceContent = {
  type: "hidden_evidence";
  hiddenEvidence: { id: number; title: string; body: string; kind: string } | null;
};
```
Add `HiddenEvidenceContent` to the `Content` union. In `UnlockedContent`, add a branch matching `RevealedEvidence.tsx:114-130`:
```tsx
if (content.type === "hidden_evidence") {
  if (!content.hiddenEvidence) return <p>The unlocked evidence is no longer available.</p>;
  return (
    <article>
      <h2>{content.hiddenEvidence.title}</h2>
      <p className="whitespace-pre-line">{content.hiddenEvidence.body}</p>
    </article>
  );
}
```

**Effort estimate:** XS (≈15 lines).

---

#### [P1] UX-02 — `/checkout/success` displays "Payment confirmed. Activation code will arrive..." even when no payment occurred

**Category:** A.

**Location:** `app/checkout/success/page.tsx:9-66`.

**What:** When `?session_id=` is missing from the URL or the order isn't found, the page shows the "Processing" state with the copy "Payment confirmed. Your activation code will arrive by email shortly." A visitor who navigates directly to `/checkout/success` (bookmark, history fragment, accidental link) will be told a payment was confirmed.

**Evidence:**
```tsx
// app/checkout/success/page.tsx:11-19
const { session_id: sessionId } = await searchParams;
const order = sessionId
  ? await prisma.order.findUnique({ where: { stripeSessionId: sessionId }, select: { status: true } })
  : null;
const isComplete = order?.status === "COMPLETE";
```
```tsx
// :43-53 (the !isComplete branch)
<Pill tone="warning" label="Processing" />
<h1>Your order is processing</h1>
<p>Payment confirmed. Your activation code will arrive by email shortly. ...</p>
```

**Why a user notices:** A user pasting an old success URL, or arriving via a redirect chain that lost the query parameter, will see a green-toned "Payment confirmed" line. Worst case: they wait for an email that will never come.

**Remediation:** Branch on three states, not two:
1. `!sessionId` → show "Looking for your bureau? Sign in or browse cases." with no payment language.
2. `sessionId && !order` → show "We couldn't find this order. Contact support if you've been charged."
3. `order?.status === "COMPLETE"` → existing success copy.
4. `order?.status === "PENDING"` → existing "Processing" copy (legitimate state).

**Effort estimate:** S (≈20 lines).

---

#### [P1] UX-03 — Every public case page renders the hardcoded serial "BL-001 / Standalone Investigation"

**Category:** A.

**Location:** `components/cases/CasePublicView.tsx:88-91`.

**What:** The `CasePublicView` component hardcodes `BL-001 / Standalone Investigation` in the case-detail header, regardless of which case is being shown. As soon as a second case ships, both `/cases/<slug>` pages (and the admin preview page) will read "BL-001" — including the second case's page.

**Evidence:**
```tsx
// components/cases/CasePublicView.tsx:88-91
<div className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
  BL-001 / Standalone Investigation
</div>
```
Used by both `app/cases/[slug]/page.tsx:45` and `app/bureau/admin/cases/[caseId]/preview/page.tsx:28-32`.

**Why a user notices:** Once Case 002 ships, the public Case 002 page will say "BL-001" in its header — a confusing and unprofessional inconsistency for a paying buyer.

**Remediation:** Pass a serial through `CasePublicViewProps` derived from a stable identifier (e.g. `BL-${String(caseFile.id).padStart(3, "0")}`) or accept an explicit `serial` prop. Same logic should ideally also feed `app/cases/page.tsx:77` so the catalog and detail pages agree.

**Effort estimate:** S (≈10 lines + plumbing the prop through).

---

#### [P1] UX-04 — Owned-case CTA still says "Order Investigation Kit" linking to `/support`

**Category:** A (also K: copy clarity).

**Location:** `components/cases/CasePublicView.tsx:165-198`.

**What:** When a signed-in user already owns the case (`canBuy=false`), the "available now" panel still renders a prominent yellow CTA labeled "Order Investigation Kit" — but the link target is `/support`, not a checkout flow. The user has already purchased; the CTA misrepresents what will happen on click and where they will land.

**Evidence:**
```tsx
// components/cases/CasePublicView.tsx:165-186
<Pill tone="success" label="Available Now" />
<h2>Get the investigation kit</h2>
<p>Order includes the physical case file and lifetime digital bureau access. ...</p>
{canBuy ? (
  <BuyButton caseId={caseFile.id} />
) : (
  <Link href="/support" ...>
    Order Investigation Kit
  </Link>
)}
```

**Why a user notices:** A buyer who already owns Case 001 navigates back to `/cases/alder-street-review`, sees a primary CTA "Order Investigation Kit" — they click it expecting checkout (or to order another) and land on the support page. Confusing. If they're told they "already own" anywhere it's only via the contradicting `BuyButton` absence; the CTA shouts "buy."

**Remediation:** When `canBuy=false`, replace the entire right-column CTA with an "Already activated" state:
```tsx
<Pill tone="info" label="In Your Bureau" />
<h2>You own this case</h2>
<p>Open your workspace to continue.</p>
<Link href="/bureau">Go to bureau</Link>
```
(Owners likely also shouldn't see the "Already purchased? Sign in..." line — covered by UX-05.)

**Effort estimate:** S (≈15 lines).

---

#### [P2] UX-05 — Owned-case page still shows "Already purchased? Sign in and enter your activation code."

**Category:** A.

**Location:** `components/cases/CasePublicView.tsx:189-197`.

**What:** Below the (already-misleading) buy CTA, the owned case page renders a "Sign in to Bureau" link plus the helper text "Already purchased? Sign in and enter your activation code." For someone who has already activated, both pieces of copy are stale.

**Evidence:**
```tsx
// components/cases/CasePublicView.tsx:189-197
<Link href="/login">Sign in to Bureau</Link>
<p className="mt-3 text-center text-xs text-zinc-600">
  Already purchased? Sign in and enter your activation code.
</p>
```

**Why a user notices:** The signed-in owner sees both the buy CTA and the redeem helper, neither of which describes their state. Together with UX-04, the entire right column tells the user the wrong story.

**Remediation:** Gate this entire helper block behind `!canBuy === false` (i.e. only show for unsigned-in or unowned visitors). Combined with UX-04, the owned-case branch should render only an "Open Workspace" CTA and a "Back to archive" link.

**Effort estimate:** XS (≈5 lines).

---

#### [P1] UX-12 — `GlobalPeopleSearchTerminal` shows the literal string "Showing 10 of N" in truncated results

**Category:** A.

**Location:** `components/bureau/GlobalPeopleSearchTerminal.tsx:147-150`.

**What:** When the bureau-wide person search is truncated, the badge below the result list says "Showing 10 of N · refine query to narrow" — the letter `N` is a placeholder that was never interpolated.

**Evidence:**
```tsx
// components/bureau/GlobalPeopleSearchTerminal.tsx:147-150
{truncated ? (
  <div className="...">
    Showing 10 of N · refine query to narrow
  </div>
) : null}
```

**Why a user notices:** A literal "N" in user-facing copy reads as broken software. The status readout already says "10 Matches Returned (Truncated)" elsewhere — this badge duplicates that with a placeholder leaked through.

**Remediation:** Either interpolate a real total (would need the server action to return it) or rephrase: `"Showing top 10 results · refine query to see more"`. Recommend the rephrase for minimal change.

**Effort estimate:** XS (1 line).

---

#### [P2] UX-25 — `/forgot-password` helper text claims "we'll send you a reset link" while the API silently no-ops on unknown emails

**Category:** A.

**Location:** `app/forgot-password/page.tsx:19`; `app/api/forgot-password/route.ts:41-44`.

**What:** The page reads "Enter the email address linked to your account and we'll send you a reset link." The API by design returns 200 with the same generic message for both registered and unregistered emails — a deliberate privacy choice that prevents enumeration. The page copy doesn't acknowledge this ambiguity, so users typing the wrong email get a fake "sent!" experience and never receive an email.

**Evidence:**

Page promise:
```tsx
// app/forgot-password/page.tsx:16-20
<PageHero
  eyebrow="Account"
  title="Forgot your password?"
  text="Enter the email address linked to your account and we'll send you a reset link. The link expires in one hour."
/>
```

API behavior:
```ts
// app/api/forgot-password/route.ts:11
const GENERIC_OK = "If that email is registered, a reset link has been sent.";
// :41-44
if (!user) {
  return NextResponse.json({ message: GENERIC_OK }, { status: 200 });
}
```

The form's success view also surfaces the generic message:
```tsx
// components/auth/ForgotPasswordForm.tsx:25-29
setMessage(
  data.message ??
    "If that email is registered, a reset link has been sent."
);
```

So the page header promises a definite send; the form on success shows a conditional "if that email is registered." The two messages contradict each other.

**Why a user notices:** A user who mistypes their email gets the green "If that email is registered…" success message, sits waiting for the email, and eventually emails support. The opening helper text led them to believe a send was guaranteed.

**Remediation:** Reword the page hero to match the API: "Enter your account email. If we have a record of it, we'll send a reset link within a few minutes. The link expires in one hour." Keeps the privacy posture and removes the user's expectation of guaranteed delivery.

**Effort estimate:** XS (1 line).

---

#### [P2] UX-26 — FAQ Q4 hardcodes "Case 001 is designed for roughly 90 to 150 minutes…" as a global FAQ entry

**Category:** A.

**Location:** `data/site.ts:104-108` (rendered by `app/faq/page.tsx`).

**What:** The site FAQ — accessible from every page footer and the main nav — answers "How long does one case take?" with content specific to Case 001. As soon as a second case with different pacing ships, the FAQ becomes wrong by category. (See also UX-29 for the broader hardcoded-001 problem.)

**Evidence:**
```ts
// data/site.ts:104-108
{
  question: "How long does one case take?",
  answer:
    "Case 001 is designed for roughly 90 to 150 minutes depending on pace, group size, and how deeply you review the file.",
},
```

**Why a user notices:** A buyer browsing the FAQ before purchase reads about Case 001 timing while looking at Case 002. They form expectations that may not match.

**Remediation:** Generalize the answer: "Most cases run 90 to 150 minutes depending on pace, group size, and how deeply you review the file. Per-case timing is shown on each case detail page."

**Effort estimate:** XS (1 line).

---

#### [P3] UX-28 — `data/site.ts:30` `heroTitle` is dead code

**Category:** A.

**Location:** `data/site.ts:30`.

**What:** `siteConfig.home.heroTitle` is defined but no consumer reads it (verified via repo grep). The home page literals on `app/page.tsx:118-134` use the strings directly, not via this config.

**Evidence:**
```ts
// data/site.ts:30
heroTitle: "Open the file. Enter the bureau. Solve what they missed.",
```
Grep confirms `heroTitle` is referenced only in `data/site.ts`.

**Why a user notices:** They don't directly. But future authors will read this config believing they can edit the headline by changing this string, and watch their edit do nothing.

**Remediation:** Either delete the unused field, or wire `app/page.tsx:118-134` to read from it. Recommend delete (the home page literals are rendered by per-line `<RedactReveal>` components that need static text anyway).

**Effort estimate:** XS (1 line).

---

#### [P3] UX-29 — Featured-case identity hardcoded across `data/site.ts`

**Category:** A.

**Location:** `data/site.ts:9-19`.

**What:** `siteConfig.featuredCase` hardcodes `id: "001"`, `slug: "alder-street-review"`, `href: "/cases/alder-street-review"`, plus all metadata. The home page consumes this object for the hero CTA and the manila-folder card. When a future case becomes the "featured" one, every consumer must be updated, and any unpublished/archived case will silently break the home page CTA.

**Evidence:**
```ts
// data/site.ts:9-19
featuredCase: {
  id: "001",
  title: "The Alder Street Review",
  slug: "alder-street-review",
  href: "/cases/alder-street-review",
  ...
},
```
Consumed by `app/page.tsx:23` (`siteConfig.featuredCase`).

**Why a user notices:** They don't, until the day the slug rot bites. The home page CTA "Examine Case 001" leads to a 404 if `alder-street-review` is archived without a redirect (CaseSlugHistory only handles renames, not archives).

**Remediation:** Move `featuredCase` resolution to a server fetch that picks the most recent `PUBLISHED` `CaseFile`. If a hardcoded fallback is desired, gate the home CTA on `caseFile.workflowStatus === PUBLISHED && caseFile.isActive`.

**Effort estimate:** S (1 server fetch + plumbing).

---

### B. Validator UX

#### [P1] UX-15 — `redeemAccessCodeSchema` is case-sensitive while `activationCodeSchema` is not

**Category:** B.

**Location:** `lib/validators.ts:271-273` (redeem) vs. `:47-54` (activate).

**What:** Activation codes (the email-delivered ones the user types into the bureau dashboard) are normalized via `.trim().toUpperCase()`. AccessCodes (the QR codes on physical artifacts) are only `.trim()`'d — case-sensitive. If an admin generates an AccessCode in mixed case (random hex generator emits uppercase, but admins can type anything) and a user types it differently, the redemption fails with "Code not found."

**Evidence:**
```ts
// lib/validators.ts:47-54
export const activationCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "Please enter a valid activation code.")
    .max(64, "Activation code is too long."),
});
```
```ts
// lib/validators.ts:271-273
export const redeemAccessCodeSchema = z.object({
  code: z.string().trim().min(1).max(64),
});
```

**Why a user notices:** The unlock page is reachable via QR scan (auto-fills the code) — that path is fine. But manual entry (artifact text damaged, ink smudge, transcribed onto a sticky note) becomes case-sensitive in a way no other code in the system is.

**Remediation:** Match `activationCodeSchema` — add `.toUpperCase()` after the `.trim()`. Verify the admin form (`CreateAccessCodeForm.tsx`) and the random-hex generator (`randomHex8` already uppercases at line 24) are consistent. CreateAccessCodeForm sends `code: code.trim()` without uppercasing — also normalize at write site for safety.

**Effort estimate:** XS (2 lines: validator + form).

---

#### [P3] UX-30 — Theory-submission `motive` validator min-10 too low for "serious" review framing

**Category:** B.

**Location:** `lib/validators.ts:71-75`.

**What:** The `motive` field requires `min(10, ...)`. A phrase like "He did it." passes (10 chars exactly). The product copy positions theory submission as a structured analytical conclusion, but a 10-character motive is acceptable to the validator.

**Evidence:**
```ts
// lib/validators.ts:71-75
motive: z
  .string()
  .trim()
  .min(10, "Motive must be at least 10 characters.")
  .max(1000, "Motive is too long."),
```

**Why a user notices:** Probably they don't, unless they accidentally submit a one-line motive and feel undercut by the result feedback. The bigger risk is grading-system noise — a 10-char motive can't carry enough tokens for the matcher to score reliably.

**Remediation:** Bump min to 30–40 characters with a friendlier error: "Describe the motive in a sentence or two so the bureau can score it." Same applies to `evidenceSummary` (min 10 → min 30 recommended). Watch out for existing tests in `tests/api/cases-theory.test.ts`.

**Effort estimate:** XS (2 lines).

---

### C. Auth/state visibility gates

#### [P1] UX-09 — Bureau dashboard active-cases list contains refunded cases without distinct labeling

**Category:** C.

**Location:** `app/bureau/page.tsx:45-46`, `:202-264`.

**What:** Refunded cases (`UserCase.revokedAt !== null`) still satisfy `status !== "SOLVED"`, so they appear in the "Active Reviews" list with full progress percentage and an "Open Workspace" CTA. There is no badge or banner on the dashboard distinguishing them. Users who refunded a case keep seeing it in their active list with stage progress.

**Evidence:**
```ts
// app/bureau/page.tsx:45-46
const solvedCases = ownedCases.filter((entry) => entry.status === "SOLVED");
const activeCases = ownedCases.filter((entry) => entry.status !== "SOLVED");
```
The render at `:212-263` shows full progress + "Open Workspace" / "Database" links with no `revokedAt` branch. The workspace page (`app/bureau/cases/[slug]/page.tsx:297-324`) is the only surface that flags refunded state.

**Why a user notices:** A user who requested a refund expects the case to disappear or be marked "Refunded" on their dashboard. Seeing it look fully active with a progress bar and CTAs is confusing. They click "Open Workspace" and only then learn the case is refunded.

**Remediation:** Either filter `revokedAt`-set cases into a separate "Archived purchases" group, or render a "Refunded" `Pill` next to `StatusBadge` and disable the action buttons. Recommend the second — preserves the user's progress record while making state explicit.

**Effort estimate:** S (≈25 lines).

---

#### [P1] UX-10 — Refund-banner missing on `/bureau/cases/[slug]/debrief` exposes solution to refunded user

**Category:** C.

**Location:** `app/bureau/cases/[slug]/debrief/page.tsx:21-30`.

**What:** The debrief page guards on `status: "SOLVED"` only, never `revokedAt`. A user who solved a case before requesting a refund retains full access to the debrief — including `solutionSuspect`, `solutionMotive`, `solutionEvidence`, and the three debrief paragraphs.

**Evidence:**
```ts
// app/bureau/cases/[slug]/debrief/page.tsx:21-30
const solvedCase = await prisma.userCase.findFirst({
  where: { userId, status: "SOLVED", caseFile: { slug } },
  include: { caseFile: true },
});
```
No `revokedAt: null` constraint and no banner branch.

**Why a user notices:** A user who refunded their purchase keeps access to the answer key. From a UX-correctness perspective, this contradicts the workspace banner that says "the case is no longer playable." From a commercial perspective, it's a soft revenue leak: solve, refund, retain answer access.

**Remediation:** Add `revokedAt: null` to the `where` clause OR render a refund banner equivalent to the workspace's (`app/bureau/cases/[slug]/page.tsx:297-324`) and gate the solution sections behind `!ownedCase.revokedAt`. Recommend the banner approach so users keep their record but lose the solution detail.

**Effort estimate:** S (≈20 lines).

---

#### [P2] UX-16 — Refund banner missing on `/bureau/cases/[slug]/database`

**Category:** C.

**Location:** `app/bureau/cases/[slug]/database/page.tsx:25-45`.

**What:** Same root cause as UX-10. The database page has no `revokedAt` branch, no banner, no read-only state. A refunded user can browse all unlocked records, hints, and people.

**Evidence:**
```ts
// app/bureau/cases/[slug]/database/page.tsx:25-45 (abbreviated)
const ownedCase = await prisma.userCase.findFirst({...});
if (!ownedCase) notFound();
// ... renders full search UI without revokedAt check
```

**Why a user notices:** The workspace page warns; this sister page silently grants the same content. Inconsistent.

**Remediation:** Either render the same refund banner at the top of the page or thread `revokedAt` into the page model so the search result cards can render with reduced opacity / a "refunded" tag. Recommend banner-only — search results were already available pre-refund.

**Effort estimate:** XS (≈10 lines: copy the banner block from the workspace page).

---

#### [P2] UX-17 — Refund banner missing on `/bureau/cases/[slug]/records/[recordId]`

**Category:** C.

**Location:** `app/bureau/cases/[slug]/records/[recordId]/page.tsx:30-56`.

**What:** Same root cause as UX-10/UX-16. Record-detail page checks ownership but not `revokedAt`.

**Evidence:**
```ts
// app/bureau/cases/[slug]/records/[recordId]/page.tsx:30-42
const ownedCase = await prisma.userCase.findFirst({
  where: { userId, caseFile: { slug } },
  ...
});
if (!ownedCase) notFound();
```

**Why a user notices:** Same as UX-16. They reached a deep link via the workspace banner-warned page, but the deep page doesn't echo the warning.

**Remediation:** Same banner pattern.

**Effort estimate:** XS (≈10 lines).

---

#### [P1] UX-11 — `heroImageUrl` and `portraitUrl` are admin-uploadable but have no user-facing consumer

**Category:** C (also A: misleading promises to admins).

**Location:** `app/bureau/admin/cases/[caseId]/edit/_components/OverviewTab.tsx:126-131` (hero); `_components/PeopleTab.tsx:155-162` (portraits). Search confirmed no consumer rendering anywhere.

**What:** Admins upload hero images via OverviewTab and portrait images via PeopleTab. The URLs are persisted to `CaseFile.heroImageUrl` and `CasePerson.portraitUrl`. No user-facing surface (`/cases/[slug]`, `/bureau/cases/[slug]`, `/bureau/people/[personId]`) reads these fields. The image upload pipeline (R2 + blurhash + ImageUploader UI) terminates at the database — no consumer.

**Evidence:**

Admin upload writes to the field:
```tsx
// app/bureau/admin/cases/[caseId]/edit/_components/OverviewTab.tsx:126-131
<ImageUploader
  context="hero"
  label="Hero Image"
  value={form.heroImageUrl ?? ""}
  onChange={(url) => update("heroImageUrl", url || null)}
/>
```
Grep across the repo for `heroImageUrl`:
```
prisma/schema.prisma                              ← schema definition
lib/validators.ts                                 ← validator
app/bureau/admin/cases/[caseId]/edit/page.tsx     ← admin edit page (write-side)
app/bureau/admin/cases/[caseId]/edit/_components/OverviewTab.tsx  ← admin edit UI (write-side)
docs/AUDIT-2026-04-26.md                          ← prior audit reference
prisma/migrations/.../migration.sql               ← schema migration
```
No file in `app/cases/`, `app/bureau/cases/`, `components/cases/`, or `components/bureau/` reads `heroImageUrl`. Same for `portraitUrl` — admin write surfaces only, never read on a player-facing page.

**Why a user notices:** The admin notices first, when they upload an image and the public/bureau page never shows it. They redo the upload, click into a different tab, refresh — same. They eventually email the operator to ask if upload is broken. The buyer notices a generic-looking case page that promised "premium" but renders no imagery.

**Remediation:** Two paths. Either:
1. **Consume the images.** Add a hero image to `CasePublicView.tsx` (e.g. above the title, next/image with fill+aspect-ratio) and a portrait to the bureau workspace `People of Interest` cards (`app/bureau/cases/[slug]/page.tsx:423-440`). Plumb `portraitUrl` through `app/api/admin/cases/[caseId]/people/route.ts` so it survives saves.
2. **Hide the upload UI** until consumers exist. Less work but means the operator's investment in the upload pipeline sits dormant.

Recommend option 1; this is core product polish.

**Effort estimate:** M (≈80–120 lines: 2 consumers + image sizing + blurhash placeholder rendering).

---

### D. Missing confirmations on destructive actions

#### [P2] UX-22 — Admin tab "Remove Person/Record/Hint/Checkpoint" buttons do not confirm

**Category:** D.

**Location:** `app/bureau/admin/cases/[caseId]/edit/_components/PeopleTab.tsx:164-170`, `RecordsTab.tsx:151-157`, `HintsTab.tsx:144-150`, `CheckpointsTab.tsx:134-140`.

**What:** Each tab editor renders a `Remove …` button per row that drops the entry from the in-memory list with no confirmation. Per the dirty-state model, removal is recoverable by leaving the page without saving — but admins routinely Save tabs as they go, and an accidental Remove + Save is destructive (it diff/upserts the API to delete the row, including any FK-linked redemptions/audit history).

**Evidence:** Identical pattern in all four:
```tsx
// PeopleTab.tsx:164-170
<button
  type="button"
  onClick={() => remove(index)}
  className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400"
>
  Remove Person
</button>
```
No `confirm()`, no modal, no typed-phrase guard. Compare with `components/admin/RevokeButton.tsx:18` which does use `confirm()`.

**Why a user notices:** Most likely as: admin clicks Remove on the wrong row (index off-by-one), saves, tries to recover. The Remove button is red; the click target is small; the resulting action is permanent on save.

**Remediation:** Wrap each remove in a `confirm()` matching `RevokeButton.tsx:18` — minimum effort. Or add a "deleted (undo)" tombstone state that survives until save. The first option is XS effort and matches existing project patterns.

**Effort estimate:** XS (4 × 1 line).

---

### E. Rate-limits or guards applied too broadly/narrowly

No findings beyond the prompt's known starter (NextAuth catch-all). Rate-limit call sites verified across 30 routes; per-route limits (`/api/me` 3/60s, `/api/checkout` 5/60s, `/api/cases/activate` 5/60s, etc.) match the action being throttled. The blurhash and checkout-status routes added in Batch 2 are scoped correctly. No state-mutating route was found that throttles unrelated state. The CSRF middleware allowlist is also tight (`WEBHOOK_PATHS = new Set(["/api/webhooks/stripe"])` at `middleware.ts:17`).

Checked: `/api/checkout`, `/api/access-codes/redeem`, `/api/cases/activate`, `/api/cases/[slug]/checkpoint`, `/api/cases/[slug]/theory`, `/api/admin/cases/[caseId]/codes`, `/api/admin/cases/[caseId]/codes/[codeId]`, `/api/admin/cases/[caseId]/access-codes`, `/api/admin/uploads/sign`, `/api/admin/uploads/blurhash`, `/api/checkout/status`, `/api/admin/support/[id]/reply`, `/api/admin/support/[id]/status`, `/api/admin/cases/[caseId]/workflow`, `/api/admin/cases/[caseId]/solution`, `/api/admin/cases/[caseId]/checkpoints`, `/api/admin/cases/[caseId]/hints`, `/api/admin/cases/[caseId]/records`, `/api/admin/cases/[caseId]/people` (per-section schema + 60/60s admin rate-limit), `/api/auth/[...nextauth]/route.ts` (catch-all, **starter example #2**, not re-flagged), `/api/me`, `/api/register`, `/api/forgot-password`, `/api/reset-password`, `/api/support`, `/api/waitlist`.

---

### F. Error states / fallbacks

#### [P0/P1 see UX-01] (UnlockForm hidden_evidence — listed under category A)

#### [P1] UX-02 — Checkout success page no-op state — listed under category A

#### Checked: `app/not-found.tsx`

The single root-level `not-found.tsx` is well-branded (returns to home / bureau). No additional `not-found.tsx` at route-group level — but Next 16 will fall through to the root. Acceptable as-is.

#### Checked: form catch blocks

Every form catch block uses generic "Something went wrong. Please try again." copy. Acceptable per audit prompt's "stick to behavior of what currently exists" — not flagging as findings.

#### Checked: Stripe / Resend / R2 failure paths

`app/api/checkout/route.ts:193-198` returns a generic 500 on Stripe failures; `BuyButton.tsx:33-35` surfaces it as "Something went wrong." Acceptable. `app/api/forgot-password/route.ts:86-90` swallows Resend send failures and still 200s — privacy-correct, no UX gap.

#### Sole net-new finding under category F

(See UX-01 above. No additional Category F findings beyond starter example #3.)

---

### G. Empty / loading / disabled states

#### [P1] UX-06 — `TheorySubmissionForm` does not call `router.refresh()` after successful submission

**Category:** G (also H: stale UI).

**Location:** `components/bureau/TheorySubmissionForm.tsx:55-63`.

**What:** When the user submits a theory and the API returns success — including the `CORRECT` path that flips `UserCase.status` to `SOLVED` server-side — the form clears its local fields and renders the result feedback inline, but does **not** call `router.refresh()`. The surrounding workspace UI (status pills, Pill `Resolved` callout, "Case Resolved" stamp, `Open Debrief` button, refund-banner branch) all keep their pre-submission render until the user manually refreshes.

**Evidence:**
```tsx
// components/bureau/TheorySubmissionForm.tsx:55-63
setStatus("success");
setMessage(data.message ?? "Theory submitted.");
setFeedback(data.feedback ?? "");
setResultLabel(data.resultLabel ?? "");
setForm({ suspectName: "", motive: "", evidenceSummary: "" });
```
Compare with sibling forms that *do* refresh after a state-changing submission:
```tsx
// components/bureau/CheckpointForm.tsx:46-47
setMessage(data.message ?? "Checkpoint cleared.");
setAnswer("");
router.refresh();
```
```tsx
// components/bureau/CaseActivationForm.tsx:51-52
setCode("");
router.refresh();
```

**Why a user notices:** The most consequential moment in the entire product — solving the case — has a stale UI. The user submits a CORRECT theory, sees a green inline `CORRECT` panel, but the page header still says "Stage 3/3" with status `Final Review`, the "Submit your current conclusion" form still says "Theory Submission Unlocked" rather than showing a "Resolved" state, and the `Open Debrief` button does not appear. They have to manually refresh to see they actually solved it.

**Remediation:** Add `router.refresh();` after `setForm({...})`. The form already imports `useRouter` patterns from sibling components; it just isn't calling refresh. (Verify the React Query / RSC re-render correctly populates the SOLVED branch on the workspace page.)

**Effort estimate:** XS (2 lines: import `useRouter` + call `.refresh()`).

---

#### [P1] UX-07 — `GenerateActivationCodeButton` does not surface the generated code value

**Category:** G.

**Location:** `components/admin/GenerateActivationCodeButton.tsx:34-35`.

**What:** When an admin clicks "Generate Code" on a case in the catalog list, the API creates a new ActivationCode and returns its value. The button shows a tiny grey message "Code created." with no actual code visible. The admin must navigate to the case's `/codes` page to see what was created. The batch generator (`GenerateCodesForm.tsx:101-110`) does the right thing and shows the codes inline.

**Evidence:**
```tsx
// components/admin/GenerateActivationCodeButton.tsx:34-35
setMessage(data.message ?? "Code created.");
router.refresh();
```
Compare:
```tsx
// app/bureau/admin/cases/[caseId]/codes/_components/GenerateCodesForm.tsx:101-110
{generated.length > 0 ? (
  <div>
    <div>Newly generated (copy now — they will not be re-displayed)</div>
    <pre>{generated.join("\n")}</pre>
  </div>
) : null}
```

**Why a user notices:** The admin generates a code on the fly (e.g., a lost-and-replaced support escalation), gets a confirmation, but no code value to read. They navigate two pages to find it, scrolling through dozens of older codes to identify the new one (sorted desc by createdAt — at least the new one is on top, so this is recoverable, but still annoying friction).

**Remediation:** Have the API include `{ code: "ALDER-XXXX" }` in the response (it almost certainly already does — `app/api/admin/cases/[caseId]/activation-codes/route.ts`) and render a `<code>` block matching `GenerateCodesForm.tsx:101-110`'s pattern.

**Effort estimate:** XS (≈10 lines).

---

#### [P2] UX-19 — `WaitlistForm` and `SupportForm` allow accidental double-submit; no terminal "thank-you" view

**Category:** G.

**Location:** `components/forms/WaitlistForm.tsx:33-35`; `components/forms/SupportForm.tsx:38-44`.

**What:** Both forms set `status: "success"`, clear the form fields, show a green inline message, and re-enable the submit button. The form's empty appearance + re-enabled button + green message creates a state where a user can submit again immediately. Waitlist's API silently absorbs duplicates (returns 201 even for duplicates per `app/api/waitlist/route.ts:43-51`), so the user could submit four times and not see a problem; support has no duplicate guard, so each click writes a new SupportMessage row.

**Evidence:**
```tsx
// components/forms/WaitlistForm.tsx:33-35
setStatus("success");
setMessage(data.message ?? "You're on the waitlist.");
setEmail("");
```
```tsx
// components/forms/SupportForm.tsx:38-44
setStatus("success");
setFeedback(data.message ?? "Your message has been sent.");
setForm({ name: "", email: "", message: "" });
```

**Why a user notices:** A real customer-support pattern — user types a message, submits, doesn't see a clear "thank you" page (because the form just empties), assumes the click missed, types again. Three SupportMessages in the inbox for one customer.

**Remediation:** After success, replace the form with a terminal "thank you" panel containing only a confirmation message and a CTA back to home or another form. Mirrors the pattern used in `ForgotPasswordForm.tsx:36-47` where the entire form is replaced post-success.

**Effort estimate:** S (≈30 lines across both forms).

---

#### [P3] UX-34 — `app/bureau/admin/cases/page.tsx` has no empty state for "no cases yet"

**Category:** G.

**Location:** `app/bureau/admin/cases/page.tsx:62-156`.

**What:** When `cases` is empty, the section renders an empty `<div className="grid gap-4">` below the "Catalog management" heading. A first-install admin sees the create form, then nothing, then the page footer.

**Evidence:**
```tsx
// app/bureau/admin/cases/page.tsx:62-63
<div className="mt-6 grid gap-4">
  {cases.map((caseFile, index) => { ... })}
</div>
```
No `cases.length === 0` branch.

**Why a user notices:** Only on first install. Probably never in production. P3.

**Remediation:** Render `cases.length === 0 ? <EmptyHint /> : <CaseGrid/>`. Empty hint copy: "No cases yet. Create your first case shell above."

**Effort estimate:** XS (5 lines).

---

### H. Stale UI / cache issues

UX-06 (TheorySubmissionForm no-refresh) is the principal Category H finding — already listed under G.

#### [P3] UX-35 — Admin tab edits stay dirty across tab switches but the unsaved state is invisible

**Category:** H.

**Location:** `app/bureau/admin/cases/[caseId]/edit/_components/Tabs.tsx:55-66`.

**What:** Tabs are mounted once and toggle visibility via `hidden=`. State (form drafts) is preserved per-tab, which is correct UX. But there is no visible dirty indicator — an admin who edits the People tab, switches to Records, and closes the browser loses all People-tab edits without warning. Also, no `beforeunload` handler.

**Evidence:**
```tsx
// app/bureau/admin/cases/[caseId]/edit/_components/Tabs.tsx:55-66
{tabs.map((tab) => (
  <div ... hidden={active !== tab.value}>
    {tab.content}
  </div>
))}
```
Each tab tracks its own `status: "idle"|"saving"|"saved"|"error"` via internal state (e.g., `OverviewTab.tsx:29`), but this is per-tab and not surfaced as a dirty marker on the tab itself.

**Why a user notices:** Admin makes 20 minutes of edits across People + Records, navigates away. Comes back. Loss. Probably a one-time learning experience but expensive when it happens.

**Remediation:** Track a `dirty: boolean` per tab; render a small dot on the tab label when dirty; add a window `beforeunload` warning when any tab is dirty. Out of "minimum viable polish" scope; flag for future batch.

**Effort estimate:** M (≈60 lines).

---

### I. Cross-page navigation gaps

#### [P1] UX-13 — Account deletion ends with a silent redirect — no "your account has been deleted" confirmation

**Category:** I (also K: copy clarity).

**Location:** `components/auth/DeleteAccountForm.tsx:45`; the delete page itself does not render a post-deletion view.

**What:** After a successful `DELETE /api/me`, the form calls `signOut({ redirectTo: "/" })`. The user lands on the home page identical to a regular signed-out visitor — no toast, no banner, no "Your account has been permanently deleted" confirmation. Combined with the deletion form's "this is irreversible" framing, the lack of confirmation creates ambiguity about whether the action actually went through.

**Evidence:**
```tsx
// components/auth/DeleteAccountForm.tsx:40-46
// Sign out and redirect home. The session cookie is now stale ...
await signOut({ redirectTo: "/" });
```

**Why a user notices:** This is the single most consequential action a user can take in the system — and it ends in silence. The privacy policy commitment is "we will delete all personal data we hold about you." A user who clicks delete and gets a generic home page may worry the action didn't take. Some will email support to confirm.

**Remediation:** Land them on `/` with a `?deleted=1` flag and render a one-time toast/banner on the home page: "Your Black Ledger account has been permanently deleted. Thank you for being part of the bureau." Persisting the toast across the redirect requires query-param-driven UI on the landing page, since signOut clears local state. Alternatively land on a dedicated `/account/deleted` page with the confirmation message and a "Back to home" link.

**Effort estimate:** S (≈30 lines: dedicated landing page is cleaner).

---

#### [P1] UX-14 — Login page CTA hardcodes `/cases/alder-street-review`

**Category:** I.

**Location:** `app/login/page.tsx:30-32`. Same root cause as UX-29 (featuredCase config).

**What:** The login page right-column CTA reads "View Case 001" and links to `/cases/alder-street-review`. If that case is renamed (CaseSlugHistory redirects), it works. If archived (no redirect), it 404s. The login page is a high-traffic surface and a 404 there is a bad first impression.

**Evidence:**
```tsx
// app/login/page.tsx:29-35
<Link
  href="/cases/alder-street-review"
  className="..."
>
  View Case 001
</Link>
```

**Why a user notices:** A new visitor lands on login, clicks the offered CTA, gets a 404. Or sees "Case 001" copy when only Cases 002+ exist.

**Remediation:** Replace with a static link to `/cases` (the catalog), or fetch the most recent published case server-side. Recommend `/cases` for simplicity — the login page sells "access" not a specific case.

**Effort estimate:** XS (2 lines).

---

### J. Mobile / responsive basics

This category was static-read for layout-class indicators only — no live viewport testing was performed. No Category J findings rise to a P1/P2.

Spot checks:
- All admin tables (`app/bureau/admin/cases/[caseId]/codes/page.tsx:71`, `app/bureau/admin/support/page.tsx:114`) wrap in `overflow-x-auto`. Good.
- Tap targets on the navbar mobile drawer (`Navbar.tsx:114-163`) use `px-3 py-3` minimum — ≥ 44px tap area assuming default font sizing.
- The bureau dashboard "Delete account" link (`app/bureau/page.tsx:129-134`) uses `text-xs` plus `px-3 py-1.5`. ~30px tall — likely below the 44px Apple/Android guideline. Worth a viewport-test confirmation.
- Mobile drawer doesn't include Sign in / Create account links for unsigned-in users — only "Access Bureau" which routes through /login. Users browsing on mobile who want to register have no direct path from the navbar; they have to reach the login page first then click "Create account." Minor.

These are flagged as "needs viewport testing" rather than firm findings — see *What I did NOT audit*.

---

### K. Copy clarity in critical moments

#### [P1] UX-08 — Case-serial format is inconsistent across surfaces (catalog vs workspace vs dashboard)

**Category:** K.

**Location:**
- `app/cases/page.tsx:77` — public catalog uses `BL-001`, `BL-002`, ... by `createdAt`-ordered list index.
- `app/bureau/page.tsx:222` — bureau dashboard uses `BL-CASE-001`, `BL-CASE-002`, ... by user's owned-cases list index.
- `app/bureau/cases/[slug]/page.tsx:206` and `app/bureau/cases/[slug]/debrief/page.tsx:38` — workspace + debrief use `BL-` + slug-derived 8-char fingerprint, e.g. `BL-ALDERSTR`.
- `components/cases/CasePublicView.tsx:90` — every public case page renders `BL-001 / Standalone Investigation` (covered separately by UX-03).

**What:** The same case appears as **four different "serials"** depending on which page the user is on. The catalog reads "BL-001"; the dashboard reads "BL-CASE-001"; the workspace reads "BL-ALDERSTR"; the case detail page reads "BL-001" (hardcoded for all cases). A user who learns the case as "BL-001" in the catalog and then sees "BL-ALDERSTR" in the workspace doesn't know they're looking at the same thing.

**Evidence:**

Catalog:
```ts
// app/cases/page.tsx:77
const serial = "BL-" + String(index + 1).padStart(3, "0");
```

Dashboard:
```ts
// app/bureau/page.tsx:222
BL-CASE-{String(index + 1).padStart(3, "0")}
```

Workspace + Debrief:
```ts
// app/bureau/cases/[slug]/page.tsx:206
const caseSerial = "BL-" + slug.toUpperCase().replace(/-/g, "").slice(0, 8);
```

Hardcoded everywhere `CasePublicView` mounts (per UX-03).

**Why a user notices:** Once more than one case exists, a user opens their bureau dashboard, sees "BL-CASE-001" and "BL-CASE-002", clicks into one, sees "BL-ALDERSTR" — they assume the system mislabeled or that they navigated to the wrong file.

Worse: the indexes are list-position-based. If a user owns three cases (A, B, C) and then refunds B, the active list shrinks from 3 to 2. C used to be `BL-CASE-003`; now it's `BL-CASE-002`. The serial silently shifts beneath the user.

**Remediation:** Pick one serial format and use it everywhere. Recommend `BL-${String(caseFile.id).padStart(3, "0")}` (stable, sortable, never shifts, derived from immutable DB id). Replace the three formats with this single derivation. Also fix `CasePublicView.tsx:90` to consume this rather than hardcoding `BL-001` (covered by UX-03).

**Effort estimate:** S (≈30 lines: one helper + four call-site replacements + dropping the slug fingerprint code).

---

#### [P1] (Already listed as UX-13 — account deletion silent redirect — Category I+K)

#### [P2] UX-20 — `PublishCaseButton` success message reads "Moved to PUBLISHED." (raw enum) instead of the human label

**Category:** K.

**Location:** `components/admin/PublishCaseButton.tsx:66`.

**What:** After a successful workflow transition, the button's status message uses the enum value directly: `setMessage(\`Moved to ${action.target}.\`)`. The same page (`app/bureau/admin/cases/page.tsx:112`) renders the workflow status using `WORKFLOW_STATUS_LABEL[caseFile.workflowStatus]` — proper label text. The post-action message disagrees with the rest of the UI.

**Evidence:**
```ts
// components/admin/PublishCaseButton.tsx:66
setMessage(`Moved to ${action.target}.`);  // -> "Moved to PUBLISHED."
```
```ts
// app/bureau/admin/cases/page.tsx:112
{WORKFLOW_STATUS_LABEL[caseFile.workflowStatus]}  // -> "Published" or "In Review"
```

**Why a user notices:** Admin-only — but visible repetition of raw enums in user-facing copy looks unfinished.

**Remediation:** Import `WORKFLOW_STATUS_LABEL` and use `setMessage(\`Moved to ${WORKFLOW_STATUS_LABEL[action.target]}.\`)`.

**Effort estimate:** XS (2 lines).

---

#### [P2] UX-21 — `RegisterForm` partial-success path styles "Account created!" message in red error-text

**Category:** K.

**Location:** `components/auth/RegisterForm.tsx:62-70`, `:131-138`.

**What:** When account creation succeeds but auto sign-in fails (rare NextAuth hiccup), the form sets `status: "error"` and `message: "Account created! Please sign in to continue."` The conditional message styling (`:131-138`) uses red text whenever `status === "error"`. The user reads "Account created! Please sign in to continue." in alarming red, suggesting failure even though the account was created.

**Evidence:**
```tsx
// components/auth/RegisterForm.tsx:63-70
if (!result || result.error) {
  setStatus("error");
  setMessage("Account created! Please sign in to continue.");
  return;
}
```
```tsx
// :131-138
<p
  className={`text-sm ${
    status === "error" ? "text-red-400" : "text-emerald-400"
  }`}
>
  {message}
</p>
```

**Why a user notices:** Rare path, but when it triggers the user is told their action failed (red) while the copy claims success. This contradiction looks like a bug.

**Remediation:** Add a `"partial"` status with neutral or amber styling, or split the message into a "Account created" (green) line + an "Please sign in to continue" (neutral) line + an explicit `<Link href="/login">` CTA.

**Effort estimate:** XS (≈8 lines).

---

#### [P2] UX-23 — `/account/delete` page omits `AccessCodeRedemption` from its description of cascaded data

**Category:** K.

**Location:** `app/account/delete/page.tsx:23-29`.

**What:** The page lists what will be deleted: "all of your owned cases, theory submissions, and checkpoint attempts." Per `app/api/me/route.ts:74-92`, the schema cascades also drop `AccessCodeRedemption` rows and stamp `revokedAt` on the user's claimed activation codes (and SetNull on `claimedByUserId`). The user-facing copy is incomplete relative to the actual server behavior.

**Evidence:**
```tsx
// app/account/delete/page.tsx:23-29
<p>
  This permanently deletes your Black Ledger account, all of your
  owned cases, theory submissions, and checkpoint attempts. Your
  purchase records (Order history) are retained for tax and
  accounting purposes per our Privacy Policy &sect;8. Activation
  codes you have redeemed will be unowned and cannot be re-used.
</p>
```
```ts
// app/api/me/route.ts:74-92 (server cascade summary)
//   User → UserCase (cascade)
//   User → TheorySubmission (cascade)
//   User → CheckpointAttempt (cascade)
//   User → AccessCodeRedemption (cascade)        ← NOT in page copy
//   User → ActivationCode.claimedByUserId (SetNull)
// ALSO: tx.activationCode.updateMany revokedAt set on all claimed codes
```

**Why a user notices:** A privacy-conscious user comparing the page to the Privacy Policy's "all personal data" promise might notice the omission. P2 because the legal commitment is met by the server; the copy just under-describes.

**Remediation:** Insert "redemption history" into the list: "owned cases, theory submissions, checkpoint attempts, and access-code redemption history." Also clarify the activation-code language: "Activation codes you redeemed are revoked at the same time, so they cannot be used by another account."

**Effort estimate:** XS (1 sentence).

---

#### [P3] UX-24 — `BuyButton` discards entered email when the user clicks Cancel and then re-opens the form

**Category:** K (also G: state preservation).

**Location:** `components/bureau/BuyButton.tsx:73-78`.

**What:** Clicking "Cancel" while the email-entry form is open resets `step: "closed"`, `status: "idle"`, and `error: ""` — but does **not** reset `email`. However, when the user re-clicks "Get the kit", the form re-mounts in the same render tree (it's the same component, only the `step` flag changes). Because `email` state is preserved in the component, this should be fine — the email persists. Verify in test? Actually re-reading: `BuyButton.tsx:64-78`'s Cancel handler doesn't clear the email. So **the email is preserved** across cancel→reopen. **Not a bug.** Marking this finding as withdrawn after re-verification.

**Withdrawn — verified the email state is intentionally preserved.**

(Leaving the finding stub here as audit transparency: this was flagged then verified as not-a-bug during the synthesis pass.)

---

## PHASE 3 — SYNTHESIS

### Findings dashboard

| ID | Sev | Cat | Title | Location | Effort |
|----|-----|-----|-------|----------|--------|
| UX-01 | P0 | A,F | UnlockForm hidden_evidence renders "no longer available" | `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx:5-207` | XS |
| UX-02 | P1 | A | /checkout/success "Payment confirmed" without sessionId | `app/checkout/success/page.tsx:11-66` | S |
| UX-03 | P1 | A | CasePublicView hardcoded `BL-001` on every case page | `components/cases/CasePublicView.tsx:88-91` | S |
| UX-04 | P1 | A,K | Owned case still shows "Order Investigation Kit" CTA | `components/cases/CasePublicView.tsx:165-186` | S |
| UX-05 | P2 | A | Owned case still shows "Already purchased? Sign in..." line | `components/cases/CasePublicView.tsx:189-197` | XS |
| UX-06 | P1 | G,H | TheorySubmissionForm missing `router.refresh()` | `components/bureau/TheorySubmissionForm.tsx:55-63` | XS |
| UX-07 | P1 | G | GenerateActivationCodeButton doesn't show generated code | `components/admin/GenerateActivationCodeButton.tsx:34-35` | XS |
| UX-08 | P1 | K | Inconsistent case-serial format across catalog/dashboard/workspace | multiple | S |
| UX-09 | P1 | C | Bureau dashboard active list contains refunded cases unflagged | `app/bureau/page.tsx:45-46,202-264` | S |
| UX-10 | P1 | C | Refunded user retains full debrief access | `app/bureau/cases/[slug]/debrief/page.tsx:21-30` | S |
| UX-11 | P1 | C,A | heroImageUrl + portraitUrl are dead pipes (no consumer) | multiple | M |
| UX-12 | P1 | A | "Showing 10 of N" literal N in search results | `components/bureau/GlobalPeopleSearchTerminal.tsx:147-150` | XS |
| UX-13 | P1 | I,K | Account deletion silent redirect — no confirmation | `components/auth/DeleteAccountForm.tsx:45` | S |
| UX-14 | P1 | I | Login page hardcodes `/cases/alder-street-review` | `app/login/page.tsx:30-32` | XS |
| UX-15 | P1 | B | redeemAccessCodeSchema is case-sensitive (inconsistent) | `lib/validators.ts:271-273` | XS |
| UX-16 | P2 | C | Refund banner missing on case database page | `app/bureau/cases/[slug]/database/page.tsx:25-45` | XS |
| UX-17 | P2 | C | Refund banner missing on record-detail page | `app/bureau/cases/[slug]/records/[recordId]/page.tsx:30-42` | XS |
| UX-19 | P2 | G | Waitlist/Support forms allow accidental double-submit | `components/forms/WaitlistForm.tsx:33-35`, `SupportForm.tsx:38-44` | S |
| UX-20 | P2 | K | PublishCaseButton message uses raw enum strings | `components/admin/PublishCaseButton.tsx:66` | XS |
| UX-21 | P2 | K | RegisterForm "Account created!" partial-success colored red | `components/auth/RegisterForm.tsx:67-70,131-138` | XS |
| UX-22 | P2 | D | Admin tab Remove buttons have no confirmation | 4 tab files | XS |
| UX-23 | P2 | K | Account-delete copy omits AccessCodeRedemption | `app/account/delete/page.tsx:23-29` | XS |
| UX-25 | P2 | A | Forgot-password page promises send unconditionally | `app/forgot-password/page.tsx:19` | XS |
| UX-26 | P2 | A | FAQ Q4 hardcodes Case 001 timing as global content | `data/site.ts:104-108` | XS |
| UX-28 | P3 | A | `data/site.ts` heroTitle is dead code | `data/site.ts:30` | XS |
| UX-29 | P3 | A | Featured-case identity hardcoded in site config | `data/site.ts:9-19` | S |
| UX-30 | P3 | B | Theory motive min-10 too lenient | `lib/validators.ts:71-75` | XS |
| UX-34 | P3 | G | Admin cases page has no empty state | `app/bureau/admin/cases/page.tsx:62-156` | XS |
| UX-35 | P3 | H | Admin tab dirty-state has no visible indicator | `_components/Tabs.tsx:55-66` | M |

29 net-new findings (UX-24 withdrawn during verification). Severity totals: P0=1, P1=13, P2=10, P3=5.

---

### Top 10 dogfooder priorities

The 10 findings that, fixed in a single small batch, would most improve the perception of polish — ordered by impact-per-fix-cost:

1. **UX-01** (P0, XS) — Fix UnlockForm hidden_evidence rendering. Highest-stakes finding: a visibly broken redemption flow on the central physical→digital path the product sells.
2. **UX-12** (P1, XS) — Replace literal "N" with real copy in `GlobalPeopleSearchTerminal`. One-line fix, removes the most "broken-looking" copy on the site.
3. **UX-06** (P1, XS) — Add `router.refresh()` to `TheorySubmissionForm`. Two-line fix that makes the climactic "I solved it" moment work the way users expect.
4. **UX-14** (P1, XS) — Replace login-page hardcoded slug with `/cases`. Two-line fix; removes the highest-traffic 404 risk.
5. **UX-15** (P1, XS) — Add `.toUpperCase()` to `redeemAccessCodeSchema`. Two-line fix; matches existing activation-code behavior.
6. **UX-04 + UX-05** (P1+P2, S+XS) — Replace owned-case "Order Investigation Kit" CTA + helper line with an "In Your Bureau / Open Workspace" panel. A buyer revisiting their own case page sees correct state.
7. **UX-08** (P1, S) — Single-format case serial used everywhere. ~30 lines, removes the "is this the same case?" confusion the moment a second case ships.
8. **UX-03** (P1, S) — Stop hardcoding `BL-001` in `CasePublicView`. Folds into UX-08; together they fix every serial inconsistency.
9. **UX-09 + UX-10** (P1+P1, S+S) — Refund visibility on dashboard + debrief. Closes both the UX gap (refunded case looks active) and the soft revenue leak (solve→refund→retain solution).
10. **UX-13** (P1, S) — Add a post-deletion confirmation page or banner. Closes the most consequential "did anything just happen?" moment in the entire app.

This batch is **roughly 4–6 hours of supervised work**. Every entry is XS or S. UX-11 (image consumers) and UX-35 (dirty-state indicator) are deferred to later batches because they're M effort.

---

### Quick-wins list (XS or S effort, ordered by impact-per-minute)

1. **UX-12** (XS) — Replace "N" placeholder. ~1 minute.
2. **UX-06** (XS) — Add `router.refresh()` to TheorySubmissionForm. ~2 minutes.
3. **UX-15** (XS) — Add `.toUpperCase()` to redeemAccessCodeSchema. ~2 minutes.
4. **UX-14** (XS) — Replace hardcoded `/cases/alder-street-review` link with `/cases`. ~2 minutes.
5. **UX-01** (XS) — Add hidden_evidence branch to UnlockForm. ~10 minutes.
6. **UX-25** (XS) — Reword forgot-password page copy. ~1 minute.
7. **UX-26** (XS) — Generalize FAQ Q4. ~1 minute.
8. **UX-22** (XS) — Wrap 4 admin Remove buttons in `confirm()`. ~5 minutes.
9. **UX-21** (XS) — Add a `"partial"` status in RegisterForm. ~5 minutes.
10. **UX-20** (XS) — Use `WORKFLOW_STATUS_LABEL` in PublishCaseButton message. ~2 minutes.
11. **UX-23** (XS) — Add AccessCodeRedemption to delete-account page copy. ~1 minute.
12. **UX-30** (XS) — Bump theory motive min-10 → min-30. ~1 minute (verify tests).
13. **UX-28** (XS) — Delete unused `heroTitle` field. ~1 minute.
14. **UX-34** (XS) — Add empty state to admin cases page. ~5 minutes.
15. **UX-05** (XS) — Hide "Already purchased" helper from owned-case view. ~3 minutes.
16. **UX-07** (XS) — Show generated code in GenerateActivationCodeButton. ~10 minutes.
17. **UX-16** (XS) — Add refund banner to case database page. ~10 minutes.
18. **UX-17** (XS) — Add refund banner to record-detail page. ~10 minutes.
19. **UX-04** (S) — Owned-case CTA replacement. ~30 minutes.
20. **UX-02** (S) — Three-state checkout success page. ~30 minutes.
21. **UX-03** (S) — Pass serial through CasePublicView. ~30 minutes.
22. **UX-08** (S) — Unified case-serial helper. ~30 minutes.
23. **UX-09** (S) — Dashboard refund pill. ~40 minutes.
24. **UX-10** (S) — Debrief refund banner / gate. ~30 minutes.
25. **UX-13** (S) — Account-deletion confirmation page. ~40 minutes.
26. **UX-19** (S) — Terminal thank-you views for waitlist + support. ~40 minutes.
27. **UX-29** (S) — Server-resolved featuredCase. ~40 minutes.

**Total quick-wins**: 27 items, all XS or S. ~7–9 hours of focused work covers everything.

---

### Recommended fix-batch grouping

**Batch 12 — UX polish: core flows (~60–90 min, like Batch 10/11 in shape).** The "would a real user notice?" highest-impact bundle.

Includes: UX-01, UX-06, UX-12, UX-14, UX-15, UX-22, UX-25, UX-26.

These are 8 XS fixes touching distinct files. Each is ≤15 lines of code. They share the property that fixing them visibly improves the user-facing surface in a single supervised session.

**Batch 13 — UX polish: refund + serial coherence (~60–90 min).**

Includes: UX-08 + UX-03 (paired serial fix), UX-09, UX-10, UX-16, UX-17.

Refund visibility and case-serial unification. Two related semantic threads with shared helpers — efficient to ship together.

**Batch 14 — UX polish: messaging & state corrections (~45–75 min).**

Includes: UX-02, UX-04, UX-05, UX-07, UX-13, UX-19, UX-20, UX-21, UX-23.

Copy fixes, owned-case CTA correction, post-action confirmations. Higher copy-touch but each item is scoped tight.

**Deferred to a later batch (M effort or product decision needed):**
- UX-11 (image consumers) — needs design call on hero size, blurhash placeholder behavior, person card layout.
- UX-29 (server-resolved featuredCase) — small architectural change, defer until a 2nd case is genuinely ready.
- UX-30 (theory min-30) — touches existing test suite; bundle with the next theory-evaluation tweak.
- UX-34, UX-35, UX-28 — pure P3 nits; pick up opportunistically.

---

### What I did NOT audit

The audit was static-read of source. The following could not be inspected from this session:

1. **Mobile / responsive viewport behavior.** No live browser, no DevTools. Tap-target sizing, modal scroll containment, tablet breakpoints, mobile keyboard interactions all need a real device or DevTools session. Specifically: `bureau dashboard "Delete account" link sizing` (`app/bureau/page.tsx:129-134`) is below recommended 44px tap target on inspection — needs viewport confirmation.

2. **Animation / motion polish.** Framer Motion presence-and-exit transitions, scroll-driven motion timings, glitch effect on hero — code reads as intentional but only a real visual review confirms quality.

3. **Email template rendering.** Resend sends HTML emails with inline styles. Text quality, dark-mode rendering in Gmail/Outlook, mobile email clients — out of scope for code-only audit.

4. **PDF / printout rendering.** N/A — Black Ledger does not produce server-side PDFs from code I could see, but if there's a print stylesheet for case pages that wasn't found in the file tree, it's not covered.

5. **Color contrast / WCAG AA.** Did not run an axe-core / Lighthouse audit. Multiple `text-zinc-500` / `text-zinc-600` foreground/background combinations on dark backgrounds may fall below 4.5:1 — needs tool verification.

6. **Tab-navigation / keyboard accessibility.** The codebase has skip-link (`app/layout.tsx:32-37`), aria-selected on tabs (`Tabs.tsx:39`), and role-controlled regions — appears solid. But focus traps, focus-visible rings, and screen-reader narration order need a manual keyboard pass.

7. **Real Stripe payment dry-run + post-success email rendering.** Already covered by `scripts/test-stripe-e2e.ts` per CLAUDE.md; not re-run as part of this audit.

8. **First-customer flows post-DKIM.** DNS records aren't published yet (per CLAUDE.md "Pre-launch operational tasks"). Real email deliverability and the post-purchase email's `?activate=` deep link in production cannot be tested until that gates clears.

9. **Cross-browser checks** (Safari iOS, Firefox, mobile Chrome) for `<form>` autoFill, autocomplete, password-manager interactions.

10. **Stress / edge cases in the global people DB search** (`/bureau/database`). Paging, sort stability, accent-folding for non-ASCII names — flagged as "did not exhaustively probe."

These should be closed by external means (real-device testing, axe-core, manual keyboard run) before a launch.

---

### Coverage attestation

Every page listed in Phase 1 of the audit prompt was read in full. Every form listed was read in full. Every layout was read in full. The supporting libraries (`lib/validators.ts`, `lib/auth-helpers.ts`, `middleware.ts`, plus 12 API route files) were verified to confirm or rule out specific findings.

**No page was skipped.** **No form was skipped.** **No layout was skipped.**

Files outside the audit prompt that were also read for evidence cross-check (not exhaustive — only when needed to verify a finding):
- `app/api/access-codes/redeem/route.ts` — for UX-01 server-side type contract.
- `app/api/me/route.ts` — for UX-23 cascade behavior.
- `app/api/forgot-password/route.ts` — for UX-25 always-200 design.
- `app/api/cases/[slug]/theory/route.ts` — for UX-06 server state transition.
- `app/api/checkout/route.ts` — for UX-02 order-state model.
- `app/api/cases/activate/route.ts` — for UX-15 normalization confirmation.
- `app/api/register/route.ts`, `app/api/waitlist/route.ts`, `app/api/support/route.ts` — for UX-19 / UX-21 verification.
- `data/site.ts` — for UX-26, UX-28, UX-29, UX-32.

29 net-new findings; 5 starter examples confirmed in coverage but not re-flagged per audit instructions. Severity distribution: 1 P0, 13 P1, 10 P2, 5 P3.

End of audit.
