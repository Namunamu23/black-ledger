# BATCH 6 — FIX PROMPT (account-deletion endpoint to close Privacy Policy commitment)

You are a fresh Claude Code session running on Opus 4.7. Apply the three fixes below, surgically, one commit per fix, in order, plus a final report commit. No scope creep. No migrations. No fixes that aren't on this list.

This batch closes the legal-vs-code drift filed as P1-7 (Cowork audit) / P1-1 (Cowork) on 2026-05-01: the Privacy Policy at `app/privacy/page.tsx:318-323` promises automated account deletion, but no `DELETE /api/me` endpoint exists. Batch 6 ships the endpoint, the UI, and the dashboard entry point.

Read this entire prompt first. Then read the two audit dossiers and `BATCH_5_REPORT.md` for the latest project context. Then begin.

---

## 1. Operating principles (read twice)

1. **One commit per fix.** Subjects pre-written below — use verbatim.
2. **No migrations.** This batch ships a new endpoint, a new page, and a new client component. Schema is untouched.
3. **No scope creep.** Capture out-of-scope discoveries in `audits/BATCH_6_OBSERVATIONS.md`.
4. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` passing at the same count or higher.
5. **No installs, no env changes, no pushes.**
6. **Ground truth = source code at HEAD.** This prompt cites locations based on `0bdd277` (post-Batch-5 + Week-14 docs commit). Re-confirm against actual file contents before each edit.

---

## 2. Pre-flight

```
git rev-parse HEAD                  # should be 0bdd277 or later
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 21 files / 161 tests
```

If any fail, stop. Confirm `audits/2026-05-01-godmode-audit.md`, `audits/2026-05-01-godmode-audit-cowork.md`, `audits/BATCH_5_REPORT.md`, and `audits/BATCH_5_OBSERVATIONS.md` are on tree.

---

## 3. The three fixes

### Fix 1 — `feat(account): DELETE /api/me with re-auth gate + tests`

**Severity:** P1. Closes Privacy Policy §8 ("When you request account deletion, we will delete all personal data we hold about you") which today has no implementation.

**Files:**
- `lib/validators.ts` (modified — add `deleteAccountSchema`)
- `app/api/me/route.ts` (new)
- `tests/api/me.test.ts` (new)

**Add to `lib/validators.ts`** at the end of the file (after `solutionPatchSchema`):

```ts
// Account deletion. The confirmation phrase is a UX safeguard against
// accidental deletion by an unattended browser; it is not a security
// control (a compromised session can type the phrase). Re-auth via the
// password is the actual gate. The literal validator emits the default
// zod error ("Invalid literal value, expected 'delete my account'") on
// mismatch — the form-side UI prevents submit until both fields are
// correctly populated, so the literal's default message is acceptable.
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete your account."),
  confirmation: z.literal("delete my account"),
});
```

**Create** `app/api/me/route.ts`:

```ts
import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { requireSessionJson } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { deleteAccountSchema } from "@/lib/validators";
import { UserRole } from "@/lib/enums";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  // Tight rate limit. Account deletion is a high-impact one-time action;
  // 3/60s is enough for retry-after-typo, far less than enough for abuse.
  const limit = await rateLimit(request, { limit: 3, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { message: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const sessionOrErr = await requireSessionJson();
  if (sessionOrErr instanceof NextResponse) return sessionOrErr;
  const userId = Number(sessionOrErr.user.id);

  const body = await request.json().catch(() => null);
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, passwordHash: true },
  });

  if (!user) {
    // Session was valid (tokenVersion check passed) but the User row is
    // gone — treat as already-deleted and return success.
    return NextResponse.json({ message: "Account deleted." }, { status: 200 });
  }

  // Refuse admin self-deletion via this endpoint. Admin deletion is a
  // low-frequency, high-risk operation that needs operator review (transfer
  // of CaseAudit ownership, confirmation of no in-flight admin work). The
  // Privacy Policy commitment is still met — admins email support for
  // manual deletion. CaseAudit.userId is RESTRICT-FK'd, so a programmatic
  // admin delete would also fail at the DB layer for any admin who has
  // ever audited a case.
  if (user.role === UserRole.ADMIN) {
    return NextResponse.json(
      {
        message:
          "Admin accounts cannot be self-deleted. Contact support@theblackledger.app.",
      },
      { status: 403 }
    );
  }

  const passwordMatches = await compare(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    return NextResponse.json(
      { message: "Incorrect password." },
      { status: 401 }
    );
  }

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
}
```

**Create** `tests/api/me.test.ts` matching the existing test conventions. Cover, at minimum:

1. **401 when not signed in** — `requireSessionJson` returns a 401 NextResponse; expect `response.status === 401` and `prisma.user.findUnique` not called.
2. **400 when body invalid** (missing password OR wrong confirmation phrase) — expect 400 and no `prisma.user.delete`.
3. **401 when password incorrect** — mock `compare` to return false; expect 401 and no `prisma.user.delete`.
4. **403 when user is ADMIN** — `findUnique` returns `{ role: "ADMIN" }`; expect 403 and no `prisma.user.delete`.
5. **200 + delete called when password matches** — expect `prisma.user.delete` called with `{ where: { id: <userId> } }` exactly once.
6. **200 + delete NOT called when user row is missing** — `findUnique` returns null; expect 200 and no delete (idempotent re-deletion).
7. **429 when rate-limited** — exhaust the limiter via `_resetForTesting` + repeated calls; expect 429.

**Mock setup guidance.** The base test scaffold (hoisted mocks, `vi.mock`, `_resetForTesting`, `makeRequest` helper) follows `tests/api/register.test.ts:1-85` exactly — copy the pattern.

For auth mocking, the existing convention (verified in `tests/api/checkpoint.test.ts:14-47`) is to mock `@/auth` directly, NOT `@/lib/auth-helpers`. `requireSessionJson` calls `auth()` internally, so an `authFn` mock at the upstream module flows correctly through the helper:

```ts
const mocks = vi.hoisted(() => ({
  // ...
  authFn: vi.fn(),
  userFindUnique: vi.fn(),
  userDelete: vi.fn(),
  compareFn: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.authFn }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      delete: mocks.userDelete,
    },
  },
}));

