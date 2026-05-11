/**
 * Bureau Message Registry — single source of truth for system-voice copy.
 *
 * Centralizes the noir-procedural register established by Privacy + Terms +
 * Batch 13's closure-standard rule. New surfaces should consume from here
 * rather than invent their own copy. Changes here ripple to every consumer
 * on next render, no schema migration.
 *
 * NOT in scope:
 *
 * - Theory-submission *feedback* strings. Those live in
 *   `lib/case-evaluation.ts:buildFeedback` because Batch 13 made the
 *   sealed-verdict rule load-bearing for security; centralizing them here
 *   would create a refactor risk on a security invariant. Forms display
 *   the feedback returned by the API as-is.
 * - Marketing-page voice (about, faq, how-it-works, support). Separate
 *   batch — that's a copy-discipline pass on `data/site.ts` and friends.
 *
 * Phase-1 surfaces covered: login, unlock, theory submission UI labels,
 * per-case database header. Phase-2 surfaces (workspace tabs, checkpoint,
 * intel queue, sign-out, search empty/error states) extend this registry.
 */

export const BUREAU_MESSAGES = {
  auth: {
    signInEyebrow: "Secure access",
    signInHeading: "Sign in",
    signInBody:
      "Sign in to restore your analyst station and continue any open files.",
    submitCta: "Scan Badge",
    submitCtaLoading: "Verifying credentials…",
    submitError: "Credentials rejected. Re-enter and try again.",
  },
  unlock: {
    pendingHeading: "Sign in to redeem code",
    pendingBodyWithCode: (code: string) =>
      `Code ${code} will be applied once you reach the bureau intake terminal.`,
    pendingBodyWithoutCode:
      "Sign in and return to this page to enter your code.",
    pendingCta: "Sign in",
    activeEyebrow: "Bureau",
    activeHeading: "Incoming Artifact Transmission",
    activeBody:
      "Scan or type the code printed on a physical artifact. The Bureau will verify the source and file the intel against your active case.",
    inputLabel: "Access Code",
    inputPlaceholder: "Enter or scan code",
    submitCta: "Transmit Code",
    submitCtaLoading: "Verifying source…",
    successBanner: "Source verified — intel filed to your case desk.",
    alreadyRedeemedBanner:
      "Already filed. This artifact is in your case record.",
  },
  theorySubmission: {
    suspectPlaceholder: "Named responsible party",
    motivePlaceholder:
      "Establish the motive — what drove the responsible party to act.",
    evidencePlaceholder:
      "Cite the specific records, witnesses, or timeline details that complete the chain.",
    helperText:
      "Submit only when your suspect, motive, and evidence form one complete chain. This review does not confirm individual pieces of a theory — only whether the whole case meets the Bureau's closure standard.",
    submitCta: "Seal Packet for Bureau Review",
    submitCtaLoading: "Submitting closure packet…",
    closureStandardMet: "Closure Standard Met",
    revisionRequired: "Revision Required",
  },
  caseDatabase: {
    eyebrow: "Case Index",
    body: (currentStage: number) =>
      `Query the case index. Only cleared subjects, records, and analyst notes are available through Stage ${currentStage}.`,
  },
} as const;

export type BureauMessages = typeof BUREAU_MESSAGES;
