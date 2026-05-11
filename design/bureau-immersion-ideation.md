This is ChatGPT's full ideation response

# Section 1: Restated understanding

Black Ledger already has the skeleton of the right product: a protected Bureau, owned cases, staged progression, checkpoints, hidden evidence redemptions, global people search, rich person dossiers, and sealed final-theory review. The current `/bureau` page opens with “Black Ledger Bureau Intelligence System,” “Classified Session,” “Auth Verified,” an operative identity block, case stats, activation, active reviews, archive links, and solved-case summaries; functionally, that is correct, but structurally it is still a vertical account dashboard: header, stats row, activation card, active list, archive list. It tells the player what they own; it does not yet make them feel like they have sat down at a workstation. 

The case workspace is closer to the Bureau fantasy than the dashboard because it has “Case Workspace,” “Classified,” stage progression, checkpoint gating, revealed evidence, people of interest, records, hints, and final theory submission. But the page still reads as a long categorized dossier scroll rather than an analyst surface with tabs, panes, timelines, boards, and system activity. The copy “Clear this checkpoint to unlock the next stage” and “Progression is tied to case understanding, not manual advancement” is conceptually strong, but it still sounds like product instruction rather than an internal Bureau protocol. 

The strongest current surface is the global person profile. `app/bureau/people/[personId]/page.tsx` already feels like a classified dossier: “Classified Subject Dossier,” bureau ID, watchlist flag, source reliability, case linkage, profiler notes, cyber trace, forensic associations, identity graph, subject timeline, and unresolved flags. That file is the closest thing in the codebase to the Garcia-grade direction because it treats information as institutional intelligence rather than generic content. 

The global database search is halfway there. `GlobalPeopleSearchTerminal.tsx` uses “Bureau Intelligence Network,” “Live Query · Node BLB-NY-01,” “Query Terminal,” “Encrypted · TLS Verified,” “Run Query,” and status states like “Querying Bureau Index...” and “No Match In Bureau Index.” That is good diegetic chrome, but the search act is still a centered two-field form; it lacks query history, provenance, side-channel feedback, and the feeling that the system is actively triangulating across files. 

The per-case database is much flatter. It says “Bureau Database” and “Search the unlocked case database for people, evidence records, and bureau hints,” then passes visible people, records, and hints into `CaseDatabaseSearch`. That is accurate, but it reads as a search page, not a living case index. It needs provenance, source classes, classification states, last-indexed metadata, and a more procedural shell. 

The evidence record detail page is the weakest “record” surface because it still uses a plain hero, category pill, unlock-stage pill, and a “Record Body” card. It is readable, but it does not yet look like an evidence item with chain-of-custody, file origin, analyst annotations, redactions, or record-class metadata. 

The unlock flow has the most obvious low-cost immersion gap. The page currently says “Unlock evidence,” “Scan or type the code printed on a physical artifact to reveal its hidden case file,” and the form says “Access Code,” “Enter or scan code,” “Unlocking...,” “Unlock,” then “Evidence unlocked.” The functional QR bridge is excellent; the presentation should feel like receiving an intel drop, not submitting a coupon code.  

The final theory system is directionally right after Batch 13. The form tells the player that suspect, motive, and evidence must form “one complete chain,” and the public result collapses to “Closure Standard Met” or “Revision Required.” That must be preserved because CLAUDE.md explicitly locks the closure-standard rule: public feedback must never confirm isolated correctness, and the debrief is where component-level reasoning belongs after CASE_CLOSED.  

The site config still contains consumer-facing copy like “Premium investigative entertainment,” “Digital bureau portal,” and “A serious digital review layer designed to support the file.” That is clean, but it is not yet fully in-world. The marketing layer currently explains the product; the Bureau layer should make the player inhabit the product. 

The attached full-scope audit also identifies the same future tension: `/bureau` is a single-column scroll when the intended pattern is a multi-panel analyst desk; the `User` model lacks a fictional identity layer like callsign or specialty; and a Bureau-immersion redesign has not started. I did not see a standalone `audits/2026-05-07-ux-polish-audit.md` attachment, so I used the uploaded 2026-05-10 full-scope review where it summarizes and carries forward the relevant UX/voice findings.  

