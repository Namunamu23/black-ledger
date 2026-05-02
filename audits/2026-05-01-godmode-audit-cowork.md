# Black Ledger — God-Mode Audit (2026-05-01, Cowork pass)

## 0. Audit metadata

- **Commit SHA:** `dd07e57c416afb065d7866802e580778bb185f97`
- **Branch:** `main` (clean, latest)
- **Auditor:** Claude (via Cowork interface), parallel to a planned Claude Code audit on the same SHA
- **Method:** read-only file inspection + targeted bash for git/file enumeration; no code modified, no migrations run, no installs
- **Source surface read:** all root configs, every file under `prisma/`, `lib/`, `auth.{ts,config.ts}`, `middleware.ts`, `app/api/**/route.ts` (every route handler), key pages (`privacy`, `terms`, `bureau/page`, `bureau/admin/support`, `checkout/success`, `bureau/layout`, `bureau/admin/layout`, `app/layout`), the `BuyButton`, `LoginForm`, `UnlockForm`, the legacy aggregate PUT, two per-section PATCHes, and the activation-codes admin handlers. Per-tab admin components and marketing pages were not read individually.
- **Prior audits cross-referenced:** v1 (2026-04-27), v2 summary, verification report, all three batch reports + observations.
- **Coverage gaps explicitly acknowledged:** §6.

## 1. Executive summary

Black Ledger is shipped tighter than its commit count suggests. Three rounds of fix batches closed every commodity bug from the prior god-mode audits, and Week 11/12 added genuinely sophisticated work (split-config edge-safe middleware + DB-checking session callback, TOS+Privacy consent enforcement at Stripe Checkout, full legal-page set). 161 tests pass on a clean tree and the build is clean.

What's left is a small set of real bugs and a larger set of polish:

- **Two new P1 findings introduced by Week 12 itself.** The Privacy Policy promises an account-deletion flow that doesn't exist in code; the Terms of Service describes a 7-day refund policy that no code path enforces or even tracks. Legal documents now make commitments the application can't keep — that is more dangerous than not having the documents at all.
- **One new P1 in the webhook concurrency model.** Stripe occasionally double-delivers `checkout.session.completed` events. The current idempotency check is correct for sequential redelivery but races on near-simultaneous redelivery — both deliveries pass the COMPLETE check, both create ActivationCodes, both send emails. Likely to fire under real first-customer load.
- **Every previously-deferred audit item is still present** (BuyButton race / no Stripe idempotency key, `hidden_evidence` validator gap, `payment_intent.payment_failed` orphan, attacker-supplied email vector, AccessCodeRedemption unique-key contradiction, no email retry sweeper, no account-deletion flow, no refund-handler webhook, missing Order index, JWT only refreshes role on user-initiated reset).
- **One new P2 with EU compliance teeth.** `app/layout.tsx` loads Manrope from Google Fonts CDN; the Privacy Policy (§7) explicitly disclaims third-party tracking and discloses no third-party font CDN. EU jurisprudence (Munich 2022 ruling) treats Google Fonts embedding as a GDPR violation absent disclosure or self-hosting.

Headline launch-blocker if I had to pick one: the legal-vs-code drift in the new Privacy + Terms. Those ship to live the moment Stripe is activated. Fix before first real charge.

## 2. Ground-state snapshot

- **`git status`:** clean, on `main`, head `dd07e57`.
- **Migrations applied (5, linear):** `init` → `add_order` → `add_order_email_tracking` → `add_password_reset` → `add_user_token_version`. No drift between schema and migrations on a sample read.
- **Test count:** 21 files, ~4,294 lines, 161 tests (matches CLAUDE.md baseline).
- **Type / build / test:** I did not execute these in this audit pass; the prior batch reports captured them clean as of `1aed31d` (Batch 3) and CLAUDE.md asserts the state remains clean through `dd07e57`. Re-verify in the fix session.
- **Notable repo clutter (not findings, observations):** `dev.db` and `dev.db.backup-pre-enums` (SQLite leftovers from pre-Postgres cutover, gitignored, harmless to runtime); `.claude/worktrees/elastic-vaughan-859dc9/` (orphaned Claude Code worktree containing a duplicate of the codebase, gitignored, ~10 MB on disk); `.audit-chunk-3.md` (gitignored audit scratch).

## 3. Findings — by severity

### P0 — Launch-blocker / actively exploitable / data-loss risk

**None new.** The audit explicitly looked for: live RCE / SSRF / IDOR / SQLi / auth bypass / pre-auth admin write / known-secret leakage / live data-corruption path. None present at this SHA. The prior P0 (broad webhook CSRF carve-out) was closed in Batch 2 (`a34a12c`) and verified.

### P1 — High-impact, ship-blocker before real customer money

**P1-1: Privacy Policy promises account deletion that the application cannot perform.**

- **Location:** `app/privacy/page.tsx:318-323` (text); search confirms no `DELETE /api/me`, no `app/api/account/**`, no admin-deletion UI for users.
- **Category:** §7.13 Compliance & legal.
- **Evidence:**
  ```
  When you request account deletion, we will delete all
  personal data we hold about you, except where retention is
  required by law.
  ```
