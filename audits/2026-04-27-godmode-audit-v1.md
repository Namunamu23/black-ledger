# BLACK LEDGER — GOD-MODE FULL AUDIT REPORT (v1)

> First god-mode audit pass, run 2026-04-27 against branch `claude/vibrant-cohen-837e20`. Read-only findings. Saved alongside v2 for cross-reference.

---

## PHASE 0 — BOOT REPORT

**Repo size.** ~180 source files across `app/` (pages + API routes), `components/`, `lib/`, `prisma/`, `scripts/`, `tests/`. Working tree clean.

**Stack versions (resolved from `package.json`).**

- Runtime: Node (target ES2017), `runtime = "nodejs"` declared only on the Stripe webhook
- Framework: Next.js `16.2.3`, React `19.2.4`, App Router (RSC)
- Auth: `next-auth ^5.0.0-beta.30` (JWT strategy, Credentials provider, bcryptjs hashing)
- DB: PostgreSQL via `@prisma/adapter-pg ^7.8.0` + `@prisma/client ^7.7.0`, Neon-hosted prod
- Validation: `zod ^4.3.6`
- Payments: `stripe ^22.1.0` (Checkout)
- Email: `resend ^6.12.2`
- Storage: AWS SDK v3 → Cloudflare R2 presigned PUTs, `sharp ^0.34.5` for blurhash
- Rate-limit: `@upstash/ratelimit ^2.0.8` + `@upstash/redis ^1.37.0` in prod, in-memory fallback in dev
- Tests: `vitest ^4.1.4` (157 test cases per CLAUDE.md, not run in this audit)

**Integration inventory.**

| Service | Env vars | Auth | Client created at | Called from |
|---|---|---|---|---|
| Neon Postgres | `DATABASE_URL`, `DIRECT_URL` | TLS+pwd | `lib/prisma.ts:11-18` (lazy via PrismaPg adapter) | every server route |
| NextAuth | `AUTH_SECRET` | n/a | `auth.ts` | session reads everywhere |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | secret key | `lib/stripe.ts:14-25` lazy singleton | `/api/checkout`, `/api/webhooks/stripe` |
| Resend | `RESEND_API_KEY`, `RESEND_FROM` | API key | `lib/resend.ts:13-24` | webhook + forgot-password + support reply |
| Cloudflare R2 (S3) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | access keys | `app/api/admin/uploads/sign/route.ts:36-45` | upload sign + blurhash |
| Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | REST token | `lib/rate-limit.ts:42-50` lazy | every rate-limited route |

**Migration timeline (linear, no branching).**

1. `20260425045353_init` — full Postgres schema cold start (replaces sqlite squash) — all 9 enums + 22 tables + indexes + FKs
2. `20260425142952_add_order` — adds `Order` table + `OrderStatus`/`ActivationCodeSource` enums + `source` column on `ActivationCode`
3. `20260426163724_add_order_email_tracking` — adds `Order.emailSentAt` + `Order.emailLastError`
4. `20260426200000_add_password_reset` — adds `User.passwordResetToken` (unique) + `User.passwordResetExpiresAt`

**Coverage tracker.** Read in Phase 1: every file under `app/`, `components/`, `lib/`, `prisma/`, `scripts/`, `types/`, plus all root-level config files. Test files inventoried (16 in `tests/api/*` + `tests/lib/*` + `tests/routes/*`) but not individually read.

---

## PHASE 1 — TOTAL COMPREHENSION

### 1.2 Architecture map

Routing layout:

```
app/
├── (public, no auth)
│   ├── /                                page.tsx       (marketing home)
│   ├── /about, /faq, /how-it-works, /support, /cases   (marketing)
│   ├── /cases/[slug]                    server page    (PUBLIC case detail + BuyButton)
│   ├── /login, /register, /forgot-password, /reset-password
│   ├── /checkout/success                server page    (Order status display)
│   └── /not-found
│
├── (unlock)/bureau/unlock              ROUTE GROUP    (carved out of bureau layout
│   └── public landing for QR codes;     so requireSession isn't applied)
│       authenticated body in UnlockForm
│
├── /u/[code]                           short-redirect → /bureau/unlock?code=
│
├── /bureau/* (auth-gated by middleware AND requireSession() in layout)
│   ├── layout.tsx                      requireSession()
│   ├── page.tsx                        owned-cases dashboard
│   ├── /cases/[slug]                   workspace + theory + checkpoint UI
│   ├── /database, /people/[personId], /archive
│   └── /admin/* (also middleware-checks role===ADMIN)
│       ├── layout.tsx                  redirect if !ADMIN (defense in depth)
│       ├── /cases (catalog, create, publish), /cases/[caseId]/{edit,preview,codes,access-codes}
│       └── /support (inbox, /[id])
│
└── /api/
    ├── /auth/[...nextauth]/route.ts    NextAuth handlers + rate-limit on POST
    ├── /webhooks/stripe                signature-verified, runtime=nodejs, CSRF-bypassed
    ├── /register, /forgot-password, /reset-password   (public)
    ├── /support, /waitlist             (public)
    ├── /checkout, /checkout/status     (public guest)
    ├── /access-codes/redeem            (auth required, hand-rolled in handler)
    ├── /cases/activate                 (middleware /api/cases/* gates auth + handler re-checks)
    ├── /cases/[slug]/theory            (auth)
    ├── /cases/[slug]/checkpoint        (auth)
    ├── /u/[code]                       (public redirect)
    └── /admin/**                       (middleware gates ADMIN; per-route requireAdmin())
```

