/**
 * Browser-safe mirror of all 9 Prisma enum values.
 *
 * The Prisma client (re-exported from @/generated/prisma/client) drags in
 * node:module and other Node-only runtime, which cannot be bundled into
 * client components. Files that need the enum values in the browser — or
 * any module that is transitively imported by a client component — must
 * import from here instead of from @/generated/prisma/client.
 *
 * Server components and route handlers may continue to import the Prisma
 * enum types directly. The string values are identical, so the two type
 * definitions are structurally interchangeable.
 *
 * If you add a Prisma enum or change a value, update this file in lockstep.
 */

export const UserRole = {
  INVESTIGATOR: "INVESTIGATOR",
  ADMIN: "ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TheoryResultLabel = {
  CORRECT: "CORRECT",
  PARTIAL: "PARTIAL",
  INCORRECT: "INCORRECT",
} as const;
export type TheoryResultLabel =
  (typeof TheoryResultLabel)[keyof typeof TheoryResultLabel];

export const UserCaseStatus = {
  NOT_STARTED: "NOT_STARTED",
  ACTIVE: "ACTIVE",
  FINAL_REVIEW: "FINAL_REVIEW",
  SOLVED: "SOLVED",
} as const;
export type UserCaseStatus =
  (typeof UserCaseStatus)[keyof typeof UserCaseStatus];

export const CaseWorkflowStatus = {
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type CaseWorkflowStatus =
  (typeof CaseWorkflowStatus)[keyof typeof CaseWorkflowStatus];

export const ActivationCodeSource = {
  ADMIN: "ADMIN",
  PURCHASE: "PURCHASE",
} as const;
export type ActivationCodeSource =
  (typeof ActivationCodeSource)[keyof typeof ActivationCodeSource];

export const OrderStatus = {
  PENDING: "PENDING",
  COMPLETE: "COMPLETE",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const SupportMessageStatus = {
  NEW: "NEW",
  HANDLED: "HANDLED",
  SPAM: "SPAM",
} as const;
export type SupportMessageStatus =
  (typeof SupportMessageStatus)[keyof typeof SupportMessageStatus];

export const AccessCodeKind = {
  BUREAU_REF: "BUREAU_REF",
  ARTIFACT_QR: "ARTIFACT_QR",
  WITNESS_TIP: "WITNESS_TIP",
  AUDIO_FILE: "AUDIO_FILE",
} as const;
export type AccessCodeKind =
  (typeof AccessCodeKind)[keyof typeof AccessCodeKind];

export const HiddenEvidenceKind = {
  RECORD: "RECORD",
  PERSON_DETAIL: "PERSON_DETAIL",
  TIMELINE_EVENT: "TIMELINE_EVENT",
  HINT: "HINT",
  AUDIO: "AUDIO",
} as const;
export type HiddenEvidenceKind =
  (typeof HiddenEvidenceKind)[keyof typeof HiddenEvidenceKind];