# Section 2: Design principles for Garcia-grade Bureau immersion

## 1. The analyst exists first

The player should not merely authenticate; they should be recognized by the Bureau as an analyst with a desk, access level, queue, and current assignment. The existing dashboard exposes `userEmail` and `userRole`, but email is account infrastructure, not fictional identity. Garcia’s workstation works because she has a role inside the world: she is not “a user,” she is the technical analyst the team calls when the case needs data. Black Ledger should treat sign-in as workstation handoff: badge accepted, analyst seat restored, open files queued.

## 2. Panels, not pages

A Garcia-grade screen is not a sequence of cards down a page. It is a working surface with simultaneous streams: active case, query terminal, system status, intel queue, file shelf, unresolved flags, and recent activity. The current `/bureau` page already has the data for this, but it flows vertically; the redesign should turn those pieces into named regions of an analyst desk. This principle comes directly from the prompt’s Criminal Minds reference: multiple panels of data running at once, not a dashboard that explains itself. 

## 3. Every fact has provenance

A record should not just be “body text.” It should have source, classification, reliability, access state, stage availability, and relation to the case. The person dossier already demonstrates this with source reliability, confidence, access level, evidence links, case linkage, and analyst notes. Apply that same pattern to records, hints, unlocks, search results, and final review receipts. 

## 4. Search is a performance

The global database already says “Query Terminal” and “Querying Bureau Index...” but the actual performance is still just submit form, receive list. In *Her Story*, search is the whole act of investigation; in Garcia’s scenes, the search itself is dramatized as work. Black Ledger should make the query feel like an operation: build query, run index, scan sources, return matches, preserve transcript.

## 5. The file is physical

The product begins with a physical kit, so the digital case workspace should echo paper, folders, tabs, stamps, file dividers, chain-of-custody sheets, clipped photos, and annotated records. *Return of the Obra Dinn* works because the book is not a menu; it is the fictional artifact the player uses. Black Ledger’s case workspace should become a file object, not a long article.

## 6. The Bureau speaks selectively

The Bureau should have a voice, but not a constant narrator. It should speak when access changes, intel arrives, a code resolves, a checkpoint clears, or a theory is sealed. The theory system already has the right register with “Closure Standard Met” and “The file is not ready for closure.” That register should become a shared system-message language across activation, unlock, database search, and errors. 

## 7. Institutional, not governmental

Black Ledger should feel procedural and official without copying real federal branding. Use fictional Bureau language, invented divisions, invented node names, access classes, case serials, and internal filing conventions. Avoid real badges, seals, federal forms, or FBI-like marks. The prompt explicitly requires “of the genre,” not “of the actual institution.” 

## 8. Memory creates ownership

The longer the player uses the Bureau, the more the Bureau should feel like their workstation: cleared files on the shelf, a stable callsign, last-opened case, saved query transcript, archive stamps, and a persistent desk state. This is not gamification. It is continuity. The current solved/archive split is a good data foundation; it needs a spatial metaphor.

# Section 3: Reference deconstruction

## Criminal Minds — Garcia’s BAU workstation

Mechanically, Garcia’s workstation is a multi-monitor ritual: one screen searches identities, another shows records, another shows communications, another frames the case context. The audio language is small but consistent: incoming call, secure channel, keystrokes, alert tone. The copy is not explanatory; it assumes institutional fluency. For Black Ledger, this translates into `/bureau` as a grid with “Active File,” “Intel Queue,” “Global Query,” “Archive Shelf,” and “Operator Identity” all visible at once, replacing the current vertical dashboard.

## Criminal Minds — Garcia as a person at a desk

Garcia’s desk is not generic federal hardware; it is personalized within the institution. Her personality does not break the procedural world; it humanizes it. Black Ledger should not copy Garcia’s voice, colors, or humor, but it should copy the structural move: the player has a station that belongs to them. Add callsign, analyst specialty, last file opened, and “desk restored” language.

