/**
 * assertSafeEnv — guard for scripts that write to or mutate the database.
 *
 * Call this at the top of any script before it makes DB writes, so that
 * an accidental run against the production Neon database is caught
 * immediately rather than silently corrupting live data.
 *
 * Behaviour:
 *   - If NODE_ENV is "production" → throws.
 *   - If DATABASE_URL contains a known production host pattern → throws.
 *   - Otherwise → passes silently.
 *
 * To add new production host patterns, extend PROD_URL_PATTERNS below.
 */

const PROD_URL_PATTERNS: RegExp[] = [
  /\.neon\.tech/i,
  /neon\.database\.azure/i,
  // Add additional prod host patterns here as the infra grows.
];

export function assertSafeEnv(scriptName = "script"): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `[assertSafeEnv] ${scriptName} refused to run: NODE_ENV is "production". ` +
        `This script must only run in development or staging environments.`
    );
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  const matchedPattern = PROD_URL_PATTERNS.find((p) => p.test(dbUrl));

  if (matchedPattern) {
    throw new Error(
      `[assertSafeEnv] ${scriptName} refused to run: DATABASE_URL looks like a ` +
        `production database (matched pattern ${matchedPattern}). ` +
        `Set DATABASE_URL to your local or staging database before running this script.`
    );
  }
}
