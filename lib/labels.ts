import {
  UserCaseStatus,
  CaseWorkflowStatus,
  TheoryResultLabel,
} from "@/generated/prisma/client";

export const CASE_STATUS_LABEL: Record<UserCaseStatus, string> = {
  [UserCaseStatus.NOT_STARTED]: "Not Started",
  [UserCaseStatus.ACTIVE]: "Active",
  [UserCaseStatus.FINAL_REVIEW]: "Final Review",
  [UserCaseStatus.SOLVED]: "Solved",
};

export const WORKFLOW_STATUS_LABEL: Record<CaseWorkflowStatus, string> = {
  [CaseWorkflowStatus.DRAFT]: "Draft",
  [CaseWorkflowStatus.IN_REVIEW]: "In Review",
  [CaseWorkflowStatus.PUBLISHED]: "Published",
  [CaseWorkflowStatus.ARCHIVED]: "Archived",
};

export const THEORY_RESULT_LABEL: Record<TheoryResultLabel, string> = {
  [TheoryResultLabel.CORRECT]: "Correct",
  [TheoryResultLabel.PARTIAL]: "Partial",
  [TheoryResultLabel.INCORRECT]: "Incorrect",
};
