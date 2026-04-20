import { z } from "zod";

export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
});

export const supportSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name is too long."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters.")
    .max(2000, "Message is too long."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const activationCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "Please enter a valid activation code.")
    .max(64, "Activation code is too long."),
});

export const theorySubmissionSchema = z.object({
  suspectName: z
    .string()
    .trim()
    .min(2, "Suspect name is required.")
    .max(120, "Suspect name is too long."),
  motive: z
    .string()
    .trim()
    .min(10, "Motive must be at least 10 characters.")
    .max(1000, "Motive is too long."),
  evidenceSummary: z
    .string()
    .trim()
    .min(10, "Evidence summary must be at least 10 characters.")
    .max(2000, "Evidence summary is too long."),
});

export const checkpointAnswerSchema = z.object({
  answer: z
    .string()
    .trim()
    .min(1, "Please enter an answer.")
    .max(200, "Answer is too long."),
});


export const adminCaseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens.")
    .min(3)
    .max(80),
  summary: z.string().trim().min(20).max(500),
  players: z.string().trim().min(1).max(40),
  duration: z.string().trim().min(1).max(40),
  difficulty: z.string().trim().min(1).max(40),
  maxStage: z.coerce.number().int().min(1).max(10),
  solutionSuspect: z.string().trim().min(1).max(300),
  solutionMotive: z.string().trim().min(1).max(500),
  solutionEvidence: z.string().trim().min(1).max(500),
  debriefOverview: z.string().trim().min(1).max(1000),
  debriefWhatHappened: z.string().trim().min(1).max(3000),
  debriefWhyItWorked: z.string().trim().min(1).max(3000),
  debriefClosing: z.string().trim().min(1).max(2000),
  initialActivationCode: z.string().trim().toUpperCase().min(4).max(64).optional().or(z.literal("")),
});

export const adminPersonSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  globalPersonId: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1000),
  portraitUrl: z.string().trim().url().max(2000).nullable().optional(),
  unlockStage: z.coerce.number().int().min(1).max(10),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export const adminRecordSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(1000),
  body: z.string().trim().min(1).max(5000),
  unlockStage: z.coerce.number().int().min(1).max(10),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export const adminHintSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  level: z.coerce.number().int().min(1).max(20),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(2000),
  unlockStage: z.coerce.number().int().min(1).max(10),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export const adminCheckpointSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  stage: z.coerce.number().int().min(1).max(10),
  prompt: z.string().trim().min(1).max(1000),
  acceptedAnswers: z.string().trim().min(1).max(1000),
  successMessage: z.string().trim().min(1).max(1000),
});

export const adminCaseContentSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens.")
    .min(3)
    .max(80),
  summary: z.string().trim().min(20).max(500),
  players: z.string().trim().min(1).max(40),
  duration: z.string().trim().min(1).max(40),
  difficulty: z.string().trim().min(1).max(40),
  maxStage: z.coerce.number().int().min(1).max(10),
  solutionSuspect: z.string().trim().min(1).max(300),
  solutionMotive: z.string().trim().min(1).max(500),
  solutionEvidence: z.string().trim().min(1).max(500),
  debriefOverview: z.string().trim().min(1).max(1500),
  debriefWhatHappened: z.string().trim().min(1).max(5000),
  debriefWhyItWorked: z.string().trim().min(1).max(5000),
  debriefClosing: z.string().trim().min(1).max(3000),
  debriefSectionTitle: z.string().trim().max(160).nullable().optional(),
  debriefIntro: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean(),
  people: z.array(adminPersonSchema),
  records: z.array(adminRecordSchema),
  hints: z.array(adminHintSchema),
  checkpoints: z.array(adminCheckpointSchema),
});

// ---- Per-section PATCH schemas (admin tabbed editor) ----
//
// Overview and Solution accept partial bodies — admins can save just the
// fields they touched. Collection sections wrap the existing entity
// schemas. Bounds match adminCaseContentSchema so the per-section saves
// and the legacy aggregate save accept the same data.

export const overviewPatchSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens.")
    .min(3)
    .max(80)
    .optional(),
  summary: z.string().trim().min(20).max(500).optional(),
  players: z.string().trim().min(1).max(40).optional(),
  duration: z.string().trim().min(1).max(40).optional(),
  difficulty: z.string().trim().min(1).max(40).optional(),
  maxStage: z.coerce.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
  heroImageUrl: z.string().trim().url().max(2000).nullable().optional(),
});

// ---- Image upload (R2 presigned URL + best-effort blurhash) ----

export const uploadSignSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z
    .string()
    .trim()
    .startsWith("image/", "Only image uploads are allowed.")
    .max(120),
  context: z.enum(["hero", "portrait", "record"]),
});

export const blurhashRequestSchema = z.object({
  publicUrl: z.string().trim().url().max(2000),
});

export const peoplePatchSchema = z.object({
  people: z.array(adminPersonSchema),
});

export const recordsPatchSchema = z.object({
  records: z.array(adminRecordSchema),
});

export const hintsPatchSchema = z.object({
  hints: z.array(adminHintSchema),
});

export const checkpointsPatchSchema = z.object({
  checkpoints: z.array(adminCheckpointSchema),
});

// ---- Activation code admin (batch generate + revoke) ----

export const generateCodesBatchSchema = z.object({
  count: z.coerce.number().int().min(1).max(100),
  kitSerialPrefix: z.string().trim().max(40).optional().or(z.literal("")),
});

export const revokeCodeSchema = z.object({
  revokedAt: z.string().datetime(),
});

export const solutionPatchSchema = z.object({
  solutionSuspect: z.string().trim().min(1).max(300).optional(),
  solutionMotive: z.string().trim().min(1).max(500).optional(),
  solutionEvidence: z.string().trim().min(1).max(500).optional(),
  debriefOverview: z.string().trim().min(1).max(1500).optional(),
  debriefWhatHappened: z.string().trim().min(1).max(5000).optional(),
  debriefWhyItWorked: z.string().trim().min(1).max(5000).optional(),
  debriefClosing: z.string().trim().min(1).max(3000).optional(),
  debriefSectionTitle: z.string().trim().max(160).nullable().optional(),
  debriefIntro: z.string().trim().max(2000).nullable().optional(),
});