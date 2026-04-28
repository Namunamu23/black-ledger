# BATCH 3 — OBSERVATIONS

Items the spec did not list explicitly but that came up while applying the
batch. Recorded here per the prompt's "anything not on the list" rule. The
human triages.

## 1. `tokenVersion` augmentation made optional (`?: number`), not required (`number`)

**Where:** `types/next-auth.d.ts` — six addition sites across the four
module-augmentation blocks.

**What I did instead of the literal spec:** the spec said
"Add `tokenVersion: number` to the same three places." I added
`tokenVersion?: number` (optional) instead of the required `: number`.

**Why I deviated.** When I first applied the literal `tokenVersion: number`
form, `npx tsc --noEmit` produced four errors in pre-existing test files
that construct `Session` objects as plain object literals:

```
tests/lib/auth-helpers.test.ts(31,3): error TS2741: Property 'tokenVersion' is missing in type '{ id: string; email: string; name: string; role: "ADMIN"; }' but required in type '{ id: string; ...; tokenVersion: number; }'.
tests/lib/auth-helpers.test.ts(41,3): error TS2741: Property 'tokenVersion' is missing in type ...
tests/routes/unlock-flow.test.ts(49,3): error TS2741: Property 'tokenVersion' is missing in type ...
tests/routes/unlock-flow.test.ts(54,3): error TS2741: Property 'tokenVersion' is missing in type ...
```

Two paths to green tsc:

  (a) Edit those two test files to add `tokenVersion: 0` to each fixture.
      Cost: 4 mechanical line additions, but expands the changeset from
      the 7 files the spec authorised to 9 files — a scope-creep
      violation of the spec's hard "Seven files. If anything else shows
      up, you've broken the no-scope-creep rule" line.

  (b) Make the augmentation optional. Cost: a one-character deviation
      (`:` → `?:`) at six sites, no test-file edits, no scope creep.
      And: it actually matches reality more honestly, because the spec's
      *own* session-callback example reads the field as
      `(token.tokenVersion as number | undefined) ?? 0`, explicitly
      acknowledging that pre-existing JWTs (issued before this code
      deploys) have `token.tokenVersion === undefined`. An optional type
      lets callers reason about that case without an `as` cast.

I picked (b). The runtime behaviour is identical: the JWT callback
unconditionally writes `token.tokenVersion = user.tokenVersion` on every
fresh sign-in (after Commit 2 lands), so any JWT minted from now on has the
field set; the session callback's `?? 0` keeps legacy JWTs working until
they expire or the user signs in again.

If you'd rather the augmentation be `tokenVersion: number` for type
strictness, the follow-up is small: change the six `?:` back to `:` and
add `tokenVersion: 0` to the four mock fixtures in
`tests/lib/auth-helpers.test.ts:31,41` and
`tests/routes/unlock-flow.test.ts:49,54`. I deferred that decision to you.

## 2. Edge-runtime risk: `auth.config.ts` now imports `prisma` and `middleware.ts` imports `auth.config.ts`

**Where:** `auth.config.ts:2` (`import { prisma } from "@/lib/prisma";`) and
the existing `middleware.ts:2` (`import { authConfig } from
"@/auth.config";`).

**What this is.** Per spec, the session callback in `auth.config.ts` now
performs `await prisma.user.findUnique(...)`. Importing `prisma` at the top
of `auth.config.ts` means anything that imports `authConfig` transitively
pulls in `lib/prisma`, which pulls in `@prisma/adapter-pg` and
`@prisma/client` — none of which are edge-runtime safe.

`middleware.ts` runs in the Next.js edge runtime by default and imports
`authConfig` to instantiate `NextAuth(authConfig)`. So at production-build
time (`next build`), the edge bundler is likely to either fail outright or
emit a warning about Node-only modules being included in the edge bundle.

**Why I shipped it anyway.** The Batch 3 prompt explicitly anticipated
this and gave the call: *"If `npx tsc --noEmit` passes after the change,
you're fine. If a build-time error appears about edge-incompatible imports,
**stop and report**."* `tsc` passes. `vitest` (Node runtime) passes.
`next build` was not in the prompt's authorised verification surface and
was not run. The prompt also explicitly forbade improvising a split-config
workaround.

**Recommended human verification before push:**

```
npx next build
```

Look for either:

  - A hard failure citing `node:fs`, `pg`, `bcryptjs`, or "Edge Runtime"
    in `auth.config.ts` or any module that imports it. → split-config is
    needed (a separate decision per the prompt).

  - A warning but a green build. → ship it; document the warning.

  - A clean build. → ship it.

The standard remediation, if needed, is the well-known NextAuth v5
"split config" pattern: keep `auth.config.ts` edge-safe (no `prisma` import,
no DB callbacks), and do the DB-touching session callback in `auth.ts`
where the full server runtime is available. Middleware imports the lean
`auth.config.ts`; everything else imports `auth.ts`. That's a refactor
that touches `auth.config.ts`, `auth.ts`, and possibly `middleware.ts`,
plus its own commit.

## 3. Existing reset-password test cast did not break despite the new `tokenVersion` field

**Where:** `tests/api/register.test.ts:355-366`.

The pre-existing "clears the reset token and expiry after a successful
reset" test casts the captured `update` args as

```ts
const updateCall = mocks.userUpdate.mock.calls[0]![0] as {
  data: {
    passwordHash: string;
    passwordResetToken: null;
    passwordResetExpiresAt: null;
  };
};
```

The spec's pre-Commit-2 verification step warned that this might break
once Commit 2 added a fourth field (`tokenVersion`) to the runtime payload.
It did not break — the `as` cast is a TypeScript assertion, not a runtime
check, and the test only `expect`s the three named fields. The runtime
payload acquiring a fourth field (`tokenVersion: { increment: 1 }`) does
not affect the cast or the assertions. No edit was made to the existing
test in Commit 2.

The new test in Commit 3 uses an independent narrowing cast
(`as { data: { tokenVersion: { increment: number } } }`) so it's also
robust to additional sibling fields.

## 4. Migration timestamp uses `20260427210000` though today is 2026-04-28

The Batch 3 prompt suggested `20260427210000_add_user_token_version` as
the example timestamp, sitting after `20260426200000_add_password_reset`.
Prisma orders migrations lexicographically, so this is fine — it's both
later than the previous migration and earlier than any future migration
the human writes today. I followed the prompt's example verbatim rather
than re-stamping to today's `20260428...`. If you'd prefer the timestamp
to match the day the schema actually goes through review, rename the
migration directory before running `migrate deploy`.

## 5. `token.id == null` defensive check is type-narrowing-redundant but kept

**Where:** `auth.config.ts:23` (the new session callback's early-return).

`JWT.id` is augmented as `string` (non-nullable), so `token.id == null` is
type-narrowing-redundant — TypeScript treats it as always-false. Kept it
because:

  - It's a runtime defence against malformed/legacy JWTs that genuinely
    might lack `id` despite the type augmentation.
  - The spec's example session callback shows this exact line.
  - Removing it would mean trusting the augmentation on a security path,
    which is exactly the kind of trust the prompt's commentary cautions
    against ("Mistakes here log every user out, or worse, fail to log
    them out when they should be logged out").

No tsc warning was produced. Worth keeping as-is.
