-- Batch 17 — FK indexes on hot-read tables.
--
-- Postgres does not auto-index foreign-key columns. The following composite
-- and single-column indexes cover the per-page query shapes used by
-- /bureau/archive (TheorySubmission/CheckpointAttempt by userId, recent
-- first), the admin per-case lists (ActivationCode/AccessCode by caseFileId),
-- and the workspace content render (CasePerson/CaseRecord/CaseHint/
-- HiddenEvidence by caseFileId).
--
-- At launch scale (single-digit cases, dozens of customers) the sequential
-- scans these tables get today are <1ms. The indexes are pre-emptive: once
-- TheorySubmission row counts climb (multiple cases × hundreds of customers
-- × many guesses per case) the unindexed scans transition from O(1) to O(N)
-- on every /bureau/archive page load.
--
-- All operations are additive. No data is moved. The CREATE INDEX statements
-- below take brief table-level locks on Postgres 17 because we are not using
-- CREATE INDEX CONCURRENTLY — acceptable at current table sizes. Future
-- index migrations on tables that have grown should switch to CONCURRENTLY
-- to avoid blocking writes; see audits/2026-05-13-godmode-audit-super.md
-- §2.B.13 F-45 deferred.

-- CreateIndex
CREATE INDEX "TheorySubmission_userId_createdAt_idx" ON "TheorySubmission"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TheorySubmission_caseFileId_idx" ON "TheorySubmission"("caseFileId");

-- CreateIndex
CREATE INDEX "CheckpointAttempt_userId_createdAt_idx" ON "CheckpointAttempt"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CheckpointAttempt_caseFileId_idx" ON "CheckpointAttempt"("caseFileId");

-- CreateIndex
CREATE INDEX "ActivationCode_caseFileId_idx" ON "ActivationCode"("caseFileId");

-- CreateIndex
CREATE INDEX "CasePerson_caseFileId_idx" ON "CasePerson"("caseFileId");

-- CreateIndex
CREATE INDEX "CaseRecord_caseFileId_idx" ON "CaseRecord"("caseFileId");

-- CreateIndex
CREATE INDEX "CaseHint_caseFileId_idx" ON "CaseHint"("caseFileId");

-- CreateIndex
CREATE INDEX "HiddenEvidence_caseFileId_idx" ON "HiddenEvidence"("caseFileId");
