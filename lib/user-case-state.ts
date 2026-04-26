/**
 * Canonical UserCase status values are sourced from the Prisma schema enum
 * UserCaseStatus, re-exported here so the rest of the codebase has a single
 * import location for state-machine types.
 *
 * The state machine is event-sourced. Routes derive the next status by
 * applying a UserCaseEvent to the current status via `transitionUserCase`,
 * never by inline string comparison. The same event is then persisted to
 * the UserCaseEvent log so the full case lifecycle is auditable from the
 * database alone.
 *
 * Allowed transitions:
 *   NOT_STARTED  --ACTIVATE--> ACTIVE
 *   ACTIVE       --CHECKPOINT_PASS--> ACTIVE
 *   ACTIVE       --CHECKPOINT_FINAL_PASS--> FINAL_REVIEW
 *   ACTIVE       --THEORY_INCORRECT--> ACTIVE
 *   ACTIVE       --THEORY_PARTIAL--> FINAL_REVIEW
 *   ACTIVE       --THEORY_CORRECT--> SOLVED
 *   FINAL_REVIEW --any non-terminal--> FINAL_REVIEW (no regressions)
 *   FINAL_REVIEW --THEORY_CORRECT--> SOLVED
 *   SOLVED       --any event--> SOLVED  (terminal — protection invariant)
 */
export {
  UserCaseStatus,
  TheoryResultLabel,
} from "@/generated/prisma/client";

import type {
  UserCaseStatus,
  TheoryResultLabel,
} from "@/generated/prisma/client";

export type UserCaseEvent =
  | "ACTIVATE"
  | "CHECKPOINT_PASS"
  | "CHECKPOINT_FINAL_PASS"
  | "THEORY_INCORRECT"
  | "THEORY_PARTIAL"
  | "THEORY_CORRECT";

const TRANSITIONS: Record<
  UserCaseStatus,
  Partial<Record<UserCaseEvent, UserCaseStatus>>
> = {
  NOT_STARTED: {
    ACTIVATE: "ACTIVE",
  },
  ACTIVE: {
    ACTIVATE: "ACTIVE",
    CHECKPOINT_PASS: "ACTIVE",
    CHECKPOINT_FINAL_PASS: "FINAL_REVIEW",
    THEORY_INCORRECT: "ACTIVE",
    THEORY_PARTIAL: "FINAL_REVIEW",
    THEORY_CORRECT: "SOLVED",
  },
  FINAL_REVIEW: {
    ACTIVATE: "FINAL_REVIEW",
    CHECKPOINT_PASS: "FINAL_REVIEW",
    CHECKPOINT_FINAL_PASS: "FINAL_REVIEW",
    THEORY_INCORRECT: "FINAL_REVIEW",
    THEORY_PARTIAL: "FINAL_REVIEW",
    THEORY_CORRECT: "SOLVED",
  },
  SOLVED: {
    ACTIVATE: "SOLVED",
    CHECKPOINT_PASS: "SOLVED",
    CHECKPOINT_FINAL_PASS: "SOLVED",
    THEORY_INCORRECT: "SOLVED",
    THEORY_PARTIAL: "SOLVED",
    THEORY_CORRECT: "SOLVED",
  },
};

/**
 * Apply a UserCaseEvent to a UserCase's current status. Returns the new
 * status on success, or `{ error }` when no transition is defined for the
 * (status, event) pair. Callers MUST discriminate on `typeof result ===
 * "string"` before assigning.
 *
 * The error path is reserved for genuinely undefined transitions — e.g.
 * NOT_STARTED + CHECKPOINT_PASS, which means a route attempted to advance
 * a case that was never activated. Surfacing rather than silently ignoring
 * keeps wiring bugs visible.
 */
export function transitionUserCase(
  currentStatus: UserCaseStatus,
  event: UserCaseEvent
): UserCaseStatus | { error: string } {
  const next = TRANSITIONS[currentStatus]?.[event];
  if (next === undefined) {
    return {
      error: `No transition defined for status=${currentStatus} event=${event}`,
    };
  }
  return next;
}
