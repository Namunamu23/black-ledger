# Black Ledger — Bureau Bible

Canonical reference for the Black Ledger universe. Every case file, every
character, every player-facing line of copy is written against this
document. Internal use. Authors and writers should treat conflicts with
this bible as bugs in the case, not bugs in the bible.

---

## 1. What is Black Ledger

Black Ledger is a premium murder-mystery platform that pairs a physical
case kit with a digital workspace. The kit ships with printed evidence,
suspect cards, and at least one QR-coded artifact. The web app — the
Bureau — is where players review records, redeem QR-encoded leads, work
through staged checkpoints, and submit a final theory.

The physical-to-digital bridge is the product's core differentiator. A
player who skips the QR-coded artifacts can finish a case but will miss
the strongest evidence chain. A player who scans every artifact gets the
full picture.

Each case is a closed-room investigation. One incident. A defined cast.
A solvable conclusion. There is always a single correct suspect, a
single correct motive, and a single correct evidence chain.

## 2. The Bureau

The Bureau is, in-universe, a cold-case review unit. Players are not
detectives kicking down doors. They are investigators reopening files
that were closed too quickly, misfiled, or quietly buried. The framing
is professional, restrained, and cinematic — closer to an intelligence
briefing than a Halloween haunted house.

Tone constraints:

- No supernatural elements. No twist endings that rely on the
  impossible.
- No jump scares, no body-horror. The disturbing material is what people
  did to one another, not how it looked.
- The evil is always ordinary: greed, silence, careerism, bureaucratic
  cover-up, the small lie that grew teeth.
- The Bureau itself is neutral. It does not editorialize. It surfaces
  the record and lets the investigator draw the conclusion.

## 3. Voice and tone guidelines

Write like an institutional file. Declarative, clipped, factual.

- Short sentences. Active voice. Past tense for events, present tense
  for status.
- Evidence is described factually, never dramatically. "The lighter was
  recovered three meters from the body" — not "The cold metal of the
  lighter glinted in the morning light."
- Character summaries describe behavior and role, not inner psychology.
  Stick to what the record can support: where they were, what they
  said, what they had access to. Speculation belongs in the analyst
  notes column, not the summary.
- Case titles follow the pattern *[Location/Object] + [Formal noun]*:
  "The Alder Street Review", "The Harbor Fog", "The Riverglass Affair".
  Never use a personal name in a case title.
- Never use the word "murder" in player-facing case copy. Use "death",
  "incident", "the events of [date]", "the events at [location]". The
  word is reserved for analyst notes and the debrief, where the
  designation matters.
- Numbers and times are exact when known and absent when not. "Between
  22:40 and 23:10" is acceptable. "Sometime late at night" is not.

## 4. Case structure conventions

Every case has exactly these layers:

- **Overview** — title, slug, summary, players, duration, difficulty.
  The summary is the logline. Two sentences, no more.
- **maxStage: 3** — current cases ship with three stages. The stage
  count may expand in future seasons but should not vary within a
  season.
- **People of Interest** — 4 to 6 characters. Exactly one victim and
  exactly one perpetrator. The remaining two-to-four are witnesses,
  adjacent professionals, or people whose involvement looks load-bearing
  but is not.
- **Case Records** — 3 to 5 documents. Mix categories: police reports,
  witness statements, internal records, financial extracts, badge
  access logs, procurement spreadsheets. Each record carries a
  category, a one-paragraph summary, and a full body the player reads
  in the workspace.
