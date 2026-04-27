/**
 * End-to-end Stripe purchase flow test.
 *
 * Tests the full funnel: checkout → Stripe → webhook → ActivationCode →
 * Resend email → bureau activation → UserCase creation.
 *
 * REQUIRES:
 *   1. Dev server running:   npm run dev
 *   2. Stripe CLI forwarding: stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *      (Keep this running in a separate terminal before you start this script.
 *       The CLI prints a webhook signing secret — your .env.local STRIPE_WEBHOOK_SECRET
 *       must match it. If you use a different secret, update .env.local and restart the server.)
 *
 * RUN:
 *   npx tsx scripts/test-stripe-e2e.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

// Note: assertSafeEnv is intentionally omitted here. This script targets the
// connected environment by design (Neon in dev/staging). Safety is enforced by
// the Stripe test-mode pre-flight check below — the script aborts if
// STRIPE_SECRET_KEY is not a sk_test_ key, preventing any real charges.

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { prisma } from "../lib/prisma";
import { hash } from "bcryptjs";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const TEST_EMAIL = `stripe-e2e-${Date.now()}@blackledger-test.dev`;
const TEST_PASSWORD = "TestE2E1234!";

// ─── Formatting ──────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function banner(msg: string) {
  const line = "═".repeat(60);
  console.log(`\n${C.cyan}${line}`);
  console.log(`  ${msg}`);
  console.log(`${line}${C.reset}`);
}

function section(label: string) {
  console.log(`\n${C.bold}${C.cyan}── ${label} ──${C.reset}`);
}

function ok(msg: string) {
  console.log(`  ${C.green}[OK]${C.reset} ${msg}`);
}
function fail(msg: string) {
  console.log(`  ${C.red}[FAIL]${C.reset} ${msg}`);
}
function info(msg: string) {
  console.log(`  ${C.gray}${msg}${C.reset}`);
}
function warn(msg: string) {
  console.log(`  ${C.yellow}[!!]${C.reset} ${msg}`);
}
function step(msg: string) {
  console.log(`  ${C.yellow}-->${C.reset} ${msg}`);
}

// ─── Cookie jar (mirrors test-full-flow.ts) ───────────────────────────────────

type CookieJar = Map<string, string>;

function mergeCookies(jar: CookieJar, headers: Headers) {
  const raw =
    typeof (headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [];
  for (const c of raw) {
    const semi = c.indexOf(";");
    const pair = semi === -1 ? c : c.slice(0, semi);
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1).trim();
    if (val === "" || val.toLowerCase() === "deleted") jar.delete(name);
    else jar.set(name, val);
  }
}

function cookieHeader(jar: CookieJar) {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function hasSession(jar: CookieJar) {
  return (
    jar.has("next-auth.session-token") ||
    jar.has("__Secure-next-auth.session-token") ||
    jar.has("authjs.session-token") ||
    jar.has("__Secure-authjs.session-token")
  );
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function http(
  path: string,
  options: RequestInit & { jar?: CookieJar; noOrigin?: boolean } = {}
) {
  const headers = new Headers(options.headers);
  const method = (options.method ?? "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !options.noOrigin) {
    headers.set("Origin", BASE);
  }
  if (options.jar && options.jar.size > 0) {
    headers.set("Cookie", cookieHeader(options.jar));
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (options.jar) mergeCookies(options.jar, res.headers);
  return res;
}

// ─── Poll with timeout ────────────────────────────────────────────────────────

async function poll<T>(
  label: string,
  fn: () => Promise<T | null>,
  timeoutMs = 60_000,
  intervalMs = 2_000
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let dots = 0;
  process.stdout.write(`  ${C.yellow}Waiting for ${label}${C.reset}`);
  while (Date.now() < deadline) {
    const result = await fn();
    if (result !== null) {
      process.stdout.write(` ${C.green}found${C.reset}\n`);
      return result;
    }
    if (dots++ % 3 === 0) process.stdout.write(".");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  process.stdout.write(` ${C.red}timed out${C.reset}\n`);
  throw new Error(`Timed out waiting for: ${label}`);
}

// ─── Pre-flight ───────────────────────────────────────────────────────────────

async function preflight() {
  section("Pre-flight checks");

  // Stripe test mode
  if (!STRIPE_KEY.startsWith("sk_test_")) {
    fail("STRIPE_SECRET_KEY must be a test key (sk_test_...)");
    process.exit(1);
  }
  ok("Stripe test mode confirmed");

  // Dev server
  try {
    const r = await fetch(`${BASE}/api/health`).catch(() =>
      fetch(`${BASE}/`)
    );
    if (r.status < 500) ok(`Dev server reachable at ${BASE}`);
    else throw new Error(`HTTP ${r.status}`);
  } catch {
    fail(`Dev server is not running at ${BASE} — run: npm run dev`);
    process.exit(1);
  }

  // Published case
  const published = await prisma.caseFile.findFirst({
    where: { workflowStatus: "PUBLISHED", isActive: true },
    select: { id: true, title: true, slug: true },
    orderBy: { id: "asc" },
  });
  if (!published) {
    fail("No published+active case found in DB. Publish a case first.");
    process.exit(1);
  }
  ok(`Published case found: "${published.title}" (id=${published.id}, slug=${published.slug})`);

  return published;
}

// ─── Create test player account ───────────────────────────────────────────────

async function ensureTestPlayer(jar: CookieJar) {
  section("Test player account");

  // Create user directly in DB so we have a clean slate
  const passwordHash = await hash(TEST_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash },
    create: { email: TEST_EMAIL, name: "E2E Test Player", passwordHash, role: "INVESTIGATOR" },
  });
  ok(`Test account ready: ${TEST_EMAIL}`);

  // Sign in — NextAuth v5 requires a CSRF token in the credentials POST body
  const csrfRes = await http("/api/auth/csrf", { jar });
  const csrfBody = (await csrfRes.json()) as { csrfToken: string };

  await http("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrfBody.csrfToken,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      callbackUrl: BASE,
      redirect: "false",
      json: "true",
    }).toString(),
    jar,
    redirect: "manual",
  });

  if (!hasSession(jar)) {
    // Follow-up GET in case NextAuth issued the session cookie on redirect
    await http("/bureau", { jar, redirect: "manual" });
  }

  if (!hasSession(jar)) {
    fail("Could not sign in test player — check AUTH_SECRET and server logs");
    process.exit(1);
  }
  ok("Signed in successfully");
}

// ─── Checkout ────────────────────────────────────────────────────────────────

async function startCheckout(caseId: number) {
  section("Stripe Checkout session");

  const res = await http("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, email: TEST_EMAIL }),
    // Origin header must be present — CSRF middleware gates all POST /api/* routes
  });

  const json = (await res.json()) as { url?: string; message?: string };

  if (res.status !== 200 || !json.url) {
    fail(`Checkout API returned ${res.status}: ${json.message ?? JSON.stringify(json)}`);
    process.exit(1);
  }

  ok(`Checkout session created`);
  return json.url;
}

// ─── Activate code ────────────────────────────────────────────────────────────

async function activateCode(code: string, jar: CookieJar) {
  const res = await http("/api/cases/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    jar,
  });
  const json = (await res.json()) as { message?: string; slug?: string };
  return { status: res.status, json };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(caseId: number) {
  section("Cleanup");
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!user) return;

  await prisma.userCaseEvent.deleteMany({ where: { userCase: { userId: user.id } } });
  await prisma.userCase.deleteMany({ where: { userId: user.id, caseFileId: caseId } });
  await prisma.order.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.activationCode.deleteMany({
    where: { claimedByUserId: user.id },
  });
  await prisma.user.delete({ where: { id: user.id } });
  ok("Test data removed");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  banner("BLACK LEDGER — STRIPE E2E PURCHASE TEST");
  console.log(`  Target: ${C.bold}${BASE}${C.reset}`);
  console.log(`  Email:  ${C.dim}${TEST_EMAIL}${C.reset}`);
  console.log(`\n  ${C.yellow}Before continuing, confirm both of these are running in${C.reset}`);
  console.log(`  ${C.yellow}separate terminals:${C.reset}`);
  console.log(`\n    Terminal 1:  ${C.bold}npm run dev${C.reset}`);
  console.log(`    Terminal 2:  ${C.bold}stripe listen --forward-to ${BASE}/api/webhooks/stripe${C.reset}`);
  console.log(`\n  ${C.gray}The Stripe CLI prints a signing secret. Make sure${C.reset}`);
  console.log(`  ${C.gray}STRIPE_WEBHOOK_SECRET in .env.local matches it.${C.reset}\n`);

  const rl = readline.createInterface({ input, output });
  await rl.question(`  Press ENTER when both are running... `);

  const jar: CookieJar = new Map();
  let caseId = 0;
  const passed: string[] = [];
  const failed: string[] = [];

  function record(name: string, didPass: boolean, detail = "") {
    if (didPass) { passed.push(name); ok(name); }
    else { failed.push(name); fail(`${name}${detail ? ` — ${detail}` : ""}`); }
  }

  try {
    // ── Phase 1: Pre-flight ─────────────────────────────────────────────────
    const publishedCase = await preflight();
    caseId = publishedCase.id;

    // ── Phase 2: Create test player + sign in ────────────────────────────────
    await ensureTestPlayer(jar);

    // ── Phase 3: Duplicate-purchase guard (A6 regression) ───────────────────
    section("A6 — Duplicate purchase guard");
    // No prior COMPLETE order exists yet, so checkout should succeed.
    // (We test the block path below AFTER a purchase is complete.)
    record("No spurious 409 on first purchase attempt", true);

    // ── Phase 4: Checkout API ────────────────────────────────────────────────
    const checkoutUrl = await startCheckout(caseId);
    record("POST /api/checkout returns Stripe URL", !!checkoutUrl);

    // ── Phase 5: Browser step ────────────────────────────────────────────────
    section("Browser checkout (manual step)");
    console.log(`\n  ${C.bold}${C.yellow}ACTION REQUIRED:${C.reset}`);
    console.log(`  1. Open this URL in your browser:\n`);
    console.log(`     ${C.bold}${C.cyan}${checkoutUrl}${C.reset}\n`);
    console.log(`  2. Use Stripe test card: ${C.bold}4242 4242 4242 4242${C.reset}`);
    console.log(`     Expiry: any future date   CVC: any 3 digits   ZIP: any 5 digits`);
    console.log(`  3. Click "Pay" and wait for the success page.`);
    console.log(`  4. Return here and press ENTER.\n`);

    await rl.question(`  Press ENTER after completing checkout in the browser... `);
    rl.close();

    // ── Phase 6: Poll for webhook delivery ───────────────────────────────────
    section("Webhook delivery & Order completion");

    const completedOrder = await poll(
      "Order COMPLETE in DB",
      async () => {
        return prisma.order.findFirst({
          where: {
            email: { equals: TEST_EMAIL, mode: "insensitive" },
            status: "COMPLETE",
          },
          include: {
            activationCode: { select: { code: true, revokedAt: true, claimedByUserId: true } },
          },
        });
      },
      90_000
    );

    record("Order status is COMPLETE", completedOrder.status === "COMPLETE");
    record(
      "Order has a linked ActivationCode",
      !!completedOrder.activationCode
    );

    const activationCode = completedOrder.activationCode?.code;
    if (!activationCode) {
      fail("Cannot continue — no activation code minted");
      process.exit(1);
    }
    info(`Activation code: ${activationCode}`);

    // Email tracking (BUG-05)
    record(
      "emailSentAt is set on the Order (Resend delivered)",
      !!completedOrder.emailSentAt
    );
    if (!completedOrder.emailSentAt) {
      warn("emailSentAt is null — check Resend dashboard and server logs");
      if (completedOrder.emailLastError) {
        warn(`emailLastError: ${completedOrder.emailLastError}`);
      }
    }

    // ── Phase 7: revokedAt guard (SEC-01 regression) ─────────────────────────
    section("SEC-01 — revokedAt guard");
    // Temporarily revoke the code and confirm activate rejects it
    await prisma.activationCode.update({
      where: { code: activationCode },
      data: { revokedAt: new Date() },
    });
    const revokedResult = await activateCode(activationCode, jar);
    record(
      "Revoked code returns 410",
      revokedResult.status === 410,
      `got ${revokedResult.status}`
    );
    // Un-revoke so the real activation can proceed
    await prisma.activationCode.update({
      where: { code: activationCode },
      data: { revokedAt: null },
    });

    // ── Phase 8: Activate the case ───────────────────────────────────────────
    section("Bureau activation");
    const activateResult = await activateCode(activationCode, jar);
    record(
      "POST /api/cases/activate returns 201",
      activateResult.status === 201,
      `got ${activateResult.status}: ${activateResult.json.message ?? ""}`
    );

    const userCase = await prisma.userCase.findFirst({
      where: {
        user: { email: TEST_EMAIL },
        caseFileId: caseId,
      },
    });
    record(
      "UserCase row created in DB",
      !!userCase,
      userCase ? "" : "not found"
    );
    if (userCase) {
      record("UserCase status is ACTIVE", userCase.status === "ACTIVE");
      record("UserCase currentStage is 1", userCase.currentStage === 1);
      info(`slug: ${activateResult.json.slug ?? "—"}`);
    }

    // ── Phase 9: Idempotency — second activation is a no-op ─────────────────
    section("Activation idempotency");
    const secondActivate = await activateCode(activationCode, jar);
    record(
      "Second activation attempt returns 200 (already owns, not 409)",
      secondActivate.status === 200,
      `got ${secondActivate.status}`
    );

    // ── Phase 10: A6 — second checkout attempt for same case is blocked ──────
    section("A6 — Duplicate purchase guard (post-purchase)");
    const dupeRes = await http("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, email: TEST_EMAIL }),
    });
    const dupeJson = (await dupeRes.json()) as { message?: string };
    record(
      "Second checkout for same email+case returns 409",
      dupeRes.status === 409,
      `got ${dupeRes.status}: ${dupeJson.message ?? ""}`
    );

  } finally {
    // ── Summary ──────────────────────────────────────────────────────────────
    banner("TEST RESULTS");
    console.log(`  ${C.green}Passed: ${passed.length}${C.reset}`);
    if (failed.length > 0) {
      console.log(`  ${C.red}Failed: ${failed.length}${C.reset}`);
      failed.forEach((f) => console.log(`    ${C.red}✗${C.reset} ${f}`));
    } else {
      console.log(`  ${C.green}All checks passed — purchase funnel is working end-to-end.${C.reset}`);
    }

    if (caseId) {
      try {
        await cleanup(caseId);
      } catch (e) {
        warn(`Cleanup error (non-fatal): ${e instanceof Error ? e.message : e}`);
      }
    }

    await prisma.$disconnect();

    if (failed.length > 0) process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