vi.mock("bcryptjs", () => ({
  compare: mocks.compareFn,
}));
```

In `beforeEach`: default `mocks.authFn.mockResolvedValue({ user: { id: "42", email: "u@test.com", role: "INVESTIGATOR" } })` for the happy path. The 401 test overrides with `mocks.authFn.mockResolvedValue(null)` (which makes `requireSessionJson` return a 401 NextResponse). The 403 ADMIN test does NOT override `authFn` — instead it overrides `userFindUnique` to return `{ role: "ADMIN", passwordHash: "..." }`. The session's `role` field is *not* the deciding factor in the route — the DB lookup is. Verify by re-reading `app/api/me/route.ts` after Fix 1 lands.

`bcryptjs.compare` defaults to `mockResolvedValue(true)` in `beforeEach`, override to `false` for the wrong-password test.

`prisma.user.delete` is a new mock — add to the hoisted block and the `vi.mock("@/lib/prisma", ...)` block as shown above.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — test count goes from 161 to 168 (+7 new tests). All passing.
- Mental trace of the 7 paths above against the new route handler.

**Commit subject:** `feat(account): DELETE /api/me with password re-auth gate`

---

### Fix 2 — `feat(account): /account/delete page + DeleteAccountForm + bureau dashboard link`

**Severity:** P1 (companion to Fix 1 — without UI the endpoint is undiscoverable).

**Files:**
- `app/account/delete/page.tsx` (new)
- `components/auth/DeleteAccountForm.tsx` (new)
- `app/bureau/page.tsx` (modified — add a discreet link in the dashboard header next to SignOutButton)

**Create** `app/account/delete/page.tsx`:

```tsx
import { requireSession } from "@/lib/auth-helpers";
import DeleteAccountForm from "@/components/auth/DeleteAccountForm";
import { Card } from "@/components/ui";

export const metadata = {
  title: "Delete Account",
  description: "Permanently delete your Black Ledger account.",
};