**Rendering model.** All non-form pages are RSC. Client islands: `BuyButton`, `CaseActivationForm`, `CheckpointForm`, `TheorySubmissionForm`, `UnlockForm`, all auth forms, `ImageUploader`, `PublishCaseButton`, `SignOutButton`, `Navbar`, `RevealedEvidence` (Framer Motion). Suspense boundaries used where forms read `useSearchParams()`: `/login`, `/register`, `/reset-password`, `/bureau` (around `CaseActivationForm`).

### 1.3 Auth & authorization model

**Authentication paths:**

- Credentials login (`auth.ts:11-42`) — email + bcrypt-compared password; returns `{id, email, name, role}` to JWT
- Registration (`app/api/register/route.ts`) — creates `User(role: INVESTIGATOR)` with bcrypt cost 12; never sets ADMIN
- Password reset (`app/api/forgot-password/route.ts`, `app/api/reset-password/route.ts`) — randomBytes(32) hex token, 1h expiry, single-use

**Roles.** `INVESTIGATOR` (default) and `ADMIN` (`prisma/schema.prisma:10-13`).

**Guards (`lib/auth-helpers.ts`):**

- `requireSession()` → page redirect to `/login` if no session
- `requireAdmin()` → returns `Session | NextResponse(403)`; called by every admin route
- `getOptionalSession()` → no-op fetch
- `requireSessionJson()` → returns `Session | NextResponse(401)`; checks `Number.isInteger(userId)`

**Session lifecycle.** JWT strategy (`auth.config.ts:5-7`). No `maxAge` set → next-auth default (30 days). JWT contents (`id`, `role`) are populated only on first sign-in (`auth.config.ts:12-17`) — role changes do not propagate to existing sessions until expiry.

**CSRF model.** `middleware.ts:21-39` gates state-mutating `/api/*` requests by comparing `req.headers.get("origin")` against `NEXT_PUBLIC_APP_URL` via `new URL().origin`. Exclusions: `/api/auth/*`, `/api/webhooks/*`.

### 1.4 Data flow traces

**Guest purchase → activation → bureau access:** `BuyButton` → POST `/api/checkout` (rate-limit 5/60s, duplicate-purchase guard, Stripe Checkout session create + Order(PENDING) create) → Stripe-hosted page → user pays → Stripe sends `checkout.session.completed` → `/api/webhooks/stripe:86-270` verifies signature, idempotency-checks existing Order, mints unique `ActivationCode(source:PURCHASE)`, marks Order(COMPLETE) atomically in `$transaction`, sends Resend email with `?activate=CODE` deep-link → user clicks email → `/register` (new) or sign-in (existing) → `/bureau?activate=CODE` → `CaseActivationForm` auto-fills → POST `/api/cases/activate` → `UserCase` created via atomic `updateMany` precondition.

**Theory submission:** workspace → POST `/api/cases/[slug]/theory` → ownership verify → maxStage check → SOLVED early-return → evaluator (Jaccard) → state machine transition → `$transaction` (TheorySubmission + UserCase update + UserCaseEvent log).

**Checkpoint advance:** workspace → POST `/api/cases/[slug]/checkpoint` → ownership verify → maxStage check → matcher → CheckpointAttempt created → atomic `updateMany({where: {currentStage: ownedStage}})` precondition guards concurrent advance → STAGE_CONFLICT → 409.

**AccessCode redeem:** physical QR → GET `/u/CODE` → redirect → `/bureau/unlock?code=CODE` → if !session, render sign-in card with callbackUrl → after auth, UnlockForm auto-POSTs to `/api/access-codes/redeem` → ownership check (UserCase exists) → requiresStage check → oneTimePerUser dedup or P2002 race fallback → resolveContent (record/person/hint/hidden_evidence) → AccessCodeRedemption row → response.

