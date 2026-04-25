## Black Ledger — Project State (updated 2026-04-25)

### Current status
Week 5 COMPLETE — 37 commits on origin/main, all pushed. 91 Vitest tests passing (was 87; +4 stage-validation tests). Build clean. 57 integration tests still passing.

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

### Week 4 — Completed commits (closed 2026-04-22)
5 commits, in order:
- e616159  chore: delete orphaned EditCaseContentForm, fix CLAUDE.md commit count + follow-ups
- 11a3f1d  feat(schema): AccessCode + HiddenEvidence models for physical-to-digital bridge
- 25a21cb  feat(unlock): /bureau/unlock page + /api/access-codes/redeem endpoint
- ae992fa  feat(workspace): revealed evidence section — AccessCodeRedemption render at workspace load
- e0a321  feat(admin): AccessCode creator + QR generator + /u/[code] short redirect
- ed892ad  chore(test): add full-flow regression script — 57 checks across all 4 weeks
- 5908e1d  fix(workspace): guard slug-history redirect against self-redirect loop

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
- middleware.ts — CSRF origin check on all POST/PUT/PATCH/DELETE /api/* except /api/auth/*; auth gating for /bureau/* and /api/admin/*. `/bureau/unlock` has an explicit pass-through before the `/bureau/*` gate so unauthenticated QR-code arrivals reach the unlock page.
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
- .env.example — all env vars documented (DATABASE_URL, AUTH_SECRET, SEED_ADMIN_*, UPSTASH_*, NEXT_PUBLIC_APP_URL, R2_*)
- prisma/schema.prisma — Week 4 additions: AccessCode, AccessCodeRedemption, HiddenEvidence models; AccessCodeKind + HiddenEvidenceKind enums
- app/api/access-codes/redeem/route.ts — POST, rate-limited 5/60s, validates AccessCode, creates AccessCodeRedemption (@@unique race guard), resolves unlocksTarget to content
- app/bureau/unlock/page.tsx + _components/UnlockForm.tsx — player unlock page; publicly accessible; unauthenticated visitors see sign-in card with callbackUrl preserving ?code= through login; authenticated users see UnlockForm which auto-submits on ?code= query param
- app/bureau/cases/[slug]/_components/RevealedEvidence.tsx — client component; renders AccessCode-unlocked evidence in case workspace with Framer Motion animations
- app/api/admin/cases/[caseId]/access-codes/route.ts — GET (list with redemption counts) + POST (create, with cross-case target validation)
- app/bureau/admin/cases/[caseId]/access-codes/ — admin AccessCode management: create form, QR display, copy URL, list with redemption counts
- app/u/[code]/route.ts — short URL redirect to /bureau/unlock?code=<code>

### Week 5 — Completed commits (closed 2026-04-25)
5 commits — full security + UX audit pass. All pushed to origin/main.

- **fix(security)** — Rate-limit `POST /api/cases/activate` (5/60 s) + legacy `POST /api/admin/cases/[caseId]/activation-codes` (10/60 s). Fix QR code URL: was hardcoded `https://blackledger.app/u`, now reads `NEXT_PUBLIC_APP_URL ?? http://localhost:3000`.
- **fix(admin)** — Per-section PATCH endpoints (`people`, `records`, `hints`, `checkpoints`) now validate `unlockStage ≤ maxStage` (checkpoints: `stage < maxStage`). 4 new Vitest tests added (91 total). tsc clean.
- **fix(public)** — Public `/cases/[slug]` page now checks `CaseSlugHistory` and issues a 301 redirect on renamed cases (mirrors the bureau route). Removed dead `/terms` and `/privacy` links from Footer.
- **chore** — Added `.gitattributes` (`* text=auto eol=lf`). Ran full repo renormalization — working tree clean on all platforms.
- **fix(ux)** — `/bureau/unlock` is now publicly accessible (middleware carve-out before `/bureau/*` auth block). Unauthenticated visitors see a sign-in card; `callbackUrl` preserves the `?code=` param through the NextAuth bounce so the form auto-fills after login.

### Week 6 priorities
Week 6+ prompts: see black-ledger-prompts.md

### Known follow-ups

**P1**
- Legacy aggregate PUT (`app/api/admin/cases/[caseId]/route.ts`) does not write `CaseSlugHistory` when slug changes — only the `/overview` PATCH does. Could cause 404s if anyone uses the old aggregate editor after a rename.
- `requireSessionJson()` helper not yet added to `lib/auth-helpers.ts` — player API routes (checkpoint, theory, redeem) call `auth()` directly; a shared helper would be cleaner and more consistent.

**P2**
- `AccessCodeList` shows "record #5" style target label, not the actual title — enrich GET endpoint or pass label map from page.
- `HiddenEvidence` model created but not yet wired as an `unlocksTarget` type — `resolveContent()` and `resolveEvidence()` only handle record/person/hint; add "hidden_evidence" branch when rows are authored.
- No PATCH endpoint for retiring `AccessCodes` (setting `retiredAt`) — needed for admin code management.
- Validator length inconsistency between old `adminCaseSchema` and per-section schemas (e.g. `debriefClosing: max(2000)` vs `max(3000)`).
- `CaseAudit` not written for: workflow PATCH, batch-generate, revoke, AccessCode create.
- `TheorySubmission` row written even when `UserCaseStatus` is already SOLVED — pollutes history.
- Image upload only checks `contentType`, not file magic bytes — could allow spoofed uploads.

**P3**
- Archive button on `PublishCaseButton` has no confirmation dialog.
- CSP `img-src` does not include R2 public origin — will block hero images when CSP flips from report-only to enforced.
- No `GlobalPerson` admin UI — can only create/edit via seed scripts.
- `/bureau/unlock` unauthenticated message says "We saved your code" — slightly misleading (it's in the URL, not stored). Copy-only fix.
- `SupportMessageStatus` not in `lib/enums.ts` — waiting on email transport.
- Email transport not wired — support reply is stub only.

**Upcoming major milestones**
- **Week 7 (Prompt 24)**: Postgres cutover (Neon / Supabase / Railway). Required before any real traffic — SQLite won't survive concurrent writes.
- **Week 8 (Prompt 25)**: Stripe Checkout + webhook, Order model, email activation code on purchase.

### Prompt library location
See black-ledger-prompts.md (uploaded to Cowork session) for Prompts 07–25.
Week 4 prompts (16–19) are outline-level — flesh out before pasting.

### Test credentials (local dev only)
Admin: mycart19@gmail.com
Investigator: test@blackledger.com / Test1234!
Activation code for case #1: ALDERS-D6A5FBA9 (may be claimed — generate a new one if needed)
