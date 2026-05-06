# BATCH 8 — FIX PROMPT (verified-audit quick wins; no migrations)

You are a fresh Claude Code session running on Opus 4.7. Apply the eleven fixes below, surgically, one commit per fix, in order, plus a final report commit. No scope creep. No migrations. No new dependencies.

This batch closes ten of the twelve quick wins from §3.4 of `audits/2026-05-06-godmode-audit.md`, plus a backlog-tickets commit that records two product decisions made in chat for later batches. Three verified P1s land here: F-01 (cron timing oracle), F-03 (account-delete code re-claim loop), and F-06 (X-Forwarded-For rate-limit bypass — escalated to P1 by the operator after re-verification). The remaining seven are P2 defense-in-depth.

The 2026-05-06 audit dossier was independently verified after it was filed: 52/52 findings real, zero hallucinations. The fix locations cited below are taken from the audit and confirmed against HEAD `76a30ac` in a verification pass. Re-confirm against the actual file before each edit; if line numbers drift after any intervening commits, find the right location by content not by line number.

Read this entire prompt first. Then read `audits/2026-05-06-godmode-audit.md` Phase 2 (the forensic findings) and `audits/BATCH_7_REPORT.md` for house style. Then begin.

---

## 1. Operating principles (read twice)

1. **One commit per fix.** Subjects pre-written below — use verbatim.
2. **No migrations.** Schema is not touched in this batch. F-02 (partial refund) and F-14 (drop oneTimePerUser column) require migrations and are deferred to Batch 9. If you reach for `prisma migrate`, stop.
3. **No new dependencies.** No `npm install`, no `npm audit fix`. Use only what's already in `package.json`.
4. **No scope creep.** Capture out-of-scope discoveries in `audits/BATCH_8_OBSERVATIONS.md`. Resist the urge to combine with Batch 9 work even if the fix is "right there."
5. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` passing at the same count or higher. If either fails, stop and report.
6. **No env changes, no pushes, no deploys.**
7. **Ground truth = source code at HEAD.** This prompt cites locations against the post-Batch-7 state. The verification pass on 2026-05-06 confirmed those locations are still accurate. If anything has shifted since, find the right location by content.

---

## 2. Pre-flight

```
git rev-parse HEAD                  # should be at or after Batch 7's last commit (88163a5)
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 22 files / 168 tests
```

If any fail, stop. Confirm `audits/2026-05-06-godmode-audit.md`, `audits/BATCH_7_REPORT.md`, and `audits/BATCH_7_OBSERVATIONS.md` are on tree.

---

## 3. The eleven fixes

### Fix 1 — `fix(security): cron route hardening — timingSafeEqual + User-Agent check`

**Severity:** P1 (F-01 timing oracle) + P3 (F-37 defense-in-depth UA check). Bundled because both touch the same file and the same security control surface.

**Why P1 on the secret comparison.** Plain JavaScript `!==` short-circuits at the first mismatching character. Once the cron is invokable from the public internet (it is; Vercel cron hits the route via HTTPS), an attacker can extract `CRON_SECRET` byte-by-byte via response timing. There is no rate-limit on `/api/cron/*` (cron is unrate-limited by design — Vercel calls it once a day). Today's destructive scope is limited to flipping abandoned PENDING orders to FAILED, but the same `CRON_SECRET` will gate any future cron added (refund-cancel, payouts, abandoned-cart sweep), and once one is compromised all are.

**File:** `app/api/cron/cleanup-pending-orders/route.ts` only.

**Current state** (verified 2026-05-06):

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/lib/enums";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { message: "Cron is not configured." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }
  // ... sweep logic
}
```

**Replacement** (the auth block, lines 19-22 today):

```ts
const authHeader = request.headers.get("authorization") ?? "";
const expected = `Bearer ${cronSecret}`;
const expectedBuf = Buffer.from(expected);
const gotBuf = Buffer.from(authHeader);

// Constant-time comparison. Buffers must be the same length for
// timingSafeEqual; the length pre-check handles that without leaking
// timing itself (the length is observable to an attacker via
// content-length, but the secret bytes are not).
if (
  gotBuf.length !== expectedBuf.length ||
  !timingSafeEqual(gotBuf, expectedBuf)
) {
  return NextResponse.json({ message: "Forbidden." }, { status: 403 });
}

// Defense in depth: confirm the request actually came from Vercel cron.
// User-Agent is trivially forgeable, so this only blocks unsophisticated
// probes — but it raises the bar at zero cost. The console.warn lets
// ops notice if Vercel ever changes its UA string in a future platform
// update (we'd see a flood of 403s with a new UA value to investigate
// rather than silent successful 403s).
const userAgent = request.headers.get("user-agent");
if (userAgent !== "vercel-cron/1.0") {
  console.warn(
    `[CRON] Rejecting cleanup-pending-orders with unexpected user-agent: ${userAgent ?? "(none)"}`
  );
  return NextResponse.json({ message: "Forbidden." }, { status: 403 });
}
```

Add the import at the top of the file:

```ts
import { timingSafeEqual } from "crypto";
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — no existing test exercises `/api/cron/*`, so 168 still passing.
- **Add one test** at `tests/api/cron-cleanup.test.ts`:
  - Mock `prisma.order.updateMany` and assert: missing auth header → 403; wrong secret → 403; wrong UA → 403; correct secret + correct UA → 200; secret missing from env → 503.
  - Test count goes 168 → 173 (5 new cases).
- Mental trace: existing Vercel cron deploys will continue to work — Vercel sends `Authorization: Bearer <CRON_SECRET>` and `User-Agent: vercel-cron/1.0`. The UA value is documented at https://vercel.com/docs/cron-jobs.

**Commit subject:** `fix(security): cron route hardening — timingSafeEqual + User-Agent check`

---

### Fix 2 — `fix(security): rate-limit IP source reads x-real-ip first to defeat X-Forwarded-For spoofing`

**Severity:** P1 (escalated from P2). The 2026-05-06 audit's most adversarially-troubling finding. Every public POST rate-limit (registration 3/60s, code redeem 5/60s, theory 10/60s, checkpoint 20/60s, admin mutations 60/60s, account deletion 3/60s) is bypassable by spoofing `X-Forwarded-For: 1.2.3.<random>` per request. Without this fix, every rate-limit ceiling is decorative.

**Why x-real-ip is the right read on Vercel.** Vercel's edge sets `x-real-ip` to the verified client IP and overwrites any client-supplied value at the edge. Any client-supplied `x-real-ip` header is not honored by the edge and does not reach the function. By contrast, `x-forwarded-for` is APPENDED to (not replaced) — Vercel adds its own hop, but the leftmost token remains whatever the client claimed. Reading the leftmost XFF token is reading the attacker's input.

**File:** `lib/rate-limit.ts:88-95` only.

**Current state** (verified 2026-05-06):

```ts
function extractIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
```

**Replacement** (the entire `extractIp` function):

```ts
function extractIp(request: Request): string {
  // Production source of truth on Vercel: x-real-ip is set by the platform
  // edge to the verified client IP. Vercel overwrites any client-supplied
  // x-real-ip at the edge, so this header cannot be forged. Reading it
  // first means rate-limit buckets correspond to real client IPs in
  // production, defeating the X-Forwarded-For spoofing bypass that the
  // 2026-05-06 audit (F-06) flagged on the prior leftmost-token read.
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }

  // Dev fallback: when x-real-ip is absent (local development, no proxy),
  // honor the leftmost x-forwarded-for token. In production behind Vercel
  // x-real-ip is always set so this branch never executes there. In dev
  // we accept the leftmost XFF token because dev tools (curl, Postman,
  // Vitest's mock requests) commonly use it for per-IP test isolation.
  if (process.env.NODE_ENV !== "production") {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
  }

  return "unknown";
}
```

**Test impact.** `tests/lib/rate-limit.test.ts` and any test that constructs a `new Request(..., { headers: { 'x-forwarded-for': '...' } })` to fake per-IP isolation will continue to work in dev (`NODE_ENV !== "production"`). Vitest sets `NODE_ENV=test`, which is not `"production"`, so the dev fallback fires.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — should remain at 168 passing (the dev fallback preserves existing test behavior).
- **Add one test** at the bottom of `tests/lib/rate-limit.test.ts`:
  - In test mode (current default), `extractIp` reads from `x-forwarded-for` → returns the leftmost token (existing behavior preserved).
  - In a forced production-mode block (`vi.stubEnv('NODE_ENV', 'production')` then restore), `extractIp` ignores `x-forwarded-for` and reads only `x-real-ip`. Spoofed `x-forwarded-for: 1.2.3.4` is dropped; missing `x-real-ip` returns `"unknown"`.
  - Test count goes 173 → 175 (2 new cases).
- Mental trace: real production traffic from Vercel always carries `x-real-ip` set by the edge to the actual client IP. The `(useUpstash) ? upstash.limit(key) : consumeFromMemory(...)` branching in the rest of the file is unchanged. The bucket key shape `${ip}:${pathname}` is unchanged. All Upstash buckets re-key transparently because the key includes the IP — old (forgeable) keys age out per the bucket's window, and new (real) keys take over.

**Operational note for `audits/BATCH_8_OBSERVATIONS.md`:** Vercel docs at https://vercel.com/docs/edge-network/headers#x-real-ip are the source of truth for x-real-ip behavior. If Vercel ever changes this contract, this fix needs revisit. As of 2026 the contract holds.

**Commit subject:** `fix(security): rate-limit IP source reads x-real-ip first to defeat X-Forwarded-For spoofing`

---

### Fix 3 — `fix(security): revoke claimed activation codes on user-delete to close re-claim loop`

**Severity:** P1. F-03 from the 2026-05-06 audit. When a user deletes their account, `ActivationCode.claimedByUserId` is `SetNull` per the FK rule (verified at `prisma/migrations/20260425045353_init/migration.sql:457` — `ON DELETE SET NULL`). The `claimedAt` timestamp persists, but `claimedByUserId` becomes null. The activate-route's "already claimed by someone else" guard at `app/api/cases/activate/route.ts:64-94` checks `activation.claimedByUserId !== null` — after SetNull, this branch is bypassed. A new user can re-redeem the same code.

**Abuse vector.** Frugal-user-as-gifter: buy → redeem → delete account → friend creates account → friend redeems same code → indefinite repeat on a single $30 purchase. Cost of each loop is one Stripe transaction (real card swipe), so an attacker needs a stolen card to scale, but the legitimate "give my kit to a friend" path is wide open.

**File:** `app/api/me/route.ts:74-91` only. The deletion call is at line 89 today.

**Current state** (verified 2026-05-06):

```ts
// Cascade-delete. Schema cascades handle:
//   User → UserCase (cascade, also drops UserCaseEvent)
//   User → TheorySubmission (cascade)
//   User → CheckpointAttempt (cascade)
//   User → AccessCodeRedemption (cascade)
//   User → ActivationCode.claimedByUserId (SetNull — preserves the code,
//                                          unowns it so it could be re-used
//                                          by another account if not also
//                                          revokedAt-stamped, which it is
//                                          NOT today; out of scope here)
//
// Order has no FK to User by design (Batch 5 deferred Order.userId), so
// financial records persist after user deletion — Order.email remains as
// the buyer-of-record identifier, satisfying tax-retention obligations
// documented in the Privacy Policy §8.
await prisma.user.delete({ where: { id: userId } });

return NextResponse.json({ message: "Account deleted." }, { status: 200 });
```

**Replacement** (replace lines 74-91; comment is updated to reflect the new behavior):

```ts
// Cascade-delete. Schema cascades handle:
//   User → UserCase (cascade, also drops UserCaseEvent)
//   User → TheorySubmission (cascade)
//   User → CheckpointAttempt (cascade)
//   User → AccessCodeRedemption (cascade)
//   User → ActivationCode.claimedByUserId (SetNull — preserves the code
//                                          row but un-claims it)
//
// Order has no FK to User by design (Batch 5 deferred Order.userId), so
// financial records persist after user deletion — Order.email remains as
// the buyer-of-record identifier, satisfying tax-retention obligations
// documented in the Privacy Policy §8.
//
// We also explicitly stamp `revokedAt` on every activation code the user
// had claimed BEFORE deleting. Without this, the SetNull cascade leaves
// codes with `claimedAt` set + `claimedByUserId` null, which the activate
// route treats as "unclaimed" and lets a fresh account re-redeem (the
// re-claim loop documented as Batch 6 Observation 2 and re-flagged in the
// 2026-05-06 audit as F-03).
//
// Both writes are wrapped in a single transaction so a partial failure
// (DB hiccup mid-delete) leaves the user's data intact rather than the
// codes pre-revoked but the user still present.
await prisma.$transaction([
  prisma.activationCode.updateMany({
    where: { claimedByUserId: userId, revokedAt: null },
    data: { revokedAt: new Date() },
  }),
  prisma.user.delete({ where: { id: userId } }),
]);

return NextResponse.json({ message: "Account deleted." }, { status: 200 });
```

The `where` clause includes `revokedAt: null` to avoid clobbering an already-revoked timestamp (e.g. if a code was revoked manually by an admin earlier and the user later deletes their account — preserve the original revocation moment for audit trail).

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — `tests/api/me.test.ts` has 7 existing happy-path/edge-path tests; the new behavior adds writes but doesn't break any. 175 still passing.
- **Add one test** in `tests/api/me.test.ts`:
  - Setup: create User + create ActivationCode with `claimedByUserId: user.id` and `claimedAt: someDate`, `revokedAt: null`.
  - Action: DELETE /api/me with correct password.
  - Assert: response 200; `prisma.activationCode.findUnique({ where: { code } }).revokedAt` is non-null; `prisma.user.findUnique({ where: { id: user.id } })` is null.
  - Test count goes 175 → 176.
- Mental trace: a non-frugal user who deletes their account once is unaffected — the only side effect they observe is the code can no longer be re-redeemed by them or anyone else, which is the correct behavior for "I want my data gone." A frugal user attempting the loop now hits 410 Gone on the second redeem.

**Commit subject:** `fix(security): revoke claimed activation codes on user-delete to close re-claim loop`

---

### Fix 4 — `fix(checkout): drop 15-min bucket from Stripe idempotencyKey to prevent stale-tab double-charge`

**Severity:** P2. F-07 from the 2026-05-06 audit. A user with a stale checkout tab (open >15 min) who clicks "Continue" again gets a fresh `bucket = Math.floor(Date.now() / (15 * 60 * 1000))` value, which produces a new idempotencyKey, which produces a new Stripe session. The PENDING-session-reuse short-circuit catches this when the prior PENDING Order is < 15 min old, but falls through for older ones. Between minute 15 and "Stripe expires the session" (default 3 hours for Checkout), a stale-tab clicker can mint a duplicate paid path. If they pay both, they're charged twice.

**File:** `app/api/checkout/route.ts:124-130` only.

**Current state** (verified 2026-05-06):

```ts
const emailHash = createHash("sha256")
  .update(parsed.data.email)
  .digest("hex")
  .slice(0, 16);
const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
const idempotencyKey = `checkout-case-${parsed.data.caseId}-${emailHash}-${bucket}`;
```

**Replacement:**

```ts
const emailHash = createHash("sha256")
  .update(parsed.data.email)
  .digest("hex")
  .slice(0, 16);
// Stripe persists idempotency keys for ~24 hours by default, which matches
// the practical lifetime of a Stripe Checkout session (default 3-hour
// session expiry, with retries thereafter producing the same outcome).
// Two requests with the same (caseId, emailHash) within 24 hours collapse
// to one Stripe session regardless of how many tabs the user has open or
// how long they wait between clicks. Combined with the existing
// PENDING-session-reuse short-circuit higher in this handler, this closes
// the F-07 stale-tab double-mint window.
const idempotencyKey = `checkout-case-${parsed.data.caseId}-${emailHash}`;
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — `tests/api/stripe.test.ts` has the existing duplicate-checkout-returns-same-session test. It uses `vi.fn()` for the Stripe SDK; the assertion is on `stripeMock.checkout.sessions.create` being called once, not on the exact key shape. Verify with grep: `grep "idempotencyKey" tests/`. If a test pins the exact key value, update it to the new shape; otherwise no test changes needed.
- Mental trace: a user clicks Continue at minute 0 → key `checkout-case-3-abc123def456ffff` → Stripe creates session A. User reopens tab at minute 16 and clicks Continue → key is unchanged → Stripe returns the SAME session A (idempotency hit). User cannot mint a duplicate. The PENDING-session-reuse short-circuit higher in the handler still applies for the application-side flow.

**Commit subject:** `fix(checkout): drop 15-min bucket from Stripe idempotencyKey to prevent stale-tab double-charge`

---

### Fix 5 — `fix(admin): atomic updateMany on activation-code revoke (close read-then-write race)`

**Severity:** P2. F-19 from the 2026-05-06 audit. Two admins racing the revoke API both pass the `existing.revokedAt !== null` check, both call `.update`. The second's timestamp overwrites the first's. Cosmetic — both intended to revoke — but it muddies the audit trail.

**File:** `app/api/admin/cases/[caseId]/codes/[codeId]/route.ts:46-65` only.

**Current state** (verified 2026-05-06):

```ts
const existing = await prisma.activationCode.findUnique({
  where: { id: parsedCodeId },
});
if (!existing) {
  return NextResponse.json({ message: "Not found." }, { status: 404 });
}
if (existing.revokedAt !== null) {
  return NextResponse.json(
    { message: "This code has already been revoked." },
    { status: 409 }
  );
}

await prisma.activationCode.update({
  where: { id: parsedCodeId },
  data: { revokedAt: new Date() },
});
```

**Replacement** (drop the `existing` lookup; use `updateMany` with the `revokedAt: null` precondition):

```ts
// Atomic: only revoke if not already revoked. count===0 means either the
// code doesn't exist OR it's already revoked. Distinguish by a follow-up
// findUnique only on miss, to give the admin a clear 404-vs-409.
const result = await prisma.activationCode.updateMany({
  where: { id: parsedCodeId, revokedAt: null },
  data: { revokedAt: new Date() },
});

if (result.count === 0) {
  const exists = await prisma.activationCode.findUnique({
    where: { id: parsedCodeId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  return NextResponse.json(
    { message: "This code has already been revoked." },
    { status: 409 }
  );
}
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — `tests/api/admin-codes.test.ts` has revoke happy-path + already-revoked 409 tests. Both still pass — the API contract is unchanged. 176 still passing.
- Mental trace: admin A and admin B click Revoke simultaneously. A's `updateMany` matches (count=1, sets revokedAt to t0). B's `updateMany` runs against `revokedAt: null` precondition — but A already wrote, so the precondition fails (count=0). B's branch goes to the findUnique → exists → returns 409. No double-write. Audit trail preserves t0 cleanly.

**Commit subject:** `fix(admin): atomic updateMany on activation-code revoke (close read-then-write race)`

---

### Fix 6 — `fix(security): R2 upload pipeline hardening — Content-Length cap + Sharp pixel limit`

**Severity:** P2 (F-11 + F-12). Both findings from the 2026-05-06 audit, bundled because both harden the same pipeline.

**F-11.** The presigned PUT URL is issued with `Bucket`, `Key`, `ContentType` only — no `ContentLength` constraint. An admin (or a stolen presigned URL — they're valid for 15 minutes regardless of session state) can PUT a 5GB file straight to R2. Cloudflare R2 charges per-GB-stored.

**F-12.** Sharp's default `limitInputPixels` is ~268M pixels. An admin (or compromised admin) feeding a 16384×16384 PNG through the blurhash route consumes ~3GB of memory before the resize clips. Vercel functions have memory limits.

**Files:**
- `app/api/admin/uploads/sign/route.ts:86-94` (presigned PUT)
- `app/api/admin/uploads/blurhash/route.ts:30-34` (Sharp call)

**Current sign-route state** (lines 86-94 today):

```ts
const command = new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  ContentType: parsed.data.contentType,
});
const url = await getSignedUrl(s3, command, { expiresIn: 60 * 15 });
```

**Replacement:**

```ts
// Maximum upload size matches the client-side advisory in
// components/admin/ImageUploader.tsx (5 MB). The client check is
// advisory; this server-side cap is enforced by Cloudflare R2 because
// the ContentLength is part of the signed parameters. An attacker who
// steals a presigned URL cannot upload past this size — R2 rejects the
// PUT with 403 SignatureDoesNotMatch when the actual Content-Length
// header on the upload differs from the signed value.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const command = new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  ContentType: parsed.data.contentType,
  ContentLength: MAX_UPLOAD_BYTES,
});
const url = await getSignedUrl(s3, command, { expiresIn: 60 * 15 });
```

**Note** — `ContentLength` in a signed URL means "the upload MUST be exactly this many bytes." The client must set its `Content-Length` header to `MAX_UPLOAD_BYTES` exactly, OR you can use `ContentLengthRange` (an unsigned-payload helper, not directly supported by `@aws-sdk/s3-request-presigner` in this version). The right pattern for a "max size, any size below" cap with the v3 SDK is to set `ContentLength` to the exact expected value and have the client pad if it must, OR use a separate API for variable-size uploads. **Verify the actual SDK behavior before committing**: check if `ContentLength` in the signed URL is "exact-match" or "≤ max." If exact-match, instead use `ChecksumAlgorithm` or accept that this fix only blocks "much larger than expected" uploads (a 5GB attempt fails because its CL header is 5GB; a 4MB legitimate upload may also fail because its CL header is 4MB ≠ 5MB).

If `ContentLength` is exact-match in this SDK version, **fall back to documenting the limit in the response** rather than enforcing it cryptographically — the cleanest interim fix is to add a Cloudflare R2 lifecycle rule (out of scope for this batch since it's dashboard work, not code). Document that as a follow-up in `audits/BATCH_8_OBSERVATIONS.md`. **Do not ship a fix that breaks legitimate uploads.**

**If the SDK behavior is "≤ max" (older v2 contract), proceed with the fix as written.** Verify by:
1. Reading `node_modules/@aws-sdk/s3-request-presigner/dist-types/index.d.ts` for the `ContentLength` field's docstring.
2. Test against R2 by uploading a 1KB file with the new presigned URL — should succeed if "≤ max", fail with SignatureDoesNotMatch if "exact-match."

**If verification proves exact-match,** revert this part of the commit and only land the Sharp fix (F-12) below; defer F-11 to BATCH_8_OBSERVATIONS as "blocked on R2 lifecycle config or different signing approach."

**Current blurhash-route state** (line 30 today):

```ts
const { data, info } = await sharp(inputBuffer)
  .resize({ width: TARGET_WIDTH, fit: "inside" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
```

**Replacement:**

```ts
const { data, info } = await sharp(inputBuffer, {
  // Cap input at 1 megapixel (1024×1024). Anything larger is overkill
  // for a blurhash placeholder anyway — the algorithm is designed for
  // tiny low-frequency previews. Without this cap, Sharp's default
  // 268-megapixel limit lets a 16384×16384 input consume ~3GB of memory
  // before the resize clips, OOM-ing the Vercel function.
  limitInputPixels: 1_048_576,
})
  .resize({ width: TARGET_WIDTH, fit: "inside" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — `tests/api/admin-uploads.test.ts` has sign + blurhash happy paths. Both still pass. 176 still passing.
- Mental trace (blurhash): a legitimate 800×600 hero image (480k pixels) is well under the 1M cap. A 16384×16384 attack input throws Sharp's `Input image exceeds pixel limit` error, which the catch block surfaces as a 422 to the admin. No memory blowup.

**Commit subject:** `fix(security): R2 upload pipeline hardening — Content-Length cap + Sharp pixel limit`

---

### Fix 7 — `fix(email): add Reply-To: support@... to activation-code email`

**Severity:** P2. F-20 from the 2026-05-06 audit. The activation-code email sets `from: getResendFrom()` (default `no-reply@theblackledger.app`) and the body says "If you have any trouble, reply to this email" — but there is no `replyTo`. A reply lands at the no-reply mailbox, which is unmonitored. Customers who reply lose the message silently.

**File:** `app/api/webhooks/stripe/route.ts:284-321` (the `getResend().emails.send(...)` call).

**Current state** (verified 2026-05-06):

```ts
await getResend().emails.send({
  from: getResendFrom(),
  to: buyerEmail,
  subject: "Your Black Ledger activation code",
  text: [...].join("\n"),
  html: `...`,
});
```

**Replacement** — add a single field to the send args:

```ts
await getResend().emails.send({
  from: getResendFrom(),
  to: buyerEmail,
  // Customers who hit Reply on this email land at our monitored support
  // mailbox, not the no-reply From address. Required by CAN-SPAM
  // (US transactional best practice) and GDPR transactional-email
  // hygiene. Closes F-20 from the 2026-05-06 audit.
  replyTo: "support@theblackledger.app",
  subject: "Your Black Ledger activation code",
  text: [...].join("\n"),
  html: `...`,
});
```

**Apply the same pattern** to the support-reply route at `app/api/admin/support/[id]/reply/route.ts:58-79` if a `replyTo` is missing there (the audit notes it's good hygiene even though the support reply is already from a monitored mailbox replying to the customer). Read the file first; if `replyTo` is already set there, skip and note in observations.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — `tests/api/stripe.test.ts` checkout-completed test mocks `resend.emails.send`. The assertion checks the call was made; verify it doesn't pin the args object to the exact prior shape. If it does, update the assertion to allow the new field. 176 still passing.
- Mental trace: customer receives the activation email, replies "I never got the code," reply lands at `support@theblackledger.app`, support@ is the monitored mailbox feeding the support inbox UI, operator sees the inbound email, replies via the existing `/api/admin/support/[id]/reply` endpoint.

**Commit subject:** `fix(email): add Reply-To: support@... to activation-code email`

---

### Fix 8 — `fix(checkout): explicit toLowerCase on Order.email at every write site`

**Severity:** P2 (defense-in-depth). F-29 from the 2026-05-06 audit. `Order.email` is currently lowercased only because Zod's `checkoutSchema` does the lowercasing at parse time. The Stripe metadata flow (`checkout/route.ts:143-146` → webhook recovery at `webhooks/stripe/route.ts:230-236`) preserves the lowercased value through `metadata.email`. Today the implementation is correct; the dependency on Zod is a hidden coupling. If a future caller submits a non-Zod-validated email to the metadata pipeline, case-drift creeps in and the duplicate-purchase guard (which uses `mode: "insensitive"`) goes blind to one branch.

**Files:**
- `app/api/checkout/route.ts:170` (Order create write site)
- `app/api/webhooks/stripe/route.ts:230-236` (orphan-recovery write site, where buyerEmail comes from session metadata)

**Pattern.** At every site that writes `Order.email`, normalize explicitly with `.toLowerCase()` immediately before the Prisma write. Do not rely on upstream validators. The change is one or two lines per site.

**Current state at checkout/route.ts:170** (read the file first to confirm exact location):

```ts
data: {
  email: parsed.data.email,
  caseFileId: caseId,
  status: OrderStatus.PENDING,
  stripeSessionId: session.id,
}
```

**Replacement:**

```ts
data: {
  email: parsed.data.email.trim().toLowerCase(),
  caseFileId: caseId,
  status: OrderStatus.PENDING,
  stripeSessionId: session.id,
}
```

**Current state at webhooks/stripe/route.ts** (around line 230-236, verify by reading): the orphan-recovery flow extracts `buyerEmail` from `session.metadata.email` and may write it into a recovery Order. Wherever it's written, apply the same `.trim().toLowerCase()`.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — existing tests use lowercase emails throughout, so behavior is identical. 176 still passing.
- Mental trace: the duplicate-purchase guard at `checkout/route.ts:65-68` uses `email: { equals: parsed.data.email, mode: "insensitive" }`. Even with mode-insensitive lookup, having data normalized at write time is faster (the index can use equality) and more predictable.

**Commit subject:** `fix(checkout): explicit toLowerCase on Order.email at every write site`

---

### Fix 9 — `fix(checkpoint): move CheckpointAttempt write inside the stage-advance transaction`

**Severity:** P2. F-17 from the 2026-05-06 audit. `prisma.checkpointAttempt.create` is called outside the transaction at line 139 today, before the `$transaction` at line 165 that contains the `updateMany` precondition for STAGE_CONFLICT. If two concurrent requests both pass the matcher, the loser throws STAGE_CONFLICT and the transaction rolls back — but the loser's CheckpointAttempt row was already committed before the transaction started. Audit-trail noise: the log shows attempts that "succeeded" but didn't advance the stage.

**File:** `app/api/cases/[slug]/checkpoint/route.ts` only. Lines 139 and 165 today; verify by reading.

**Pattern.** Move the `checkpointAttempt.create` call from its current pre-transaction location to inside the existing `$transaction` block. Order: first the `updateMany` precondition, then if it succeeded, `checkpointAttempt.create` + `userCaseEvent.create` (or whichever order is currently inside the transaction body).

The existing pattern at the end of the transaction is something like:

```ts
await prisma.$transaction(async (tx) => {
  const advance = await tx.userCase.updateMany({
    where: { id: userCase.id, currentStage: ownedStage },
    data: { currentStage: nextStage },
  });
  if (advance.count !== 1) throw new Error("STAGE_CONFLICT");
  await tx.userCaseEvent.create({ data: { ... } });
});
```

After the move it becomes:

```ts
await prisma.$transaction(async (tx) => {
  const advance = await tx.userCase.updateMany({
    where: { id: userCase.id, currentStage: ownedStage },
    data: { currentStage: nextStage },
  });
  if (advance.count !== 1) throw new Error("STAGE_CONFLICT");
  // CheckpointAttempt write is INSIDE the transaction so it rolls back
  // alongside the stage advance on STAGE_CONFLICT — preserves audit-trail
  // accuracy (attempts that didn't advance don't leave artifacts).
  await tx.checkpointAttempt.create({
    data: {
      userId,
      caseFileId: userCase.caseFileId,
      stage: ownedStage,
      answer: parsed.data.answer,
      isCorrect,
    },
  });
  await tx.userCaseEvent.create({ data: { ... } });
});
```

**Important nuance.** The `if (!isCorrect) return 400;` early-return in the current code lives AFTER the (currently outside-transaction) CheckpointAttempt.create. After the move, the wrong-answer path no longer creates a CheckpointAttempt at all — which is a behavior change. Wrong-answer attempts ARE useful audit data (you want to know players are guessing). To preserve this, write the CheckpointAttempt for wrong-answer attempts OUTSIDE the transaction (the current location) AND for correct-answer attempts INSIDE the transaction. Two write sites, branch on `isCorrect`:

```ts
if (!isCorrect) {
  // Wrong answer: write the attempt, return 400. No stage advance to
  // roll back; no transaction needed.
  await prisma.checkpointAttempt.create({
    data: { userId, caseFileId: userCase.caseFileId, stage: ownedStage, answer: parsed.data.answer, isCorrect: false },
  });
  return NextResponse.json(
    { message: "That's not the right answer." },
    { status: 400 }
  );
}

// Correct answer: write the attempt inside the transaction so a STAGE_CONFLICT
// rollback also rolls back the attempt. This way the audit trail only records
// attempts that actually advanced (or failed to advance for a real reason).
await prisma.$transaction(async (tx) => {
  const advance = await tx.userCase.updateMany({
    where: { id: userCase.id, currentStage: ownedStage },
    data: { currentStage: nextStage },
  });
  if (advance.count !== 1) {
    return NextResponse.json({ message: "Stage conflict." }, { status: 409 });
  }
  await tx.checkpointAttempt.create({
    data: { userId, caseFileId: userCase.caseFileId, stage: ownedStage, answer: parsed.data.answer, isCorrect: true },
  });
  await tx.userCaseEvent.create({ data: { ... } });
});
```

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — `tests/api/checkpoint.test.ts` has matcher + STAGE_CONFLICT cases. Existing 409 case still triggers. The wrong-answer test still finds the CheckpointAttempt row. 176 still passing.
- Mental trace: two concurrent correct submissions, both pass the matcher, both enter their transactions. A's `updateMany` advances; A's CheckpointAttempt(isCorrect: true) is inserted; A commits. B's `updateMany` finds 0 matches (A already advanced), B returns 409, B's transaction rolls back, B's CheckpointAttempt is NOT inserted. Audit trail: one correct attempt, one 409 client-side error, no false-positive log.

**Commit subject:** `fix(checkpoint): move CheckpointAttempt write inside the stage-advance transaction`

---

### Fix 10 — `feat(admin): include hidden_evidence in CreateAccessCodeForm and access-codes page`

**Severity:** P2. F-15 from the 2026-05-06 audit. Batch 4 Fix 2 widened the API-side validator to accept `hidden_evidence` and added the ownership branch at `app/api/admin/cases/[caseId]/access-codes/route.ts:95-101`. The redeem route + workspace renderer support `hidden_evidence`. But `CreateAccessCodeForm.tsx:5` still has `type TargetType = "record" | "person" | "hint"` — admins cannot create a hidden_evidence AccessCode through the UI.

**Files:**
- `app/bureau/admin/cases/[caseId]/access-codes/page.tsx` — extend the case-file fetch to include `hiddenEvidence` rows.
- `app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodesPanel.tsx` — accept and forward the new prop.
- `app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx` — widen `TargetType`, accept new prop, add dropdown option, add `targetOptions` branch.

**Step 1.** In `page.tsx`, extend the `caseFile` query include block:

```ts
const caseFile = await prisma.caseFile.findUnique({
  where: { id: parsedCaseId },
  include: {
    people: { select: { id: true, name: true }, orderBy: { sortOrder: "asc" } },
    records: { select: { id: true, title: true }, orderBy: { sortOrder: "asc" } },
    hints: { select: { id: true, title: true }, orderBy: [{ unlockStage: "asc" }, { sortOrder: "asc" }] },
    // F-15: surface hidden_evidence rows so admins can target them from the UI.
    // Same shape as hints — id + title for display + lookup.
    hiddenEvidence: { select: { id: true, title: true }, orderBy: { sortOrder: "asc" } },
  },
});
```

**Verify the relation name** before committing — in `prisma/schema.prisma` find the `CaseFile` model and confirm the back-relation field on the HiddenEvidence join is named `hiddenEvidence` (camelCase). If it's named differently (e.g. `hiddenEvidences`), use the correct name. If `HiddenEvidence` doesn't have a `sortOrder` field, drop the orderBy or use `id` instead.

Pass the new prop to `<AccessCodesPanel ... hiddenEvidence={caseFile.hiddenEvidence} />`.

**Step 2.** In `AccessCodesPanel.tsx`, add `hiddenEvidence: { id: number; title: string }[]` to its `Props` and forward it to `<CreateAccessCodeForm ... hiddenEvidence={hiddenEvidence} />`.

**Step 3.** In `CreateAccessCodeForm.tsx`:

- Widen the union: `type TargetType = "record" | "person" | "hint" | "hidden_evidence";`
- Add `hiddenEvidence: { id: number; title: string }[]` to `Props`.
- Update `targetOptions` useMemo:

```ts
const targetOptions = useMemo(() => {
  if (targetType === "record") return records.map((r) => ({ id: r.id, label: r.title }));
  if (targetType === "person") return people.map((p) => ({ id: p.id, label: p.name }));
  if (targetType === "hint") return hints.map((h) => ({ id: h.id, label: h.title }));
  return hiddenEvidence.map((h) => ({ id: h.id, label: h.title }));
}, [targetType, records, people, hints, hiddenEvidence]);
```

- Add the dropdown option (in the existing Target type select):

```tsx
<option value="record">Record</option>
<option value="person">Person</option>
<option value="hint">Hint</option>
<option value="hidden_evidence">Hidden evidence</option>
```

**Verification:**
- `npx tsc --noEmit` clean — tsc will catch any prop drift between the three files.
- `npx vitest run` — no existing UI test covers this form; manual smoke test only.
- Manual trace: navigate to `/bureau/admin/cases/<id>/access-codes`, click "Create access code," select target type "Hidden evidence" — the target dropdown should populate with hidden_evidence rows from the case. Submit; the API should accept and create the row (the validator + route already accept `hidden_evidence`).
- If `caseFile.hiddenEvidence` returns empty (e.g. the seed cases have no hidden_evidence rows), the dropdown shows "No hidden_evidence available — add one first." That copy already exists for the other types.

**Commit subject:** `feat(admin): include hidden_evidence in CreateAccessCodeForm and access-codes page`

---

### Fix 11 — `docs(backlog): record deferred Batch 9 product items + revisit triggers in CLAUDE.md`

**Severity:** Administrative. Records two product decisions made in chat 2026-05-06 so future sessions don't re-litigate them.

**File:** `site/CLAUDE.md` only. Append a new subsection at the bottom of the "Known follow-ups" section, BEFORE the "Upcoming major milestones" subsection:

```markdown
**Deferred product / architecture decisions (revisit triggers):**

- **Self-serve refund flow (`/api/refund-request`)** — DEFERRED. Decision made 2026-05-06: today's manual flow (customer emails support@..., operator verifies + processes Stripe refund, charge.refunded webhook revokes code) is fine at current volume. Revisit when monthly order volume reaches roughly 50–100 OR when refund handling becomes a support burden. Until then, Terms §7 specifies the manual flow with required info (purchase email, order number or activation code, brief reason). Implementation sketch when we revisit: authenticated `POST /api/refund-request` → asserts `Order.createdAt > now - 7 days` AND `ActivationCode.claimedAt === null` → calls `stripe.refunds.create` → fires the existing `charge.refunded` handler. ~200 lines + UI.
- **Authenticated purchase flow (account-before-checkout)** — DEFERRED. Decision made 2026-05-06: keep guest checkout via Stripe Checkout with email-delivered activation code. Per-recipient activation-email throttle (3/hour to the same normalized email) ships as the interim spam-relay defense in Batch 9 — see F-13 in `audits/2026-05-06-godmode-audit.md`. Revisit the architectural fix (require account creation pre-checkout, deliver code via authenticated link) when: (a) the throttle proves insufficient and Resend account reputation suffers, OR (b) we need to store the buyer's identity for refund automation, OR (c) we need a customer dashboard with order history. Today: BuyButton flow remains as-is.
```

Also update the "Upcoming major milestones" list to remove F-05 / F-13 from the "still open" framing (they're now scheduled for Batch 9, not floating).

**Verification:**
- No TypeScript implications.
- `npx vitest run` — 176 still passing.
- Cosmetic only.

**Commit subject:** `docs(backlog): record deferred Batch 9 product items + revisit triggers in CLAUDE.md`

---

## 4. Final verification gate

After all eleven commits are on tree:

```
git log --oneline -11               # confirm 11 commits in order
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 176 tests passing (168 baseline + 8 new)
npm run build                       # clean
git diff main~11 main --stat        # confirm only authorized files touched
```

Expected files touched:

```
app/api/cron/cleanup-pending-orders/route.ts         (Fix 1)
tests/api/cron-cleanup.test.ts                       (Fix 1, new)
lib/rate-limit.ts                                    (Fix 2)
tests/lib/rate-limit.test.ts                         (Fix 2)
app/api/me/route.ts                                  (Fix 3)
tests/api/me.test.ts                                 (Fix 3)
app/api/checkout/route.ts                            (Fix 4 + Fix 8)
app/api/admin/cases/[caseId]/codes/[codeId]/route.ts (Fix 5)
app/api/admin/uploads/sign/route.ts                  (Fix 6)
app/api/admin/uploads/blurhash/route.ts              (Fix 6)
app/api/webhooks/stripe/route.ts                     (Fix 7 + Fix 8)
app/api/admin/support/[id]/reply/route.ts            (Fix 7, only if missing replyTo)
app/api/cases/[slug]/checkpoint/route.ts             (Fix 9)
app/bureau/admin/cases/[caseId]/access-codes/page.tsx                                       (Fix 10)
app/bureau/admin/cases/[caseId]/access-codes/_components/AccessCodesPanel.tsx               (Fix 10)
app/bureau/admin/cases/[caseId]/access-codes/_components/CreateAccessCodeForm.tsx           (Fix 10)
CLAUDE.md                                            (Fix 11)
audits/BATCH_8_REPORT.md                             (Fix 12, new)
audits/BATCH_8_OBSERVATIONS.md                       (Fix 12, new)
```

If any other file is in the diff, restore it before declaring done.

If Fix 6's R2 ContentLength portion was reverted due to SDK exact-match behavior, that file's diff is smaller (only the Sharp pixel-limit change remains). Note in the report.

---

## 5. Required output

`audits/BATCH_8_REPORT.md` matching the structure of `audits/BATCH_7_REPORT.md`. Per-commit hash + subject + file diff + tsc/vitest results + mental trace + anomalies + pre-flight tree state at top.

`audits/BATCH_8_OBSERVATIONS.md` — capture explicitly:

1. **F-02 partial-refund handler (P1) deferred to Batch 9.** Recommendation B was selected by the operator on 2026-05-06: partial refunds flag the Order as `PARTIALLY_REFUNDED` (a new OrderStatus enum value) but keep entitlement active. Only `amount_refunded === amount` revokes. Entitlement revocation marks UserCase as inactive (preserves progress) rather than `deleteMany`. Requires: schema migration adding `OrderStatus.PARTIALLY_REFUNDED` + `UserCase.revokedAt: DateTime?` (or equivalent inactive flag) + new webhook branch logic + 4-5 new tests covering full/partial/refund-of-already-revoked flows. Larger work, separate batch.
2. **F-13 per-recipient activation-email throttle (P2) deferred to Batch 9.** Operator confirmed the interim throttle path (3/hour to same normalized email) on 2026-05-06. Implementation: in the webhook's email-send block, `prisma.order.count({ where: { email, createdAt: { gt: oneHourAgo }, status: COMPLETE } })` → if > 3, log + mark `Order.emailLastError: "Throttled"` + skip the Resend send. Architectural fix (account-before-checkout) recorded as backlog ticket in CLAUDE.md.
3. **F-14 oneTimePerUser column drop (P2) deferred to Batch 9.** Operator confirmed the column drop on 2026-05-06 (my call): the `@@unique([accessCodeId, userId])` constraint already enforces one-per-user unconditionally, the flag is a no-op. Drop requires migration + redeem-route conditional removal + validator field removal + admin UI toggle removal + test cleanup. Migration is destructive (DROP COLUMN), so deploy ordering matters: code change first (which doesn't reference the column), migration second.
4. **F-04 Privacy Policy §6 factual error** — operator action, not code. Brief Georgian lawyer specifically on (a) Stripe Payments Europe Ltd disclosure for EU buyers, (b) Cloudflare R2 region/jurisdiction language. Wait for lawyer review before re-shipping §6.
5. **F-05 Terms §7 rewrite** deferred to Batch 9 per operator instruction. The new version specifies: 7-day window, customer emails support@..., required info (purchase email + order number or activation code + brief reason), manual processing through Stripe.
6. **R2 Content-Length (Fix 6 first half) — verify SDK behavior before relying on this fix.** If the v3 SDK's `ContentLength` in a signed URL means "exact-match" (not "≤ max"), the fix breaks any upload whose actual size differs from `MAX_UPLOAD_BYTES` exactly. In that case revert and document a Cloudflare R2 lifecycle rule as the alternative. The Sharp pixel-limit half of Fix 6 is unaffected.
7. **Carry-forward items still deferred:** Sentry / structured logging (needs npm install — separate batch with explicit install permission), CSP nonce migration (multi-week refactor of every Framer-Motion usage), `app/layout.tsx` calling `auth()` on every render (perf refactor needs Navbar lazy-fetch pattern), forgot-password timing leak (clean fix with `after()` breaks existing Resend-call assertion).

**Commit subject:** `docs(audit): batch 8 report + observations`

Then stop. Do not push. Do not start Batch 9.

---

## 6. Begin

Read `audits/2026-05-06-godmode-audit.md` Phase 2 (the forensic findings — confirms the 11 finding IDs cited above against their full evidence blocks). Read `audits/BATCH_7_REPORT.md` for house style. Then start with Fix 1's pre-flight + cron route hardening. Commit. Verify. Move to Fix 2's `extractIp` rewrite. Continue through Fix 11. Write the two report files in commit 12. Done.