**Image upload:** ImageUploader → POST `/api/admin/uploads/sign` (admin guard, 20/60s rate-limit, MIME enum, sanitize filename, randomUUID key) → 15-min presigned PUT URL → browser PUTs directly to R2 → ImageUploader fires-and-forgets POST `/api/admin/uploads/blurhash` → SSRF guard (host-equality vs `R2_PUBLIC_URL`) → Sharp resize to 32px → blurhash encode → returns 200.

**Stripe webhook:** raw body → signature verify → switch on event.type → for `checkout.session.completed`: find Order by stripeSessionId; if status===COMPLETE → idempotent return; if no Order → recovery via `session.metadata.{caseId,email}` (or log `[STRIPE-ORPHAN]` and throw); mint code with retry (collision-check ×3); `$transaction` { Order.create-if-recovery + ActivationCode.create + Order.update(COMPLETE) }; send email; on success update `emailSentAt`; on failure update `emailLastError` (best-effort).

### 1.5 Schema & migration map

22 models, 9 enums (all mirrored in `lib/enums.ts` for browser-safety). Sensitive fields: `User.passwordHash` (bcrypt), `User.passwordResetToken` (unique, hex), `Order.email`, `Order.stripeSessionId`, `Order.stripePaymentIntent`, `ActivationCode.code` (unique), `AccessCode.code` (unique), `GlobalPerson.internalNotes`, `PersonAnalystNote.visibility=INTERNAL`.

Cascades: `User → UserCase`, `User → ActivationCode.claimedByUserId` is SET NULL (good), every `caseFileId` FK is `CASCADE` — deleting a CaseFile wipes its codes, redemptions, owners, audits. `CaseAudit.userId` is `RESTRICT`.

### 1.6 Environment & secrets surface

Every var referenced in code: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (client-exposed, intended), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `RESEND_API_KEY`, `RESEND_FROM`, `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME/PUBLIC_URL`, `UPSTASH_REDIS_REST_URL/TOKEN`, `SEED_ADMIN_EMAIL/PASSWORD`, `NODE_ENV`. No client-exposed secrets found beyond `NEXT_PUBLIC_APP_URL`.

### 1.7 Test inventory

`tests/api/`: register, stripe, theory, checkpoint, activate, access-codes-redeem, admin-cases, admin-codes, admin-section-patches, admin-slug-history, admin-support, admin-uploads, bureau-people, workflow. `tests/lib/`: auth-helpers, case-evaluation, case-quality, post-login-path, rate-limit, user-case-state. `tests/routes/`: unlock-flow.

### 1.8 Dependency posture

Notable: `next-auth ^5.0.0-beta.30` — still beta. `next 16.2.3` — bleeding edge. `react 19.2.4`, `react-dom 19.2.4` — current. `prisma ^7.7.0`, `@prisma/client ^7.7.0`, `@prisma/adapter-pg ^7.8.0`. `zod ^4.3.6`. `stripe ^22.1.0`. `bcryptjs ^3.0.3` (cost 12 is fine). `sharp ^0.34.5`. `lucide-react ^1.8.0` — pinned to v1, very old major track — **verify intended package**.

---

## PHASE 2 — FORENSIC AUDIT

### [P0] Stripe webhook is exposed via `pathname.startsWith("/api/webhooks/")` — middleware bypass surface is broader than the single Stripe endpoint

**Location:** `middleware.ts:25`

**What:** The CSRF middleware skips state-mutating requests for any path beginning with `/api/webhooks/`, but signature verification only exists in the single Stripe handler. Any future webhook-shaped route added under `/api/webhooks/*` will be writable cross-origin without auth, CSRF, or signature checks.

**Evidence:**

```ts
if (
  STATE_MUTATING_METHODS.has(req.method) &&
  pathname.startsWith("/api/") &&
  !pathname.startsWith("/api/auth/") &&
  !pathname.startsWith("/api/webhooks/")  // ← blanket carve-out
) { ... }
```

**Why it's a problem:** Defense in depth is missing. A teammate adding `/api/webhooks/foo` won't realize they've opted out of CSRF. Today the surface is one endpoint that does verify; tomorrow's surface is whatever ends up there.

**Impact:** Latent risk; near-zero today, large blast radius for any future hand-rolled webhook handler.

**Remediation:** Tighten the carve-out to the exact path: `pathname !== "/api/webhooks/stripe"`. Or maintain an explicit allowlist (`WEBHOOK_PATHS = new Set([...])`).

**Verification:** Add an integration test: cross-origin POST to a hypothetical `/api/webhooks/test` is rejected with 403.

> **Note from triage:** This is described as "near-zero today" in its own impact line, which contradicts P0 by the prompt's own scale. Should likely be P2.

### [P1] Duplicate-purchase 409 guard leaks "this email has bought this case" to anyone

**Location:** `app/api/checkout/route.ts:60-76`

