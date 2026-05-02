# Black Ledger — God-Mode Audit (2026-05-01)

## 0. Audit metadata

- **Commit SHA:** `dd07e57c416afb065d7866802e580778bb185f97` (`main`, working tree clean)
- **Auditor model:** Claude Opus 4.7 (`claude-opus-4-7`)
- **Wall-clock duration:** ~3 hours
- **Files read in full:** 60+ source files (every API route handler, both auth files, middleware, schema, all 5 migrations, every script, every legal page, every component on the QR/checkout/admin/global-database paths, every prior audit and batch report under `audits/`)
- **Lines read:** ~13,400 (project source) + ~3,200 (prior audit dossiers) + per-file evidence reads
- **Tools used:** `git`, `Glob`, `Grep`, `Read`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm audit --omit=dev`, `npm view`
- **Coverage gaps:** UI primitives under `components/ui/*` and the long admin tab forms (`OverviewTab.tsx`, `PeopleTab.tsx`, etc.) sampled, not read line-by-line. Marketing pages (`/about`, `/faq`, `/how-it-works`, `/cases`) sampled. The 18 test files were inventoried by name and the highest-value ones (stripe, register, unlock-flow) read in part. No live network checks against Stripe, Resend, Vercel, or Neon dashboards.

---

## 1. Executive summary

After three batches of fixes, dependency hardening, JWT invalidation, legal pages, and Stripe consent enforcement, the codebase is in genuinely good shape. The new finding that demands immediate attention is **a single React Server Component → Client Component boundary that ships every case's solution payload (and every GlobalPerson's `internalNotes` field) into the browser RSC payload at `/bureau/database`** — accessible to any signed-in investigator. It defeats the game's core mechanic and leaks fields the prior audits flagged as INTERNAL.

Beyond that, the audit re-confirms the seven open follow-ups already documented in `CLAUDE.md` (BuyButton race, attacker-supplied email recipient, no `charge.refunded` handler, `hidden_evidence` validator gap, `oneTimePerUser`-vs-unique-key contradiction, missing async-payment-failed branch, no `DELETE /api/me`) and adds three smaller new findings: an enumeration leak via `POST /api/register` 409, an enumeration leak via `POST /api/waitlist` 409, and a Privacy/Terms ↔ code drift where the policies promise behavior the code does not enforce.

- **P0 count: 1** (RSC payload leak of solutions + internalNotes)
- **P1 count: 7** (six are open follow-ups whose blast radius widens once Stripe Live opens; one new — Privacy↔code deletion drift)
- **Dominant themes:** (a) RSC payload hygiene — server-fetched data flows into client components without `select`-narrowing; (b) every Stripe outcome the webhook does not handle becomes a customer-support bill once live mode flips; (c) admin endpoints have no rate limit and no per-action audit on revoke/access-code/workflow/support paths.
- **Top 3 launch-blockers:** (1) the RSC payload leak; (2) BuyButton race + no `idempotencyKey`; (3) refund flow has no code path that revokes the issued ActivationCode.

---

## 2. Ground-state snapshot

| Check | Result |
|---|---|
| `npm run build` | **PASS.** Only the documented `middleware → proxy` deprecation notice; no edge-runtime warnings. |
| `npx tsc --noEmit` | **PASS.** Zero output. |
| `npm test` (`vitest run`) | **PASS.** 161 tests / 21 files. 1.13 s. |
| `npm audit --omit=dev` | 8 moderate vulnerabilities; all fixable only via breaking-change downgrades (Next 9.3.3, Prisma 6, Resend 6.1.3). Per `CLAUDE.md` accepted-risk reasoning still holds. |
| Schema vs. migrations | Consistent. 5 migrations apply cleanly: init → add_order → add_order_email_tracking → add_password_reset → add_user_token_version. |
| Build-side notice | `(node) Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.` Emitted by `pg` driver during build/page-data collection. Informational; connections succeed. |

---

## 3. Findings — by severity

### P0 — Launch-blocker / actively exploitable / data-loss risk

#### **P0-1: `/bureau/database` ships every case's solution + GlobalPerson `internalNotes` into the client RSC payload**

- **Location:** `app/bureau/database/page.tsx:14-26` and `:149`; type contract at `components/bureau/GlobalPeopleSearch.tsx:6-37`
- **Category:** §7.2 Authorization / §7.4 Data integrity / §7.13 Compliance
- **Evidence:**

  ```ts
  // app/bureau/database/page.tsx:14-26
  const people = await prisma.globalPerson.findMany({
    include: {
      aliases: true,
      caseAppearances: {
        include: {
          caseFile: true,           // ← unselected → returns ALL CaseFile fields
        },
      },
    },
    orderBy: { bureauId: "asc" },
  });
  ...
  // line 149
  <GlobalPeopleSearch people={people} />
  ```

  ```ts
  // components/bureau/GlobalPeopleSearch.tsx:1
  "use client";
  // The TS type narrows `caseFile` to { title, slug }, but TS types are
  // erased at runtime. The client component receives the JS object as-is.
  ```

  Because `findMany`/`include` returns full scalars, `people[].caseAppearances[].caseFile` carries `solutionSuspect`, `solutionMotive`, `solutionEvidence`, `debriefOverview`, `debriefWhatHappened`, `debriefWhyItWorked`, `debriefClosing` for every linked case (no `workflowStatus` filter — DRAFT and IN_REVIEW cases included). Each `globalPerson` row also carries `internalNotes` (the schema field explicitly named for operator-private content; prior audits flagged `PersonAnalystNote.visibility=INTERNAL` as the sibling of this).

- **Why it's broken:** Next.js serializes the entire JS object passed to a client component into the RSC payload regardless of the destination's TypeScript prop type. The TS narrowing in `PersonSearchItem` is documentation, not data redaction. The page must `select` only the fields the client component renders, or the page must be restructured to do its filtering server-side and pass already-projected DTOs.

- **Reproduction:**
  1. Register an account at `/register` (no admin role required).
  2. Sign in and visit `/bureau/database`.
  3. View source (or Network tab, page document response).
  4. Search the response body for `solutionSuspect` (or any known solution-text token from a published case).
  5. The solution strings appear inline in the encoded RSC payload, alongside `internalNotes`, for every `GlobalPerson` whose `caseAppearances` link to a `CaseFile`.

- **Blast radius:** Any signed-in investigator (the default role on registration) can read the solution suspect, motive, and evidence — and the full debrief — for every case linked through any GlobalPerson, including cases not yet published. The game's core "solve the mystery" mechanic is bypassable with View-Source. Operator-private `internalNotes` for every person in the global database is also exposed.

- **Suggested remediation:** Tighten the Prisma `select` on the page to the exact projection the client component needs (`bureauId, firstName, lastName, fullName, dateOfBirth, knownLocation, status, personType, classification, riskLevel, relevanceLevel, profileSummary, gender, accessLevel, sourceReliability, confidenceLevel, watchlistFlag, aliases.alias, caseAppearances.role, caseAppearances.caseFile.title, caseAppearances.caseFile.slug`). Drop `internalNotes` and the entire scalar bag of `caseFile` from what crosses the server→client boundary.

- **Confidence:** **High.** Verified against current source. The exact same pattern (`include: { caseFile: true }` returning to a server component for direct rendering only) is used safely in `app/bureau/people/[personId]/page.tsx` because *that* page renders fields itself and never passes the object to a client component — confirming the boundary is the issue, not the include.

---

### P1 — High-impact, ship-blocker before real customer money

#### **P1-1: BuyButton double-charge race / no Stripe `idempotencyKey` on session creation**

- **Location:** `app/api/checkout/route.ts:60-115`; client side `components/bureau/BuyButton.tsx:15-36`
- **Category:** §7.3 Payment & money handling
- **Evidence:**

  ```ts
  // app/api/checkout/route.ts:60-67
  const existingOrder = await prisma.order.findFirst({
    where: { caseFileId: caseId, email: { equals: email, mode: "insensitive" }, status: "COMPLETE" },
    select: { id: true },
  });
  if (existingOrder) { return 409; }
  // ... no PENDING-order check, no Stripe idempotencyKey
  // line 81
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    consent_collection: { terms_of_service: "required" },
    metadata: { caseId: String(caseId), email },
    success_url: ..., cancel_url: ...,
  });   // ← no { idempotencyKey } passed
  ```

  Per `CLAUDE.md` open-follow-ups list: "BuyButton double-charge race / no Stripe `idempotencyKey`. Two concurrent `/api/checkout` POSTs both pass the COMPLETE-only guard, both create Stripe sessions, both can be paid → double charge." Status: deferred to Batch 4.

- **Why it's broken:** The duplicate-purchase guard reads `Order(status: COMPLETE)` only. On the very first checkout for a `(caseId, email)` pair (every kit's first sale), there is no COMPLETE order — both tabs sail through. Two Stripe sessions are created. If the buyer pays both, two charges land for the same kit. No `idempotencyKey` is passed to `checkout.sessions.create`, so Stripe-side dedup is also off.

- **Reproduction:** From the UI, double-click "Continue to checkout" while the network is slow; or from a script, fire two near-simultaneous `POST /api/checkout` requests with identical body. Two `session.id`s come back, two `Order(status: PENDING)` rows get written.

- **Blast radius:** Real-money correctness bug. Will most likely fire on the first paying customer of every new kit. Two charges, two activation codes minted on payment, manual refund + revoke required by the operator.

- **Suggested remediation:** Pass `idempotencyKey: \`checkout-${caseId}-${email}-${truncatedTimestamp}\`` to `checkout.sessions.create`, and add a 15-minute PENDING-Order lookup that returns the existing session URL when one exists.

- **Confidence:** **High.**

#### **P1-2: Refund flow has no `charge.refunded` handler and no `Order.userId` link — refunded customers keep entitlement**

- **Location:** `app/api/webhooks/stripe/route.ts:60-74` (event switch) and `prisma/schema.prisma:470-484` (`Order` model)
- **Category:** §7.3 Payment & money handling / §7.13 Compliance (Terms of Service §7 makes specific promises)
- **Evidence:**

  ```ts
  // app/api/webhooks/stripe/route.ts:60-74
  switch (event.type) {
    case "checkout.session.completed":  ...
    case "checkout.session.expired":     ...
    case "payment_intent.payment_failed": ...
    default:
      // Ignore unhandled event types — Stripe will keep delivering...
      break;
  }
  // No "charge.refunded", "charge.dispute.created", or
  // "checkout.session.async_payment_failed" branches.
  ```

  ```prisma
  // prisma/schema.prisma:470-484
  model Order {
    id                  Int             @id @default(autoincrement())
    stripeSessionId     String          @unique
    ...
    email               String
    caseFileId          Int
    activationCodeId    Int?            @unique
    // ← no userId
  }
  ```

  ```tsx
  // app/terms/page.tsx:194-199
  // "You may request a full refund within 7 days of purchase if you have not
  //  redeemed the activation code. Once an activation code is redeemed against
  //  an account, the case file is considered delivered and the sale is final."
  ```

- **Why it's broken:** The Terms commit to a refund flow whose enforcement key is `claimedAt` on `ActivationCode` — but the only thing that knows about an actual Stripe refund is the dashboard / `charge.refunded` event, which the webhook ignores. If a refund happens (manually or via dispute), the `Order` is not marked REFUNDED and the issued `ActivationCode` is not revoked. The buyer keeps access to the case after the money returns. No `userId` on `Order` means there is also no clean way to cascade-revoke any `UserCase` or `AccessCodeRedemption` rows the buyer created post-redemption.

- **Reproduction:** Issue a refund from the Stripe dashboard for a paid order. Confirm via Neon: `Order.status` stays `COMPLETE`, `ActivationCode.revokedAt` stays `null`, `UserCase` (if redeemed) stays intact.

- **Blast radius:** Customer disputes a charge → keeps the case → operator eats the chargeback fee + the case access. Once the catalog grows, this becomes a recurring leak.

- **Suggested remediation:** Add `Order.userId` (link backwards from the `UserCase.userId` derived during activation), subscribe to `charge.refunded` (and `charge.dispute.created`), and inside the handler: mark Order REFUNDED, set ActivationCode.revokedAt, and (optional) delete the UserCase row.

- **Confidence:** **High.**

#### **P1-3: Activation-code email is delivered to attacker-supplied address (Resend abuse / paid spam vector)**

- **Location:** `app/api/checkout/route.ts:81-95` (sets `customer_email` and `metadata.email`); `app/api/webhooks/stripe/route.ts:215-218` (`to: buyerEmail`)
- **Category:** §7.12 Email / §7.3 Payment
- **Evidence:**

  ```ts
  // app/api/checkout/route.ts:84
  customer_email: email,
  ...
  metadata: { caseId: String(caseId), email },
  ```

  ```ts
  // app/api/webhooks/stripe/route.ts:217
  to: buyerEmail,    // pulled from Order.email or session.metadata.email
  ```

  Per `CLAUDE.md` open-follow-ups: "Activation-code email goes to attacker-supplied address." Status: architectural fix needed (require account creation pre-checkout, or token-link delivery).

- **Why it's broken:** Anyone can pay (with their own card or a stolen one) and direct the activation-code email — sent from the verified `theblackledger.app` Resend sender — to any third-party address. Brand-name spam, deliverability hit, eventual Resend account suspension; if cards are stolen, chargebacks plus shipping cost.

- **Reproduction:** Test-mode `POST /api/checkout` with `email = victim@example.com`; pay with `4242 4242 4242 4242`; webhook fires; victim receives a Black Ledger activation-code email they never asked for.

- **Blast radius:** Brand and deliverability. Resend will flag the account on enough complaints. Stripe will eventually flag chargebacks if cards are stolen.

- **Suggested remediation:** Either (a) require a signed-in account before checkout — recipient is the account email (not the form input); or (b) keep guest checkout but deliver the code via a token-link flow where the actual code is only revealed after the recipient proves email control. As an interim, throttle per-recipient (max 3 successful checkouts/hour per destination email) inside the webhook.

- **Confidence:** **High.**

#### **P1-4: `hidden_evidence` AccessCode unreachable from admin API**

- **Location:** `lib/validators.ts:275-284` (`createAccessCodeSchema.unlocksTarget.type`); consumers `app/api/access-codes/redeem/route.ts:33-38` and `app/bureau/cases/[slug]/page.tsx:66-80`
- **Category:** §7.4 Data integrity / §7.16 Code-quality contradiction
- **Evidence:**

  ```ts
  // lib/validators.ts:278-284
  unlocksTarget: z.object({
    type: z.enum(["record", "person", "hint"]),  // ← excludes "hidden_evidence"
    id: z.number().int().positive(),
  }),
  ```

  ```ts
  // app/api/access-codes/redeem/route.ts:33-38
  if (target?.type === "hidden_evidence") {
    const hiddenEvidence = await prisma.hiddenEvidence.findUnique({ where: { id: target.id } });
    return { type: "hidden_evidence", hiddenEvidence };
  }
  ```

- **Why it's broken:** The redeem route, the workspace renderer (`RevealedEvidence.tsx:114-131`), and the `HiddenEvidence` Prisma model are all wired for `type === "hidden_evidence"`, but the admin POST validator rejects it. An admin cannot create such a code through the API; only direct DB writes work. The `app/api/admin/cases/[caseId]/access-codes/route.ts:62-81` cross-case ownership check also has no `hidden_evidence` branch — meaning even after the validator is opened, the ownership check would silently say `targetExists = false`.

- **Reproduction:** `POST /api/admin/cases/<id>/access-codes` with `{ unlocksTarget: { type: "hidden_evidence", id: 1 } }`; gets 422 from Zod; nothing reaches the handler.

- **Blast radius:** Half-shipped feature; physical-to-digital reveal cannot use the `HiddenEvidence` model that exists in the schema for the case it was designed for.

- **Suggested remediation:** Extend the enum to `["record", "person", "hint", "hidden_evidence"]` and add the matching ownership check (`prisma.hiddenEvidence.findUnique({ where: { id }, select: { caseFileId: true } })`).

- **Confidence:** **High.**

#### **P1-5: `payment_intent.payment_failed` cannot find an Order; no `checkout.session.async_payment_failed` branch**

- **Location:** `app/api/webhooks/stripe/route.ts:284-294`
- **Category:** §7.3 Payment & money handling / §7.14 Reliability
- **Evidence:**

  ```ts
  // app/api/webhooks/stripe/route.ts:284-294
  async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
    const order = await prisma.order.findFirst({
      where: { stripePaymentIntent: intent.id },  // ← only set in success path
      select: { id: true, status: true },
    });
    if (!order || order.status === OrderStatus.COMPLETE) return;
    ...
  }
  ```

  `Order.stripePaymentIntent` is written only inside `handleCheckoutCompleted`'s `$transaction` (line 194). A `PENDING` order never has it. So when an async-payment fails (the typical cause of late-rejected payments), the handler silently no-ops.

- **Why it's broken:** Per `CLAUDE.md`: "Subscribe to `checkout.session.async_payment_failed` instead, which carries the session id you already index." Today, payment failures leave `Order(status: PENDING)` rows accumulating forever, with no cleanup cron.

- **Reproduction:** Trigger an async-failure card (e.g. delayed bank transfer with a known-failure routing) in test mode; the corresponding `Order` row stays PENDING.

- **Blast radius:** Operator inbox fills with "stuck PENDING" support tickets; eventually a manual SQL cleanup is required.

- **Suggested remediation:** Subscribe to `checkout.session.async_payment_failed` and `checkout.session.async_payment_succeeded` in the Stripe dashboard; add the matching switch branches that look up Order by `session.id`.

- **Confidence:** **High.**

#### **P1-6: `AccessCodeRedemption` unique key makes `oneTimePerUser=false` a no-op (functional contradiction)**

- **Location:** `prisma/schema.prisma:446-457` and `app/api/access-codes/redeem/route.ts:117-161`
- **Category:** §7.4 Data integrity
- **Evidence:**

  ```prisma
  // prisma/schema.prisma:446-457
  model AccessCodeRedemption {
    ...
    @@unique([accessCodeId, userId])  // ← unconditional
  }
  ```

  ```ts
  // redeem/route.ts:134-161 — non-oneTimePerUser branch
  try {
    await prisma.accessCodeRedemption.create({ data: { accessCodeId, userId, caseFileId } });
  } catch (error) {
    if (maybe.code === "P2002") {
      // Returns alreadyRedeemed: true — same shape as the oneTimePerUser branch.
    }
  }
  ```

- **Why it's broken:** The flag `AccessCode.oneTimePerUser` (`schema.prisma:440`) only switches *which code path* sets `alreadyRedeemed: true` — the unconditional unique constraint enforces single-redemption regardless. Per the verification report `audits/2026-04-27-verification.md:60-64`: "Net effect: observable behavior is identical regardless of flag value. Multiple redemption rows for `(accessCodeId, userId)` cannot exist. The flag is functionally a no-op." Status remains open per `CLAUDE.md`.

- **Reproduction:** Create an AccessCode with `oneTimePerUser: false`; redeem it as user A twice; the second response is `alreadyRedeemed: true` and only one row exists in `AccessCodeRedemption`.

- **Blast radius:** Confused contract; one of two design intents is not honored. Either the UI promise of "scan again to re-reveal" is broken, or the DB constraint should be removed.

- **Suggested remediation:** Product call. Either drop `oneTimePerUser` and rely on the constraint, or replace `@@unique([accessCodeId, userId])` with a non-unique index and let `oneTimePerUser=true` enforce single-redemption in code only.

- **Confidence:** **High.**

#### **P1-7: Privacy Policy promises GDPR/PDPL deletion that has no implementation in code**

- **Location:** `app/privacy/page.tsx:318-323` and `:339` (deletion promise); no matching endpoint anywhere under `app/api/` (verified via the file listing in §0)
- **Category:** §7.13 Compliance / §7.14 Reliability
- **Evidence:**

  ```tsx
  // app/privacy/page.tsx:318-323
  // "When you request account deletion, we will delete all personal data we
  //  hold about you, except where retention is required by law."

  // app/privacy/page.tsx:339
  // "request deletion of your data (subject to legal retention requirements)"
  ```

  No `DELETE /api/me`, `DELETE /api/users/[id]`, or admin-side deletion endpoint exists; `CLAUDE.md` open-follow-up "No account-deletion flow (GDPR/CCPA)." confirms — but the audit framing is the *contradiction* between the policy and the code.

- **Why it's broken:** A user emails `support@theblackledger.app` asking for deletion under Georgia's PDPL or GDPR. The operator has no automated way to fulfill it; manual SQL is required against Neon. The 30-day response window in §9 of the policy is plausible to miss, and a single complaint to the Personal Data Protection Service of Georgia (which the policy itself names as the supervisory authority) becomes a regulatory exposure.

- **Reproduction:** Code-search proof: there is no route under `app/api/me*` or `app/api/users*`; `Grep` for `prisma.user.delete` returns zero hits in route handlers.

- **Blast radius:** Compliance & reputational — the policy makes a promise the platform cannot fulfill at the speed it commits to. The cascades exist at the schema level (`User → UserCase`, `User → ActivationCode.claimedByUserId SET NULL`, etc.), so the engineering work is small; the gap is binding the policy to an implementation.

- **Suggested remediation:** Add a `DELETE /api/me` route gated by a recent-password-reauth (or a one-time confirmation token sent to the account email) that calls `prisma.user.delete({ where: { id }})`; the existing schema cascades handle the rest. Document retention exceptions (financial records ~6 years, per the policy's §8) explicitly in the deletion confirmation copy.

- **Confidence:** **High.**

---

### P2 — Material, fix in next 1–2 batches

#### **P2-1: Email enumeration via `POST /api/register` 409**

- **Location:** `app/api/register/route.ts:32-42`
- **Category:** §7.11 Rate limiting & abuse
- **Evidence:**

  ```ts
  // app/api/register/route.ts:37-42
  if (existing) {
    return NextResponse.json(
      { message: "An account with this email already exists." },
      { status: 409 }
    );
  }
  ```

  Compare to `app/api/forgot-password/route.ts:38-42` which always returns 200 with a generic message specifically to avoid this signal.

- **Why it's broken:** The route is rate-limited to 3/60s per (ip, route), and the response distinguishes "account exists" (409) from "account does not exist" (201). An attacker rotating IPs (cheap) can map any list of email addresses to "is on Black Ledger?". This contradicts the careful design of `/api/forgot-password` (which goes out of its way to be uniform), `/api/checkout`'s recently-generalized 409 message, and the spirit of "no enumeration" the codebase otherwise demonstrates.

- **Reproduction:** `POST /api/register {email: "alice@example.com", password:"x".repeat(8)}` from one IP; if 409, the email exists; if 201 + a side-effect of account creation, the email did not.

- **Blast radius:** Per-customer privacy regression. Bigger as the user base grows and more "is X on Black Ledger" probes become useful for personalized phishing.

- **Suggested remediation:** Make registration uniform: always return 200 with a generic "If your email is not yet registered, we've created your account; check your inbox to verify." Send an email-of-record on every attempt (the existing-account version says "Someone tried to create an account with your email; if it was you, you're already registered."). Or, accept the trade-off and document that enumeration is intentional UX. Either is defensible; the current state — visible enumeration without acknowledgement — is not.

- **Confidence:** **High.**

#### **P2-2: Email enumeration via `POST /api/waitlist` 409**

- **Location:** `app/api/waitlist/route.ts:42-46`
- **Category:** §7.11 Rate limiting & abuse
- **Evidence:**

  ```ts
  // app/api/waitlist/route.ts:42-46
  if (maybeError.code === "P2002") {
    return NextResponse.json(
      { message: "That email is already on the waitlist." },
      { status: 409 }
    );
  }
  ```

- **Why it's broken:** `WaitlistEntry.email` is `@unique` (`schema.prisma:281`). The handler turns the unique-violation into a leaky 409 message. Rate-limited 3/60s per IP. Same enumeration vector as P2-1 but one level milder (waitlist vs. registered account).

- **Blast radius:** Privacy of waitlist members. Low today since waitlist is small / not yet promoted.

- **Suggested remediation:** Always return 201 with the same generic "You're on the waitlist." message regardless of duplicate status. The duplicate is silently absorbed.

- **Confidence:** **High.**

#### **P2-3: Stripe webhook does not record processed `event.id` for cross-delivery idempotency**

- **Location:** `app/api/webhooks/stripe/route.ts:86-202`
- **Category:** §7.3 Payment / §7.5 Concurrency, races, idempotency
- **Evidence:**

  ```ts
  // line 87-90
  const existingOrder = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
    include: { caseFile: { select: { id: true, slug: true, title: true } } },
  });
  // Idempotency: webhook re-delivery after a successful run is a no-op.
  if (existingOrder?.status === OrderStatus.COMPLETE) { return; }
  ```

  No table records `event.id` as "already processed."

- **Why it's broken:** The `Order.status === COMPLETE` check is the only idempotency primitive. It works for the typical "Stripe re-delivers the same event 5 minutes later" case (because the first run set status to COMPLETE). It does *not* work for two near-simultaneous deliveries of the same event before the first transaction commits — both would see `status !== COMPLETE`, both enter `handleCheckoutCompleted`, both mint a fresh `ActivationCode` inside their transaction. The second tx fails on the `Order(stripeSessionId)` unique-create branch (in the orphan-recovery path) or on the `Order(activationCodeId)` unique-update branch. It rolls back; Stripe re-delivers; second time succeeds. Net effect: one extra ActivationCode in the wallet on the second tx's failure (no, that one rolls back too — *all* writes inside the tx unwind). So no real-world ActivationCode leak; only wasted work and a transient 500 to Stripe.

- **Why it's still worth filing:** "It works because the transaction rolls back" is fragile reasoning. A future change that splits the mint outside the tx, or changes the orphan-recovery path, could re-introduce a duplicate ActivationCode. A `processed_stripe_event(event.id)` write inside the same tx makes the invariant explicit.

- **Blast radius:** Today: zero (transient log noise). Tomorrow: one careless refactor away from issuing two activation codes for one purchase.

- **Suggested remediation:** Add `model ProcessedStripeEvent { id String @id }` and write `tx.processedStripeEvent.create({ data: { id: event.id }})` inside the same `$transaction` as the ActivationCode mint. The unique-id collision becomes the idempotency gate.

- **Confidence:** **Medium-high** (correctness today, fragility tomorrow).

#### **P2-4: Webhook does not validate `event.account` / `event.livemode` against expected**

- **Location:** `app/api/webhooks/stripe/route.ts:46-55`
- **Category:** §7.3 Payment / §7.7 Secrets & configuration
- **Evidence:** No reference to `event.account` or `event.livemode` exists in the file (`Grep` confirms zero matches).
- **Why it's broken:** If the webhook secret leaks (or is shared between test and live in dashboard misconfiguration), the handler will accept events from the wrong Stripe account / mode. The prior audits flagged this as P2/P3.
- **Blast radius:** Today: zero (sandbox-only). After Stripe Live activation: an attacker who somehow obtained the webhook secret could forge low-stakes test-mode events (or vice versa) to mint codes.
- **Suggested remediation:** `if (event.livemode !== (process.env.NODE_ENV === "production")) throw ...` and `if (event.account && event.account !== process.env.STRIPE_ACCOUNT_ID) throw ...`. Defense in depth.
- **Confidence:** **High.**

#### **P2-5: Admin mutation routes lack rate limits**

- **Location:** All admin-mutation routes except `app/api/admin/uploads/sign/route.ts`, `.../uploads/blurhash/route.ts`, `.../cases/[caseId]/codes/route.ts` (POST), and `.../cases/[caseId]/activation-codes/route.ts`. Specifically the unrate-limited endpoints (verified):
  - `app/api/admin/cases/route.ts` (POST create)
  - `app/api/admin/cases/[caseId]/route.ts` (PUT/GET legacy aggregate)
  - `app/api/admin/cases/[caseId]/{overview,people,records,hints,checkpoints,solution}/route.ts` (PATCH)
  - `app/api/admin/cases/[caseId]/workflow/route.ts` (PATCH)
  - `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts` (PATCH revoke)
  - `app/api/admin/cases/[caseId]/access-codes/route.ts` (GET/POST)
  - `app/api/admin/support/[id]/{reply,status}/route.ts`
- **Category:** §7.11 Rate limiting & abuse
- **Why it's broken:** Defense in depth. A leaked / phished admin token (today, only one admin exists) could be used to mass-revoke activation codes, mass-create AccessCodes, mass-archive cases, or burn through Resend quota via support replies. There is no per-account or per-route ceiling.
- **Blast radius:** Bounded by `requireAdmin()` — needs a valid ADMIN session. Once that's acquired, no rate brake.
- **Suggested remediation:** Add a generic admin-mutation rate limit (e.g. 60/60s per (ip, route)) by either decorating the helper or wrapping `requireAdmin()`. The pattern from `uploads/sign` is the template.
- **Confidence:** **High.**

#### **P2-6: Slug update inside transactions has no `P2002` catch on concurrent admin edits**

- **Location:** `app/api/admin/cases/[caseId]/route.ts:404-476` (legacy aggregate PUT) and `app/api/admin/cases/[caseId]/overview/route.ts:76-102` (per-section PATCH)
- **Category:** §7.4 Data integrity / §7.5 Concurrency
- **Evidence:** Both routes pre-check `slugConflict` outside the transaction; the actual `tx.caseFile.update` inside the transaction has no `P2002` catch. Two concurrent admin saves that both pass the pre-check race; the second one bubbles a `P2002` to the outer `try { ... } catch (error) { console.error; return 500 }`.
- **Why it's broken:** Single-admin product today, so unlikely to fire. Once a second admin (or even a misclick + slow network refresh) is in the picture, the second save sees a 500 instead of a clean 409.
- **Blast radius:** Bad admin UX, not a security issue.
- **Suggested remediation:** Catch `P2002` in the existing outer try-catch and translate to 409 ("Another admin just renamed this slug; reload."). Same mechanical pattern as Batch 2's fix in `app/api/admin/cases/route.ts:57-66`.
- **Confidence:** **High.**

#### **P2-7: Role demotion does not propagate to existing JWT sessions (tokenVersion only bumps on password reset)**

- **Location:** `app/api/reset-password/route.ts:56` (only place that increments `tokenVersion`); `auth.ts:62-77` (session callback compares `tokenVersion` only); no admin role-change endpoint exists, so the operator would do this via direct SQL today
- **Category:** §7.1 Authentication & session
- **Evidence:** `Grep "tokenVersion: { increment"` returns one hit (`reset-password/route.ts:56`). The session callback (`auth.ts:62-72`) compares `tokenVersion` against DB but reads `role` from the JWT (line 75: `session.user.role = token.role`) — so a stale JWT with `role: ADMIN` but a current DB row with `role: INVESTIGATOR` keeps admin until the JWT expires (7 days) or `tokenVersion` is bumped manually.
- **Why it's broken:** The "I think I'm compromised" recovery flow is solid (Batch 3 closed it). The "I'm demoting an admin" flow is not — and the operator would have to know to bump `tokenVersion` alongside the role change. No tooling enforces it.
- **Blast radius:** Hypothetical until a second admin exists. Then a real concern.
- **Suggested remediation:** When a role change endpoint is added, mirror `reset-password/route.ts:56` by bumping `tokenVersion` in the same update.
- **Confidence:** **Medium** (hypothetical; depends on future feature).

#### **P2-8: `/bureau/database` loads every `GlobalPerson` unbounded — performance + larger-than-needed RSC payload**

- **Location:** `app/bureau/database/page.tsx:14-26`
- **Category:** §7.4 Data integrity / §7.14 Reliability (and amplifies the P0-1 leak)
- **Why it's broken:** `findMany` with no `take`, no pagination, and a nested `caseAppearances → caseFile` include. At 1k people × avg 3 case appearances, the RSC payload becomes hundreds of KB even after the P0-1 fix.
- **Blast radius:** Page load latency + bandwidth.
- **Suggested remediation:** Server-side pagination + a real search endpoint. Keep the same UI; make the data fetch incremental.
- **Confidence:** **High.**

#### **P2-9: `runtime = "nodejs"` not pinned on every API route**

- **Location:** Verified via `Grep`: only `app/api/webhooks/stripe/route.ts:9` declares `export const runtime = "nodejs"`. The other 24 API route handlers rely on Next.js's default.
- **Category:** §7.9 Edge / runtime / build
- **Why it's broken:** Per `CLAUDE.md` follow-ups. A future Next or adapter version that introduces an "edge-compatible" preference could silently flip Prisma-using routes to edge and crash at first request.
- **Blast radius:** Latent; zero today.
- **Suggested remediation:** Add the line to every API route. Mechanical, ~24 files.
- **Confidence:** **High.**

#### **P2-10: CSP allows `'unsafe-inline'` and `'unsafe-eval'` in `script-src`**

- **Location:** `next.config.ts:28`
- **Category:** §7.10 CSP & security headers
- **Evidence:** `"script-src 'self' 'unsafe-inline' 'unsafe-eval'"`. Required today by Next.js hydration scripts and Framer Motion runtime.
- **Why it's broken:** Defeats the most useful XSS-blast-radius reduction CSP offers. Open follow-up per `CLAUDE.md`.
- **Suggested remediation:** Move to a nonce-based CSP. Generate per-request nonce in middleware; attach to response header; pass to script tags. Multi-batch effort; defer until other launch-blockers close.
- **Confidence:** **High.**

#### **P2-11: Forgot-password timing leak (response time) and login lookup not constant-time**

- **Location:** `app/api/forgot-password/route.ts:34-53` and `auth.ts:22-33`
- **Category:** §7.11 Rate limiting & abuse / §7.1 Authentication
- **Evidence:** Forgot-password's "user exists" path executes `findUnique + token gen + prisma.user.update + getResend().emails.send` (a Resend round trip — easily 200-400 ms); the "user does not exist" path returns after a single `findUnique` (~10 ms). Login (`auth.ts:22-33`) `return null` immediately for nonexistent emails, vs. `return null` after `bcrypt.compare` (~80-200 ms) for a wrong-password-on-real-user. Both leak email existence by timing.
- **Why it's broken:** Open follow-ups per `CLAUDE.md`.
- **Suggested remediation:** Move the email send out-of-band (e.g. `setImmediate` / Inngest). For login, run a `bcrypt.compare` against a constant fake hash on the not-found path so the per-request CPU is uniform.
- **Confidence:** **High.**

#### **P2-12: `Order` missing index on `(caseFileId, email, status)`**

- **Location:** `prisma/schema.prisma:470-484`
- **Category:** §7.4 Data integrity (performance)
- **Evidence:** `Order.findFirst({ where: { caseFileId, email, status }})` on every checkout (line 60-67 of the checkout route) does a sequential scan as the table grows. Open follow-up per `CLAUDE.md`.
- **Suggested remediation:** Add `@@index([caseFileId, email, status])` and migrate.
- **Confidence:** **High.**

---

### P3 — Code health, deferred-acceptable

(Items below are all real but bounded; I'm intentionally compressing the writeup so the operator can prioritize.)

- **P3-1: `assertSafeEnv` only matches Neon hosts.** `lib/assert-safe-env.ts:16-20`. If the platform migrates off Neon (Supabase, Railway, RDS), the guard is silently disarmed. Open follow-up. Add patterns or replace with an explicit `ALLOW_DESTRUCTIVE=true` env-var gate.
- **P3-2: `unarchive-case.ts` hardcodes `CASE_ID = 3`.** `scripts/unarchive-case.ts:10`. Open follow-up. Take it as a CLI arg.
- **P3-3: `dotenv` loaded at runtime in `lib/prisma.ts:1-3`, `lib/stripe.ts`-via-import, and `prisma.config.ts:3-5`.** Bundles the dotenv module into the production server runtime where Vercel injects env vars natively. ~32 KB of cold-start bloat. Wrap behind `if (process.env.NODE_ENV !== "production")`.
- **P3-4: `tsconfig target ES2017` is dated.** Per `CLAUDE.md`. Bump to ES2022.
- **P3-5: No `engines.node` in `package.json`.** Per `CLAUDE.md`. Pin to the Vercel runtime in use (Node 22 or whatever is current).
- **P3-6: `"We saved your code (${code})..."` copy in `/bureau/unlock` is misleading** (`app/(unlock)/bureau/unlock/page.tsx:39-41`). The code isn't "saved" anywhere — it's interpolated into the callbackUrl on the next anchor. Per `CLAUDE.md`.
- **P3-7: No Sentry / structured logging.** All errors are `console.error` to Vercel logs. Open follow-up.
- **P3-8: No cron / sweeper for stuck PENDING orders, abandoned R2 uploads, or unsent activation-code emails.** Open follow-up.
- **P3-9: `lib/user-case-state.ts:45-47` has dead code for `NOT_STARTED → ACTIVATE → ACTIVE`.** UserCase is created with `status: ACTIVE` (`schema.prisma:167`), so the `NOT_STARTED` branch is unreachable. Cosmetic.
- **P3-10: `next.config.ts:30` lists `https://fonts.gstatic.com` in `font-src` even though `next/font/google` self-hosts the Manrope woff2 files at build time.** Unused source in CSP; tighten to `font-src 'self'`. (Side benefit: Privacy Policy's "no third-party tracking" claim becomes airtight.)
- **P3-11: `pg` driver build-time SECURITY warning** about SSL modes 'prefer'/'require'/'verify-ca' being aliased to 'verify-full'. Informational; connections succeed. The current `.env.example` recommends `sslmode=require` — update to `verify-full` in the docs to silence the warning and make the actual behavior explicit.
- **P3-12: `RevokeButton` still sends a now-ignored `revokedAt` field** — purely cosmetic, server stamps. Per `CLAUDE.md`.
- **P3-13: Pre-existing odd indentation in `app/api/admin/cases/route.ts:37-56`** — `data: { ... }` block dedented two columns. Cosmetic; preserved by Batch 2 to avoid scope-creep.
- **P3-14: Resend DKIM/SPF/DMARC for `theblackledger.app` is unverified.** Operational, not code. Open follow-up.
- **P3-15: `Order.email` is rendered in admin support inbox row** (`app/bureau/admin/support/page.tsx:148`). This is the operator's own inbox; not a leak. Listed only because the path passes PII to a server-rendered page and would warrant masking if support is ever delegated.
- **P3-16: `/api/auth/[...nextauth]` rate limit applies to the catch-all route** including GET (sign-out, callback). Functionally fine — POSTs (sign-in) is the abuse vector — but worth noting that callbacks share the same bucket.

---

## 4. Cross-cutting observations

1. **The RSC server→client boundary is the next class of mistake to guard.** The architecture has converged on RSC + thin client islands. Every place that does `prisma.X.findMany({ include: { Y: true } })` and passes the result to a `"use client"` component is a candidate leak. The TypeScript prop type does **not** filter the JSON. The fix discipline is to `select` exactly what the client renders, or to mint a server-side DTO. P0-1 is the loudest example; consider auditing every `<ClientComponent prop={prismaResult} />` pair as a class.

2. **Webhook surface is the most fragile remaining layer.** `payment_intent.payment_failed` is the wrong event (P1-5); `charge.refunded` and `charge.dispute.created` are unhandled (P1-2); event-id idempotency is implicit (P2-3); livemode/account validation is missing (P2-4). Each is small in isolation; together they make the webhook the system's softest spot once Stripe Live opens.

3. **Privacy/Terms ↔ code drift.** Two of the new (Week 12) commitments — automated deletion (P1-7) and a 7-day-window refund mechanism (P1-2) — are written as platform behaviors but exist only as operator-discretion processes. Either the policies should soften the language ("on request, we will manually delete...") or the code needs an endpoint and a Stripe-event handler.

4. **Enumeration is treated as a per-route choice instead of a policy.** `/api/forgot-password` is uniform-200; `/api/register` (P2-1) and `/api/waitlist` (P2-2) leak via 409. Pick a stance and apply it everywhere.

5. **Admin endpoints are the only major surface without rate limits.** Public POSTs are well-defended (16 routes); admin POSTs/PATCHes have nothing. Single-admin product today, but defense-in-depth is cheap.

---

## 5. What I checked and did NOT find a meaningful issue in

- **§7.1 Authentication & session.** Bcrypt 12, JWT invalidation via `tokenVersion` works as designed, `pickPostLoginPath` covers protocol-relative + `javascript:` + cross-origin via `URL().origin` round-trip. Stale-JWT `auth()` returns `{ ...session, user: undefined }` and `Navbar` correctly guards on `session?.user` (post-Batch-3 fix verified). One residual gap (P2-7) noted.
- **§7.2 Authorization (IDOR).** Every `/api/admin/*` handler calls `requireAdmin()` *first* (verified via `Grep guard\.user\.` + visual scan of every route). Player routes (`activate`, `theory`, `checkpoint`, `redeem`) all use `requireSessionJson()` and validate ownership via `userCase.findFirst`. No mass-assignment patterns (no `data: { ...body }` spreads). The bureau database leak (P0-1) is RSC payload exposure, not a missing guard.
- **§7.3 Payment & money handling.** Webhook signature verification is correct, idempotency works for the typical case, orphan recovery is in place, success path is in a transaction. Outstanding items captured in P1-1, P1-2, P1-5, P2-3, P2-4.
- **§7.4 Data integrity.** Schema + 5 migrations consistent. Cascades reviewed (`User → UserCase` cascade, `User → ActivationCode SET NULL` is correct, `CaseAudit.userId RESTRICT` prevents orphan audit rows). One inconsistency captured at P1-6 (`oneTimePerUser` vs unique key).
- **§7.5 Concurrency, races, idempotency.** Checkpoint advance uses `updateMany` with currentStage precondition (verified). Theory submission has SOLVED early-return. Activation route has `claimedByUserId IS NULL` precondition. P2002 on `caseFile.create` is caught (Batch 2). Outstanding items: BuyButton race (P1-1), webhook event-id (P2-3), slug update P2002 (P2-6).
- **§7.6 Input validation & sanitization.** Zod everywhere; `.safeParse()` consistently. `dangerouslySetInnerHTML` confirmed nowhere. Resend HTML emails route every interpolation through `escapeHtml` (verified in webhook + support reply). Image upload MIME allowlist tightened to jpeg/png/webp/gif. SSRF guard on blurhash.
- **§7.7 Secrets & configuration.** `.env.example` complete. No `NEXT_PUBLIC_*` leaks anything secret. `assertSafeEnv` covers all destructive scripts post-Batch-1. Stripe `apiVersion` pinned. One narrow concern at P3-1.
- **§7.8 Dependencies & supply chain.** `npm audit` reasoning still holds; `lucide-react ^1.8.0` *is* a real package (latest 1.14.0; this codebase is on an older 1.x branch — bump available, no security issue). `@prisma/dev` only flows in dev. No unused deps spotted.
- **§7.9 Edge / runtime / build.** Build clean post-Batch-3 split. Suspense around `useSearchParams` checked at `/login`, `/register`, `/reset-password`, `/bureau` (CaseActivationForm). One outstanding item: P2-9 (runtime not pinned on every route).
- **§7.10 CSP & security headers.** HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all set. `frame-ancestors 'none'` is the load-bearing clickjacking control (X-Frame-Options is redundant but harmless). Outstanding: P2-10 (script-src unsafe), P3-10 (font-src cleanup).
- **§7.11 Rate limiting & abuse.** 16 public POST endpoints rate-limited. Outstanding: P2-1, P2-2 enumeration; P2-5 admin coverage gap.
- **§7.12 Email.** Resend usage clean; HTML templates escape user input. One outstanding architectural item at P1-3. DKIM/SPF/DMARC pending (P3-14).
- **§7.13 Compliance & legal.** Privacy + Terms now exist; both well-structured. Two policy↔code drifts at P1-2 and P1-7.
- **§7.14 Reliability & operability.** Order.emailSentAt/emailLastError tracking exists. No cron / Sentry; outstanding (P3-7, P3-8). Migration rollback safety: every migration is additive (`ADD COLUMN`); no destructive DDL.
- **§7.15 UX traps.** "We saved your code" copy is the known one (P3-6). The "Processing" branch on `/checkout/success` does not poll — user has to manually refresh. Acceptable.
- **§7.16 Code quality.** `as unknown as` count is 8, all justified. Strict TS clean. One dead-code item (P3-9).
- **§7.17 Cross-cutting / system-level.** Captured in §4 themes.

---

## 6. Coverage gaps & known unknowns

- **UI primitives and the long admin tab forms** (`OverviewTab.tsx`, `PeopleTab.tsx`, `RecordsTab.tsx`, `HintsTab.tsx`, `CheckpointsTab.tsx`, `SolutionTab.tsx`) were not read line-by-line. They wrap the per-section PATCH endpoints I *did* read; the data path is server-validated, so a UI bug here would be a UX issue rather than a security issue, but a careful pass would tighten my confidence.
- **Marketing pages** (`/about`, `/faq`, `/how-it-works`, `/cases`) sampled, not read.
- **Test files** were inventoried (18 files, 161 tests confirmed passing) and the highest-value ones (stripe, register, unlock-flow) read in part. The full set was not graded for assertion quality (e.g. "expect(mock).toHaveBeenCalled()" without input/output assertion).
- **Live verification of the P0-1 RSC leak via `View Source` against the deployed `theblackledger.app`** was not performed (audit is read-only/local). The finding is verified statically against the source; live confirmation is one curl + grep away.
- **No Stripe E2E run against live keys.** `scripts/test-stripe-e2e.ts` exists; not executed.
- **No DNS / Vercel dashboard checks** (DKIM/SPF/DMARC, env-var parity, custom domain config). Operational, not code.
- **No live load test or concurrency test** for the BuyButton race (P1-1) or the webhook event-id race (P2-3). Both are reproducible by static reading; not by running tests in this audit.
- **Admin role-change scenario (P2-7) is hypothetical** — no role-change endpoint exists today, so the finding is forward-looking.

---

## 7. Recommended fix-batch sequencing

**Batch 4 — same-shape mechanical wins, ship together:**
1. **P0-1** — narrow the `select` on `app/bureau/database/page.tsx`. Single file, 10-line diff. Re-test by visiting `/bureau/database` and confirming `solutionSuspect` is no longer in `View Source`.
2. **P1-4** — extend `createAccessCodeSchema.unlocksTarget.type` enum + add the matching `hidden_evidence` ownership branch in `app/api/admin/cases/[caseId]/access-codes/route.ts`. ~6 lines.
3. **P2-1, P2-2** — make `/api/register` and `/api/waitlist` uniform-200 (or accept enumeration with a docblock). ~4 lines each.
4. **P2-6** — wrap the slug-update inside the legacy PUT and overview PATCH transactions with a `P2002` catch → 409. Mirrors the Batch 2 pattern.
5. **P2-12** — add `@@index([caseFileId, email, status])` on `Order` + a tiny migration.
6. **P3-10, P3-11** — drop `https://fonts.gstatic.com` from `font-src`; update `.env.example` to recommend `sslmode=verify-full`.

**Batch 5 — payment & refund correctness, all-in-one:**
1. **P1-1** — add `idempotencyKey` to `getStripe().checkout.sessions.create` + a 15-minute PENDING-Order lookup short-circuit.
2. **P1-2** — add `Order.userId` (additive migration), subscribe to `charge.refunded` + `charge.dispute.created`, write the handler that marks Order REFUNDED + revokes the ActivationCode.
3. **P1-5** — switch from `payment_intent.payment_failed` to `checkout.session.async_payment_failed` (and add `async_payment_succeeded`).
4. **P2-3** — add `model ProcessedStripeEvent` + write inside the `$transaction`.
5. **P2-4** — add `event.livemode` + `event.account` validation to the webhook entry.
6. **P3-8** — add a Vercel Cron that marks `Order(status: PENDING)` older than 24h as FAILED (companion to P1-5).

**Batch 6 — privacy & deletion plumbing:**
1. **P1-7** — add `DELETE /api/me` with a re-auth gate. Cascades handle the rest.
2. **P1-3** — architectural decision: account-required checkout, or token-link delivery. Discuss before implementing.
3. **P1-6** — product call on `oneTimePerUser`; drop the field or drop the unique constraint.
4. **P2-7** — when a role-change endpoint is added, bump `tokenVersion` in the same update.

**Batch 7 — defense-in-depth + ops:**
1. **P2-5** — admin-mutation rate limiter helper.
2. **P2-9** — add `runtime = "nodejs"` to every API route.
3. **P2-10** — nonce-based CSP migration (multi-batch in itself).
4. **P2-11** — constant-time login + out-of-band forgot-password.
5. **P3-1, P3-2, P3-3, P3-4, P3-5, P3-6, P3-7, P3-12, P3-13, P3-14, P3-15** — sweep.

---

## 8. Appendix

### Commands run (read-only verification)

| Command | Result |
|---|---|
| `git rev-parse HEAD` | `dd07e57c416afb065d7866802e580778bb185f97` |
| `git status` | working tree clean |
| `git log --oneline -50` | recent commits captured for context |
| `git log --since='2026-04-25' --stat` | confirmed Week 11/12 file-change set |
| `npm audit --omit=dev` | 8 moderate vulns; reasoning per `CLAUDE.md` accepted-risk holds |
| `npm view lucide-react@1.8.0 dist-tags` | `latest: '1.14.0'` — package real, just an old branch |
| `npx tsc --noEmit` | clean (exit 0, no output) |
| `npx vitest run` | 21 files / 161 tests passed; 1.13s |
| `npm run build` | passed; only `middleware → proxy` deprecation + `pg` SSL informational warning |
| `Glob '**/*.{ts,tsx,prisma,sql,mjs,cjs,json}'` | 60+ source files inventoried |
| `Grep dangerouslySetInnerHTML` | zero matches in app/components |
| `Grep 'rateLimit\\('` | 16 endpoint files use the rate limiter |
| `Grep 'runtime\\s*=\\s*[\"\\']nodejs[\"\\']' app/` | one match (`/api/webhooks/stripe`) |
| `Grep 'analytics\\|gtag\\|posthog\\|mixpanel\\|segment\\|amplitude'` | zero in `components/`; two in `app/` (false positives — `analytics: false` in rate-limit, a CSS class match) |
| `Grep 'session\\.user!\\|session!\\.user'` | zero non-null-assertions on session (good — `session?.user` style throughout) |

