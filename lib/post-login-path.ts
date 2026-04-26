/**
 * Decide where to send a player after a successful sign-in.
 *
 * The login flow accepts a `?callbackUrl=` query param so that flows like
 * the QR-scan unlock can preserve their original destination through the
 * NextAuth bounce. Anything coming from a query string is untrusted, so
 * the value must be sanitized to a same-origin path before we hand it to
 * `window.location.assign`. An attacker who controls a `?callbackUrl=`
 * value should not be able to redirect the player to an external host
 * (open-redirect), nor to a `javascript:` payload.
 *
 * The check is done by resolving the input against a synthetic base URL
 * and rejecting anything whose origin shifts off that base. This catches
 * absolute URLs, protocol-relative `//evil.com`, the `javascript:` scheme
 * (whose `origin` is `null`), and anything else the URL parser does not
 * keep on `http://localhost`.
 */

export const DEFAULT_POST_LOGIN_PATH = "/bureau";

export function pickPostLoginPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_POST_LOGIN_PATH;

  try {
    const base = "http://localhost";
    const url = new URL(raw, base);
    if (url.origin !== base) return DEFAULT_POST_LOGIN_PATH;
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }
}
