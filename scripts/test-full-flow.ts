/**
 * Full end-to-end test script covering every Black Ledger feature built
 * in Weeks 1–4. Requires the dev server running at http://localhost:3000.
 *
 * Run with: npx tsx scripts/test-full-flow.ts
 *
 * Each [PASS] / [FAIL] is printed inline. A summary table prints at the
 * end. A failed assertion in one test never aborts the script — failures
 * are recorded and execution continues.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { execSync } from "node:child_process";
import { hash } from "bcryptjs";
import { prisma } from "../lib/prisma";

const BASE = "http://localhost:3000";
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "";
const PLAYER_EMAIL = "player@test.com";
const PLAYER_PASSWORD = "testplayer123";
const CASE_SLUG = "alder-street-review";
const ACTIVATION_CODE = "ALDER-001-DEMO";

// ---------- result tracking ----------

type Result = { name: string; passed: boolean; detail?: string };
const results: Result[] = [];

function pass(name: string) {
  console.log(`[PASS] ${name}`);
  results.push({ name, passed: true });
}

function fail(name: string, detail: string) {
  console.log(`[FAIL] ${name} — ${detail}`);
  results.push({ name, passed: false, detail });
}

async function expect(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    pass(name);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    fail(name, detail);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function section(label: string) {
  console.log(`\n━━━ ${label} ━━━`);
}

// ---------- cookie jar ----------

type CookieJar = Map<string, string>;

function parseSetCookieHeaders(headers: Headers): Array<[string, string]> {
  const raw =
    typeof (headers as { getSetCookie?: () => string[] }).getSetCookie ===
    "function"
      ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [];
  const out: Array<[string, string]> = [];
  for (const c of raw) {
    const semi = c.indexOf(";");
    const pair = semi === -1 ? c : c.slice(0, semi);
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    out.push([name, value]);
  }
  return out;
}

function mergeCookies(jar: CookieJar, headers: Headers) {
  for (const [name, value] of parseSetCookieHeaders(headers)) {
    if (value === "" || value.toLowerCase() === "deleted") {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  }
}

function cookieHeader(jar: CookieJar): string {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function hasSession(jar: CookieJar): boolean {
  return (
    jar.has("next-auth.session-token") ||
    jar.has("__Secure-next-auth.session-token") ||
    jar.has("authjs.session-token") ||
    jar.has("__Secure-authjs.session-token")
  );
}

// ---------- HTTP helpers ----------

const STATE_MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type ReqOptions = RequestInit & {
  jar?: CookieJar;
  noOrigin?: boolean;
};

async function http(path: string, options: ReqOptions = {}) {
  const headers = new Headers(options.headers);
  const method = (options.method ?? "GET").toUpperCase();

  if (STATE_MUTATING.has(method) && !options.noOrigin) {
    headers.set("Origin", BASE);
  }
  if (options.jar && options.jar.size > 0) {
    headers.set("Cookie", cookieHeader(options.jar));
  }

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    method,
    headers,
    redirect: options.redirect ?? "manual",
  });

  if (options.jar) {
    mergeCookies(options.jar, response.headers);
  }

  return response;
}

async function login(email: string, password: string): Promise<CookieJar> {
  const jar: CookieJar = new Map();

  const csrfRes = await http("/api/auth/csrf", { jar });
  const csrfBody = (await csrfRes.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    csrfToken: csrfBody.csrfToken,
    email,
    password,
    callbackUrl: BASE,
    redirect: "false",
    json: "true",
  });

  await http("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    jar,
  });

  return jar;
}

// ---------- server liveness ----------

async function serverIsUp(): Promise<boolean> {
  try {
    const r = await fetch(BASE, { redirect: "manual" });
    return r.status < 500;
  } catch {
    return false;
  }
}

// ---------- main ----------

async function main() {
  if (!(await serverIsUp())) {
    console.error(
      "Dev server is not reachable at http://localhost:3000.\n" +
        "Start it with: npm run dev"
    );
    process.exit(1);
  }
  console.log(`Server reachable at ${BASE}.`);

  // ---------- PHASE 1 — setup ----------
  section("PHASE 1 — Setup");

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set in .env.local — aborting."
    );
    process.exit(1);
  }

  // Ensure admin exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });
  if (!existingAdmin) {
    console.log("Admin not found — running npm run seed:admin");
    execSync("npm run seed:admin", { stdio: "inherit" });
  }

  // Ensure case exists
  let caseFile = await prisma.caseFile.findUnique({
    where: { slug: CASE_SLUG },
  });
  if (!caseFile) {
    console.log("Case not found — running npm run seed:case");
    execSync("npm run seed:case", { stdio: "inherit" });
    caseFile = await prisma.caseFile.findUnique({ where: { slug: CASE_SLUG } });
  }
  assert(caseFile, "Case file still missing after seed.");

  // Ensure activation code exists and is unclaimed for this run
  let activationCode = await prisma.activationCode.findUnique({
    where: { code: ACTIVATION_CODE },
  });
  if (!activationCode) {
    activationCode = await prisma.activationCode.create({
      data: { code: ACTIVATION_CODE, caseFileId: caseFile.id },
    });
    console.log(`Created activation code ${ACTIVATION_CODE}.`);
  }
  await prisma.activationCode.update({
    where: { id: activationCode.id },
    data: { claimedByUserId: null, claimedAt: null, revokedAt: null },
  });

  // Ensure player exists with the expected password
  const playerHash = await hash(PLAYER_PASSWORD, 10);
  const existingPlayer = await prisma.user.findUnique({
    where: { email: PLAYER_EMAIL },
  });
  if (existingPlayer) {
    // Wipe player-owned test artifacts so each run starts fresh.
    await prisma.accessCodeRedemption.deleteMany({
      where: { userId: existingPlayer.id },
    });
    await prisma.theorySubmission.deleteMany({
      where: { userId: existingPlayer.id },
    });
    await prisma.checkpointAttempt.deleteMany({
      where: { userId: existingPlayer.id },
    });
    await prisma.userCase.deleteMany({ where: { userId: existingPlayer.id } });
    // Unclaim any codes still pointing at the player to keep deletes clean.
    await prisma.activationCode.updateMany({
      where: { claimedByUserId: existingPlayer.id },
      data: { claimedByUserId: null, claimedAt: null },
    });
    await prisma.user.update({
      where: { id: existingPlayer.id },
      data: { passwordHash: playerHash, role: "INVESTIGATOR" },
    });
  } else {
    await prisma.user.create({
      data: {
        email: PLAYER_EMAIL,
        name: "Test Player",
        passwordHash: playerHash,
        role: "INVESTIGATOR",
      },
    });
  }

  // Reset case workflow + slug to a known starting state.
  await prisma.caseFile.update({
    where: { id: caseFile.id },
    data: {
      slug: CASE_SLUG,
      workflowStatus: "DRAFT",
      publishedAt: null,
      isActive: true,
    },
  });
  // Drop any leftover slug-history rows from prior runs so Phase 15
  // reliably writes a fresh row.
  await prisma.caseSlugHistory.deleteMany({
    where: { caseFileId: caseFile.id },
  });
  // Drop test-only AccessCodes from prior runs so Phase 12 can recreate.
  await prisma.accessCode.deleteMany({
    where: { caseFileId: caseFile.id, code: { startsWith: "TESTQR" } },
  });
  // Drop generated test ActivationCodes from Phase 7 of prior runs.
  await prisma.activationCode.deleteMany({
    where: { caseFileId: caseFile.id, kitSerial: "TEST-" },
  });

  console.log("Setup complete.");

  // ---------- PHASE 2 — DB state ----------
  section("PHASE 2 — DB state checks");

  await expect("admin user exists with role=ADMIN", async () => {
    const u = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    assert(u, "no admin row");
    assert(u.role === "ADMIN", `role=${u.role}`);
  });

  await expect(
    "player user exists with role=INVESTIGATOR",
    async () => {
      const u = await prisma.user.findUnique({
        where: { email: PLAYER_EMAIL },
      });
      assert(u, "no player row");
      assert(u.role === "INVESTIGATOR", `role=${u.role}`);
    }
  );

  await expect(`case "${CASE_SLUG}" exists`, async () => {
    const c = await prisma.caseFile.findUnique({ where: { slug: CASE_SLUG } });
    assert(c, "case missing");
  });

  await expect(
    "case has at least 1 person, 1 record, 1 hint, 1 checkpoint",
    async () => {
      const c = await prisma.caseFile.findUnique({
        where: { slug: CASE_SLUG },
        include: { people: true, records: true, hints: true, checkpoints: true },
      });
      assert(c, "case missing");
      assert(c.people.length >= 1, `people=${c.people.length}`);
      assert(c.records.length >= 1, `records=${c.records.length}`);
      assert(c.hints.length >= 1, `hints=${c.hints.length}`);
      assert(c.checkpoints.length >= 1, `checkpoints=${c.checkpoints.length}`);
    }
  );

  await expect(
    `activation code "${ACTIVATION_CODE}" exists and is not revoked`,
    async () => {
      const ac = await prisma.activationCode.findUnique({
        where: { code: ACTIVATION_CODE },
      });
      assert(ac, "code missing");
      assert(ac.revokedAt === null, "revokedAt is set");
    }
  );

  await expect("Case.maxStage === 3", async () => {
    const c = await prisma.caseFile.findUnique({ where: { slug: CASE_SLUG } });
    assert(c, "case missing");
    assert(c.maxStage === 3, `maxStage=${c.maxStage}`);
  });

  // ---------- PHASE 3 — Auth ----------
  section("PHASE 3 — Auth");

  let adminJar: CookieJar = new Map();
  let playerJar: CookieJar = new Map();

  await expect("admin login → session cookie set", async () => {
    adminJar = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    assert(hasSession(adminJar), "no session-token cookie in jar");
  });

  await expect("player login → session cookie set", async () => {
    playerJar = await login(PLAYER_EMAIL, PLAYER_PASSWORD);
    assert(hasSession(playerJar), "no session-token cookie in jar");
  });

  await expect("login with wrong password → no session cookie", async () => {
    const jar = await login(ADMIN_EMAIL, "definitely-wrong");
    assert(!hasSession(jar), "session cookie was set on bad credentials");
  });

  await expect("GET /api/admin/cases with no cookie → 401/403", async () => {
    const r = await http("/api/admin/cases");
    assert(
      r.status === 401 || r.status === 403,
      `status=${r.status}`
    );
  });

  await expect(
    "GET /api/admin/cases with player cookie → 403",
    async () => {
      const r = await http("/api/admin/cases", { jar: playerJar });
      assert(r.status === 403, `status=${r.status}`);
    }
  );

  // ---------- PHASE 4 — Public API ----------
  section("PHASE 4 — Public API");

  // Use a unique waitlist email per run to avoid 409.
  const waitlistEmail = `waittest+${Date.now()}@test.com`;
  await expect("POST /api/waitlist valid → 201", async () => {
    const r = await http("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: waitlistEmail }),
    });
    assert(
      r.status === 200 || r.status === 201,
      `status=${r.status}`
    );
    const row = await prisma.waitlistEntry.findUnique({
      where: { email: waitlistEmail },
    });
    assert(row, "WaitlistEntry not in DB");
  });

  await expect("POST /api/waitlist invalid → 400", async () => {
    const r = await http("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(r.status === 400, `status=${r.status}`);
  });

  let supportMessageId = 0;
  await expect("POST /api/support valid → 201", async () => {
    const r = await http("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: `support+${Date.now()}@test.com`,
        message: "hello test message here from automated suite",
      }),
    });
    assert(
      r.status === 200 || r.status === 201,
      `status=${r.status}`
    );
    const row = await prisma.supportMessage.findFirst({
      orderBy: { createdAt: "desc" },
    });
    assert(row, "no SupportMessage in DB");
    assert(row.status === "NEW", `status=${row.status}`);
    supportMessageId = row.id;
  });

  await expect("POST /api/support missing fields → 400", async () => {
    const r = await http("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    assert(r.status === 400, `status=${r.status}`);
  });

  // ---------- PHASE 5 — Admin section PATCH ----------
  section("PHASE 5 — Admin case content PATCH");

  const caseId = caseFile.id;

  // OVERVIEW
  const originalSummary = caseFile.summary;
  await expect("PATCH /overview { summary } → 200 + audit row", async () => {
    const r = await http(`/api/admin/cases/${caseId}/overview`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: "Updated summary for test." }),
      jar: adminJar,
    });
    assert(r.status === 200, `status=${r.status}`);
    const audits = await prisma.caseAudit.findMany({
      where: { caseFileId: caseId, action: "UPDATE_OVERVIEW" },
    });
    assert(audits.length >= 1, "no UPDATE_OVERVIEW audit row");
    // Restore.
    await http(`/api/admin/cases/${caseId}/overview`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: originalSummary }),
      jar: adminJar,
    });
  });

  // PEOPLE
  let testPersonId = 0;
  await expect(
    "PATCH /people add new person → 200 + new row",
    async () => {
      const existing = await prisma.casePerson.findMany({
        where: { caseFileId: caseId },
        orderBy: { sortOrder: "asc" },
      });
      const payload = {
        people: [
          ...existing.map((p) => ({
            id: p.id,
            globalPersonId: p.globalPersonId,
            name: p.name,
            role: p.role,
            summary: p.summary,
            portraitUrl: p.portraitUrl,
            unlockStage: p.unlockStage,
            sortOrder: p.sortOrder,
          })),
          {
            name: "Test Witness",
            role: "Bystander",
            summary: "Added by test.",
            unlockStage: 1,
            sortOrder: 99,
          },
        ],
      };
      const r = await http(`/api/admin/cases/${caseId}/people`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        jar: adminJar,
      });
      assert(r.status === 200, `status=${r.status}`);
      const added = await prisma.casePerson.findFirst({
        where: { caseFileId: caseId, name: "Test Witness" },
      });
      assert(added, "Test Witness not in DB");
      testPersonId = added.id;
    }
  );

  await expect("PATCH /people omit test person → row deleted", async () => {
    const remaining = await prisma.casePerson.findMany({
      where: { caseFileId: caseId, NOT: { id: testPersonId } },
      orderBy: { sortOrder: "asc" },
    });
    const payload = {
      people: remaining.map((p) => ({
        id: p.id,
        globalPersonId: p.globalPersonId,
        name: p.name,
        role: p.role,
        summary: p.summary,
        portraitUrl: p.portraitUrl,
        unlockStage: p.unlockStage,
        sortOrder: p.sortOrder,
      })),
    };
    const r = await http(`/api/admin/cases/${caseId}/people`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      jar: adminJar,
    });
    assert(r.status === 200, `status=${r.status}`);
    const deleted = await prisma.casePerson.findUnique({
      where: { id: testPersonId },
    });
    assert(!deleted, "Test Witness still in DB after delete");
  });

  // RECORDS
  await expect("PATCH /records edit + restore → 200 + audit", async () => {
    const records = await prisma.caseRecord.findMany({
      where: { caseFileId: caseId },
      orderBy: { sortOrder: "asc" },
    });
    assert(records.length > 0, "no records to test against");
    const originalRec0Summary = records[0].summary;
    const payload = {
      records: records.map((r, i) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        summary: i === 0 ? "Edited by test." : r.summary,
        body: r.body,
        unlockStage: r.unlockStage,
        sortOrder: r.sortOrder,
      })),
    };
    const r = await http(`/api/admin/cases/${caseId}/records`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      jar: adminJar,
    });
    assert(r.status === 200, `status=${r.status}`);
    const audit = await prisma.caseAudit.findFirst({
      where: { caseFileId: caseId, action: "UPDATE_RECORDS" },
      orderBy: { createdAt: "desc" },
    });
    assert(audit, "no UPDATE_RECORDS audit row");
    // Restore.
    payload.records[0].summary = originalRec0Summary;
    await http(`/api/admin/cases/${caseId}/records`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      jar: adminJar,
    });
  });

  // HINTS
  await expect("PATCH /hints unchanged → 200", async () => {
    const hints = await prisma.caseHint.findMany({
      where: { caseFileId: caseId },
    });
    const payload = {
      hints: hints.map((h) => ({
        id: h.id,
        level: h.level,
        title: h.title,
        content: h.content,
        unlockStage: h.unlockStage,
        sortOrder: h.sortOrder,
      })),
    };
    const r = await http(`/api/admin/cases/${caseId}/hints`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      jar: adminJar,
    });
    assert(r.status === 200, `status=${r.status}`);
  });

  // CHECKPOINTS
  await expect("PATCH /checkpoints unchanged → 200", async () => {
    const checkpoints = await prisma.caseCheckpoint.findMany({
      where: { caseFileId: caseId },
    });
    const payload = {
      checkpoints: checkpoints.map((c) => ({
        id: c.id,
        stage: c.stage,
        prompt: c.prompt,
        acceptedAnswers: c.acceptedAnswers,
        successMessage: c.successMessage,
      })),
    };
    const r = await http(`/api/admin/cases/${caseId}/checkpoints`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      jar: adminJar,
    });
    assert(r.status === 200, `status=${r.status}`);
  });

  // SOLUTION
  const originalSuspect = caseFile.solutionSuspect;
  await expect("PATCH /solution edit + restore → 200", async () => {
    const r = await http(`/api/admin/cases/${caseId}/solution`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solutionSuspect: "test suspect from script" }),
      jar: adminJar,
    });
    assert(r.status === 200, `status=${r.status}`);
    const after = await prisma.caseFile.findUnique({ where: { id: caseId } });
    assert(
      after?.solutionSuspect === "test suspect from script",
      "DB not updated"
    );
    // Restore.
    await http(`/api/admin/cases/${caseId}/solution`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solutionSuspect: originalSuspect }),
      jar: adminJar,
    });
  });

  // ---------- PHASE 6 — Workflow ----------
  section("PHASE 6 — Workflow");

  await expect("DRAFT → IN_REVIEW → 200", async () => {
    const r = await http(`/api/admin/cases/${caseId}/workflow`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowStatus: "IN_REVIEW" }),
      jar: adminJar,
    });
    assert(r.status === 200, `status=${r.status}`);
  });

  await expect("IN_REVIEW → DRAFT → 422 (illegal backward)", async () => {
    const r = await http(`/api/admin/cases/${caseId}/workflow`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowStatus: "DRAFT" }),
      jar: adminJar,
    });
    assert(r.status === 422, `status=${r.status}`);
  });

  await expect(
    "IN_REVIEW → PUBLISHED → 200 + publishedAt set",
    async () => {
      const r = await http(`/api/admin/cases/${caseId}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowStatus: "PUBLISHED" }),
        jar: adminJar,
      });
      assert(r.status === 200, `status=${r.status}`);
      const after = await prisma.caseFile.findUnique({ where: { id: caseId } });
      assert(after?.publishedAt !== null, "publishedAt not set");
    }
  );

  await expect(
    "PUBLISHED → IN_REVIEW → 422 (illegal backward)",
    async () => {
      const r = await http(`/api/admin/cases/${caseId}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowStatus: "IN_REVIEW" }),
        jar: adminJar,
      });
      assert(r.status === 422, `status=${r.status}`);
    }
  );

  // ---------- PHASE 7 — Activation codes admin ----------
  section("PHASE 7 — Activation codes admin");

  await expect(
    "GET /codes contains seeded ALDER-001-DEMO",
    async () => {
      const r = await http(`/api/admin/cases/${caseId}/codes`, {
        jar: adminJar,
      });
      assert(r.status === 200, `status=${r.status}`);
      const json = (await r.json()) as { codes: { code: string }[] };
      assert(
        json.codes.some((c) => c.code === ACTIVATION_CODE),
        "ALDER-001-DEMO missing from list"
      );
    }
  );

  await expect("GET /codes?format=csv → text/csv", async () => {
    const r = await http(`/api/admin/cases/${caseId}/codes?format=csv`, {
      jar: adminJar,
    });
    assert(r.status === 200, `status=${r.status}`);
    const ct = r.headers.get("content-type") ?? "";
    assert(ct.includes("text/csv"), `content-type=${ct}`);
  });

  let revokeTargetCodeId = 0;
  await expect(
    "POST /codes batch generate 2 codes with prefix → 2 new rows",
    async () => {
      const before = await prisma.activationCode.count({
        where: { caseFileId: caseId },
      });
      const r = await http(`/api/admin/cases/${caseId}/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 2, kitSerialPrefix: "TEST-" }),
        jar: adminJar,
      });
      assert(r.status === 201, `status=${r.status}`);
      const after = await prisma.activationCode.count({
        where: { caseFileId: caseId },
      });
      assert(after - before === 2, `delta=${after - before}`);
      const fresh = await prisma.activationCode.findFirst({
        where: { caseFileId: caseId, kitSerial: "TEST-" },
        orderBy: { createdAt: "desc" },
      });
      assert(fresh, "no test code found");
      revokeTargetCodeId = fresh.id;
    }
  );

  await expect(
    "PATCH /codes/[codeId] revoke → 200 + revokedAt set",
    async () => {
      const r = await http(
        `/api/admin/cases/${caseId}/codes/${revokeTargetCodeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revokedAt: new Date().toISOString() }),
          jar: adminJar,
        }
      );
      assert(r.status === 200, `status=${r.status}`);
      const row = await prisma.activationCode.findUnique({
        where: { id: revokeTargetCodeId },
      });
      assert(row?.revokedAt !== null, "revokedAt not set");
    }
  );

  // ---------- PHASE 8 — Case activation ----------
  section("PHASE 8 — Case activation");

  await expect("activate FAKECODE999 → 404", async () => {
    const r = await http("/api/cases/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "FAKECODE999" }),
      jar: playerJar,
    });
    assert(r.status === 404, `status=${r.status}`);
  });

  await expect("activate with no cookie → 401", async () => {
    const r = await http("/api/cases/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ACTIVATION_CODE }),
    });
    assert(r.status === 401, `status=${r.status}`);
  });

  await expect(
    "activate ALDER-001-DEMO with player cookie → 201 + UserCase row",
    async () => {
      const r = await http("/api/cases/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: ACTIVATION_CODE }),
        jar: playerJar,
      });
      assert(
        r.status === 200 || r.status === 201,
        `status=${r.status}`
      );
      const player = await prisma.user.findUnique({
        where: { email: PLAYER_EMAIL },
      });
      assert(player, "player missing");
      const uc = await prisma.userCase.findFirst({
        where: { userId: player.id, caseFileId: caseId },
      });
      assert(uc, "UserCase not created");
      assert(
        uc.status === "ACTIVE" || uc.status === "NOT_STARTED",
        `status=${uc.status}`
      );
    }
  );

  await expect(
    "activate ALDER-001-DEMO again → 200, still 1 UserCase row",
    async () => {
      const r = await http("/api/cases/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: ACTIVATION_CODE }),
        jar: playerJar,
      });
      assert(r.status === 200, `status=${r.status}`);
      const player = await prisma.user.findUnique({
        where: { email: PLAYER_EMAIL },
      });
      assert(player, "player missing");
      const count = await prisma.userCase.count({
        where: { userId: player.id, caseFileId: caseId },
      });
      assert(count === 1, `UserCase count=${count}`);
    }
  );

  // ---------- PHASE 9 — Checkpoint flow ----------
  section("PHASE 9 — Checkpoint flow");

  const player = await prisma.user.findUnique({
    where: { email: PLAYER_EMAIL },
  });
  assert(player, "player missing for Phase 9");

  // Get the current stage's checkpoint and submit a wrong answer.
  await expect(
    "POST checkpoint with wrong answer → 400 + isCorrect=false attempt",
    async () => {
      const r = await http(`/api/cases/${CASE_SLUG}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: "thisisacompletewronganswer12345",
        }),
        jar: playerJar,
      });
      assert(r.status === 400, `status=${r.status}`);
      const last = await prisma.checkpointAttempt.findFirst({
        where: { userId: player.id, caseFileId: caseId },
        orderBy: { createdAt: "desc" },
      });
      assert(last, "no CheckpointAttempt row");
      assert(last.isCorrect === false, "isCorrect should be false");
    }
  );

  // Advance through every checkpoint until we reach maxStage.
  await expect(
    "advance through all checkpoints → currentStage reaches maxStage",
    async () => {
      // Loop until UserCase.currentStage >= maxStage. Re-query each pass
      // to pick up the latest stage and matching checkpoint.
      const maxStage = caseFile!.maxStage;
      let safetyCounter = 0;
      while (safetyCounter < maxStage * 2) {
        const uc = await prisma.userCase.findFirst({
          where: { userId: player.id, caseFileId: caseId },
        });
        assert(uc, "UserCase missing mid-advance");
        if (uc.currentStage >= maxStage) break;

        const checkpoint = await prisma.caseCheckpoint.findFirst({
          where: { caseFileId: caseId, stage: uc.currentStage },
        });
        assert(
          checkpoint,
          `no checkpoint for stage ${uc.currentStage}`
        );
        const firstAccepted = checkpoint.acceptedAnswers
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)[0];
        assert(firstAccepted, "no accepted answer");

        const r = await http(`/api/cases/${CASE_SLUG}/checkpoint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer: firstAccepted }),
          jar: playerJar,
        });
        assert(
          r.status === 200,
          `stage ${uc.currentStage} status=${r.status}`
        );
        safetyCounter++;
      }

      const final = await prisma.userCase.findFirst({
        where: { userId: player.id, caseFileId: caseId },
      });
      assert(final, "UserCase missing");
      assert(
        final.currentStage === maxStage,
        `final stage=${final.currentStage}, expected ${maxStage}`
      );
    }
  );

  // ---------- PHASE 10 — Theory submission ----------
  section("PHASE 10 — Theory submission");

  await expect("theory wrong → 201 + INCORRECT, status not SOLVED", async () => {
    const r = await http(`/api/cases/${CASE_SLUG}/theory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suspectName: "wrong person nobody",
        motive: "wrong motive completely unrelated to the case",
        evidenceSummary: "wrong evidence completely irrelevant text",
      }),
      jar: playerJar,
    });
    assert(
      r.status === 200 || r.status === 201,
      `status=${r.status}`
    );
    const json = (await r.json()) as { resultLabel: string };
    assert(
      json.resultLabel === "INCORRECT",
      `resultLabel=${json.resultLabel}`
    );
    const uc = await prisma.userCase.findFirst({
      where: { userId: player.id, caseFileId: caseId },
    });
    assert(uc, "UserCase missing");
    assert(uc.status !== "SOLVED", `status=${uc.status} after INCORRECT`);
  });

  let solvedThisRun = false;
  await expect(
    "theory correct → 201 + CORRECT/PARTIAL, may set SOLVED",
    async () => {
      const r = await http(`/api/cases/${CASE_SLUG}/theory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suspectName: "leah morn",
          motive: "to stop elena from exposing the certification fraud",
          evidenceSummary:
            "badge access log and procurement spreadsheet extract",
        }),
        jar: playerJar,
      });
      assert(
        r.status === 200 || r.status === 201,
        `status=${r.status}`
      );
      const json = (await r.json()) as { resultLabel: string };
      assert(
        json.resultLabel === "CORRECT" || json.resultLabel === "PARTIAL",
        `resultLabel=${json.resultLabel}`
      );
      const uc = await prisma.userCase.findFirst({
        where: { userId: player.id, caseFileId: caseId },
      });
      assert(uc, "UserCase missing");
      if (json.resultLabel === "CORRECT") {
        assert(uc.status === "SOLVED", `status=${uc.status} after CORRECT`);
        solvedThisRun = true;
      }
    }
  );

  // ---------- PHASE 11 — SOLVED is terminal ----------
  section("PHASE 11 — SOLVED terminal");

  if (solvedThisRun) {
    await expect("after SOLVED, wrong theory keeps SOLVED", async () => {
      const r = await http(`/api/cases/${CASE_SLUG}/theory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suspectName: "wrong person",
          motive: "wrong motive text completely unrelated",
          evidenceSummary: "wrong evidence text completely irrelevant",
        }),
        jar: playerJar,
      });
      assert(
        r.status === 200 || r.status === 201,
        `status=${r.status}`
      );
      const uc = await prisma.userCase.findFirst({
        where: { userId: player.id, caseFileId: caseId },
      });
      assert(uc, "UserCase missing");
      assert(
        uc.status === "SOLVED",
        `downgraded to ${uc.status}`
      );
    });
  } else {
    console.log(
      "[SKIP] SOLVED terminal — previous theory did not solve (PARTIAL match)"
    );
  }

  // ---------- PHASE 12 — Access code admin ----------
  section("PHASE 12 — Access code admin");

  const firstRecord = await prisma.caseRecord.findFirst({
    where: { caseFileId: caseId },
    orderBy: { sortOrder: "asc" },
  });
  assert(firstRecord, "no record to point AccessCode at");

  await expect("POST /access-codes create → 201 + DB row", async () => {
    const r = await http(`/api/admin/cases/${caseId}/access-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "TESTQR01",
        kind: "ARTIFACT_QR",
        unlocksTarget: { type: "record", id: firstRecord.id },
        oneTimePerUser: true,
      }),
      jar: adminJar,
    });
    assert(r.status === 201, `status=${r.status}`);
    const ac = await prisma.accessCode.findUnique({
      where: { code: "TESTQR01" },
    });
    assert(ac, "AccessCode not in DB");
  });

  await expect("POST duplicate code → 409", async () => {
    const r = await http(`/api/admin/cases/${caseId}/access-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "TESTQR01",
        kind: "ARTIFACT_QR",
        unlocksTarget: { type: "record", id: firstRecord.id },
        oneTimePerUser: true,
      }),
      jar: adminJar,
    });
    assert(r.status === 409, `status=${r.status}`);
  });

  await expect("POST nonexistent target id → 422", async () => {
    const r = await http(`/api/admin/cases/${caseId}/access-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "TESTQR02",
        kind: "ARTIFACT_QR",
        unlocksTarget: { type: "record", id: 999999 },
      }),
      jar: adminJar,
    });
    assert(r.status === 422, `status=${r.status}`);
  });

  await expect(
    "GET /access-codes contains TESTQR01",
    async () => {
      const r = await http(`/api/admin/cases/${caseId}/access-codes`, {
        jar: adminJar,
      });
      assert(r.status === 200, `status=${r.status}`);
      const json = (await r.json()) as { codes: { code: string }[] };
      assert(
        json.codes.some((c) => c.code === "TESTQR01"),
        "TESTQR01 missing"
      );
    }
  );

  // ---------- PHASE 13 — Access code redemption ----------
  section("PHASE 13 — Access code redemption");

  await expect("redeem FAKECODE999 → 404", async () => {
    const r = await http("/api/access-codes/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "FAKECODE999" }),
      jar: playerJar,
    });
    assert(r.status === 404, `status=${r.status}`);
  });

  await expect("redeem with no cookie → 401", async () => {
    const r = await http("/api/access-codes/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "TESTQR01" }),
    });
    assert(r.status === 401, `status=${r.status}`);
  });

  await expect("redeem TESTQR01 with player → 200 + content + DB row", async () => {
    const r = await http("/api/access-codes/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "TESTQR01" }),
      jar: playerJar,
    });
    assert(r.status === 200, `status=${r.status}`);
    const json = (await r.json()) as {
      alreadyRedeemed: boolean;
      content: { type: string; record?: { title?: string } };
    };
    assert(json.alreadyRedeemed === false, "alreadyRedeemed should be false");
    assert(json.content?.type === "record", `content.type=${json.content?.type}`);
    assert(json.content.record?.title, "no record.title in content");
    const ac = await prisma.accessCode.findUnique({
      where: { code: "TESTQR01" },
    });
    assert(ac, "AC missing");
    const red = await prisma.accessCodeRedemption.findFirst({
      where: { accessCodeId: ac.id, userId: player.id },
    });
    assert(red, "no AccessCodeRedemption row");
  });

  await expect(
    "redeem TESTQR01 again → 200 + alreadyRedeemed:true + still 1 row",
    async () => {
      const r = await http("/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "TESTQR01" }),
        jar: playerJar,
      });
      assert(r.status === 200, `status=${r.status}`);
      const json = (await r.json()) as { alreadyRedeemed: boolean };
      assert(json.alreadyRedeemed === true, "alreadyRedeemed should be true");
      const ac = await prisma.accessCode.findUnique({
        where: { code: "TESTQR01" },
      });
      assert(ac, "AC missing");
      const count = await prisma.accessCodeRedemption.count({
        where: { accessCodeId: ac.id, userId: player.id },
      });
      assert(count === 1, `redemption count=${count}`);
    }
  );

  // ---------- PHASE 14 — Short URL ----------
  section("PHASE 14 — Short URL redirect");

  await expect(
    "GET /u/TESTQR01 → 30x redirect to /bureau/unlock?code=TESTQR01",
    async () => {
      const r = await fetch(`${BASE}/u/TESTQR01`, { redirect: "manual" });
      assert(
        r.status === 302 || r.status === 307 || r.status === 308,
        `status=${r.status}`
      );
      const loc = r.headers.get("location") ?? "";
      assert(loc.includes("/bureau/unlock"), `location=${loc}`);
      assert(loc.includes("TESTQR01"), `location=${loc}`);
    }
  );

  // ---------- PHASE 15 — Slug history ----------
  section("PHASE 15 — Slug history");

  await expect(
    "rename slug → CaseSlugHistory(oldSlug=alder-street-review) created",
    async () => {
      const r = await http(`/api/admin/cases/${caseId}/overview`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "alder-street-review-renamed" }),
        jar: adminJar,
      });
      assert(r.status === 200, `status=${r.status}`);
      const row = await prisma.caseSlugHistory.findUnique({
        where: { oldSlug: CASE_SLUG },
      });
      assert(row, "no slug-history row for alder-street-review");
    }
  );

  await expect(
    "rename slug back → second CaseSlugHistory row created",
    async () => {
      const r = await http(`/api/admin/cases/${caseId}/overview`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: CASE_SLUG }),
        jar: adminJar,
      });
      assert(r.status === 200, `status=${r.status}`);
      const row = await prisma.caseSlugHistory.findUnique({
        where: { oldSlug: "alder-street-review-renamed" },
      });
      assert(row, "no slug-history row for the renamed slug");
    }
  );

  // ---------- PHASE 16 — Support management ----------
  section("PHASE 16 — Support management");

  await expect(
    "PATCH /support/[id]/status HANDLED → 200 + DB updated",
    async () => {
      const r = await http(`/api/admin/support/${supportMessageId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "HANDLED" }),
        jar: adminJar,
      });
      assert(r.status === 200, `status=${r.status}`);
      const row = await prisma.supportMessage.findUnique({
        where: { id: supportMessageId },
      });
      assert(row?.status === "HANDLED", `status=${row?.status}`);
    }
  );

  await expect("PATCH status invalid → 422", async () => {
    const r = await http(`/api/admin/support/${supportMessageId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "BOGUS" }),
      jar: adminJar,
    });
    assert(r.status === 422, `status=${r.status}`);
  });

  await expect("POST /support/[id]/reply → 200 { sent: false }", async () => {
    const r = await http(`/api/admin/support/${supportMessageId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Thanks for reaching out." }),
      jar: adminJar,
    });
    assert(r.status === 200, `status=${r.status}`);
    const json = (await r.json()) as { sent: boolean };
    assert(json.sent === false, `sent=${json.sent}`);
  });

  // ---------- PHASE 17 — Security ----------
  section("PHASE 17 — Security");

  await expect(
    "PATCH /overview with player cookie → 403",
    async () => {
      const r = await http(`/api/admin/cases/${caseId}/overview`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "should not work" }),
        jar: playerJar,
      });
      assert(r.status === 403, `status=${r.status}`);
    }
  );

  await expect(
    "PATCH /overview with admin but no Origin → 403 (CSRF)",
    async () => {
      const r = await http(`/api/admin/cases/${caseId}/overview`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "no origin" }),
        jar: adminJar,
        noOrigin: true,
      });
      assert(r.status === 403, `status=${r.status}`);
    }
  );

  await expect(
    "redeem with admin cookie → 200 (admin is also a valid user)",
    async () => {
      // Use a fresh AccessCode so we don't collide with TESTQR01's
      // oneTimePerUser pre-check.
      const ac = await prisma.accessCode.create({
        data: {
          code: "ADMINREDEEM01",
          kind: "BUREAU_REF",
          caseFileId: caseId,
          unlocksTarget: { type: "record", id: firstRecord.id },
          oneTimePerUser: false,
        },
      });
      const r = await http("/api/access-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "ADMINREDEEM01" }),
        jar: adminJar,
      });
      assert(r.status === 200, `status=${r.status}`);
      // Cleanup.
      await prisma.accessCodeRedemption.deleteMany({
        where: { accessCodeId: ac.id },
      });
      await prisma.accessCode.delete({ where: { id: ac.id } });
    }
  );

  // ---------- PHASE 18 — CaseAudit integrity ----------
  section("PHASE 18 — CaseAudit integrity");

  await expect(
    "CaseAudit count > 5 with all fields populated and JSON diff",
    async () => {
      const audits = await prisma.caseAudit.findMany({
        where: { caseFileId: caseId },
      });
      assert(
        audits.length > 5,
        `audit count=${audits.length}`
      );
      for (const a of audits) {
        assert(a.caseFileId, "missing caseFileId");
        assert(a.userId, "missing userId");
        assert(a.action, "missing action");
        assert(a.diff !== null && a.diff !== undefined, "diff is null");
        // Json column should round-trip through JSON.stringify safely.
        const s = JSON.stringify(a.diff);
        assert(typeof s === "string" && s.length > 0, "diff not JSON-able");
      }
    }
  );

  // ---------- summary ----------
  console.log("\n=== SUMMARY ===");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - ${r.name} — ${r.detail ?? ""}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("\nFatal error in test runner:", err);
    process.exit(2);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