**What:** The guard returns HTTP 409 with the message "An activation code for this case has already been sent to this email address." for any unauthenticated caller who supplies an email that has a `COMPLETE` order on a given `caseId`. There is no rate-limit cap below 5/min/IP and no proof-of-ownership challenge.

**Evidence:**

```ts
const existingOrder = await prisma.order.findFirst({
  where: { caseFileId: caseId, email: { equals: email, mode: "insensitive" }, status: "COMPLETE" },
  ...
});
if (existingOrder) {
  return NextResponse.json({ message: "An activation code for this case has already been sent..." }, { status: 409 });
}
```

**Why it's a problem:** Anyone who knows or guesses an email address can probe whether that email purchased a specific case — `/api/checkout` is unauthenticated by design. At 5 attempts/min/IP and no per-email cap, scanning a list of emails against a list of caseIds is practical.

**Impact:** Privacy regression for every paying customer. Gets worse as the catalog grows.

**Remediation:** Defer the duplicate check until after a Stripe session would otherwise be created — or drop the friendly 409 and accept that idempotency lives at the webhook layer. If you keep the guard, return HTTP 200 with a generic message regardless of whether a duplicate was found, and tighten rate-limit to 1/30s/email.

**Verification:** From an unauthenticated client, request the same `(caseId, email)` twice; the second response should be indistinguishable from a fresh attempt by status code, body, and timing.

### [P1] Activation-code email goes to attacker-supplied address — abuse for spam relay paid via Stripe

**Location:** `app/api/checkout/route.ts:81-91`, `app/api/webhooks/stripe/route.ts:215-251`

**What:** Anyone can pay (with their own card) and have the activation-code email sent to any email address they like — there is no email-ownership verification before the email is sent.

**Evidence:**

```ts
// /api/checkout
customer_email: email,
metadata: { caseId: String(caseId), email },

// webhook
to: buyerEmail, // straight from session metadata or Order.email
```

**Why it's a problem:** Even though the attacker pays for the kit, this becomes a paid-spam vector aimed at a specific recipient with reputable Resend deliverability and the Black Ledger brand. If the attacker uses stolen cards, you eat the chargebacks plus shipping cost. This is also the canonical pattern that gets a Resend account suspended for abuse.

**Impact:** Brand and deliverability damage; Resend account suspension risk; chargeback exposure if cards are stolen.

**Remediation:** Either (a) require account creation before checkout — buyer's session email is the recipient; or (b) keep guest checkout but only deliver the activation code via a token-link flow. Until either is in place, implement per-email rate limiting (max 3 successful checkouts/hour/destination email) inside the webhook.

**Verification:** Run a dry test in test mode: pay for two different kits and direct each to a separate fake email; both emails fire.

### [P1] Reset-password and registration race window leaves long-lived sessions valid after credential change

**Location:** `auth.config.ts:12-26`, `app/api/reset-password/route.ts:50-57`

**What:** The JWT callback only writes `id`/`role` to the token on first sign-in; `session.user.role` and `session.user.id` are never re-read from the database during a session's lifetime. After a password reset, the old JWT cookies remain valid. After an admin demotion, the demoted user keeps `role: "ADMIN"` until their JWT expires. There is no `maxAge` configured, so the default is 30 days.

**Evidence:**

```ts
// auth.config.ts
session: { strategy: "jwt" },  // no maxAge
...
async jwt({ token, user }) {
  if (user) { token.id = user.id; token.role = user.role; }
  return token;
}

// reset-password/route.ts — updates passwordHash but never invalidates sessions
await prisma.user.update({ where: { id: user.id }, data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null }});
```

**Why it's a problem:** A user who thinks they've kicked out an attacker by resetting their password actually hasn't — the attacker's JWT remains valid for up to 30 days. Demoting an admin doesn't take effect until the demoted account signs out and back in.

**Impact:** Security control failure for the canonical "I think my account was compromised" recovery flow.

**Remediation:** Three changes. (a) Set `session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }` (7 days) or shorter. (b) Add a `tokenVersion` (or `passwordChangedAt`) column on `User`, write it into the JWT, and re-check it inside the `session` callback against the current DB value — bump it on password reset and on admin role change. (c) Add a "sign out everywhere" button.

**Verification:** Reset a user's password and confirm an existing browser tab with that user's session can no longer call any auth-gated API.

### [P1] Race condition: rapid sequential `/api/checkout` requests can create N parallel Stripe sessions before the duplicate-purchase guard fires

**Location:** `app/api/checkout/route.ts:60-106`

**What:** The duplicate-purchase guard reads `Order(status: COMPLETE)`. The very-first checkout on a `(caseId, email)` pair has no COMPLETE row — both requests sail through the guard, both create Stripe sessions, both create local PENDING orders, both buyers receive the Stripe URL.

**Evidence:**

