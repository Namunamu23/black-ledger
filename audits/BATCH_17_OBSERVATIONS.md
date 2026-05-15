# Batch 17 — Observations

Companion notes to `BATCH_17_REPORT.md`. Captures the design judgements, surprises, and follow-ups discovered during the batch.

---

## 1. Why we deferred the support-route CaseAudit writes

The audit flagged 6 admin mutation surfaces without `CaseAudit`. Batch 17 closes 5. The sixth — `app/api/admin/support/[id]/reply/route.ts` and `app/api/admin/support/[id]/status/route.ts` — was deliberately deferred.

The blocker is the `SupportMessage` model has no `caseFileId`, and `CaseAudit.caseFileId` is `Int` (not-null) with `onDelete: Cascade`. Writing a support-audit row requires one of:

- **Option A — Sentinel `caseFileId = 0` row.** Add a sentinel CaseFile row (e.g. "Support Operations") and bind support-audit rows to it. No schema migration; CaseAudit semantics unchanged. Downside: every forensic query that filters by caseFileId has to special-case 0; an admin browsing CaseAudit-by-case sees an unfamiliar "Support Operations" pseudo-case.
- **Option B — New `AdminAudit` model.** Schema migration adds a top-level `AdminAudit` table with the same shape but no caseFileId FK. Clean separation; future-proofs for other case-less admin actions (user management, system config). Two audit tables to query when surfacing "everything an admin did."
- **Option C — Make CaseAudit.caseFileId nullable.** Single ALTER TABLE; existing rows unaffected. Semantically loose — a "CaseAudit" with no case is awkward.

Option B is cleanest but a schema migration; Option A is shippable in 30 minutes but adds a sentinel. Recommend Option B paired with the Sentry / structured-logging work (F-12), since both rewire the observability surface. Until then, support actions are logged via the existing `console.log` for the Resend send (reply route) and the status PATCH leaves a non-structured trail.

## 2. The `replace_all: true` near-miss on `resolveContent`

The fix for B1 (caseFileId defense-in-depth) had a subtle near-miss. The API route at `app/api/access-codes/redeem/route.ts` calls `resolveContent` twice — once in the P2002 race-recovery branch (line 149) and once in the happy path (line 162). The `replace_all: true` `Edit` only replaced the first occurrence. Caught it during verification — the happy-path call would have remained unchanged and the defense-in-depth check would only have fired on race-recovery (a never-fires path in practice).

Lesson: `replace_all` is unreliable for short patterns that appear at scale. Prefer explicit duplicate `Edit` calls or grep-then-precise-edit when fixing call sites. Both occurrences are now patched.

## 3. The 211-test baseline drift, again

CLAUDE.md still cites "203 Vitest tests" in the production-state quick reference. After the sealed-publicVerdict regression suite landed (8 new tests), the real count is 211. Batch 17 adds zero new tests but updates four. Real count post-Batch-17 is still 211, but four files have new mocks.

This is the third documentation-drift episode on test count (157 → 161 → 168 → ... → 198 → 203 → 211 across batches). Operator should consider an automated CLAUDE.md test-count assertion in CI once branch protection ships (F-36), or simply accept the drift and fix during audits. Manual single-line edits to CLAUDE.md every batch are not paying for themselves.

## 4. The `next.config.ts` CSP `'unsafe-inline'` survives Batch 17

A1 dropped `https://fonts.googleapis.com` from `style-src` because it was a dead reference, but `'unsafe-inline'` remained on both `script-src` and `style-src`. The bigger F-32/F-33 win — switching to nonces — is genuinely a multi-week project:

- Next.js 16 ships a nonce primitive (`headers.set('Content-Security-Policy', csp.with-nonce)`), but each `<script>` in the rendered tree must opt in.
- Framer Motion injects inline `<style>` tags at runtime for layout animations. There is no official nonce-support story for Framer Motion ≤12.x; the workaround is the `useReducedMotion` exit-path which loses the animations.
- Tailwind v4 emits inline `<style>` blocks at first paint. PostCSS plugins can be configured to add nonces but the pipeline rewires require a build-config change.

Each of those is a 2–4 hour investigation; the bundle is genuinely a multi-day task. Right call to defer.

## 5. CREATE INDEX without CONCURRENTLY is a deliberate choice

The Batch 17 migration uses plain `CREATE INDEX`, not `CREATE INDEX CONCURRENTLY`. At current scale (TheorySubmission ~10 rows, CheckpointAttempt ~30 rows, content tables ~100 rows total across all cases) the brief table-level lock is microseconds. The first migration to grow this concern is when TheorySubmission crosses ~10k rows.

Document this for future batches: any new index migration on a table that has grown should switch to `CREATE INDEX CONCURRENTLY` to avoid blocking writes during the index build. Prisma's `migrate dev` does NOT emit CONCURRENTLY automatically; you have to hand-edit the generated SQL or use a SQL-only migration.

## 6. The five `caseSerial` use sites — a unification audit

After A5 + A7, every player-facing surface that displays the case serial goes through `caseSerial(caseFile)`:

