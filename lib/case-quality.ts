export type CaseContentForQualityCheck = {
  title: string;
  slug: string;
  summary: string;
  players: string;
  duration: string;
  difficulty: string;
  maxStage: number;
  solutionSuspect: string;
  solutionMotive: string;
  solutionEvidence: string;
  debriefOverview: string;
  debriefWhatHappened: string;
  debriefWhyItWorked: string;
  debriefClosing: string;
  people: Array<{ unlockStage: number }>;
  records: Array<{ unlockStage: number }>;
  hints: Array<{ unlockStage: number }>;
  checkpoints: Array<{ stage: number }>;
};

export function evaluateCaseReadiness(caseFile: CaseContentForQualityCheck) {
  const issues: string[] = [];

  if (!caseFile.title.trim()) issues.push("Missing title.");
  if (!caseFile.slug.trim()) issues.push("Missing slug.");
  if (!caseFile.summary.trim()) issues.push("Missing summary.");
  if (!caseFile.players.trim()) issues.push("Missing players.");
  if (!caseFile.duration.trim()) issues.push("Missing duration.");
  if (!caseFile.difficulty.trim()) issues.push("Missing difficulty.");

  if (!caseFile.solutionSuspect.trim()) issues.push("Missing solution suspect.");
  if (!caseFile.solutionMotive.trim()) issues.push("Missing solution motive.");
  if (!caseFile.solutionEvidence.trim()) issues.push("Missing solution evidence.");

  if (!caseFile.debriefOverview.trim()) issues.push("Missing debrief overview.");
  if (!caseFile.debriefWhatHappened.trim()) issues.push("Missing debrief 'what happened'.");
  if (!caseFile.debriefWhyItWorked.trim()) issues.push("Missing debrief 'why it worked'.");
  if (!caseFile.debriefClosing.trim()) issues.push("Missing debrief closing.");

  if (caseFile.people.length === 0) issues.push("No people added.");
  if (caseFile.records.length === 0) issues.push("No records added.");
  if (caseFile.hints.length === 0) issues.push("No hints added.");

  if (caseFile.maxStage > 1 && caseFile.checkpoints.length === 0) {
    issues.push("No checkpoints added.");
  }

  const invalidUnlockStages =
    [...caseFile.people, ...caseFile.records, ...caseFile.hints].some(
      (item) => item.unlockStage > caseFile.maxStage
    );

  if (invalidUnlockStages) {
    issues.push("Some unlock stages are greater than maxStage.");
  }

  const invalidCheckpointStages = caseFile.checkpoints.some(
    (item) => item.stage >= caseFile.maxStage
  );

  if (invalidCheckpointStages) {
    issues.push("Some checkpoints use a stage equal to or greater than maxStage.");
  }

  return {
    isReady: issues.length === 0,
    issues,
  };
}