```ts
const existingOrder = await prisma.order.findFirst({
  where: { ..., status: "COMPLETE" }, ...
});
if (existingOrder) { return 409; }
// ...nothing prevents two PENDING orders from racing here...
const session = await getStripe().checkout.sessions.create({ ... });
await prisma.order.create({ data: { stripeSessionId: session.id, ... } });
```

**Why it's a problem:** A tab-double-clicker, a slow network buyer who refreshes, or just the BuyButton being submitted twice all produce two PENDING orders, two checkout sessions, and (if the buyer pays both) two charges to the same card for the same case.

**Impact:** Real-money correctness bug. Most likely to fire on the first sale of every kit you ever sell.

**Remediation:** Add a `Order(status: PENDING)` check that returns the existing session URL if one was created in the last few minutes for the same `(caseId, email)`. The simpler path is "if a PENDING order exists in the last 15 min for this email+case, redirect to its existing Stripe URL."

**Verification:** Spawn two concurrent POST `/api/checkout` requests with identical body; only one Stripe session should be created.

### [P1] CSV export is vulnerable to formula injection in Excel/Google Sheets

**Location:** `app/api/admin/cases/[caseId]/codes/route.ts:46-77`

**What:** The CSV export of activation codes joins user-supplied fields after CSV-escaping for `,`/`"`/`\n` only. Cells starting with `=`, `+`, `-`, or `@` are interpreted as formulas when opened in Excel/Numbers/Google Sheets.

**Evidence:**

```ts
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

**Why it's a problem:** Today, `kitSerialPrefix` is admin-controlled and `email` is Zod-validated to start with a letter. But the threat model relies on validators that may change. A future feature that surfaces customer notes or any other free-form field becomes immediately exploitable.

**Impact:** Low today, real if any free-form field enters the CSV later.

**Remediation:** In `csvEscape`, prefix any cell beginning with `=`, `+`, `-`, `@`, or `\t` with a single quote `'`. Or always wrap every cell in quotes.

**Verification:** Inject a kit serial of `=cmd|/c calc|""`, export the CSV, open in Excel — should show as text, not execute.

### [P1] `revokedAt` is accepted from the client and can be backdated or future-dated arbitrarily

**Location:** `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts:23-49`, `lib/validators.ts:269-271`

**What:** The "revoke activation code" PATCH endpoint accepts `revokedAt` as a client-supplied ISO datetime and writes it verbatim to the database.

**Evidence:**

```ts
// validators.ts
export const revokeCodeSchema = z.object({ revokedAt: z.string().datetime() });

// route.ts
data: { revokedAt: new Date(parsed.data.revokedAt) },
```

**Why it's a problem:** `revokedAt` should be a server-stamped fact. Allowing client values means an admin can backdate revocations. There is also no `CaseAudit` record for this action.

**Impact:** Audit-integrity issue.

**Remediation:** Drop `revokedAt` from the request body; stamp `revokedAt: new Date()` server-side. Add `CaseAudit` write inside a transaction.

**Verification:** Submit `{revokedAt: "1970-01-01T00:00:00.000Z"}` — server should ignore the value and stamp now.

### [P1] `/api/admin/cases/[caseId]/access-codes` POST allows arbitrary `unlocksTarget` payload (`hidden_evidence` not in validator enum)

**Location:** `lib/validators.ts:277-286`, `app/api/admin/cases/[caseId]/access-codes/route.ts:61-88`

**What:** `createAccessCodeSchema.unlocksTarget.type` is `z.enum(["record", "person", "hint"])` — but the redeem route and the bureau evidence renderer both branch on `type === "hidden_evidence"`. There is no admin path to create such codes.

**Evidence:**

```ts
// validators.ts:280-283
unlocksTarget: z.object({
  type: z.enum(["record", "person", "hint"]),  // ← excludes "hidden_evidence"
  id: z.number().int().positive(),
}),

// redeem/route.ts:33-38 — handler reads "hidden_evidence"
if (target?.type === "hidden_evidence") { ... }
```

**Why it's a problem:** Code paths exist to render hidden evidence, but no admin can create the AccessCode that triggers them via the API (only direct DB writes work).

**Impact:** Functional gap.

**Remediation:** Extend the enum to `["record", "person", "hint", "hidden_evidence"]`. Add a corresponding ownership check (`prisma.hiddenEvidence.findUnique`).

**Verification:** Create an AccessCode with `unlocksTarget: { type: "hidden_evidence", id }`; redeem; render in workspace.

### [P1] Webhook `payment_intent.payment_failed` cannot find an Order until the success path has already updated it

**Location:** `app/api/webhooks/stripe/route.ts:284-294`

**What:** `handlePaymentFailed` looks up Order by `stripePaymentIntent`. But `stripePaymentIntent` is written to Order only by the success branch — a payment_intent that fails before any successful flow has no Order to mark FAILED.

