## Black Ledger — Project State (updated 2026-04-20)

### Current status
Week 2 COMPLETE / Week 3 IN PROGRESS — 16 commits on origin/main. 45 Vitest tests passing. Build clean.

### Week 1 — Completed commits (closed 2026-04-20)
All P0 bugs from the original audit closed. 11 commits.

Notable changes:
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

### Week 2 — Completed commits (closed 2026-04-20)
5 commits, in order:
- ee1cba7  fix(checkpoint): replace substring matcher with normalizeIdentity + Jaccard
- 60e2dca  feat(security): token-bucket rate limiting on 5 API routes + Upstash Redis prod adapter
- e965205  feat(security): add security headers + CSP report-only to next.config.ts
- 5d17eab  refactor(auth): consolidate guards into lib/auth-helpers.ts, add UserRole to lib/enums.ts
- 1b87d00  feat(security): CSRF origin gate in middleware + consolidate workflow PATCH, remove toggle routes

### Architecture / key files
- lib/case-evaluation.ts — Jaccard + exact-name matcher (theory submissions)
- lib/text-utils.ts — shared tokenize/normalizeIdentity used by both theory + checkpoint matchers
- lib/user-case-state.ts — monotonic state machine, SOLVED is terminal
- lib/rate-limit.ts — token-bucket per (ip, route); in-memory dev, Upstash Redis prod
- lib/auth-helpers.ts — requireSession(), requireAdmin(), getOptionalSession()
- lib/enums.ts — browser-safe const mirrors of all Prisma enums (UserRole, TheoryResultLabel, UserCaseStatus, CaseWorkflowStatus)
- lib/labels.ts — human-readable label constants
- lib/validators.ts — Zod schemas; child entities carry id + globalPersonId
- types/next-auth.d.ts — Session/JWT augmented with id + role
- prisma/schema.prisma — Prisma enums, CaseAudit model, per-case debrief copy fields
- next.config.ts — security headers + CSP report-only
- middleware.ts — CSRF origin check on all POST/PUT/PATCH/DELETE /api/* except /api/auth/*; auth gating for /bureau/* and /api/admin/*
- app/api/admin/cases/[caseId]/route.ts — diff/upsert PUT with CaseAudit trail
- app/api/admin/cases/[caseId]/workflow/route.ts — unified PATCH for workflow transitions; replaces deleted /status + /publish routes
- .env.example — all env vars documented (DATABASE_URL, AUTH_SECRET, SEED_ADMIN_*, UPSTASH_*, NEXT_PUBLIC_APP_URL)

### Week 3 priorities
- Prompt 11: Tabbed editor split (EditCaseContentForm → 6 tab components + per-section PATCH endpoints)
- Prompt 12: Activation code admin view (/bureau/admin/cases/[caseId]/codes)
- Prompt 13: Image upload pipeline (Cloudflare R2 or S3)
- Prompt 14: Support inbox (/bureau/admin/support)
- Prompt 15: Slug history + 301 redirect

### Prompt library location
See black-ledger-prompts.md (uploaded to Cowork session) for Prompts 07–25.
Week 3 prompts (11–15) are outline-level — flesh out before pasting.

### Test credentials (local dev only)
Admin: mycart19@gmail.com
Investigator: test@blackledger.com / Test1234!
Activation code for case #1: ALDERS-D6A5FBA9 (may be claimed — generate a new one if needed)
