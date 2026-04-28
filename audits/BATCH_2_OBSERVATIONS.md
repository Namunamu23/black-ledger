# BATCH 2 — OBSERVATIONS

Things noticed while applying Batch 2 that were out of scope. Triage as you
see fit; no action taken on any of these.

## 1. Pre-existing odd indentation in `app/api/admin/cases/route.ts`

The `prisma.caseFile.create({...})` call I had to wrap for Fix 3 has
pre-existing irregular indentation. The call begins at 4-space indent,
but the `data:` object inside is at 2-space indent and the closing
`});` is at column 0 (file-root indent). Example:

```ts
    const createdCase = await prisma.caseFile.create({
  data: {
    slug: data.slug,
    ...
  },
});
```

The neighbouring `prisma.activationCode.create` call below it is
properly indented. This looks like a previous edit that wasn't
re-formatted.

I preserved the bad indentation verbatim per the no-scope-creep rule,
which makes the new try/catch wrapper visually awkward — the wrapped
call is still mis-indented inside the new `try { ... }` block. Worth a
single-commit cleanup: re-indent the entire `data: { ... }` block to
6 spaces (so it sits properly inside the new try inside the existing
outer try inside the function). Eyeballing the diff, that would touch
~20 lines but be purely whitespace.

## 2. Git CRLF→LF normalisation warnings on edits

Three of the five fixes produced warnings of the form:

```
warning: in the working copy of '<path>', CRLF will be replaced by LF the
next time Git touches it
```

…on `middleware.ts`, `app/api/admin/cases/route.ts`, and
`app/api/admin/uploads/blurhash/route.ts`. Same as Batch 1 — expected
behaviour from the `* text=auto eol=lf` in `.gitattributes` (Week 5).
The committed objects are LF. Informational only.

## 3. New rate-limit branches in Fix 4 are untested

Neither `/api/checkout/status` nor `/api/admin/uploads/blurhash` had a
test file before this batch, and the spec did not authorise adding
one. The 429 path on both routes works by mental trace and by
mirroring the well-tested upload-sign pattern, but a "31st call within
60s returns 429 with Retry-After" assertion would be useful insurance.
Suggest adding minimal tests in a future batch.

## 4. Fix 3's catch is also untested

`tests/api/admin-cases.test.ts` does not simulate two concurrent POSTs
hitting the create endpoint with the same slug. Adding a test that
mocks `prisma.caseFile.create` to reject with `{ code: "P2002" }` and
asserts on `response.status === 409` would lock the new behaviour in.
Out of scope for Batch 2 — same comment as Batch 1's "out-of-scope
hooks" section.

## 5. Out-of-scope items the audit identified but Batch 2 deliberately skipped

Listing for Batch 3 scoping. The audit's P1 set still has these open:

- BuyButton double-charge race (no Stripe `idempotencyKey`, no
  PENDING-order check). The Fix 5 message-generalisation explicitly
  defers the structural fix to Batch 3.
- Activation-code email recipient is attacker-supplied (paid-spam
  vector via Stripe).
- JWT sessions don't invalidate on password reset (30-day default).
- `hidden_evidence` AccessCode branch unreachable via admin API
  (validator enum gap).
- Stripe `payment_intent.payment_failed` lookup orphan handling.

End of observations.