**Why it's a problem:** PENDING orders accumulate indefinitely with no cleanup job.

**Impact:** Monitoring noise + "stuck order" complaints over months.

**Remediation:** Subscribe to `checkout.session.async_payment_failed` instead, which carries the session id you already index. Add a nightly cron that marks PENDING orders older than 24h as FAILED.

**Verification:** Trigger a card-decline in Stripe test mode; the corresponding Order should land in `FAILED`.

### [P1] `scripts/seed-global-people.ts` and `scripts/unarchive-case.ts` lack `assertSafeEnv` — they can wipe or republish in production

**Location:** `scripts/seed-global-people.ts:5`, `scripts/unarchive-case.ts:1-8`

**What:** Two scripts perform destructive mutations without the safety guard the codebase has elsewhere:

- `seed-global-people.ts` runs `prisma.personConnection.deleteMany()` (line 857) and per-person `deleteMany` for aliases, behavioral profiles, traces, timeline events, evidence links, analyst notes — wipes existing data wholesale
- `unarchive-case.ts` hard-codes `CASE_ID = 3` and updates `workflowStatus: "PUBLISHED"` — would silently un-archive an arbitrary prod case if invoked with prod creds

**Evidence:**

```ts
// seed-global-people.ts:1-5 — no assertSafeEnv import
import dotenv from "dotenv";
import { prisma } from "../lib/prisma";
dotenv.config({ path: ".env.local" });
dotenv.config();

// seed-global-people.ts:857
await prisma.personConnection.deleteMany();  // ← all rows, every env
```

**Impact:** Silent data loss if a teammate runs the script with `DATABASE_URL` pointing at Neon.

**Remediation:** Add `assertSafeEnv("seed-global-people");` and `assertSafeEnv("unarchive-case");` after the dotenv imports. Stop hardcoding case IDs in `unarchive-case.ts`.

**Verification:** Set `DATABASE_URL` to a Neon URL and run each script — it should refuse to start.

### [P2] No `runtime = "nodejs"` declared on Prisma-using API routes

**Location:** every `app/api/**/route.ts` except `app/api/webhooks/stripe/route.ts:9`

**What:** Only the webhook explicitly sets `export const runtime = "nodejs"`. Every other route relies on the default. A future Next or adapter version that ships an "edge-compatible" stub may flip routes to edge silently.

**Remediation:** Add `export const runtime = "nodejs";` to every API route file.

### [P2] CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts

**Location:** `next.config.ts:26-36`