## Her Story / Telling Lies — search as investigation

The search bar is not a utility; it is the core verb. Results do not over-explain themselves; the player earns understanding by choosing terms, noticing gaps, and building a timeline. Black Ledger’s global database should keep its two-field safe search for now, but the interface should show query transcript, source domains, zero-result guidance, and “refine query” language. The goal is not advanced search power for its own sake; it is making search feel like casework.

## Return of the Obra Dinn — bundled validation

Obra Dinn does not validate every clue the instant the player guesses it. It validates deduction as a bundle. Black Ledger’s Batch 13 theory submission already applies this principle by sealing suspect, motive, and evidence into one closure-standard verdict. The next step is presentation: the theory form should feel like assembling a closure packet, not filling three inputs and clicking “Submit Theory.”  

## Orwell — dossiers built piece by piece

*Orwell* turns dragging, saving, and classifying information into the game. The player’s action is not “read content”; it is “turn a fragment into institutional intelligence.” Black Ledger can borrow this without new mechanics: unlocked evidence should arrive as a filed item with source, classification, and reason it matters. The existing AccessCode and HiddenEvidence models already support this bridge; the UI should dramatize it. 

## 24 — named channels and sourced panels

CTU-style interfaces feel authoritative because panels are labeled by source and operational function: channel, source, node, feed, analyst, status. Black Ledger already uses “Node BLB-NY-01,” which is good. Extend it: “INTAKE,” “ARCHIVE,” “FIELD NOTE,” “SUBJECT INDEX,” “EVIDENCE LOCKER,” “REVIEW BOARD.” The panel name should tell the player where the information comes from inside the fiction.

## True Detective / Mindhunter — investigation as a room

The authority comes from accumulated evidence: photos, folders, taped timelines, witness statements, maps, and ugly bureaucratic patience. Black Ledger’s case workspace should not chase flashy hacker UI. The case page should feel like a desk with physical tabs and a board: “Timeline,” “People,” “Records,” “Unlocked Artifacts,” “Review Standard.” The screen becomes the room.

## The Wire — patient accumulation

The Wire-tap room is not glamorous. It is procedural repetition, slow classification, and small confirmations. This matters for Black Ledger because the product should not over-animate every click. Motion and sound should mark meaningful state changes: code redeemed, stage cleared, case closed, new artifact indexed. Everyday reading should remain quiet.

## Palantir / Maltego / Bellingcat — entity relationships

The global person dossier already points toward an entity graph with aliases, connections, appearances, evidence links, digital traces, and timeline events. The next design move is not necessarily an expensive graph canvas; the 80/20 version is relationship cards, “linked subject” lanes, and provenance chips. Full graph UI can remain Phase 3.

# Section 4: Feature ideation — the catalog

## A. Identity and onboarding

### 1. Badge Scan Entry

Replace ordinary sign-in confirmation with a badge-scan transition after successful auth: “ACCESS VERIFIED / WORKSTATION RESTORED.” This produces the feeling that the player is entering a secured internal system, not logging into a consumer account.

Reference: Criminal Minds secure workstation handoff; 24 CTU access language.

Current surface: `app/login/page.tsx`, `components/auth/LoginForm.tsx`, `/bureau` redirect state.

Effort: XS. Mostly copy and one small post-login banner or query-state message.

Current copy replacement examples:

* Current: “Sign in”
* Replacement: “Scan Badge”
* Current: “Welcome back!”
* Replacement: “Access verified. Analyst station restored.”

### 2. Callsign From Existing User Data

Create a fictional callsign without schema first, using deterministic derivation from the user ID or email prefix, then display it as “ANALYST / {CALLSIGN}” instead of plain email prominence. This gives identity immediately without an additive migration.

Reference: CTU callsign culture; Garcia as named internal specialist.

Current surface: `app/bureau/page.tsx` operative identity block currently displays `userEmail` and `userRole`. 