- **Hints** — exactly 3 hints at levels 1, 2, and 3. Level 1 is
  directional ("look at the timeline"). Level 2 is corrective ("the
  badge log contradicts the witness statement"). Level 3 is
  near-conclusive ("compare the procurement extract against the
  witness's role in the certification chain").
- **Checkpoints** — exactly 2 checkpoints, at stages 1 and 2.
  Stage-1 unlocks the middle content layer. Stage-2 unlocks final
  review.
- **Solution** — one correct suspect (pipe-separated aliases), one
  correct motive (pipe-separated phrasings), one correct evidence chain
  (pipe-separated phrasings). The matcher rewards token overlap, so
  authors must write at least three plausible variants per field.
- **Debrief** — five sections: overview, what happened, why the
  original theory failed, why the real answer worked, closing note.
  The per-case `debriefSectionTitle` overrides the generic heading
  ("Why your theory was incomplete") with something specific to this
  case ("Why the robbery theory failed").

## 5. Character archetypes

The cast is small and structurally consistent.

- **The victim** is always someone whose professional work or
  knowledge was the trigger. Compliance officers, auditors, junior
  staff who saw something. Never a random target. Never the wrong
  place at the wrong time.
- **The perpetrator** is always someone with both *access* and
  *something to protect*. Insiders. Colleagues. People with badges,
  not strangers. The motive is professional or financial preservation,
  not passion.
- **The misdirection layer** — at least one character looks
  guilty-adjacent: motive-shaped, opportunity-shaped, present in the
  wrong place. They are not the perpetrator. Their narrative purpose
  is to absorb the player's first hypothesis and survive it.
- **The peripheral informant** — at least one character is not a
  suspect but is genuinely informative. A neighbor, a records clerk,
  a maintenance contractor. They saw something specific. The
  player who reads their statement carefully gains real signal.

Outsiders, drifters, and strangers are never the perpetrator. The
crime is always coming from inside the building.

## 6. Physical kit conventions

Every shipped kit contains:

- A printed **case summary card** whose front matches the digital
  summary line-for-line. Players who only read the kit and never log
  in should still know what the case is.
- **Physical evidence cards** — one per `CaseRecord` row. Cards are
  shorter than the full digital body; the full text only appears in the
  Bureau workspace.
- At least one **QR-coded artifact** — a sticker, a card, a printed
  audio reference. Each QR encodes `https://theblackledger.app/u/<code>`
  and points at an `AccessCode` whose `unlocksTarget` reveals a digital
  record not present in the physical kit.
- An **activation code** (`ActivationCode`) printed on the inside of
  the kit cover. Used once per player to link the case to their Bureau
  account.

QR artifacts may be gated by `requiresStage` so they only resolve
useful content once the player has reached a given stage. A scanned
pre-stage code shows a "you have not reached the required stage yet"
message rather than the unlock body, so the artifact is not consumed.

## 7. GlobalPerson universe

Some characters recur across cases. A `GlobalPerson` carries the full
biographical surface: bureauId, names, aliases, behavioral profile,
digital traces, timeline events, evidence links, analyst notes,
connections to other GlobalPersons. A `CasePerson` row in any specific
case may link to a `GlobalPerson` via `globalPersonId`.

When authoring a new case:

- Default to creating a fresh `CasePerson` with no `globalPersonId`.
- Link to an existing `GlobalPerson` only when the character is
  literally the same individual. Same name, same identity, same career
  thread.
- Never duplicate a `GlobalPerson` to "make the character your own"
  for one case. The Bureau database is the union of recurring identity
  data; duplication breaks cross-case continuity.
- Linking is a load-bearing data decision. Once a case ships with a
  link, breaking it later orphans cross-case timeline events and
  evidence references.

## 8. Gameplay mechanic summary (for writers)

For every case the writer authors, the Bureau enforces this loop:

- **Stage 1.** Player activates the case. Visible content is everything
  with `unlockStage <= 1` — typically the victim, two to three
  witnesses, the initial police report, and the entry-level hints.
  Checkpoint 1 tests whether the player has identified the key
  structural contradiction at this stage (a name on a record that
  doesn't match the witness account, a timeline that does not close,
  a missing artifact). The accepted-answer field should reward the
  noun phrase that names the contradiction, not free-form prose.
- **Stage 2.** Player has cleared checkpoint 1. New content unlocks at
  `unlockStage <= 2`. Typically: the second-tier records, one or two
  additional people, the hints at level 2. Checkpoint 2 tests the key
  person or timeline insight — the question the original investigation
  failed to ask.
- **Stage 3 / FINAL_REVIEW.** Player has cleared checkpoint 2. The
  theory submission form unlocks. The player names one suspect, one
  motive, one evidence chain. The theory matcher uses pipe-separated
  variants; the case reaches `SOLVED` only when all three dimensions
  match.
- **Theory results.** `CORRECT` solves the case. `PARTIAL` (suspect
  right, only one of motive/evidence matches) keeps the case at
  `FINAL_REVIEW` with structured feedback. `INCORRECT` keeps the case
  at its current status and surfaces feedback. `SOLVED` is terminal:
  no theory submission can downgrade a solved case.
- **Physical QR codes.** Can be redeemed at any time once activated.
  `requiresStage` may gate them. `oneTimePerUser` controls whether the
  redemption counts as one event or whether the player can re-show the
  unlocked content. The unlocked record / person / hint joins the
  player's "Revealed Evidence" section in the workspace, with
  Framer Motion entrance.

Writers should design at least one QR-gated piece of evidence per case
that is *load-bearing* for the correct theory — not just decorative.
A player who skips the kit's QR codes and tries to solve the case
should arrive at PARTIAL at best.
