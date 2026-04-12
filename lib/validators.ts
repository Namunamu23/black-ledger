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