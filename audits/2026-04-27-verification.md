# BLACK LEDGER — AUDIT VERIFICATION (2026-04-27)

Independent ground-truth verification of the seven highest-value findings from
the v1 and v2 audit reports. Each finding was confirmed by directly reading the
cited file at the cited line range. **Result: all seven findings are real.**

---

## 1. [v2 P1] Checkout success page leaks buyer email — CONFIRMED

**File:** `app/checkout/success/page.tsx`

```ts
// Line 13-16 — selects email
const order = sessionId
  ? await prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
      select: { status: true, email: true },
    })
  : null;

// Line 20
const email = order?.email ?? null;

// Line 33-34 — renders into HTML
<span className="font-mono text-zinc-200">{email}</span>
```

The page is unauthenticated (no `requireSession()`). Anyone with the
`session_id` can fetch the page and read the buyer's email.

**Severity assessment:** P1 is correct.

---

## 2. [v2 P1] `AccessCodeRedemption` unique key contradicts `oneTimePerUser=false` — CONFIRMED

**File:** `prisma/schema.prisma`

```prisma
// Line 445-456
model AccessCodeRedemption {
  id           Int        @id @default(autoincrement())
  accessCodeId Int
  userId       Int
  caseFileId   Int
  redeemedAt   DateTime   @default(now())
  ...
  @@unique([accessCodeId, userId])  // ← unconditional
}
```

**File:** `app/api/access-codes/redeem/route.ts`

When `oneTimePerUser=true` (lines 117-132): short-circuits with
`alreadyRedeemed: true`. When `oneTimePerUser=false` (lines 134-161): falls
through to `create()`, which throws `P2002`, caught and returns the same
`alreadyRedeemed: true` shape.

**Net effect:** observable behavior is identical regardless of flag value.
Multiple redemption rows for `(accessCodeId, userId)` cannot exist. The flag
is functionally a no-op.

**Severity assessment:** P1 is correct.

---

## 3. [v1 P1] JWT session not invalidated on password reset — CONFIRMED

**File:** `auth.config.ts`

```ts
// Line 4-6 — no maxAge → next-auth default 30 days
session: {
  strategy: "jwt",
},

// Line 12-18 — id/role only written on initial sign-in
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.role = user.role;
  }
  return token;
}

// Line 19-25 — session callback never re-reads from DB
async session({ session, token }) {
  if (session.user) {
    session.user.id = token.id;
    session.user.role = token.role;
  }
  return session;
}
```

**File:** `app/api/reset-password/route.ts`

```ts
// Lines 50-57 — updates passwordHash, clears reset token, NO session invalidation
await prisma.user.update({
  where: { id: user.id },
  data: {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
  },
});
```

The `User` model has no `tokenVersion` or `passwordChangedAt` field
(verified in schema). Old JWTs remain valid for up to 30 days after a
password reset.

**Severity assessment:** P1 is correct.

---

## 4. [v1+v2 P1] `seed-global-people.ts` and `unarchive-case.ts` lack `assertSafeEnv` — CONFIRMED

**File:** `scripts/seed-global-people.ts` (lines 1-5)

```ts
import dotenv from "dotenv";
import { prisma } from "../lib/prisma";

dotenv.config({ path: ".env.local" });
dotenv.config();
// no assertSafeEnv call
```

**File:** `scripts/unarchive-case.ts` (full file read)

```ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { prisma } from "../lib/prisma";

const CASE_ID = 3; // change this if needed
// no assertSafeEnv call

async function main() {
  ...
  const updated = await prisma.caseFile.update({
    where: { id: CASE_ID },
    data: { workflowStatus: "PUBLISHED" },
  });
}
```

`unarchive-case.ts` will publish whichever case has id=3 in whichever DB the
env vars point to. `seed-global-people.ts` performs `deleteMany` operations.

**Severity assessment:** P1 is correct. One-line fix per script.

---

## 5. [v1 P1] Duplicate-purchase 409 leaks email × case ownership — CONFIRMED

**File:** `app/api/checkout/route.ts` (lines 60-76)

```ts
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

Route is unauthenticated. Rate limit is 5/60s per (ip, route) (line 9).
An attacker can probe (email × caseId) → "did this email buy this case"
mapping at the rate-limit ceiling.

**Severity assessment:** P1 is correct.

---

## 6. [v1 P1] BuyButton double-click race / no Stripe `idempotencyKey` — CONFIRMED

**File:** `app/api/checkout/route.ts` (lines 60-106)

The duplicate-purchase guard checks `status: "COMPLETE"` only — does not check
`PENDING`. Two concurrent requests both pass the guard. Then:

```ts
// Line 81-91 — no idempotencyKey passed
const session = await getStripe().checkout.sessions.create({
  mode: "payment",
  line_items: [{ price: priceId, quantity: 1 }],
  customer_email: email,
  metadata: { caseId: String(caseId), email },
  success_url: ...,
  cancel_url: ...,
});

// Line 100-106 — Order created AFTER Stripe call
await prisma.order.create({
  data: { stripeSessionId: session.id, email, caseFileId: caseId },
});
```

Two near-simultaneous POSTs produce two Stripe sessions and two PENDING
Orders for the same `(caseId, email)`. If the buyer pays both, they're
charged twice for the same kit.

**Severity assessment:** P1 is correct.

---

## 7. [v1 P1] CSV export vulnerable to formula injection — CONFIRMED (severity may be inflated)

**File:** `app/api/admin/cases/[caseId]/codes/route.ts` (lines 72-77)

```ts
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

No prefix protection for `=`, `+`, `-`, `@`, `\t`. Any cell starting with
those characters executes as a formula in Excel/Sheets/Numbers.

**Today's exposure:** low. The exported cells are `code` (alphanumeric+dashes,
admin-controlled), `email` (Zod-validated, cannot start with `=`),
ISO timestamps, and `kitSerial` (admin-controlled prefix). No free-form
customer-supplied field reaches this CSV today.

**Future exposure:** any feature that adds a free-form field to the export
becomes immediately exploitable.

**Severity assessment:** P1 from v1 audit is slightly inflated for current
threat model. P2 is more accurate. Fix is still trivial and worthwhile.

---

## Summary

| # | Finding | Audit | Severity | Status |
|---|---|---|---|---|
| 1 | Checkout success page email leak | v2 | P1 | Confirmed |
| 2 | AccessCodeRedemption unique-key vs flag | v2 | P1 | Confirmed |
| 3 | JWT not invalidated on password reset | v1 | P1 | Confirmed |
| 4 | `assertSafeEnv` gap on two scripts | v1+v2 | P1 | Confirmed |
| 5 | Duplicate-purchase 409 enumeration | v1 | P1 | Confirmed |
| 6 | BuyButton race / no Stripe idempotency | v1 | P1 | Confirmed |
| 7 | CSV formula injection | v1 | P1 (→ P2) | Confirmed; severity slightly high |

7/7 findings real. Both audits trustworthy on the points checked. Proceed to
fix queue.