export default async function DeleteAccountPage() {
  await requireSession();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-xl px-6 py-16 sm:py-24">
        <Card variant="dossier" padding="lg">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-400">
            Danger Zone
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Delete your account
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            This permanently deletes your Black Ledger account, all of your
            owned cases, theory submissions, and checkpoint attempts. Your
            purchase records (Order history) are retained for tax and
            accounting purposes per our Privacy Policy &sect;8. Activation
            codes you have redeemed will be unowned and cannot be re-used.
          </p>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            This action cannot be undone. You will be signed out immediately.
          </p>
          <div className="mt-8">
            <DeleteAccountForm />
          </div>
        </Card>
      </div>
    </main>
  );
}
```

**Create** `components/auth/DeleteAccountForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function DeleteAccountForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const canSubmit =
    password.length > 0 &&
    confirmation === "delete my account" &&
    status !== "loading";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        setStatus("error");
        setMessage(data.message ?? "Could not delete account.");
        return;
      }

      // Sign out and redirect home. The session cookie is now stale (the
      // User row is gone; the next auth() call would clear session.user
      // anyway via the tokenVersion-mismatch path), but signOut also
      // clears the JWT cookie cleanly. NextAuth v5 uses `redirectTo`
      // (not v4's `callbackUrl`) — this matches `components/auth/SignOutButton.tsx`.
      await signOut({ redirectTo: "/" });
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="block">
        <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
          Current password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-400/60"
        />
      </label>

      <label className="block">
        <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
          Type <span className="font-mono text-red-300">delete my account</span> to confirm
        </span>
        <input
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          required
          className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-white outline-none focus:border-red-400/60"
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-2xl bg-red-500 px-5 py-3 font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "loading" ? "Deleting..." : "Permanently delete my account"}
      </button>

      {message ? (
        <p className="text-sm text-red-400" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
```

**Modify** `app/bureau/page.tsx` — add a "Delete account" link in the header button row alongside `SignOutButton`. Find the `<SignOutButton />` invocation (it sits in the header's button-row, currently around line 129 — verify exact location). Add a `<Link>` immediately BEFORE `<SignOutButton />`:

```tsx
<Link
  href="/account/delete"
  className="inline-flex items-center rounded-2xl border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:border-red-500/40 hover:text-red-300"
>
  Delete account
</Link>
```

The styling deliberately understates the link (small, subdued zinc-500 default) so it doesn't compete with the primary admin/database/archive nav. It only colors red on hover, signaling danger without alarming idle viewers.

**Verification:**
- `npx tsc --noEmit` clean.
- `npx vitest run` — 168 tests passing (no new tests added in this commit; UI not unit-tested).
- `npm run build` clean (validates the new page renders, the new client component bundles, and the new route is detected).

**Commit subject:** `feat(account): /account/delete page + DeleteAccountForm + bureau dashboard link`

---

### Fix 3 — `docs(audit): batch 6 report + observations`

**File:** Two new files matching the structure of `BATCH_5_REPORT.md` / `BATCH_5_OBSERVATIONS.md`.

`audits/BATCH_6_REPORT.md` — per-commit hash, subject, file diff, tsc/vitest results, mental-trace verification, anomalies. Include pre-flight tree state at top.

`audits/BATCH_6_OBSERVATIONS.md` — capture: any out-of-scope items spotted, the explicit deferral list (admin self-deletion path, ActivationCode revoked-on-user-delete cascade, account-deletion email confirmation/audit log), and the relationship to remaining Privacy Policy / Terms commitments now closed.

Specifically observe and document for the next batch:

1. **No CaseAudit row is written when an account is deleted.** Investigators don't have audit history, but if the deletion endpoint is later extended to cover admins, a "USER_SELF_DELETED" audit entry should be written somewhere (probably a new `UserDeletion` model rather than reusing `CaseAudit` since the deleted User row is gone).
2. **Deleted User's claimed ActivationCodes are SET NULL'd, not revokedAt-stamped.** A returning user could theoretically re-claim them. Product call for a future batch: should `User.delete` also `revokedAt`-stamp every ActivationCode they ever claimed?
3. **No email is sent confirming the deletion.** GDPR best practice is to email the user-of-record after their account is deleted (proof for them, audit for us). Defer to a future batch — needs Resend send + a small template.
4. **The `/account/delete` page link in `app/bureau/page.tsx` is the only entry point.** Public marketing site does not link to it. That's correct — we don't need to advertise account deletion to anonymous visitors.

**Commit subject:** `docs(audit): batch 6 report + observations`

---

## 4. Final verification gate

After all three commits are on tree:

```
git log --oneline -3                # confirm three commits in order
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 168 tests passing
npm run build                       # clean
git diff main~3 main --stat         # confirm only authorized files touched
```

Expected files touched (and only these):

```
app/account/delete/page.tsx                    (Fix 2, new)
app/api/me/route.ts                            (Fix 1, new)
app/bureau/page.tsx                            (Fix 2)
audits/BATCH_6_OBSERVATIONS.md                 (Fix 3, new)
audits/BATCH_6_REPORT.md                       (Fix 3, new)
components/auth/DeleteAccountForm.tsx          (Fix 2, new)
lib/validators.ts                              (Fix 1)
tests/api/me.test.ts                           (Fix 1, new)
```

If any other file is in the diff, scope crept. Restore it before declaring done.

---

## 5. Begin

Read both audit dossiers under `audits/`. Read `BATCH_5_REPORT.md` for house style. Then start with Fix 1's pre-flight, validator add, route create, test create. Commit. Verify. Move to Fix 2. Continue. Write the two report files in commit 3. Done.
