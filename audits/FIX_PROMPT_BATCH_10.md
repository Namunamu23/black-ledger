# BATCH 10 — FIX PROMPT (auth-page redirects for already-signed-in users)

You are a fresh Claude Code session running on Opus 4.7. Apply two commits: one feat commit that closes the auth-page redirect gap, plus one final report commit. No scope creep. No migrations. No new dependencies.

This batch closes a UX/security gap the operator noticed in dogfooding: signed-in users can currently navigate to `/login`, `/register`, `/forgot-password`, and `/reset-password` and see the auth forms. The right behavior is to detect the live session at the page level and server-redirect to a sensible default landing — preserving any sanitized `callbackUrl` query param that came in with the request. The fix is small, mechanical, and isolated to four page components plus one shared helper.

Read this prompt first. Then read `audits/BATCH_9B_REPORT.md` for house style and `audits/BATCH_9B_OBSERVATIONS.md` for the post-Batch-9b baseline. Then begin.

---

## 1. Operating principles

1. **Two commits.** Subjects pre-written below — use verbatim.
2. **No migrations.** Pure code change in this batch.
3. **No new dependencies.** Use only what's already in `package.json`. The session lookup goes through the existing `auth()` from `@/auth`; the callbackUrl sanitization goes through the existing `pickPostLoginPath` from `@/lib/post-login-path`.
4. **No scope creep.** The operator explicitly asked for the auth-redirect fix only. Do NOT touch the Navbar, the sign-out flow, the account-settings page (which doesn't exist), or any unrelated page. Confirm the Navbar already hides login/register links for signed-in users (Batch 3 fix) but do NOT change it.
5. **Read-only verification between commits.** After every commit: `npx tsc --noEmit` clean, `npx vitest run` passing at the same count or higher.
6. **No env changes, no pushes, no deploys.** The operator runs `git push` after the batch is complete and verified. No migrate-deploy needed (no schema change).
7. **Ground truth = source code at HEAD.** This prompt cites the post-Batch-9b state (HEAD `e4740f6`). Re-confirm against the actual file before each edit.

---

## 2. Pre-flight

```
git rev-parse HEAD                  # at or after `e4740f6` (Batch 9b docs commit)
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 23 files / 184 tests
```

If any fail, stop. Confirm `audits/BATCH_9B_REPORT.md` is on tree.

---

## 3. The two fixes

### Fix 1 — `feat(auth): redirect signed-in users away from auth pages`

Six file changes in one commit.

**(a) Add the centralized helper to `lib/auth-helpers.ts`.** This file already exports `requireSession`, `requireAdmin`, `getOptionalSession`, and `requireSessionJson`. We add an inverse helper that policy-checks "if you're already authenticated, you don't belong here."

Append after the existing `requireSessionJson` function:

```ts
import { pickPostLoginPath } from "@/lib/post-login-path";

/**
 * Inverse of requireSession. Used by the auth-form pages
 * (`/login`, `/register`, `/forgot-password`, `/reset-password`) to send
 * an already-authenticated visitor away from the form back to a sensible
 * landing page rather than rendering a sign-in UI for someone who is
 * already signed in.
 *
 * If `callbackUrl` is provided (login + register accept it via search
 * params), the same `pickPostLoginPath` sanitizer the post-login flow
 * uses applies — anything off-origin or otherwise unsafe falls back to
 * the default `/bureau` landing. Pages that don't expose callbackUrl
 * (forgot-password, reset-password) call this without an argument and
 * unconditionally redirect to `/bureau`.
 *
 * Returns Promise<never> on the redirect path because `redirect()` throws
 * a NEXT_REDIRECT signal that Next intercepts; resolves to void only
 * when no session is present and the caller should continue rendering.
 */
export async function redirectIfAuthenticated(
  callbackUrl?: string | null
): Promise<void> {
  const session = await auth();
  if (session?.user) {
    redirect(pickPostLoginPath(callbackUrl ?? null));
  }
}
```

The new import for `pickPostLoginPath` goes near the top of the file alongside the existing imports. If a circular-dependency or import-ordering issue surfaces (unlikely — `post-login-path.ts` is dependency-free), resolve by inlining the sanitizer call rather than restructuring the helper file.

**(b) `app/login/page.tsx`** — convert to an async server component, accept `searchParams`, call the helper. The existing render body stays unchanged.

Current state: synchronous component, no session check.

Replacement (top of file + function signature only — leave the JSX body intact):

```ts
import { Suspense } from "react";
import Link from "next/link";
import PageHero from "@/components/ui/PageHero";
import LoginForm from "@/components/auth/LoginForm";
import { redirectIfAuthenticated } from "@/lib/auth-helpers";

type SearchParams = Promise<{ callbackUrl?: string | string[] }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : null;
  await redirectIfAuthenticated(callbackUrl);

  return (
    <main className="bg-zinc-950 text-white">
      {/* ... existing JSX unchanged ... */}
    </main>
  );
}
```

The `string | string[]` shape on the searchParam type is Next 15+'s convention — a query like `?callbackUrl=A&callbackUrl=B` returns an array; we honor only the string case (drop arrays as suspicious / malformed).

**(c) `app/register/page.tsx`** — same pattern as login.

```ts
import { Suspense } from "react";
import Link from "next/link";
import PageHero from "@/components/ui/PageHero";
import RegisterForm from "@/components/auth/RegisterForm";
import { redirectIfAuthenticated } from "@/lib/auth-helpers";

export const metadata = {
  title: "Create Account",
};

type SearchParams = Promise<{ callbackUrl?: string | string[] }>;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : null;
  await redirectIfAuthenticated(callbackUrl);

  return (
    <main className="bg-zinc-950 text-white">
      {/* ... existing JSX unchanged ... */}
    </main>
  );
}
```

**(d) `app/forgot-password/page.tsx`** — simpler, no callbackUrl support.

```ts
import PageHero from "@/components/ui/PageHero";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { redirectIfAuthenticated } from "@/lib/auth-helpers";

export const metadata = {
  title: "Forgot Password",
};

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated();

  return (
    <main className="bg-zinc-950 text-white">
      {/* ... existing JSX unchanged ... */}
    </main>
  );
}
```

**(e) `app/reset-password/page.tsx`** — same as forgot-password. The reset token in the URL (`?token=`) is intentionally NOT preserved through the redirect: if a signed-in user clicks a password-reset email link, the safe behavior is to send them to `/bureau`, not to walk them through a reset flow they don't need. If they actually want to use the token, they can sign out first.

```ts
import { Suspense } from "react";
import PageHero from "@/components/ui/PageHero";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { redirectIfAuthenticated } from "@/lib/auth-helpers";

export const metadata = {
  title: "Reset Password",
};

export default async function ResetPasswordPage() {
  await redirectIfAuthenticated();

  return (
    <main className="bg-zinc-950 text-white">
      {/* ... existing JSX unchanged ... */}
    </main>
  );
}
```

**(f) Add tests at `tests/routes/auth-redirect.test.ts`** (new file). Cover the four page components × two auth states (signed-in → redirect, anonymous → render). Pattern mirrors `tests/routes/unlock-flow.test.ts` for layout-gate testing.

Sketch (Claude Code adapts to the project's actual mock pattern):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @/auth and next/navigation per project convention.
const authMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${path};307;`});
});

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

beforeEach(() => {
  authMock.mockReset();
  redirectMock.mockClear();
});

describe("auth-page redirect-if-authenticated (Batch 10)", () => {
  it("login page redirects signed-in users to /bureau", async () => {
    authMock.mockResolvedValue({ user: { id: "1", email: "u@x.com" } });
    const { default: LoginPage } = await import("@/app/login/page");
    await expect(
      LoginPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/bureau");
  });

  it("login page honors a sanitized callbackUrl when signed in", async () => {
    authMock.mockResolvedValue({ user: { id: "1", email: "u@x.com" } });
    const { default: LoginPage } = await import("@/app/login/page");
    await expect(
      LoginPage({
        searchParams: Promise.resolve({ callbackUrl: "/bureau/unlock?code=ABC" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/bureau/unlock?code=ABC");
  });

  it("login page rejects an off-origin callbackUrl and falls back to /bureau", async () => {
    authMock.mockResolvedValue({ user: { id: "1", email: "u@x.com" } });
    const { default: LoginPage } = await import("@/app/login/page");
    await expect(
      LoginPage({
        searchParams: Promise.resolve({ callbackUrl: "https://evil.com/steal" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/bureau");
  });

  it("login page renders normally for anonymous visitors", async () => {
    authMock.mockResolvedValue(null);
    const { default: LoginPage } = await import("@/app/login/page");
    const result = await LoginPage({ searchParams: Promise.resolve({}) });
    expect(result).toBeDefined(); // JSX returned, no throw
    expect(redirectMock).not.toHaveBeenCalled();
  });

  // Repeat the signed-in / anonymous pair for register, forgot-password,
  // reset-password. The latter two don't take callbackUrl so the array-of-
  // callback tests don't apply to them.
});
```

Eight tests total: 4 pages × (signed-in redirect, anonymous render) + a couple of callbackUrl edge cases on login. Adjust to match the existing project mock conventions you find in `tests/routes/unlock-flow.test.ts`. If the existing pattern uses `vi.mock("@/auth", { spy: true })` or a different shape, mirror it for consistency.

**Verification:**

- `npx tsc --noEmit` clean. The new `searchParams: SearchParams` type, the async signature on previously-sync components, and the new helper export should all type-check cleanly.
- `npx vitest run` — 184 → 192 (+8 new tests).
- Manual smoke (post-deploy, optional): visit `/login` while signed in as the test investigator account → expect immediate 307 redirect to `/bureau`. Visit `/login?callbackUrl=/bureau/unlock?code=ABC` while signed in → redirect to `/bureau/unlock?code=ABC`. Visit `/login?callbackUrl=https://evil.com` while signed in → redirect to `/bureau` (sanitizer caught it). Visit `/login` while signed out → see the form normally.
- Confirm Navbar (`components/layout/Navbar.tsx`) already hides login/register links for signed-in users (Batch 3 fix at lines around `session?.user`). Do NOT modify; just verify the existing behavior. If the verification surfaces that the Navbar still shows login/register to signed-in users, document the gap in `BATCH_10_OBSERVATIONS.md` for a follow-up batch — do not fix in this batch.

**Commit subject:** `feat(auth): redirect signed-in users away from auth pages`

---

### Fix 2 — `docs(audit): batch 10 report + observations`

Two new files mirroring the BATCH_9B structure.

**`audits/BATCH_10_REPORT.md`** — short report (~120-180 lines):

- Pre-flight tree state (HEAD SHA, working tree, tsc + vitest counts).
- One-row commit table for Fix 1.
- Per-fix detail block: applied yes/no, files touched, diff stats, tsc + vitest deltas, mental trace ("signed-in user navigates to /login → redirectIfAuthenticated runs → auth() returns session → redirect to /bureau via pickPostLoginPath default → 307 served by Next, browser follows; anonymous user → auth() returns null → helper returns void → page render continues to JSX").
- Final verification gate output: `git log --oneline -2`, `git status`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `git diff e4740f6..main --stat`.

**`audits/BATCH_10_OBSERVATIONS.md`** — short, ~60-100 lines:

1. **Why the fix lives at the page-component level rather than middleware.** Two reasons. (a) Middleware in this project already does CSRF + bureau gating; adding more conditional redirect logic there increases the risk of subtle interactions. (b) Page-level redirects are tied to the same `auth()` call that powers `requireSession`, so the policy is consistent across the app — one source of truth on what "signed in" means (including the JWT tokenVersion check from Batch 3).
2. **Why `/reset-password` doesn't preserve the token through the redirect.** The reset token is for unauthenticated password recovery. A signed-in user clicking a reset email link is in an unusual state (already authenticated, somehow ended up at the link). The safe move is to drop them at `/bureau` and let them sign out manually if they really need to use the token. Any other behavior risks breaking the "signed-in users don't see auth forms" invariant.
3. **Navbar status note.** The Navbar (`components/layout/Navbar.tsx`) was last updated in Batch 3 to guard on `session?.user` (not just `session?`) — record whether this batch's verification confirmed the existing guard still hides login/register links for signed-in users. If it does, no follow-up. If it doesn't, flag a future batch.
4. **No-scope-creep notes.** This batch did NOT touch sign-out behavior, did not add a "change password while signed in" UI, did not modify the Navbar, did not refactor the existing auth forms. The operator asked for the auth-redirect gap only.
5. **Carry-forward items** unchanged from Batch 9b: Sentry, CSP nonce migration, app/layout.tsx auth() per-render, forgot-password timing leak, /bureau/database admin pagination, error.tsx absence, R2 ContentLength alternative paths, F-04 lawyer brief pending.

**Commit subject:** `docs(audit): batch 10 report + observations`

Then stop. Do not push.

---

## 4. Final verification gate

After both commits are on tree:

```
git log --oneline -2                # Fix 1 + Fix 2 in order
git status                          # working tree clean
npx tsc --noEmit                    # clean
npx vitest run                      # 192 tests passing (184 + 8 new)
npm run build                       # clean (only the pre-existing pg SSL informational notice)
git diff e4740f6..main --stat
```

Expected files touched:

```
lib/auth-helpers.ts                                         (Fix 1)
app/login/page.tsx                                          (Fix 1)
app/register/page.tsx                                       (Fix 1)
app/forgot-password/page.tsx                                (Fix 1)
app/reset-password/page.tsx                                 (Fix 1)
tests/routes/auth-redirect.test.ts                          (Fix 1, new)
audits/BATCH_10_REPORT.md                                   (Fix 2, new)
audits/BATCH_10_OBSERVATIONS.md                             (Fix 2, new)
```

If any other file is in the diff, restore it before declaring done.

---

## 5. Begin

Read `audits/BATCH_9B_REPORT.md` for house style. Read the existing `tests/routes/unlock-flow.test.ts` to mirror its mocking convention before writing the new test file. Confirm `lib/post-login-path.ts` exports `pickPostLoginPath` and `DEFAULT_POST_LOGIN_PATH` per the current state.

Then start with Fix 1 — add the helper, convert the four pages, write the tests, verify tsc + vitest clean, commit. Then Fix 2 — write the two report files, verify, commit.

When you finish, surface the operator-action callout in your closing message: **"Run `git push`. No `prisma migrate deploy` needed — this batch is pure code, no schema change."**

Done.