Effort: S. No schema required for V1; create `lib/bureau-identity.ts` and use it in dashboard/nav.

### 3. Analyst Desk Card

Turn the top dashboard identity block into a “desk” module: callsign, access level, current assignment, last indexed activity, active file count, solved-file count. This converts account metadata into fictional workstation status.

Reference: Garcia’s personalized BAU desk.

Current surface: `app/bureau/page.tsx`.

Effort: S. Reuses existing counts and session data.

## B. The dashboard as workstation

### 4. Analyst Desk Grid

Reshell `/bureau` from a single vertical scroll into a CSS grid with named areas: Identity, Active File, Intake, Intel Queue, Global Query, Archive Shelf, System Status. The data does not need to change; the layout needs to stop reading as “cards in a feed.”

Reference: Criminal Minds multi-monitor workstation; 911 dispatch multi-panel UI.

Current surface: `app/bureau/page.tsx`, which the audit already flags as single-column dashboard architecture. 

Effort: M. Layout work plus component extraction, but no new database model.

### 5. Intel Queue Panel

Add a right-side panel with 3–5 deterministic system items: “No new external intel,” “Latest unlocked artifact,” “Last theory review,” “Stage checkpoint pending,” “Global index online.” This makes the Bureau feel alive without requiring real-time infrastructure.

Reference: 24 situation-room status feeds.

Current surface: `app/bureau/page.tsx`; later reusable as `components/bureau/IntelQueue.tsx`.

Effort: S. Derived from existing owned cases, submissions, and redemptions.

### 6. Case Shelf Instead of Active Cards

Reframe active and solved cases as physical file folders on an archive shelf. Active files show a pull-tab, stage stamp, and “Open Workspace”; solved files show “CLOSED” stamp and debrief access.

Reference: Mindhunter basement files; True Detective case spread.

Current surface: `/bureau` active reviews and solved cases.

Effort: S. Mostly visual component replacement.

Current copy replacement:

* Current: “Active Reviews”
* Replacement: “Open Files on Desk”
* Current: “No active cases on record.”
* Replacement: “No open files assigned to this station.”

### 7. Station Status Strip

Add a thin persistent top strip: “BLB-NY-01 / INDEX ONLINE / ARCHIVE SEALED / SESSION CLASSIFIED / LOCAL TIME.” It should not be a navbar; it is machine status.

Reference: Person of Interest machine POV density, without sci-fi AI framing.

Current surface: `app/bureau/page.tsx`, `app/bureau/cases/[slug]/page.tsx`, `app/bureau/database/page.tsx`.

Effort: XS. Reusable component with static/deterministic text.

## C. The case workspace as case file

### 8. File Tab Navigation

Replace the long case workspace scroll with sticky dossier tabs: Brief, People, Records, Unlocked Intel, Checkpoint, Closure Review. The underlying sections remain; the player now feels like they are flipping a case file, not reading a page.

Reference: Obra Dinn’s book-as-tool; physical case-folder metaphor.

Current surface: `app/bureau/cases/[slug]/page.tsx`.

Effort: M. Requires section extraction and anchor/tab state, no schema.

### 9. Stage Briefing Header

Rewrite the case header as an internal briefing: “Assignment Brief,” “Current Stage,” “Known Constraints,” “Unresolved Questions.” Keep summary, players, duration, difficulty, but present them as file metadata.

Reference: Zodiac procedural office; Mindhunter case binders.

Current surface: `app/bureau/cases/[slug]/page.tsx`.

Effort: S. Copy and layout only.

Current copy replacement:

* Current: “Case Workspace”
* Replacement: “Assignment Brief”
* Current: “Bureau Database”
* Replacement: “Open Case Index”

### 10. Evidence Board Snapshot

Add a compact “board” showing people, records, hints, and unlocked artifacts as small linked nodes/cards grouped by type. It does not need lines or physics; it just needs visual adjacency.

Reference: True Detective wall board; Maltego relationship thinking.