### File-size distribution (files > 300 lines, source code only)

| Lines | Path |
|---|---|
| 800 | `app/bureau/people/[personId]/page.tsx` |
| ~640 | `app/bureau/cases/[slug]/page.tsx` |
| 545 | `components/bureau/GlobalPeopleSearch.tsx` |
| 491 | `app/api/admin/cases/[caseId]/route.ts` (legacy aggregate PUT) |
| 452 | `tests/api/stripe.test.ts` |
| 448 | `tests/api/register.test.ts` |
| 436 | `app/privacy/page.tsx` |
| 430 | `tests/api/admin-section-patches.test.ts` |
| 407 | `app/terms/page.tsx` |
| 365 | `app/bureau/page.tsx` |
| 320 | `app/api/webhooks/stripe/route.ts` |
| 306 | `tests/routes/unlock-flow.test.ts` |

The two big admin/page files (`people/[personId]/page.tsx` and the legacy aggregate PUT) are the highest-cost-to-audit-safely files in the codebase.

### TODO/FIXME/HACK comments

All matches are in seed templates (`prisma/seed/cases/harbor-fog.ts`, `scripts/new-case.ts`) and serve as placeholder fields for the operator to fill before running the seed. There are no in-code TODOs requesting follow-up — the operator's open-follow-ups list lives in `CLAUDE.md` and `audits/BATCH_*_OBSERVATIONS.md`, not in inline comments. Clean.

---

End of audit. No source code modified. No migrations executed. No commits or pushes.
