# BATCH 6 — OBSERVATIONS

Things noticed while applying Batch 6 that were out of scope. Triage as
you see fit; no action taken on any of these.

## 1. Admin self-deletion is refused at the route layer — operator path needed

`app/api/me/route.ts` returns 403 when `user.role === "ADMIN"` with the
message `"Admin accounts cannot be self-deleted. Contact
support@theblackledger.app."`. Two reasons we picked this over allowing
the delete:

- `CaseAudit.userId` is a **mandatory** Prisma relation
  (`prisma/schema.prisma:143` — `user User @relation(fields: [userId],
  references: [id])`, no `onDelete` clause → Postgres default of
  `Restrict` / `NoAction`). Any admin who has ever audited a case (which
  is every admin in practice — every per-section PATCH writes a
  CaseAudit row) cannot be deleted via Prisma without first deleting or
  reassigning their CaseAudit history. Re-parenting CaseAudit to a
  "deleted-admin" placeholder user is the right pattern; it just
  doesn't fit a single-commit batch.
- Admin deletion is high-impact in ways an INVESTIGATOR delete is not
  — it removes a person from the audit trail, can leave dangling
  references in operational notes, and (today) is irreversible. A 403 +
  manual ops path is the safer default until we have a documented
  hand-off procedure.

**For a future batch, the right shape is probably:**

1. Add a `User` flag like `isAnonymized: Boolean @default(false)` and a
   `deletedAt: DateTime?` so admins can be soft-deleted (anonymise the
   email/name, blank the password hash so they can never log in).
2. Or: introduce a "deleted user" placeholder row with a sentinel
   email and re-parent all `CaseAudit.userId` foreign keys to it
   inside the delete transaction.
3. Either way, gate behind a `support@` request rather than a
   self-service flow — admin deletion is a once-a-decade event, not
   something to optimise for.

The Privacy Policy commitment is still met for admins: §8 doesn't
distinguish role and the policy supports manual deletion via support
email.

## 2. Deleted user's claimed ActivationCodes are SET NULL'd, not revoked

When `prisma.user.delete` cascades through `ActivationCode.claimedByUserId`,
the optional `claimedByUser User?` relation defaults to `SetNull`, so the
ActivationCode row stays — claimed-by is just nulled out. The
`claimedAt` timestamp also stays. Effect: the row looks "claimed but
unowned."

`app/api/cases/activate/route.ts` checks both `isActive` and `revokedAt`
when accepting a code. It does **not** treat a non-null `claimedAt` as
a hard block — the activate logic checks `claimedByUserId` and rejects
if already claimed by *someone* (i.e., the value is not null and is not
the current user). So once a deleted user's claimed code has its
`claimedByUserId` SetNull'd, the row's effective state is:

- `claimedByUserId = null` → activate route treats it as un-claimed
- `claimedAt = <past date>` → no behavioural effect (no check)
- `revokedAt = null` → not revoked

Net: a returning user could theoretically re-claim that code by
re-registering and entering the code from the original purchase email.
**Whether this is desirable is a product decision.** Two possible
behaviours, neither of which Batch 6 ships:

- **Strictly preserve entitlement:** when a user deletes their account,
  also stamp `revokedAt: new Date()` on every ActivationCode they ever
  claimed. The code becomes 410 on re-redemption. Clean but loses the
  customer good-will of "I deleted by accident, can I re-redeem?"
- **Optionally preserve entitlement:** add a "preserve my purchases"
  checkbox to the deletion UI; default off (= revoke), opt-in to keep.

Either way, requires a small inline transaction inside the delete
handler. Defer to a future batch with product input.

## 3. No confirmation email is sent when an account is deleted

GDPR best practice is to send the user-of-record an "your account has
been deleted" email after their account is purged — both as proof to
them and as an audit artefact for us. Today the route just returns 200.

The reason this isn't in Batch 6: we no longer have the user's email
after `prisma.user.delete` runs (the row is gone). To send the email
correctly, we'd need to capture `email` in the `findUnique` select
*before* the delete and pipe it into a Resend send after. That's a
~10-line change but pulls Resend into the route, which means another
`getResend()` import and a new email template. Defer.

If/when this lands, also consider:

- Logging the deletion to a new `UserDeletion` model (or `UserAuditLog`)
  with `email`, `deletedAt`, `reason: "self" | "admin" | "ops"`. The
  CaseAudit table is the wrong shape — it's per-case and would
  require shoehorning.
- Whether the email should include a `Reply-To` for "did this not come
  from you?" recovery flow. Probably yes.

## 4. The `/account/delete` page is intentionally unlinked from the public site

The deletion page is reachable only from the bureau dashboard header.
Anonymous visitors (marketing site, /privacy, /terms) cannot find it
and shouldn't be able to. This is correct for two reasons:

- A signed-out visitor cannot self-delete anything; the page would
  redirect them to /login and back.
