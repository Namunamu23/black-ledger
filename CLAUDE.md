## Black Ledger — Project State (updated 2026-04-20)

### Current status
Week 3 COMPLETE / Week 4 IN PROGRESS — 24 commits on origin/main. 66 Vitest tests passing. Build clean.

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

### Week 3 — Completed commits (closed 2026-04-20)
5 commits, in order:
- 271a78e  feat(admin): tabbed case editor — 6 tab components + per-section PATCH endpoints
- c0a4fb6  feat(admin): activation code management page — batch generate, revoke, CSV export
- 1eedc93  feat(admin): image upload pipeline — R2 presigned URLs, blurhash, ImageUploader component
- 350ecd6  feat(admin): support inbox — paginated list, detail view, status actions, reply stub
- 6d8421b  feat(admin): slug history + 301 redirect — CaseSlugHistory model, rename tracking, page-level redirect

### Architecture / key files
- lib/case-evaluation.ts — Jaccard + exact-name matcher (theory submissions)
- lib/text-utils.ts — shared tokenize/normalizeIdentity used by both theory + checkpoint matchers
- lib/user-case-state.ts — monotonic state machine, SOLVED is terminal
- lib/rate-limit.ts — token-bucket per (ip, route); in-memory dev, Upstash Redis prod
- lib/auth-helpers.ts — requireSession(), requireAdmin(), getOptionalSession()
- lib/enums.ts — browser-safe const mirrors of all Prisma enums (UserRole, TheoryResultLabel, UserCaseStatus, CaseWorkflowStatus)
- lib/labels.ts — human-readable label constants
- lib/validators.ts — Zod schemas; child entities carry id + globalPersonId; per-section PATCH schemas + upload + support schemas
- types/next-auth.d.ts — Session/JWT augmented with id + role
- prisma/schema.prisma — Prisma enums, CaseAudit model, per-case debrief copy fields; new this week: CaseSlugHistory model, SupportMessageStatus enum; new columns ActivationCode.kitSerial/revokedAt, CaseFile.heroImageUrl, CasePerson.portraitUrl
- next.config.ts — security headers + CSP report-only
- middleware.ts — CSRF origin check on all POST/PUT/PATCH/DELETE /api/* except /api/auth/*; auth gating for /bureau/* and /api/admin/*
- app/api/admin/cases/[caseId]/route.ts — diff/upsert PUT with CaseAudit trail (legacy aggregate; tabs are now the primary editor)
- app/api/admin/cases/[caseId]/workflow/route.ts — unified PATCH for workflow transitions; replaces deleted /status + /publish routes
- app/bureau/admin/cases/[caseId]/edit/_components/ — 6 tab components (Overview/People/Records/Hints/Checkpoints/Solution), each with independent save state
- app/api/admin/cases/[caseId]/overview|people|records|hints|checkpoints|solution/route.ts — per-section PATCH endpoints with diff/upsert + CaseAudit
- app/bureau/admin/cases/[caseId]/codes/ — activation code management (batch generate, revoke, CSV export)
- app/api/admin/cases/[caseId]/codes/route.ts — GET (list + ?format=csv) + POST (batch generate, rate-limited)
- app/api/admin/cases/[caseId]/codes/[codeId]/route.ts — PATCH (revoke)
- app/api/admin/uploads/sign/route.ts — R2 presigned PUT URL (15-min expiry, rate-limited)
- app/api/admin/uploads/blurhash/route.ts — best-effort blurhash generation via sharp
- components/admin/ImageUploader.tsx — client component: sign → PUT → onChange + blurhash
- app/bureau/admin/support/ — support inbox (paginated list + detail + status actions + reply stub)
- app/api/admin/support/[id]/reply|status/route.ts — reply stub (no transport yet) + status PATCH
- components/admin/EditCaseContentForm.tsx — DEPRECATED (deprecation header added; remove after Week 3 QA)
- .env.example — all env vars documented (DATABASE_URL, AUTH_SECRET, SEED_ADMIN_*, UPSTASH_*, NEXT_PUBLIC_APP_URL, R2_*)

### Week 4 priorities
- Prompt 16: AccessCode + HiddenEvidence schema (physical-to-digital bridge)
- Prompt 17: Redemption flow (/bureau/unlock + /api/access-codes/redeem)
- Prompt 18: Hidden evidence reveal (UserHiddenEvidence + workspace render)
- Prompt 19: Admin code creator + QR generator (extend /codes page)

### Known follow-ups (deferred from Week 3)
- Email transport (resend/nodemailer) — wire into /api/admin/support/[id]/reply + add SupportReply model
- SupportMessageStatus to lib/enums.ts + lib/labels.ts when transport lands
- Subject column on SupportMessage + public SupportForm — separate prompt
- CSP img-src to add R2 public origin when CSP flips from report-only to enforced
- Public /cases/[slug] page slug-history redirect (currently only /bureau/cases/[slug] redirects)
- Legacy aggregate PUT (app/api/admin/cases/[caseId]/route.ts) does not write CaseSlugHistory when slug changes — only the /overview PATCH does
- Legacy /activation-codes POST route is unrate-limited and still wired to GenerateActivationCodeButton on the admin cases list

### Prompt library location
See black-ledger-prompts.md (uploaded to Cowork session) for Prompts 07–25.
Week 4 prompts (16–19) are outline-level — flesh out before pasting.

### Test credentials (local dev only)
Admin: mycart19@gmail.com
Investigator: test@blackledger.com / Test1234!
Activation code for case #1: ALDERS-D6A5FBA9 (may be claimed — generate a new one if needed)
