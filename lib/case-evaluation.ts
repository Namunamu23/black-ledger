import { normalizeIdentity, tokenize } from "@/lib/text-utils";

const JACCARD_THRESHOLD = 0.34;

function splitPipe(value: string): string[] {
  return value
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function matchesSuspect(submission: string, candidates: string[]): boolean {
  const normalizedSubmission = normalizeIdentity(submission);

  if (!normalizedSubmission) return false;

  return candidates
    .map(normalizeIdentity)
    .filter(Boolean)
    .some((candidate) => candidate === normalizedSubmission);
}

type FreeTextResult = { full: boolean; partial: boolean };

function evaluateFreeTextSingle(
  submission: string,
  candidate: string
): FreeTextResult {
  const submissionTokens = tokenize(submission);
  const candidateTokens = tokenize(candidate);

  if (submissionTokens.size === 0 || candidateTokens.size === 0) {
    return { full: false, partial: false };
  }

  const intersection = new Set(
    [...candidateTokens].filter((token) => submissionTokens.has(token))
  );
  const union = new Set([...candidateTokens, ...submissionTokens]);
  const jaccard = intersection.size / union.size;

  const full = jaccard >= JACCARD_THRESHOLD || intersection.size >= 2;
  const partial = !full && intersection.size === 1;

  return { full, partial };
}

function evaluateFreeText(
  submission: string,
  pipeSeparatedCandidates: string
): FreeTextResult {
  const candidates = splitPipe(pipeSeparatedCandidates);

  let anyFull = false;
  let anyPartial = false;

  for (const candidate of candidates) {
    const result = evaluateFreeTextSingle(submission, candidate);
    if (result.full) anyFull = true;
    if (result.partial) anyPartial = true;
  }

  return { full: anyFull, partial: anyPartial && !anyFull };
}

function buildFeedback({
  suspectCorrect,
  motiveCorrect,
  evidenceCorrect,
}: {
  suspectCorrect: boolean;
  motiveCorrect: boolean;
  evidenceCorrect: boolean;
}) {
  if (suspectCorrect && motiveCorrect && evidenceCorrect) {
    return "You correctly identified the suspect, motive, and key evidence.";
  }

  const correctParts: string[] = [];
  const missingParts: string[] = [];

  if (suspectCorrect) correctParts.push("suspect");
  else missingParts.push("suspect");

  if (motiveCorrect) correctParts.push("motive");
  else missingParts.push("motive");

  if (evidenceCorrect) correctParts.push("evidence");
  else missingParts.push("evidence");

  if (correctParts.length > 0) {
    return `You were correct on ${correctParts.join(
      ", "
    )}, but still need to improve ${missingParts.join(", ")}.`;
  }

  return "Your current theory does not match the expected suspect, motive, or evidence strongly enough yet.";
}

/**
 * Evaluate a player's theory submission against the case solution.
 *
 * Suspect identity matching:
 *   The submitted `suspectName` is normalized — lowercased, internal whitespace
 *   collapsed, punctuation stripped except for hyphens — and compared by
 *   EQUALITY against each pipe-separated candidate in `solutionSuspect`. Each
 *   candidate represents either the suspect's primary name or a registered
 *   alias (e.g. "Anya Volkov|Mr. Volkov"). There is no substring matching:
 *   the player either named the suspect (or one of their known aliases) or
 *   they did not.
 *
 * Motive and evidence matching:
 *   Both fields are evaluated by Jaccard token similarity. The submission and
 *   each candidate are tokenized — lowercased, split on whitespace and
 *   punctuation, then filtered to tokens of at least 4 characters with a small
 *   English stopword set removed (the, and, of, for, with, was, were, has,
 *   have, been, that, this, from, into, onto, but, not). A candidate is a
 *   FULL match if the Jaccard similarity is at least 0.34 OR if at least two
 *   distinct candidate tokens appear in the submission. A candidate is a
 *   PARTIAL match if exactly one distinct candidate token appears in the
 *   submission and the full-match thresholds are not met. When a solution is
 *   pipe-separated, every alternative is evaluated and the best result wins
 *   (full beats partial beats none).
 *
 * Overall result:
 *   - resultLabel = "CORRECT" when suspect, motive, and evidence are all full matches.
 *   - resultLabel = "PARTIAL" when the suspect is correct AND at least one of
 *     motive or evidence is a full or partial match.
 *   - resultLabel = "INCORRECT" otherwise.
 *
 * The numeric `score` (0–3) counts full-credit dimensions only. Partial credit
 * is exposed via the boolean `motivePartial` and `evidencePartial` flags so
 * callers and the UI can surface it without losing the integer score contract.
 */
export function evaluateTheorySubmission({
  suspectName,
  motive,
  evidenceSummary,
  solutionSuspect,
  solutionMotive,
  solutionEvidence,
}: {
  suspectName: string;
  motive: string;
  evidenceSummary: string;
  solutionSuspect: string;
  solutionMotive: string;
  solutionEvidence: string;
}) {
  const suspectCorrect = matchesSuspect(
    suspectName,
    splitPipe(solutionSuspect)
  );

  const motiveResult = evaluateFreeText(motive, solutionMotive);
  const evidenceResult = evaluateFreeText(evidenceSummary, solutionEvidence);

  const motiveCorrect = motiveResult.full;
  const motivePartial = motiveResult.partial;
  const evidenceCorrect = evidenceResult.full;
  const evidencePartial = evidenceResult.partial;

  const score =
    (suspectCorrect ? 1 : 0) +
    (motiveCorrect ? 1 : 0) +
    (evidenceCorrect ? 1 : 0);

  let resultLabel: "CORRECT" | "PARTIAL" | "INCORRECT" = "INCORRECT";

  if (suspectCorrect && motiveCorrect && evidenceCorrect) {
    resultLabel = "CORRECT";
  } else if (
    suspectCorrect &&
    (motiveCorrect || motivePartial || evidenceCorrect || evidencePartial)
  ) {
    resultLabel = "PARTIAL";
  }

  const feedback = buildFeedback({
    suspectCorrect,
    motiveCorrect,
    evidenceCorrect,
  });

  return {
    suspectCorrect,
    motiveCorrect,
    motivePartial,
    evidenceCorrect,
    evidencePartial,
    score,
    resultLabel,
    feedback,
  };
}
