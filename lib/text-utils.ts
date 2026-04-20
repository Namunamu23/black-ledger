/**
 * Shared text-normalization and tokenization helpers used by both the theory
 * matcher (lib/case-evaluation.ts) and the checkpoint route's answer matcher.
 *
 * Keeping these in one place ensures both code paths agree on what a "token"
 * is and how identifiers are normalized — different policies in the two
 * matchers should be expressed via thresholds and rules the callers enforce,
 * not by drifting normalization rules.
 */

const STOPWORDS: ReadonlySet<string> = new Set([
  "the",
  "and",
  "of",
  "for",
  "with",
  "was",
  "were",
  "has",
  "have",
  "been",
  "that",
  "this",
  "from",
  "into",
  "onto",
  "but",
  "not",
]);

const MIN_TOKEN_LENGTH = 4;

/**
 * Normalize a name-like string for equality comparison: lowercased, internal
 * whitespace collapsed, punctuation stripped except hyphens.
 */
export function normalizeIdentity(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize a free-text string into a Set of comparison tokens: lowercased,
 * split on whitespace and Unicode punctuation, with tokens shorter than 4
 * characters and a small English stopword set removed.
 */
export function tokenize(value: string): Set<string> {
  const tokens = value
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter(
      (token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token)
    );

  return new Set(tokens);
}
