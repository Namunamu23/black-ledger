# BATCH 1 — OBSERVATIONS

Things noticed while applying Batch 1 that were out of scope. Triage as you
see fit; no action taken on any of these.

## 1. Stripe SDK `LatestApiVersion` literal differs from the spec's hint

The Fix 4 spec suggested `apiVersion: "2024-12-18.acacia"` as a starting
guess, with explicit authorization to fall back to whatever the SDK exports
as `Stripe.LatestApiVersion`.

The installed SDK is `stripe@22.1.0`. Reading
`node_modules/stripe/cjs/apiVersion.d.ts`:

```
export declare const ApiVersion = "2026-04-22.dahlia";
```

…and `node_modules/stripe/cjs/lib.d.ts`:

```
export type LatestApiVersion = typeof ApiVersion;
```

So `LatestApiVersion` is the single-literal type `"2026-04-22.dahlia"`, and
`"2024-12-18.acacia"` would not have type-checked. I used the SDK literal
directly. The guidance to "bump deliberately on SDK upgrade" still applies
exactly the same way — just with this newer literal as the current pin.

## 2. Vitest baseline count drift in `CLAUDE.md`

`CLAUDE.md` claims "157 Vitest tests passing." The actual baseline (and
post-batch) count is 21 files / 160 tests. Drift, not breakage. Worth
updating the doc when convenient — out of scope for Batch 1.

## 3. `tests/api/admin-codes.test.ts` revoke test asserts shape only

The Fix 5 spec warned that the existing revoke test might assert on the
*value* of `revokedAt` matching what the client sent — and to flag if a
test edit was needed. It doesn't:

```
expect(updateArgs.data.revokedAt).toBeInstanceOf(Date);
```

It only asserts the field is a `Date`. So the server-stamp change passes
the existing test untouched. The pre-existing test is already correct
behavior to assert; no change needed.

## 4. Git CRLF→LF normalisation warnings on edits

Three of the five fixes produced warnings of the form:

```
warning: in the working copy of '<path>', CRLF will be replaced by LF the
next time Git touches it
```

…on `app/api/admin/cases/[caseId]/codes/route.ts`,
`app/api/admin/cases/[caseId]/codes/[codeId]/route.ts`, and
`lib/validators.ts`. The repo has `* text=auto eol=lf` in `.gitattributes`
(from Week 5), so Git is normalising on `git add`. The committed objects
are LF. This is the expected behaviour for a Windows working tree under
that gitattributes rule — informational only, no action required. Mention
included only because it appears in the commit output.

## 5. Out-of-scope hooks the audit identified but Batch 1 deliberately skipped

Just listing for the next batch's scoping discussion — not acting on any of
these in Batch 1 because the prompt was explicit about the five fixes:

- `RevokeButton` still sends `revokedAt` in its PATCH body. With the new
  schema using `.passthrough()`, the field is silently ignored. The
  cosmetic cleanup (drop the client-side field) was explicitly listed as
  "Do NOT in this commit" in the Fix 5 spec.
- The revoke route still doesn't write a `CaseAudit` row (audit-trail gap
  flagged in both audits). Deferred.
- `unarchive-case.ts` still hard-codes `CASE_ID = 3`. Deferred per spec.

End of observations.
