function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAnswer(input: string, solution: string) {
  const normalizedInput = normalize(input);
  const accepted = solution
    .split("|")
    .map((item) => normalize(item))
    .filter(Boolean);

  return accepted.some(
    (candidate) =>
      normalizedInput === candidate ||
      normalizedInput.includes(candidate) ||
      candidate.includes(normalizedInput)
  );
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
  const suspectCorrect = matchesAnswer(suspectName, solutionSuspect);
  const motiveCorrect = matchesAnswer(motive, solutionMotive);
  const evidenceCorrect = matchesAnswer(evidenceSummary, solutionEvidence);

  const score = [suspectCorrect, motiveCorrect, evidenceCorrect].filter(Boolean).length;

  let resultLabel = "INCORRECT";

  if (score === 3) {
    resultLabel = "CORRECT";
  } else if (score > 0) {
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
    evidenceCorrect,
    score,
    resultLabel,
    feedback,
  };
}