**What:** The enforced CSP includes `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. That defeats the most useful effect of CSP.

**Remediation:** Move to a nonce-based CSP. Generate a per-request nonce in `middleware.ts`, attach it to the response header, and pass it to `<script nonce={...}>` tags. Drop `'unsafe-inline'` and `'unsafe-eval'`.

### [P2] `/api/checkout/status` exposes Order status to anyone with a session_id (unauthenticated)

**Location:** `app/api/checkout/status/route.ts:4-23`

**What:** GET `/api/checkout/status?session_id=…` is unauthenticated and returns `{ status }`. Stripe session IDs are unguessable, but they leak via referrers, browser history, third-party analytics, or accidental sharing.

**Impact:** Low. Mostly hygiene.

**Remediation:** Document the contract clearly. Consider rate-limiting (today: none).

### [P2] Slug uniqueness check at `/api/admin/cases` (POST) is non-atomic

**Location:** `app/api/admin/cases/route.ts:23-54`

**What:** The route checks `prisma.caseFile.findUnique({ where: { slug }})`, then creates. Two simultaneous "Create" submits with the same slug both pass the precheck, the second fails with P2002, the admin sees a 500.

**Remediation:** Catch P2002 from `caseFile.create` and translate to 409.

### [P2] `globalPersonId` is not validated to exist in admin People save

**Location:** `app/api/admin/cases/[caseId]/people/route.ts:104-112`

**What:** No `prisma.globalPerson.findUnique` check that the ID exists. The DB FK rejects with P2003, surfacing as 500.

**Remediation:** Validate `globalPersonId` exists before transaction.

### [P2] No cleanup for stuck PENDING orders or orphaned R2 objects

**Location:** No cron / scheduled job

**What:** PENDING orders accumulate indefinitely. R2 objects for image uploads that were never persisted are likewise orphaned forever.

**Remediation:** A daily cron that marks PENDING Orders > 24h as FAILED and deletes orphan R2 objects older than 7 days.

### [P2] No `apiVersion` pinned on the Stripe client

**Location:** `lib/stripe.ts:20`

**Remediation:** `new Stripe(secretKey, { apiVersion: "2024-12-18.acacia" })` (or whichever version the team has tested against).

### [P2] Forgot-password leaks user existence via response timing

**Location:** `app/api/forgot-password/route.ts:34-53`

**What:** Nonexistent emails return after a single `findUnique`; existing emails do `findUnique` + token gen + `prisma.user.update` + `getResend().emails.send`. The Resend send is the slowest operation and easily measurable.

**Remediation:** Move the slow path out-of-band (queue / `setImmediate`).

### [P2] `lucide-react ^1.8.0` is suspicious — verify intended package

**Location:** `package.json:34`

**What:** `lucide-react` versioning typically tracks `0.x` (current ~0.488). A `^1.8.0` constraint is unusual.

**Remediation:** Verify with `npm view lucide-react versions`. If you want canonical Lucide icons, pin to the latest `0.x`.

### [P3] Various low-priority hardening items

- `register` and `forgot-password` first-issue Zod messages reveal validation rule details (trivial).
- `/api/checkout/status` has no rate limit.
- `/api/admin/uploads/blurhash` has no rate limit.
- Webhook does not assert `livemode` matches expectation.
- CSP `connect-src 'self'` will block Stripe.js if you ever add it client-side.
- `assertSafeEnv` only matches Neon hosts — false negatives for Supabase/Railway/RDS prod.
- `Order` missing index on `(caseFileId, email, status)` — slow at scale.
- `ActivationCode.code` entropy ~52 bits effective (acceptable).
- `Footer` lost `/privacy` and `/terms` links — pages don't exist either. **Stripe in production requires publicly accessible TOS and Privacy Policy.**
- No cookie consent banner.
- Bureau workspace renders admin-controlled strings — couples to the CSP `unsafe-inline` issue.
- Success page shows email — verify intent.

### [P4] Cosmetic / cleanup

- `tsconfig target ES2017` is old → `ES2022`.
- `app/bureau/admin/cases/page.tsx` imports `CaseWorkflowStatus` from `@/generated/prisma/client` instead of `@/lib/enums`.
- Legacy seed defaults `source: ADMIN` (correct, document for clarity).
- `signOut` button hits `redirectTo: "/"` — could land on `/login`.
- Framer Motion isn't loaded conditionally — bundle-size opportunity.

### Category-by-category checks (no findings)

- **2.1 Authentication** — bcrypt cost 12 good, email-normalization at login good, callback URL sanitized via `pickPostLoginPath`, logout clears JWT cookie.
- **2.2 Authorization (IDOR)** — every `/api/admin/*` route calls `requireAdmin()`; `/api/cases/*` routes verify ownership via `userCase.findFirst`; admin role can be set only by direct DB seed.
- **2.3 Input validation & injection** — every API route runs Zod safeParse; no `$queryRaw`/`$executeRaw`; no `dangerouslySetInnerHTML`; MIME allowlist enforced server-side; SSRF guard on blurhash route.
- **2.4 CSRF, CORS, headers** — CSRF gate uses `new URL(origin).origin` (subdomain-bypass-proof); no GET endpoint mutates state; HSTS / X-Content-Type-Options / X-Frame-Options / Referrer-Policy / Permissions-Policy all set.
- **2.5 Rate limiting & abuse** — 14 endpoints rate-limited; Upstash backend in prod; bucket key is `(ip, route)`.
- **2.7 Database, transactions, concurrency** — every multi-write wrapped in `$transaction`; checkpoint advance uses atomic `updateMany` precondition; cascades reviewed.
- **2.10 Frontend / React / RSC** — no client component imports a server-secret-using module; Suspense boundaries present where required; double-submit prevented via `disabled={status==="loading"}`.
- **2.11 TypeScript & code health** — `strict: true`; no `as any` (sampling); session typing via module augmentation correct.

---

## PHASE 3 — SYNTHESIS & EXECUTIVE REPORT

### Executive summary

Black Ledger is in unusually good shape for a pre-launch indie codebase. The Wave-1 through Wave-4 audit cycles have closed almost every commodity vulnerability — credential timing, session typing, CSRF, rate limiting on every public POST, atomic state transitions, idempotent webhooks, SSRF guards, MIME allowlists, slug-history redirects, monotonic state machines, ownership checks on every player API. The architecture is coherent.

What's left is a small set of real issues and a larger set of polish. The launch-blockers are: (1) a duplicate-charge race when a buyer double-submits the BuyButton — most likely on the first sale of every kit; (2) a duplicate-purchase guard that leaks "this email bought this case" to anyone — a privacy regression, easy to fix; (3) an activation-code email that goes to attacker-supplied addresses, paid via stolen cards — a deliverability and chargeback risk; (4) password resets that don't invalidate existing sessions for up to 30 days; (5) the `hidden_evidence` AccessCode branch is half-shipped; (6) two destructive seed scripts lack the safety guard.

The remaining findings are real but bounded. None block a soft launch. The codebase is more mature than its commit history suggests. Ship it after the P1 set.

### Top 10 launch-blockers (ranked)

1. **[P1] Double-charge race on first sale** — most likely to fire on the first paying customer; bad first impression and immediate refund work.
2. **[P1] Activation-code email recipient is attacker-supplied** — biggest single threat to your Resend deliverability reputation and Stripe account standing.
3. **[P1] JWT sessions don't invalidate on password reset and last 30 days** — defeats the canonical "I think I'm compromised" recovery flow.
4. **[P1] Duplicate-purchase 409 enumeration** — quietest finding, highest enumerability impact. Two-line fix.
5. **[P1] `seed-global-people.ts` lacks `assertSafeEnv`** — single-script-mistake to production-data-wipe.
6. **[P1] `hidden_evidence` AccessCode branch unreachable via admin API** — half-shipped feature.
7. **[P0→P2] Webhook CSRF carve-out is too broad** — defense-in-depth gap; tighten now while there's only one webhook.
8. **[P3] Privacy + Terms pages missing** — Stripe periodically audits; missing TOS is one of their fastest disable triggers.
9. **[P1] Stripe `payment_intent.payment_failed` doesn't update Order** — admin support will hit "stuck PENDING" complaints in week one.
10. **[P1] `revokedAt` is client-supplied** — easy fix, removes audit-integrity hole.

### Quick-wins (< 30 min each, ordered by impact-per-minute)

1. Add `assertSafeEnv` to `seed-global-people.ts` and `unarchive-case.ts` — 2 lines each, kills production-wipe risk.
2. Stamp `revokedAt` server-side; drop client value — 3 lines.
3. Tighten the webhook CSRF carve-out — 1 line in middleware.
4. Add `runtime = "nodejs"` to every API route — 1 line each (~28 routes).
5. Pin Stripe `apiVersion` — 1 line in `lib/stripe.ts`.
6. Add `csvEscape` formula-prefix protection — 3 lines.
7. Catch P2002 on `caseFile.create` in admin POST → 409 — 5 lines.
8. Add `@@index([caseFileId, email, status])` on Order — 1 line in schema + 1 migration.
9. Add rate limits to `/api/checkout/status` and `/api/admin/uploads/blurhash` — 8 lines each.
10. Drop the duplicate-purchase 409 message specificity (or move it after Stripe session create) — 5 lines.
11. Fix `lucide-react` version pin — `npm install lucide-react@latest` after confirming the canonical package.
12. Verify Resend SPF/DKIM/DMARC for `theblackledger.app` — dashboard work, no code.

### Strategic recommendations (architectural moves over 1–3 months)

- Introduce Sentry (or equivalent) and structured logging. `console.error` to Vercel logs is invisible until something breaks.
- Move email-sending behind a queue (Upstash QStash, Inngest, or Vercel Queues).
- Add an "admin operations" service: refund handling, code revocation with audit, manual code generation, "resend activation email," "regenerate code."
- Build a GDPR data-export and account-deletion flow before EU traffic shows up.
- Adopt a nonce-based CSP to drop `unsafe-inline`/`unsafe-eval`.
- Split admin into a separate Vercel project with IP allowlist or basic-auth in front.
- Add a periodic R2 sweeper + Order-cleanup cron.
- Consider moving from JWT to database sessions in next-auth for the next refactor.

### What I did NOT audit

- `npm audit` / dependency CVE scan — could not run from this session.
- Vercel dashboard — env-var parity, function regions, build settings, custom domain config.
- DNS / email deliverability — SPF, DKIM, DMARC for `theblackledger.app`.
- Stripe dashboard — webhook endpoint configured? events subscribed?
- Live Stripe E2E test — `scripts/test-stripe-e2e.ts` exists but I did not execute it.
- Vercel function-level concurrency / cold-start behavior.
- Mobile / accessibility actual testing.
- Penetration test of the live site.
- Reading every admin tab component, marketing pages, UI primitives — sampled, not read individually.
- Test files individually — inventoried by name only.

### Coverage attestation

Every file in the Phase 0 coverage tracker that is security-bearing was read in Phase 1 and cited where relevant. Files explicitly noted as "sampled, not read individually" are non-security-bearing render surfaces. For full file-by-file pass, schedule a follow-up audit specifically against those.

The 28 API route handlers, 14 lib helpers, middleware, both auth files, the schema, all 4 migrations, all 6 scripts, every authentication-touching page, every form that crosses a trust boundary, the bureau workspace rendering surface, the `/u/[code]` and `/bureau/unlock` flow, the public case page, the success page, and the 21 components on critical paths were read in full and cited in this report.

End of audit. No code was modified, no migrations were run, no installations performed.
