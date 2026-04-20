## Black Ledger — Project State (updated 2026-04-20)

### Week 1 COMPLETE — 11 commits pushed to origin/main
All P0 bugs closed. 25 Vitest tests passing. Build clean.

Key files added/changed this week:
- lib/case-evaluation.ts — Jaccard + exact-name matcher (replaces substring)
- lib/user-case-state.ts — monotonic state machine, SOLVED is terminal
- lib/enums.ts — browser-safe enum mirrors (no Prisma client import)
- lib/labels.ts — human-readable label constants
- lib/validators.ts — child entity schemas include id + globalPersonId
- types/next-auth.d.ts — Session/JWT typed with id + role
- prisma/schema.prisma — UserRole, UserCaseStatus, CaseWorkflowStatus, TheoryResultLabel enums; CaseAudit model; debriefSectionTitle + debriefIntro on CaseFile
- app/api/admin/cases/[caseId]/route.ts — diff/upsert PUT, CaseAudit trail, no more deleteMany+createMany
- app/api/cases/[slug]/advance/route.ts — DELETED (privilege escalation)
- components/bureau/AdvanceReviewButton.tsx — DELETED

### Known gaps going into Week 2
- app/api/cases/[slug]/checkpoint/route.ts still uses old bidirectional substring matcher — fix first in Week 2
- No Playwright e2e test yet — deferred from Week 1 exit criteria
- GlobalPerson rows not seeded (FK prevents linking CasePerson.globalPersonId in Prisma Studio)

### Week 2 — next prompts in order
0. Fix checkpoint route matcher (mini-prompt, not in library)
1. Prompt 07 — Rate limiting (lib/rate-limit.ts, 5 routes)
2. Prompt 08 — Security headers (next.config.ts)
3. Prompt 09 — Auth helpers consolidation (lib/auth-helpers.ts)
4. Prompt 10 — CSRF + explicit-state PATCHes

### Prompt library location
See black-ledger-prompts.md (uploaded to Cowork session) for Prompts 07–25.
Week 2 prompts (07–10) are outline-level — flesh out before pasting.

### Test credentials (local dev only)
Admin: mycart19@gmail.com
Investigator: test@blackledger.com / Test1234!
Activation code for case #1: ALDERS-D6A5FBA9 (may be claimed — generate a new one if needed)
