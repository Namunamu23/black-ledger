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

const adminPersonSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1000),
  unlockStage: z.coerce.number().int().min(1).max(10),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

const adminRecordSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(1000),
  body: z.string().trim().min(1).max(5000),
  unlockStage: z.coerce.number().int().min(1).max(10),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

const adminHintSchema = z.object({
  level: z.coerce.number().int().min(1).max(20),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(2000),
  unlockStage: z.coerce.number().int().min(1).max(10),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

const adminCheckpointSchema = z.object({
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