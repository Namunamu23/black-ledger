import type { NextConfig } from "next";

// Hardened security headers applied to every route. The CSP is enforced
// (not report-only). script-src carries 'unsafe-inline' + 'unsafe-eval'
// to accommodate Next.js hydration and Framer Motion; tightening to a
// nonce-based policy is a future hardening opportunity. R2_PUBLIC_URL is
// injected dynamically into img-src so hero/portrait images are allowed.
const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const r2Origin = process.env.R2_PUBLIC_URL
  ? new URL(process.env.R2_PUBLIC_URL).origin
  : "";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Dead `https://fonts.googleapis.com` entry removed in Batch 17 — mirrors
  // the Batch 7 font-src cleanup (commit b10dd68). The codebase uses
  // next/font/google, which self-hosts fonts at build time and never
  // contacts the Google Fonts CDN at runtime. `'unsafe-inline'` remains
  // because Tailwind v4 emits inline <style> blocks at first paint; that's
  // tracked separately as part of the F-32/F-33 CSP-nonce migration.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  `img-src 'self' data: blob: ${r2Origin}`,
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...SECURITY_HEADERS,
          {
            key: "Content-Security-Policy",
            value: CSP,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