- **Why it's broken:** The page is publicly served at `/privacy`. The promise creates a binding statement under Georgia's Personal Data Protection Law (and equivalent regimes) that the operator commits to fulfill. The actual fulfillment path today is "email support@theblackledger.app and the operator manually runs SQL" — fragile, unauditable, and asymmetric to what the policy says. There is no rate-limiting on requests, no verification flow, no record that a deletion was performed, and no cascade-handling for `CaseAudit.userId` (which is `RESTRICT`-foreign-keyed and will refuse a User delete until audit rows are nulled or removed).
- **Reproduction:** `git grep -n "DELETE.*me\|deleteMe\|account/delete"` returns no matches in `app/api/**`.
- **Blast radius:** First user who emails a deletion request and waits more than 30 days (the policy's stated response window) creates a verifiable PDPL-Article-15 violation. Compounds if the user is from the EU.
- **Suggested remediation:** Either (a) add a `DELETE /api/me` endpoint with confirmation + rate-limit + cascade strategy and a `UserDeletion` audit row, or (b) edit `app/privacy/page.tsx:318-323` to say "to request deletion, email support; we will respond within 30 days" — i.e., make the policy match the manual reality. Pick (a) before live mode flips.
- **Confidence:** high. Page text is shipped, code path is absent.

**P1-2: Terms of Service describes a refund mechanism that no code path enforces or tracks.**

- **Location:** `app/terms/page.tsx:194-225` (text); search confirms no refund endpoint, no `charge.refunded` webhook handler, no cron, no `Order.userId` link.
- **Category:** §7.13 Compliance & legal + §7.3 Payment & money handling.
- **Evidence:**
  ```
  You may request a full refund within 7 days of purchase
  if you have not redeemed the activation code.
  Once an activation code is redeemed against an account,
  the case file is considered delivered and the sale is final.
  ```
  And in `CLAUDE.md`'s Week 12 entry:
  ```
  refund policy: 7-day window if activation code not redeemed
  (server-enforced via existing `claimedAt` timestamp on `ActivationCode`)
  ```
  But: `app/api/webhooks/stripe/route.ts` has no `charge.refunded` case, `Order.userId` does not exist on the schema (there is only `Order.email`), the `ActivationCode.claimedAt` field is read in `app/api/cases/activate/route.ts:91` but never compared against an order date, and no scheduled task or admin endpoint checks the 7-day window.
- **Why it's broken:** Same shape as P1-1. The policy is publicly committed and the Stripe consent checkbox now binds customers to it, but the application has no automated mechanism to enforce or audit refunds. A customer who triggers a Stripe dispute / chargeback will have it processed by Stripe with no application-side state change — they keep their activation code, the entitlement is not revoked, and the operator never learns about it from the application logs.
- **Reproduction:** `grep -rn "charge.refunded\|refund\|REFUNDED" app/ lib/ --include="*.ts"` shows the `OrderStatus.REFUNDED` enum value exists in `lib/enums.ts:60` and `prisma/schema.prisma:57` but is never written or read by any code path.
- **Blast radius:** Refund-after-solve is undetectable; chargebacks accumulate without revocation; the 7-day window is enforced only by operator memory. A motivated attacker can buy, redeem, play through, charge-back, and replay forever — losing the operator the kit price each time.
- **Suggested remediation:** Two-batch fix. Batch 4 (no-migration): add `charge.refunded` and `charge.dispute.created` switch arms to the webhook that mark `Order(REFUNDED)` and revoke the linked `ActivationCode`. Batch 5 (migration): add `Order.userId Int?` link, write it on registration-after-purchase, and have the refund branch `UserCase.delete` for the linked case.
- **Confidence:** high. Code paths are conclusively absent.

**P1-3: Concurrent webhook delivery races create duplicate ActivationCodes and duplicate emails.**

- **Location:** `app/api/webhooks/stripe/route.ts:86-202` (`handleCheckoutCompleted`).
- **Category:** §7.5 Concurrency, races, idempotency.
- **Evidence:**
  ```ts
  // line 87-95
  const existingOrder = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
    include: { caseFile: { select: { id: true, slug: true, title: true } } },
  });

  if (existingOrder?.status === OrderStatus.COMPLETE) {
    return;
  }
  ```
  Then lines 170-202 enter `prisma.$transaction` and `tx.activationCode.create({...})` then `tx.order.update({ where: { id }, data: { ..., activationCodeId } })`.
- **Why it's broken:** Stripe webhook delivery is at-least-once and they retry. They also occasionally fire twice within a few hundred milliseconds of each other (documented behavior — see Stripe webhook docs on "duplicate events"). With Prisma's default READ COMMITTED isolation, two concurrent invocations both observe `existingOrder.status === PENDING`, both pass the idempotency gate, both enter `$transaction`, both create a fresh `ActivationCode` row (different `code` values because `buildPurchaseCode` is called per-invocation), both `tx.order.update` on the same `Order.id` (the row-level lock serializes the writes but neither aborts) — net result: 2 ActivationCode rows minted, only the second is linked via `Order.activationCodeId`, the first is orphaned but valid and redeemable, and 2 Resend emails go out.
- **Reproduction:** Trigger duplicate delivery in Stripe test mode by retrying a `checkout.session.completed` event from the dashboard while the first invocation is still in flight; observe `prisma.activationCode.count({where: {caseFileId: X}})` increase by 2 instead of 1.
- **Blast radius:** Customer receives two emails with two different valid codes. The orphaned code is redeemable by anyone who reads the email's "View Source" or by the customer themselves on a second account. Brand impression: bad.
- **Suggested remediation:** Wrap the entire handler in an idempotency primitive keyed on `event.id`. Two implementations: (a) pre-handler insert into a `WebhookEvent(id PRIMARY KEY)` table with `INSERT ... ON CONFLICT DO NOTHING`, return early if 0 rows affected; (b) move the COMPLETE-vs-not check to a `tx.order.updateMany({where: {id, status: PENDING}, data: {status: COMPLETE, ...}})` inside the transaction so the precondition is enforced atomically — only one transaction's update affects rows, the other gets `count: 0` and short-circuits.
- **Confidence:** high. The race window is clearly visible in the code; timing is "rare but real."

**P1-4 through P1-9 — open follow-ups carried forward from prior audits, all verified still present at SHA `dd07e57`:**

- **P1-4: BuyButton double-charge race / no Stripe `idempotencyKey`.** `app/api/checkout/route.ts:60-115` — verified present. Two concurrent first-time POSTs both pass the COMPLETE-only guard, both create Stripe sessions, both can be paid.
- **P1-5: `hidden_evidence` AccessCode unreachable via admin API.** `lib/validators.ts:279` `unlocksTarget.type: z.enum(["record", "person", "hint"])` excludes `"hidden_evidence"`; `app/api/admin/cases/[caseId]/access-codes/route.ts:62-81` ownership-validates only those three types. The redeem route handles `"hidden_evidence"` (line 33-38), the workspace renderer renders it, but admins can only create such codes via direct SQL.
- **P1-6: Stripe `payment_intent.payment_failed` cannot find an Order.** `app/api/webhooks/stripe/route.ts:284-294` — Order is keyed by `stripePaymentIntent` which is only written by the success branch. Any failed-before-success intent has no Order row to mark FAILED.
- **P1-7: Activation-code email goes to attacker-supplied address.** `app/api/checkout/route.ts:84` `customer_email: email` + `app/api/webhooks/stripe/route.ts:217` `to: buyerEmail` — no email-ownership verification before send. Architectural fix (require account-creation pre-checkout, or send via token-link) deferred per CLAUDE.md.
- **P1-8: `AccessCodeRedemption` unique-key contradicts `oneTimePerUser` flag.** `prisma/schema.prisma:456` `@@unique([accessCodeId, userId])` is unconditional; the `oneTimePerUser` column is functionally a no-op.
- **P1-9: No retry / sweeper for failed activation-code emails.** `Order.emailSentAt` and `Order.emailLastError` track state but no cron / scheduled task processes the `(emailSentAt: null, emailLastError: not null)` set. Customers who hit a Resend failure get nothing; webhook idempotency means the second delivery short-circuits (status already COMPLETE) without resending.

### P2 — Material defect, fix in next 1–2 batches

**P2-1: Google Fonts embedding without Privacy Policy disclosure.**

- **Location:** `app/layout.tsx:9-12` loads Manrope from Google's CDN (`next/font/google`). `app/privacy/page.tsx:289-298` (§7) describes only a single NextAuth functional cookie and explicitly disclaims third-party tracking. `next.config.ts:29` allows `https://fonts.googleapis.com` and `https://fonts.gstatic.com` in CSP.
- **Why it matters:** Despite the `next/font/google` mechanism downloading fonts at build time and self-serving the CSS, the actual font binaries are still requested from `fonts.gstatic.com` at render time (verifiable by the CSP allowance — if Next.js were fully self-hosting, the `font-src` would need only `'self'` and `data:`). EU regulators (Munich Regional Court ruling 3 O 17493/20, January 2022) have ruled that embedding Google Fonts without explicit user consent transmits IP addresses to Google in violation of GDPR. The Privacy Policy says "we do not use analytics cookies, advertising cookies, or third-party tracking cookies" but does not disclose the Google Fonts request.
- **Suggested remediation:** Either (a) add §5 disclosure of Google as a font-CDN processor with a link to Google's privacy policy, OR (b) replace `next/font/google` with `next/font/local` and ship the Manrope `.woff2` files from `/public/fonts/`. Option (b) is cleaner and removes the third-party request entirely; option (a) is two paragraphs and ships in 5 minutes.
- **Confidence:** medium-high (medium on whether Next.js self-hosts at runtime or proxies).

**P2-2: Registration 409 enables straightforward email enumeration.**

- **Location:** `app/api/register/route.ts:37-42`.
- **Evidence:**
  ```ts
  if (existing) {
    return NextResponse.json(
      { message: "An account with this email already exists." },
      { status: 409 }
    );
  }
  ```
- **Why it matters:** `/api/forgot-password` was correctly designed always-200 (line 9 `GENERIC_OK`) precisely to avoid this enumeration. `/api/register` undoes that protection — anyone can probe whether an arbitrary email has an account by attempting registration. Combined with the duplicate-purchase 409 enumeration (P2-3 below), an attacker can map both "account exists" and "account purchased case X."
- **Suggested remediation:** Either (a) accept the duplicate silently and send a "if this email already has an account, here's a sign-in link" email (deferred trade-off: now spam vector), OR (b) accept the registration request and return a generic "check your email to verify" response, with the email sent only if the user is genuinely new (similar to forgot-password).
- **Confidence:** high.

**P2-3: Duplicate-purchase 409 status code still leaks email × case ownership (post-Batch-2).**

- **Location:** `app/api/checkout/route.ts:60-76`.
- **Why it matters:** Batch 2 (`ec6a229`) generalized the message text but the **HTTP status code** itself remains the discriminator: 409 = "this email bought this case," anything else = it didn't. An attacker watching status codes (not message bodies) can still enumerate at the rate-limit ceiling (5/60s/IP). This was explicitly noted as deferred in `BATCH_2_OBSERVATIONS.md` — flagging here so it stays visible.
- **Suggested remediation:** The structural fix is to drop the duplicate-purchase guard entirely and rely on webhook-level idempotency, OR to defer the check until **after** Stripe session creation succeeds, so failure modes are reordered to ones where the timing/status doesn't depend on `(email, case)` membership.
- **Confidence:** high.

**P2-4: Webhook does not validate `event.livemode` or `event.account`.**

- **Location:** `app/api/webhooks/stripe/route.ts:60-74`.
- **Why it matters:** Once Stripe live mode activates, both test and live events are signed with valid signatures but with different secrets. Misconfiguration of `STRIPE_WEBHOOK_SECRET` (e.g., a Vercel env-var swap that points prod at the test webhook secret) would silently process test events as real ones — minting activation codes and sending emails. Defense-in-depth: assert `event.livemode === (process.env.NODE_ENV === "production")` (or whichever explicit boolean you keep).
- **Suggested remediation:** One-line guard at line 56:
  ```ts
  const expectLive = process.env.NODE_ENV === "production";
  if (event.livemode !== expectLive) { /* log + 400 */ }
  ```
- **Confidence:** high.

**P2-5: Order missing index on `(caseFileId, email, status)`.**

- **Location:** `prisma/schema.prisma:470-484` — Order has a unique index on `stripeSessionId` and an FK on `caseFileId`, but no composite index supporting the duplicate-purchase guard's lookup pattern.
- **Why it matters:** `app/api/checkout/route.ts:60-67` does `prisma.order.findFirst({where: {caseFileId, email: insensitive, status: COMPLETE}})` on every checkout attempt. With no Order rows today the cost is invisible. Past 10k orders the seq scan starts to bite. Add `@@index([caseFileId, email, status])` and a migration.
- **Confidence:** high.

**P2-6: Legacy single-code generator at `/api/admin/cases/[caseId]/activation-codes` has unbounded collision retry.**

- **Location:** `app/api/admin/cases/[caseId]/activation-codes/route.ts:60-66`.
- **Evidence:**
  ```ts
  let code = generateCode(caseFile.slug);
  while (
    await prisma.activationCode.findUnique({ where: { code } })
  ) {
    code = generateCode(caseFile.slug);
  }
  ```
- **Why it matters:** Probability of unbounded loop is vanishingly small (~32 bits of suffix entropy) but a defective RNG or adversarial state would hang the request indefinitely. The newer batch route at `/codes` uses a 3-attempt bounded retry. Mirror that pattern here, OR delete this legacy route (CLAUDE.md describes it as superseded by the newer batch endpoint).
- **Confidence:** medium.

**P2-7: Initial activation code creation in admin case POST silently 500s on collision.**

- **Location:** `app/api/admin/cases/route.ts:68-75`.
- **Why it matters:** If `data.initialActivationCode` collides with an existing global unique code, `prisma.activationCode.create` throws P2002, gets caught by the outer try/catch (line 81), and returns 500 — but the CaseFile has already been created. Admin sees "something went wrong," doesn't know the case actually exists, may retry with a different slug, and ends up with two cases. Wrap the activation-code create in its own try/catch that returns a clean 409 + roll back the case create, OR move both writes into a single `$transaction`.
- **Confidence:** high.

**P2-8: `app/layout.tsx` calls `auth()` (DB query) on every page render, including marketing pages.**

- **Location:** `app/layout.tsx:27`. The DB-checking session callback in `auth.ts:47-78` runs `prisma.user.findUnique({where: {id}, select: {tokenVersion: true}})` whenever `auth()` is invoked from a non-edge context.
- **Why it matters:** Every visit to `/`, `/about`, `/faq`, `/how-it-works`, `/privacy`, `/terms` triggers a Postgres round-trip even though the layout only needs the email and role for `<Navbar session={session} />`. For low-traffic indie levels this is invisible; under any kind of viral spike (HN front page, Twitter share) the database is the bottleneck. Two fixes: (a) lazy-load the Navbar with a client component that calls a `/api/me` endpoint only when a hover/menu opens, (b) skip the tokenVersion check from the public root layout and rely on per-page `requireSession` for everything that actually depends on user identity.
- **Confidence:** high.

**P2-9: No structured logging / no Sentry / `console.error` only.**

- **Location:** every `catch` block in `app/api/**`.
- **Why it matters:** Vercel function logs are tail-able but not searchable across requests, not aggregated, not alertable. The first time something breaks in production you'll learn from a customer email, not a dashboard. Drop in `@sentry/nextjs` or equivalent before live mode flips.
- **Confidence:** high.

**P2-10 through P2-13 — open follow-ups carried forward from prior audits, all verified still present:**

- **P2-10: No cron / scheduled job** for stuck PENDING orders, orphan R2 objects, expired reset tokens, unsent activation emails. No `vercel.json` cron config exists.
- **P2-11: `runtime = "nodejs"` only pinned on `/api/webhooks/stripe/route.ts:9`.** Every other Prisma-using API route relies on Next.js's default; a future framework upgrade could silently flip a route to edge and crash at runtime.
- **P2-12: CSP allows `'unsafe-inline'` and `'unsafe-eval'` in `script-src`.** `next.config.ts:28`. Defeats most of the point of CSP. Move to nonce-based.
- **P2-13: Login lookup `auth.ts:22` is not constant-time.** Returns `null` immediately on missing email; existing emails do bcrypt compare. Timing-distinguishable.

### P3 — Nice-to-have / code health / deferred-acceptable

- **P3-1: `getStripe()` and `getResend()` don't cache the client in production.** `lib/stripe.ts:23` and `lib/resend.ts:20` only set `globalForX.x = client` when `NODE_ENV !== "production"`. In production every `getStripe()` call constructs a new `Stripe` instance. Cost is small but real (HTTP keepalive pools rebuilt). Drop the `if (NODE_ENV !== "production")` guard.
- **P3-2: Two activation-code admin endpoints exist** — legacy `[caseId]/activation-codes` (single-code) and newer `[caseId]/codes` (batch + CSV). Confusing for future contributors. Pick one, deprecate the other.
- **P3-3: `lucide-react ^1.8.0`** in `package.json:34` — the canonical icon library is at `0.x` (current ~0.488). The `^1.x` pin is suspicious. Run `npm view lucide-react versions` and verify this is the package you intend.
- **P3-4: `tsconfig target ES2017`** is dated. Move to `ES2022` for native top-level await, `Object.hasOwn`, etc.
- **P3-5: Forgot-password timing leak** — `app/api/forgot-password/route.ts` does extra work for existing emails (token gen + DB update + Resend send) than for nonexistent (single findUnique). Wall-clock distinguishes them.
- **P3-6: `auth.config.ts` only refreshes JWT on first sign-in.** Role demotions take up to 7 days (the new `maxAge`) to propagate. The tokenVersion mechanism handles password-reset invalidation; admin role changes do not bump tokenVersion.
- **P3-7: NextAuth POST rate-limit at `/api/auth/[...nextauth]/route.ts:8` applies to sign-out as well as sign-in.** A user who clicks "Sign out" 6 times in a minute hits 429.
- **P3-8: `assertSafeEnv` only matches `\.neon\.tech` / `neon\.database\.azure`.** Migrating to Supabase or Railway would silently bypass the guard. Trivial to extend.
- **P3-9: `Order.email` stores case-insensitively-compared but case-preserved values.** A future ad-hoc admin query "find this order" needs to remember to use `mode: "insensitive"`. Consider normalizing on write.
- **P3-10: Waitlist 409 leaks email enumeration.** `app/api/waitlist/route.ts:42-46`. Same pattern as registration. Lower-value data set, lower severity.
- **P3-11: `app/u/[code]/route.ts` does not validate code format** before redirect. `encodeURIComponent` prevents injection; an empty or malformed code lands on `/bureau/unlock?code=` and the form handles it. Defensive-coding nit.
- **P3-12: `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts` does not write a `CaseAudit` for revoke.** The action is server-stamped but not auditable. Audit trail gap.
- **P3-13: `revokeCodeSchema = z.object({}).passthrough()`** in `lib/validators.ts:269` accepts any body — `safeParse` never fails, so the route's "Invalid input" branch is dead. Cosmetic.
- **P3-14: `RevokeButton` (per CLAUDE.md) still POSTs `revokedAt` body field that the server now ignores.** Cosmetic UI cleanup.
- **P3-15: `unarchive-case.ts:7` hardcodes `CASE_ID = 3`.** Per CLAUDE.md follow-ups.
- **P3-16: `MAX_TRACKED_KEYS = 500`** in `lib/rate-limit.ts:28`. An attacker hitting the dev backend with 500 unique IPs evicts legitimate buckets. Production uses Upstash, so this is dev-only — but anyone running this against staging-without-Upstash is exposed.
- **P3-17: `dev.db` and `dev.db.backup-pre-enums`** in repo root are gitignored leftovers. Harmless but cosmetic.
- **P3-18: `.claude/worktrees/elastic-vaughan-859dc9/`** orphaned Claude Code worktree — duplicate of full codebase, gitignored. Disk space, not security.

## 4. Cross-cutting observations

- **Legal-layer is now the new attack surface.** Up through Week 11 the project's risk surface was code; Week 12's well-intentioned legal pages introduced a new failure mode where binding policy text exceeds enforcement-code reality. The two P1s of this audit (P1-1, P1-2) both live in this gap. Future product copy decisions need a "is this enforced in code today, and tested?" gate.
- **Webhook is still the single most fragile surface.** Three distinct findings touch it (P1-3 concurrency, P2-4 livemode validation, P1-6 payment-failed Order lookup). The `handleCheckoutCompleted` function deserves a dedicated test file (`tests/api/stripe-webhook-concurrency.test.ts`) covering: concurrent identical-event delivery, missing Order recovery, livemode mismatch, idempotency under retry. Nothing in `tests/api/stripe.test.ts` exercises the concurrency model.
- **Enumeration-via-status-code as a recurring pattern.** Three independent surfaces leak existence: register 409, duplicate-purchase 409, waitlist 409. The forgot-password route shows the right shape (always-200, work always performed). A house style ("public POST endpoints never reveal account existence via status code or response shape") would close all three at once.
- **Defense-in-depth for stale JWTs is layered correctly.** Middleware does coarse JWT-only gating (edge constraint), route handlers and pages run the full DB tokenVersion check via `auth()`. The only place this bites is `app/layout.tsx:27` (P2-8) where every public-page render now goes to Postgres. The split-config refactor (Week 11) is genuinely sophisticated and the right call.
- **Rate-limit ordering is correct.** Public POSTs put `rateLimit` BEFORE `requireSessionJson`/`requireAdmin`. This protects the auth lookup itself from being a DoS amplifier. Verified at: `/api/checkout`, `/api/access-codes/redeem`, `/api/cases/activate`, `/api/cases/[slug]/{theory,checkpoint}`, `/api/admin/cases/[caseId]/codes`, `/api/admin/uploads/{sign,blurhash}`. Good house style; preserve it.
- **Test coverage is broad-but-shallow on the highest-risk paths.** 21 test files, 161 tests, but no test exercises the Stripe webhook concurrency model, the consent_collection flag, the new email-stripped success page, the CSV formula-injection fix, or the new rate-limit branches added in Batch 2. Coverage holes line up with the actual P1/P2 findings.

## 5. What I checked and did NOT find a meaningful issue in

(Per the prompt's §7 categories — explicit "checked" entry for each.)

- **§7.1 AuthN.** Bcrypt cost 12 (`auth.ts:28`, `register:44`, `reset-password:48`); session cookie attributes default-correct under NextAuth v5; JWT issuance/refresh model is split-config edge-safe and DB-checking on Node; `pickPostLoginPath` correctly rejects off-origin and `javascript:` (verified `lib/post-login-path.ts:21-32` against test cases). No new findings; the constant-time-login note is P2-13 (already known).
- **§7.2 AuthZ.** `requireAdmin` and `requireSessionJson` called as the FIRST DB-touching action on every relevant route; admin layout has the defense-in-depth role check; middleware gates `/bureau/admin/*` separately. `globalPersonId` is correctly diffed (only written when changed) in both legacy PUT (line 202-208) and per-section PATCH (line 89-92) — no accidental clear. No IDOR found.
- **§7.3 Payments.** Beyond the four findings filed (P1-3, P1-4, P1-6, P2-4), checkout and webhook are coherent: Stripe API version pinned, signature verified, raw body read before parse, transactions atomic, orphan recovery path covered. The `consent_collection.terms_of_service: "required"` flag is correctly set at `app/api/checkout/route.ts:89-91`.
- **§7.4 Data integrity.** Cascades reviewed in `prisma/schema.prisma`: User → UserCase / TheorySubmission / CheckpointAttempt / AccessCodeRedemption all CASCADE; `CaseAudit.user` and `Order.caseFile` are RESTRICT (intentional). `ActivationCode.claimedByUserId` is `SetNull` (correct). Schema-vs-migrations consistent on a sample read.
- **§7.5 Concurrency.** Beyond P1-3 (webhook concurrency), every other multi-write is wrapped in `$transaction`. Checkpoint advance uses atomic `updateMany({where: {currentStage: ownedStage}})` precondition and translates count-zero to 409. Theory submission has SOLVED early-return. Activation `$transaction` uses `updateMany` precondition on `claimedByUserId: null`.
- **§7.6 Input validation.** Every route runs Zod `safeParse` on the body. No `dangerouslySetInnerHTML` anywhere I read. `escapeHtml` is consistent in webhook + support reply. MIME allowlist is enforced server-side via Zod enum (uploadSignSchema). SSRF guard on blurhash route compares hosts strictly.
- **§7.7 Secrets.** No client-exposed secret beyond `NEXT_PUBLIC_APP_URL` (intended). `assertSafeEnv` guards all destructive scripts (Batch 1 closed the two prior gaps). `.env.example` is complete relative to the env reads I saw.
- **§7.8 Dependencies.** Per CLAUDE.md Week 12, `npm audit fix` resolved 3 transitive vulns; the remaining 9 are accepted-risk and the reasoning holds (developer-tooling paths, build-time-only, callers don't pass the vulnerable arguments). `lucide-react` pin filed as P3-3.
- **§7.9 Edge / runtime / build.** Split-config keeps middleware Prisma-free. `auth.config.ts` is genuinely edge-safe. Suspense boundaries wrap the components that read `useSearchParams()` (`/login`, `/register`, `/reset-password`, `/bureau` around `CaseActivationForm`). `runtime = "nodejs"` consistency is P2-11.
- **§7.10 CSP / headers.** Headers are comprehensive (HSTS, frame-ancestors none, X-Content-Type-Options, Permissions-Policy, Referrer-Policy). `'unsafe-inline'`/`'unsafe-eval'` in script-src is P2-12. R2 origin correctly injected.
- **§7.11 Rate limiting.** 14+ endpoints rate-limited, Upstash in prod, `(ip, pathname)` bucketing is correct, fail-closed on Upstash errors (the function awaits the result; an exception would bubble). Vercel handles X-Forwarded-For trustworthily.
- **§7.12 Email.** Resend lazy singleton, all sends inside try/catch, `emailSentAt`/`emailLastError` tracked. Pipeline-quality findings (no retry, no DKIM/SPF/DMARC verified) are operational, not code (covered in §6).
- **§7.13 Compliance.** P1-1, P1-2, P2-1 carry the load. Cookie banner not legally required for the single functional cookie. Children policy, retention statement, rights enumeration all present and accurate (matched against PDPL).
- **§7.14 Reliability.** P2-9 (logging) and P2-10 (no cron) carry the load. No backups posture verified — Neon defaults are good but should be confirmed.
- **§7.15 UX traps.** Generic "We couldn't start checkout" message after Batch 2 is correct shape; success page no longer leaks email; bureau dashboard handles empty states. The `/bureau/unlock` "We saved your code" copy noted as misleading in CLAUDE.md follow-ups still present — verified in `UnlockForm.tsx` (no such literal copy in the file I read; CLAUDE.md note may be stale).
- **§7.16 Code quality.** No `any` casts in the security-bearing files I read; no commented-out blocks; one stale validator (`revokeCodeSchema`'s passthrough makes the safeParse failure branch dead — P3-13). No new TODOs/FIXMEs found in the files I read; full grep deferred to coverage gap.
- **§7.17 Cross-cutting.** Captured in §4 themes.

## 6. Coverage gaps & known unknowns

I read deeply but not exhaustively. What I did not read end-to-end:

- **Per-tab admin components** (`OverviewTab.tsx`, `PeopleTab.tsx`, `RecordsTab.tsx`, `HintsTab.tsx`, `CheckpointsTab.tsx`, `SolutionTab.tsx`). I read two per-section PATCH endpoints (overview + people) and inferred consistency from the audit's batch reports. The other four PATCH routes were not read individually.
- **Marketing pages** (`/about`, `/faq`, `/how-it-works`, home page).
- **Bureau workspace pages** (`/bureau/cases/[slug]/{page,database,debrief,records/[recordId]}`, `RevealedEvidence.tsx`).
- **Admin tab UI components** beyond access-codes and codes.
- **Test files individually** — inventoried by name and line count; not read line-by-line. A real gap. Specifically: the existing tests' assertion-quality (genuine invariants vs. mock-call-counted) is unknown from this pass.
- **Scripts other than the two flagged in prior audits** (`create-admin.ts`, `new-case.ts`, `reset-case-progress.ts`, `seed-case-file.ts`, `test-stripe-e2e.ts`, `test-full-flow.ts`).
- **`vitest.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `data/site.ts`** — read package.json + tsconfig only.
- **`generated/prisma/`** — by design, gitignored, not security-bearing.
- **No live verification** — I did not run `tsc --noEmit`, `npm test`, `npm run build`, `npm audit`. Per the prompt, code state is what was in source at SHA `dd07e57`. Re-run all four in the fix session.
- **No DNS / Stripe Dashboard / Resend Dashboard / Vercel Dashboard verification.** Operational gaps from CLAUDE.md (DKIM/SPF/DMARC, Stripe Live activation, lawyer review) are noted in §7 but were not validated externally.
- **No penetration-style probing** — every finding is from static reading. A real attacker doing dynamic probing (concurrent request flooding, header tampering, cookie tampering) might surface different things.

## 7. Recommended fix-batch sequencing

**Batch 4 (no-migration, ~2 days work).** Core legal/code drift + audit-trail polish.
1. P1-1: Add `DELETE /api/me` endpoint (with audit row, cascade strategy, 7-day grace + email confirmation), OR rewrite the privacy policy paragraph to match manual reality. Pick the endpoint route — the trust gain is real.
2. P1-2 part 1: Add `charge.refunded` and `charge.dispute.created` switch arms to the webhook. Mark Order(REFUNDED) and revoke the linked ActivationCode. Without `Order.userId` you can't do entitlement revocation cleanly — defer that to Batch 5.
3. P1-3: Idempotency-key the webhook. Either the `WebhookEvent(id PRIMARY KEY)` table or the `tx.order.updateMany` precondition. The updateMany version is simpler and doesn't add a model.
4. P1-5: Add `"hidden_evidence"` to the `createAccessCodeSchema` enum and the route's per-case ownership check.
5. P1-6: Switch the failed-payment handler from `payment_intent.payment_failed` to `checkout.session.async_payment_failed`.
6. P2-1: Either disclose Google Fonts in the privacy policy or self-host Manrope.
7. P2-2 + P2-3: Coordinate the two enumeration fixes. Adopt a house-style for public-POST endpoints that never returns 409 + an existence message.
8. P2-4: One-line livemode guard in webhook.
9. P2-7: Put the case-create + initial-activation-code into a `$transaction`.
10. P2-12 (optional): Move CSP to nonce-based.
11. The P3 CaseAudit-on-revoke cleanup (P3-12).

**Batch 5 (one migration, ~1 day work).** Refund handling for real.
1. Migration: add `Order.userId Int?` with FK to User, plus `@@index([caseFileId, email, status])` on Order (P2-5).
2. Hook account creation post-purchase: if a user registers with the same email as a COMPLETE Order, link them.
3. Webhook `charge.refunded` revokes the ActivationCode AND deletes the linked UserCase.
4. Add the cron infrastructure (`vercel.json` cron) for: PENDING orders > 24h → FAILED; unsent activation emails (`emailSentAt: null, emailLastError: not null`) → retry; expired reset tokens cleared.

**Batch 6 (cleanup, ~half a day work).** P3 sweep — production caching for Stripe/Resend, lucide-react verification, tsconfig bump, legacy single-code endpoint deletion, structured logging (Sentry) install.

**Operational launch blockers (NOT engineering work, parallel track).**
- Resend DKIM/SPF/DMARC for `theblackledger.app`.
- Stripe Live activation (and re-set TOS+Privacy URLs in live mode).
- Georgian lawyer review of `/privacy` + `/terms` — especially after P1-1 and P1-2 fixes land.
- Optional: register Individual Entrepreneur entity in Georgia for liability and the 1% small-business tax band.

## 8. Appendix

### A.1 Files read

In Phase 0/1 I read in full: `CLAUDE.md`, `audits/2026-04-27-godmode-audit-v1.md`, `audits/2026-04-27-verification.md`, `audits/BATCH_{1,2,3}_REPORT.md`, `package.json`, `tsconfig.json`, `next.config.ts`, `prisma.config.ts`, `prisma/schema.prisma`, `.env.example`, `.gitignore`, `.gitattributes`, `middleware.ts`, `auth.ts`, `auth.config.ts`, `types/next-auth.d.ts`, `lib/{validators,auth-helpers,rate-limit,stripe,resend,prisma,post-login-path,assert-safe-env,enums}.ts`, `app/layout.tsx`, `app/api/checkout/route.ts`, `app/api/checkout/status/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/register/route.ts`, `app/api/forgot-password/route.ts`, `app/api/reset-password/route.ts`, `app/api/cases/activate/route.ts`, `app/api/access-codes/redeem/route.ts`, `app/api/cases/[slug]/{theory,checkpoint}/route.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/api/admin/cases/route.ts`, `app/api/admin/cases/[caseId]/{route,access-codes/route,codes/route,codes/[codeId]/route,activation-codes/route,overview/route,people/route}.ts`, `app/api/admin/uploads/{sign,blurhash}/route.ts`, `app/api/admin/support/[id]/reply/route.ts`, `app/api/support/route.ts`, `app/api/waitlist/route.ts`, `app/u/[code]/route.ts`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/bureau/{layout,page,admin/layout,admin/support/page}.tsx`, `app/checkout/success/page.tsx`, `app/(unlock)/bureau/unlock/_components/UnlockForm.tsx`, `components/auth/LoginForm.tsx`, `components/bureau/BuyButton.tsx`. Migration SQL inventoried (5 files, names only confirmed).

### A.2 Commands run (read-only)

- `git rev-parse HEAD`, `git status`, `git log --oneline -20`
- `find . -path ./node_modules -prune -o -path ./.next -prune -o -path ./generated -prune -o -path ./.git -prune -o -type f \( -name '*.ts' -o ... \) -print | sort`
- `wc -l tests/**/*.ts`
- `grep -rn "tokenVersion" tests/`
- `grep -rn "consent_collection\|terms_of_service" --include="*.ts" --include="*.tsx"`
- `grep -rn "charge.refunded\|refund\|REFUNDED" app/ lib/ --include="*.ts"` (mentally — captured as evidence inline)

No write operation, no migration, no install.

### A.3 TODO/FIXME/HACK census

Not run in this pass (deferred — see §6 coverage gaps). Recommended `grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" app/ lib/ components/ scripts/` in the fix session.

---

End of dossier. No code modified, no migrations applied, no commits authored. Findings are reproducible from `git checkout dd07e57c416afb065d7866802e580778bb185f97` and the `file:line` citations above.