- Advertising "delete your account" on the homepage is unhelpful and
  slightly off-tone for a paid product page. It belongs in the
  authenticated dashboard, where the user already has a sense of what
  they have to lose.

The `/privacy` page mentions account deletion but doesn't link to the
form — the user is expected to find it via the bureau header. If a
support email asks "how do I delete?" the answer is "sign in → bureau
dashboard → Delete account in the header." This is sufficient.

## 5. Deleted-user trace remains in non-cascading places — known and acceptable

After a successful `prisma.user.delete`, these traces remain in the DB:

- `Order.email` — buyer-of-record, no User FK. Documented and correct
  per Privacy §8 (tax retention).
- `ActivationCode` rows the user claimed — stay, with
  `claimedByUserId = null`. Discussed in Observation 2.
- `SupportMessage` rows where the user emailed support — the
  SupportMessage table has its own `email` column with no FK to User,
  so support tickets persist by design. This is correct (we need the
  history to triage future tickets) but if a user explicitly requests
  "delete everything you have on me," ops needs to also blank these
  rows. Note for the Privacy-Policy lawyer review: clarify whether
  support tickets are subject to the deletion request and document the
  retention period if they are not.
- `CheckpointAttempt` and `TheorySubmission` are cascade-deleted via
  the User FK. Confirmed by re-reading `prisma/schema.prisma` lines
  255-256 and 274-275.
- `CaseAudit.userId` is RESTRICT-FK'd, but only ADMIN users have these
  rows; INVESTIGATOR users (the only role this endpoint accepts) never
  do. Confirmed by re-reading the schema and grepping
  `caseAudit.create` call sites — all are inside admin-only routes.

## 6. Other rate-limit and CSP gaps still open from prior audits

Carried forward unchanged from prior batches' observations — not
actioned in Batch 6:

- `/api/checkout/status` and `/api/admin/uploads/blurhash` rate-limit
  branches still untested (Batch 2 added them, no race-against-mock
  tests).
- `/api/admin/cases` POST and `/api/admin/cases/[caseId]` PUT P2002
  catches still untested (Batch 2 + Batch 4).
- `/api/me` itself is a new rate-limit branch added in Fix 1 — the
  429 path is covered by the new test, but the route is otherwise
  uncovered for concurrent-delete races against the same userId.
  Worst case is two requests both pass `findUnique` and one of them
  P2025s on `delete` because the other won. Not exploitable; not
  worth a test today.

## 7. Out-of-scope items from the 2026-05-01 audits still open after Batch 6

Listing for Batch 7+ scoping. These remain after Batch 6:

- **Cowork audit P1-2:** Terms of Service promises a 7-day refund
  mechanism. Batch 5 closed the **Stripe-side** half (refund webhook
  revokes entitlement). The **product-side half** — a customer-facing
  "Request a refund" flow with the 7-day window enforced via
  `claimedAt` — is still open. Either build the customer-facing flow,
  or clarify the policy to "request via support email."
- **Audit P1-3:** Activation-code email goes to attacker-supplied
  address. Architectural — needs product input on whether to require
  account-creation pre-checkout, or deliver code via token-link.
- **Audit P1-6:** `AccessCodeRedemption` unique-key vs
  `oneTimePerUser=false` is a no-op. Product call: drop the column or
  drop the unique constraint.
- **Audit P2-5:** Admin mutation routes lack rate limits. Mechanical.
- **Audit P2-7:** Role demotion does not propagate to existing JWT
  sessions (tokenVersion only bumps on password reset). Hypothetical
  until a second admin exists.
- **Audit P2-8:** `/bureau/database` loads every `GlobalPerson`
  unbounded. Pagination still pending after Batch 4 closed the leak.
- **Audit P2-9:** `runtime = "nodejs"` not pinned on every API route.
  Mechanical sweep, ~24 files. Batch 6 pinned the new `/api/me` route
  as a one-off; the rest is deferred.
- **Audit P2-10 / cowork P2-12:** CSP allows `'unsafe-inline'` and
  `'unsafe-eval'` in `script-src`. Move to nonce-based.
- **Audit P2-11 / cowork P2-13:** Forgot-password timing leak +
  login lookup not constant-time. Operational, deferred.
- **Cowork P2-1:** Google Fonts embedding without Privacy Policy
  disclosure. Either disclose `fonts.gstatic.com` in /privacy §5 or
  replace `next/font/google` with `next/font/local`.
- **Cowork P2-6:** Legacy single-code generator at
  `/api/admin/cases/[caseId]/activation-codes` has unbounded collision
  retry.
- **Cowork P2-7:** Initial activation code creation in admin case POST
  silently 500s on collision after creating the CaseFile. Wrap both
  writes in a `$transaction`.
- **Cowork P2-8:** `app/layout.tsx` calls `auth()` on every page render.
- **Cowork P2-9:** No structured logging / no Sentry.
- **All P3 items:** carried forward from prior batches and CLAUDE.md
  follow-ups. Defer.

End of observations.
