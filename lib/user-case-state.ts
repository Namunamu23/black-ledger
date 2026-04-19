/**
 * Canonical UserCase status values are sourced from the Prisma schema enum
 * UserCaseStatus, re-exported here so the rest of the codebase has a single
 * import location for state-machine types.
 *
 * The state machine is monotonically upward:
 *   NOT_STARTED → ACTIVE → FINAL_REVIEW → SOLVED  (terminal)
 *
 * TheoryResultLabel comes from the Prisma TheoryResultLabel enum.
 */
export {
  UserCaseStatus,
  TheoryResultLabel,
} from "@/generated/prisma/client";

import type {
  UserCaseStatus,
  TheoryResultLabel,
} from "@/generated/prisma/client";

const STATUS_ORDER: Record<UserCaseStatus, number> = {
  NOT_STARTED: 0,
  ACTIVE: 1,
  FINAL_REVIEW: 2,
  SOLVED: 3,
};

/**
 * For a given theory result, the lowest status the case must hold afterwards.
 * Combined with the current status by taking the higher of the two so the
 * machine can never move backwards.
 */
const RESULT_FLOOR: Record<TheoryResultLabel, UserCaseStatus> = {
  INCORRECT: "ACTIVE",
  PARTIAL: "FINAL_REVIEW",
  CORRECT: "SOLVED",
};

/**
 * Given a UserCase's current status and the result label of a brand-new
 * theory submission, return the status the UserCase should hold after the
 * submission is recorded.
 *
 * Invariants:
 *   - SOLVED is terminal. Once solved, the status never moves regardless of
 *     subsequent submission results. This is the SOLVED-protection invariant.
 *   - The state machine is monotonically upward. The returned status is never
 *     "lower" than the current one.
 *   - Each result label has a floor status the case must reach: INCORRECT
 *     keeps the case at ACTIVE, PARTIAL pushes it up to FINAL_REVIEW, CORRECT
 *     pushes it up to SOLVED. The current status wins if it is already higher.
 *
 * This is the only place in the codebase that decides UserCase.status
 * transitions caused by theory submissions. Route handlers must call this
 * function rather than inline status decisions.
 */
export function nextUserCaseStatus(
  currentStatus: UserCaseStatus,
  submissionResult: TheoryResultLabel
): UserCaseStatus {
  if (currentStatus === "SOLVED") return "SOLVED";

  const candidate = RESULT_FLOOR[submissionResult];
  return STATUS_ORDER[candidate] > STATUS_ORDER[currentStatus]
    ? candidate
    : currentStatus;
}