Current surface: `app/bureau/cases/[slug]/page.tsx`; possible component `components/bureau/CaseBoardSnapshot.tsx`.

Effort: M. Derived from existing `visiblePeople`, `visibleRecords`, `visibleHints`, and `revealedEvidence`.

### 11. Record Detail as Evidence Sheet

Redesign the record detail page from hero + body card into an evidence sheet with classification stamp, source, category, unlock stage, record body, analyst note area, and “related file” navigation. It should look filed, not published.

Reference: Mindhunter paper authority; Bellingcat evidence provenance.

Current surface: `app/bureau/cases/[slug]/records/[recordId]/page.tsx`, currently “Evidence Record,” category, unlock stage, “Record Body.” 

Effort: S. Mostly UI shell; optional later schema for richer source fields.

## D. Search and database

### 12. Query Transcript

After every database search, show a small transcript:
“QUERY RECEIVED”
“INDEX: IDENTITY”
“PARAMETERS: NAME / DOB”
“MATCHES RETURNED: N”
This makes the system feel like it processed an operation, not a form.

Reference: Garcia narrating search work; Her Story search-as-investigation.

Current surface: `components/bureau/GlobalPeopleSearchTerminal.tsx`.

Effort: S. Uses existing local state.

### 13. Provenance Chips on Results

Add chips to result cards for source reliability, confidence, access level, watchlist flag, last indexed date, and case-link count. The person profile already has those fields; the search results should preview them.

Reference: Palantir/Gotham entity cards.

Current surface: `components/bureau/GlobalPeopleSearchTerminal.tsx` and `app/bureau/database/actions.ts`.

Effort: M if server action projection needs more fields; S if fields already exist in result type.

### 14. Per-Case Database Terminal Shell

Keep `CaseDatabaseSearch`, but wrap it in the same terminal grammar as the global database: “Case Index,” “Indexed Objects,” “Unlocked Stage,” “Restricted Items.” The current shell says “Search the unlocked case database...” and then behaves like a simple search page; it needs system framing. 

Reference: 24 named panels; Her Story single-verb investigation.

Current surface: `app/bureau/cases/[slug]/database/page.tsx`, `components/bureau/CaseDatabaseSearch.tsx`.

Effort: S. Copy and visual shell.

Current copy replacement:

* Current: “Search the unlocked case database for people, evidence records, and bureau hints.”
* Replacement: “Query the case index. Only cleared subjects, records, and analyst notes are available at your current stage.”

## E. The Bureau speaks

### 15. Bureau Message Registry

Create a single copy registry for system messages: activation success, unlock success, search empty, theory sealed, checkpoint pass/fail, generic error. This prevents each component from inventing its own tone.

Reference: Control-style institutional copy; 24 system-channel consistency.

Current surface: new `data/bureau-messages.ts`, used by `CaseActivationForm`, `UnlockForm`, `TheorySubmissionForm`, database terminal, checkpoint form.

Effort: S. Mostly copy centralization.

### 16. Classification Stamp Variants

Create reusable stamps: “CLASSIFIED,” “RESTRICTED,” “OPEN FILE,” “CLOSED,” “REVISION REQUIRED,” “INTEL RECEIVED,” “CASE ACCESS REQUIRED.” They should be visually consistent and slightly imperfect/physical.

Reference: procedural file stamps; Mindhunter/Zodiac paper evidence.

Current surface: extend current `StampBadge` and replace ad hoc pills across `/bureau`, workspace, database, unlock, record detail.

Effort: XS/S. Existing `StampBadge` already exists; expand variants.

## F. Hidden-evidence reveal

### 17. Intel Drop Handshake

When `/bureau/unlock?code=` auto-submits, display a short deterministic sequence: “CODE RECEIVED,” “ARTIFACT SOURCE VERIFIED,” “CASE LINK CONFIRMED,” “INTEL FILE RELEASED.” Then show the unlocked content.

Reference: secure-channel handshake; Garcia terminal resolving a hit.

Current surface: `app/(unlock)/bureau/unlock/page.tsx`, `UnlockForm.tsx`.  