| Surface | File | Pre-Batch-17 | Post-Batch-17 |
|---|---|---|---|
| Dashboard cards | `app/bureau/page.tsx` | `caseSerial(...)` (Batch 16) | unchanged |
| Debrief header | `app/bureau/cases/[slug]/debrief/page.tsx` | `caseSerial(...)` (Batch 16) | unchanged |
| Public marketing | `components/cases/CasePublicView.tsx` | `caseSerial(...)` (Batch 16) | unchanged |
| Public catalog | `app/cases/page.tsx:76` | `"BL-" + String(index + 1).padStart(3, "0")` | `caseSerial(caseFile)` (A5) |
| Workspace header | `app/bureau/cases/[slug]/page.tsx:199` | `"BL-" + slug.toUpperCase().replace(/-/g, "").slice(0, 8)` | `caseSerial(caseFile)` (A7) |

The other surfaces — admin tabs (`/bureau/admin/cases/[caseId]/edit/...`), admin codes listing, admin support inbox — do not display a serial; they show numeric id or slug directly. No drift there.

## 7. Hidden trade-off in `resolveContent` returning `null`

After B1, a mistargeted AccessCode (e.g. pointing at caseRecord.id=42 which belongs to caseFile=99 instead of caseFile=7) will silently return `null` from `resolveContent`. The redeem route currently returns this null inside the response body as `content`. The workspace render filters nulls out.

Net: a mistargeted AccessCode looks to the user like a "missing/broken artifact" rather than throwing. That's correct fail-safe behavior — never reveal cross-case content — but it means the admin who created the bad code won't get a runtime error to debug from.

Mitigation: the write-side validation at `app/api/admin/cases/[caseId]/access-codes/route.ts:80-110` already prevents this at AccessCode create time. The runtime null is only reachable via a future schema bug or a hand-edited row, both of which deserve a separate alert path (Sentry, when it lands).

## 8. The Stripe orphan retry-storm fix changes Stripe Dashboard semantics

Pre-Batch-17, a `[STRIPE-ORPHAN]` orphan event would show in Stripe Dashboard → Events as "Failed (retrying)" for ~3 days. Post-Batch-17, the same event shows as "Succeeded" (200 ack from our endpoint).

This is correct behavior — the event was genuinely handled (we logged the alert; there's nothing else to do) — but it does mean the operator can't sort Stripe Dashboard by "failed events" to find orphans anymore. Orphans now have to be found via Vercel logs grepping for `[STRIPE-ORPHAN]`.

Recommendation: once Sentry lands, route `[STRIPE-ORPHAN]` to a Sentry alert rule. Until then, an operator habit: weekly `vercel logs --since 7d | grep "STRIPE-ORPHAN"`.

## 9. The 5 CaseAudit writes intentionally omit redeemable secrets

Across C2, C4, C5, the `diff` payload deliberately does NOT contain the generated `code` value. Activation codes and access codes are redeemable secrets — they confer access until claim/revoke. Logging them into `CaseAudit.diff` (a JSONB column with no special access controls) would duplicate the secret into a forensic table that survives claim, and a compromised admin reading their own audit log could re-mint claims by replaying old code values.

Pattern: when an admin action mints a secret, the audit logs the secret's **id** (for traceability) and **metadata** (what it unlocks, etc.), never the secret itself. Document this convention in any future support / `AdminAudit` work too.

## 10. What the test files now look like, summarised

- `tests/api/admin-codes.test.ts`: 24 lines added (mock surface).
- `tests/api/workflow.test.ts`: 17 lines added (mock surface).
- `tests/api/access-codes-redeem.test.ts`: 4 find-replaces (caseRecordFindUnique → caseRecordFindFirst) plus a comment.
- `tests/api/stripe.test.ts`: ~20 lines changed in the one orphan test.

All four updates are mechanical mock-surface adjustments. None test new behavior; they're all "make the test compile against the changed route surface." The new behavior covered (CaseAudit row insertion, defense-in-depth caseFileId, orphan 200 ack) is implicit in the mocks resolving correctly.

A more rigorous testing approach would add positive assertions: e.g. for workflow PATCH, `expect(mocks.caseAuditCreate).toHaveBeenCalledOnce()` and assert the action payload shape. We did NOT add those assertions in Batch 17 to keep scope tight. **Recommend adding them in Batch 18** as part of the planned support-route CaseAudit work — both routes can ship with proper positive assertions together.

## 11. The Saturday-afternoon scope held

Original Batch 17 charter was "Saturday afternoon, ~2-4 hours." Actual scope:

- 8 Group A fixes — surgical edits, ~30 minutes total.
- 3 Group B fixes — ~45 minutes (the resolveContent signature change required care).
- 5 Group C CaseAudit writes — ~45 minutes.
- 1 schema migration + 4 test-mock updates — ~30 minutes.
- This report + observations — ~30 minutes.

Total: roughly 3 hours of careful work. The bundle is 13 separately-committable fixes plus the migration and the docs. Big enough to be meaningful, small enough that the diff is reviewable in one sitting.

## 12. After this batch lands, the remaining "must-do-before-launch" list shrinks to operational items only

- Resend DKIM/SPF/DMARC (operational, DNS).
- Stripe Live activation (operational, dashboard).
- Georgian lawyer review of `/privacy` + `/terms` (operational, legal).
- Optional: CI / branch protection / Dependabot (operational, GitHub config).

No code-blockers remain after Batch 17 is verified-green. The deferred backlog (Sentry, CSP nonces, support-route audit, `Order.userId`, `/api/me/export`, etc.) is genuinely deferred — none of those gate first-paying-customer launch.