Effort: S. Client-side status steps; no backend change.

Current copy replacement:

* Current: “Unlock evidence”
* Replacement: “Incoming Artifact Transmission”
* Current: “Evidence unlocked”
* Replacement: “Intel file released to your case desk.”

### 18. Artifact Receipt Panel

After success, show a receipt-like panel: artifact type, case access confirmed, already-redeemed state, filing destination, and “Return to workspace.” This tells the player where the evidence went.

Reference: chain-of-custody intake.

Current surface: `UnlockedPanel` in `UnlockForm.tsx`.

Effort: S. Uses `payload.alreadyRedeemed` and content type.

## G. Theory submission

### 19. Closure Packet Ceremony

Reframe the final theory form as a closure packet: “Responsible Party,” “Motive Chain,” “Evidence Chain,” “Seal for Review.” The mechanics remain identical, preserving the sealed verdict rule.

Reference: Return of the Obra Dinn bundled validation; Bureau closure-standard rule.

Current surface: `components/bureau/TheorySubmissionForm.tsx`. 

Effort: XS. Copy and labels.

Current copy replacement:

* Current: “Primary suspect”
* Replacement: “Responsible party named in closure packet”
* Current: “Submit Theory”
* Replacement: “Seal Packet for Bureau Review”

### 20. Review Receipt

After submission, show a formal review receipt with verdict, timestamp, case serial, and sealed feedback. Do not show score, component correctness, or partial labels.

Reference: institutional review board memo.

Current surface: `TheorySubmissionForm.tsx`, recent submissions panel in `app/bureau/cases/[slug]/page.tsx`.

Effort: S. Presentation only; must preserve Batch 13 sealed response.

## H. Audio and motion

### 21. Silent-First Motion Layer

Add subtle scan sweeps, type-on labels, pulse dots, and short handshake transitions only for major events: login restored, code redeemed, query run, checkpoint cleared, theory sealed. No constant loops beyond tiny status indicators.

Reference: Garcia/CTU terminal motion, The Wire restraint.

Current surface: shared components: `TerminalReadout`, `StampBadge`, `UnlockForm`, database terminal.

Effort: S/M. Framer Motion already exists in the project, and `RevealedEvidence` already uses it per the audit summary. 

### 22. Optional Local Sound Pack

Add muted, opt-in UI sounds: one soft access tone, one query tick, one intel arrival tone, one closure stamp. Default off or controlled by a “sound” toggle.

Reference: secure-channel tones and dispatch UIs.

Current surface: new `components/bureau/BureauSoundProvider.tsx`.

Effort: M. Needs local assets, preference state, and accessible defaults. No external service.

## I. Worldbuilding around the case

### 23. Shift Log

Add a small “Shift Log” panel with deterministic notes like “Night desk indexed one new artifact,” “No external correspondence attached,” “Checkpoint pending analyst review.” This gives the Bureau institutional life without AI or live agents.

Reference: The Wire’s patient case room; Lacuna handler-style updates.

Current surface: `/bureau` and case workspace.

Effort: S. Generated from existing state, not authored per user.

### 24. Handler Memo Blocks

Each stage can include a short memo-style header from a fictional desk officer or review board. This is not a chatbot and not dynamic. It is authored case content, eventually editable in admin.

Reference: Lacuna’s handler channel; Control-style internal memos.

Current surface: `app/bureau/cases/[slug]/page.tsx`; Phase 3 may require schema fields per stage.

Effort: M now if hardcoded/derived; L if fully admin-authored per stage.

## J. Personalization across sessions

### 25. Closed Files Shelf

Turn `/bureau/archive` into a visual shelf of closed files and sealed review receipts, not just a list. Solved cases should look physically filed away, with dates, stamps, and debrief access.

Reference: archive room / evidence locker.

Current surface: `/bureau/archive`; the audit also flags archive theory feedback as a sensitive surface that must be aligned with Batch 13 sealed rules. 

Effort: M. UI refactor plus sealed-feedback correction.

### 26. Persistent Analyst Profile

Add real `User.callsign`, `User.specialty`, and maybe `User.deskTheme` later. This is the durable version of the callsign idea and lets the Bureau remember the player as a fictional analyst.

Reference: Garcia as a known internal role, not a generic user.

Current surface: Prisma `User` model, registration/profile settings, `/bureau` identity block. The audit notes this layer is absent today. 

Effort: L. Additive schema migration plus UI and backfill.

# Section 5: Anti-recommendations

1. Do not imitate Penelope Garcia’s personality. The reference is structural: role, workstation, data density, desk identity, Bureau response. Copying the exact bubbly voice would feel derivative and off-brand.

2. Do not turn Black Ledger into green-on-black hacker cosplay. The prompt is explicit that the genre is terrestrial procedural noir, not sci-fi or primary hacker culture. 

3. Do not over-animate reading surfaces. Evidence review should feel patient and serious. Motion belongs at transitions and state changes, not on every paragraph.

4. Do not add XP, levels, “junior investigator” badges, daily streaks, or achievement confetti. That makes the product feel like a mobile game and collapses the seriousness of the Bureau frame.

5. Do not create fake “real FBI” forms, insignia, seals, or badge language. Use fictional Black Ledger Bureau systems and invented file classifications.

6. Do not let the Bureau over-explain itself. “Click here to search the database” is website language. “QUERY INDEX” is system language. The interface should trust the player to infer context.

7. Do not add AI/LLM chat as a near-term Bureau agent. It would be expensive, legally messy, unpredictable, and explicitly outside Phase 1/2 constraints. Authored memos and deterministic state messages achieve the feel without the risk.

8. Do not make the player “the chosen one.” The correct fiction is one analyst at one desk inside a larger institution. The Bureau should feel bigger than the player.

9. Do not expose diagnostic correctness anywhere after Batch 13. The closure-standard rule is part security, part game design, part voice. Archive, debrief, and review receipt surfaces must preserve it. 

10. Do not redesign everything at once. The single-person indie constraint matters. The cheap win is not a total app rebuild; it is reshelling existing data with stronger in-world structure.

# Section 6: Phased roadmap recommendation

## Phase 1 — cheap wins

Goal: get 60% of the Bureau feel with copy, shell, and small component changes. Cumulative effort: S/M, roughly 1–2 focused batches.

1. Badge Scan Entry
   Principles: The analyst exists first; Bureau speaks selectively.
   Effort: XS.

2. Callsign From Existing User Data
   Principles: The analyst exists first; memory creates ownership.
   Effort: S.

3. Bureau Message Registry
   Principles: Bureau speaks selectively; institutional, not governmental.
   Effort: S.

4. Classification Stamp Variants
   Principles: every fact has provenance; file is physical.
   Effort: XS/S.

5. Intel Drop Handshake for `/bureau/unlock`
   Principles: Bureau speaks selectively; search/intake as performance.
   Effort: S.

6. Closure Packet copy pass for `TheorySubmissionForm`
   Principles: file is physical; sealed review.
   Effort: XS.

7. Per-case database copy/shell rewrite
   Principles: every fact has provenance; search is a performance.
   Effort: S.

Recommended Phase 1 copy changes:

* “Add a case to your archive” → “Intake a new case file”
* “Enter a valid activation code to link a case file to your operative account.” → “Enter an activation code to assign this file to your Bureau station.”
* “Unlock evidence” → “Incoming Artifact Transmission”
* “Evidence unlocked” → “Intel file released”
* “Search the unlocked case database...” → “Query the case index. Only cleared subjects, records, and analyst notes are available at your current stage.”
* “Submit Theory” → “Seal Packet for Bureau Review”

## Phase 2 — the design layer

Goal: convert the Bureau from a vertical web app into a working analyst station. Cumulative effort: M/L, likely one major supervised batch plus polish.

1. Analyst Desk Grid
   Principles: panels, not pages; analyst exists first.
   Effort: M.

2. Intel Queue Panel
   Principles: Bureau speaks selectively; panels, not pages.
   Effort: S.

3. Case Shelf Instead of Active Cards
   Principles: file is physical; memory creates ownership.
   Effort: S.

4. File Tab Navigation in workspace
   Principles: file is physical; panels, not pages.
   Effort: M.

5. Query Transcript in global database
   Principles: search is a performance; every fact has provenance.
   Effort: S.

6. Evidence Record as Evidence Sheet
   Principles: every fact has provenance; institutional authority.
   Effort: S.

7. Review Receipt after theory submission
   Principles: sealed review; Bureau speaks selectively.
   Effort: S.

This is the phase where Black Ledger stops feeling like “a serious portal” and starts feeling like a workstation.

## Phase 3 — the ambitious world

Goal: make the Bureau persistent, personal, and expandable across multiple cases. Cumulative effort: L/XL.

1. Persistent Analyst Profile
   Principles: analyst exists first; memory creates ownership.
   Effort: L.

2. Handler Memo Blocks with admin authoring
   Principles: Bureau as living institution; file is physical.
   Effort: L.

3. Evidence Board Snapshot with relationships
   Principles: every fact has provenance; panels, not pages.
   Effort: L.

4. Closed Files Shelf and archive redesign
   Principles: memory creates ownership; file is physical.
   Effort: M/L.

5. Optional Local Sound Pack
   Principles: Bureau speaks selectively; workstation atmosphere.
   Effort: M.

6. Full provenance model for records
   Principles: every fact has provenance.
   Effort: XL if schema-backed and admin-authored.

7. Graph-like subject relationship view
   Principles: search as investigation; entity relationships.
   Effort: XL if interactive graph; M if card-based adjacency only.

# Section 7: Voice and copy register sample

Sign-in confirmation:
“ACCESS VERIFIED. Analyst station restored. Open files are now available.”

Case activation:
“CASE INTAKE COMPLETE. File assigned to this Bureau station.”

Theory submission accepted:
“CLOSURE STANDARD MET. The Bureau accepts the submitted chain of suspect, motive, and evidence.”

Theory submission revision required:
“REVISION REQUIRED. The file is not ready for closure. The Bureau could not verify a complete chain.”

Intel arrival notification:
“NEW INTEL RECEIVED. Artifact indexed and attached to the active case file.”

Classification stamp:
“RESTRICTED MATERIAL. Cleared for current-stage review only.”

Search empty state:
“NO INDEX MATCH. The Bureau found no cleared subject under those parameters.”

Search error state:
“QUERY INTERRUPTED. The index did not return a reliable response. Run the search again.”

Unlock success:
“SOURCE VERIFIED. Intel file released to your case desk.”

Unlock already redeemed:
“ALREADY FILED. This artifact has previously been indexed for your account.”

Checkpoint cleared:
“CHECKPOINT CLEARED. Next-stage material released to the case file.”

Checkpoint failed:
“REVIEW INCOMPLETE. Current answer does not satisfy the stage standard.”

Sign-out confirmation:
“SESSION SEALED. Workstation access closed.”

Workspace “About this case” header:
“ASSIGNMENT BRIEF. Review the file, isolate the contradiction, and document the chain that survives scrutiny.”

Archive empty state:
“NO CLOSED FILES. Resolved cases will appear here after Bureau review accepts a closure packet.”

# Section 8: What this exercise is not

This did not write actual code.

This did not produce implementation tickets; it mapped the creative direction and feature space the dev plan should be derived from.

This did not propose multiplayer or co-op modes.

This did not propose new external integrations.

This did not propose AI/LLM features for Phase 1 or Phase 2.

This did not break the Batch 13 closure-standard rule; the sealed public theory verdict remains the design foundation.

This did not use real federal signage, seals, badges, or agency branding.

This did not address security, performance, accessibility, or compliance as separate audit tracks, except where current audit notes affect immersion scope.

This did not estimate dollar cost or team size. Effort is sized only relative to the existing Black Ledger batch style.
