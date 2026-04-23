/**
 * Case scaffolder CLI.
 *
 *   npm run new-case -- --slug "harbor-fog" --title "The Harbor Fog"
 *
 * Generates a ready-to-edit seed file at prisma/seed/cases/<slug>.ts.
 * If GlobalPersons exist in the DB the operator is prompted to wire any
 * of them into the people array via stable globalPersonId references.
 *
 * The generator's output is validated against a Zod schema before being
 * written so structural drift between this script and the runtime data
 * shape surfaces as a generator-time error rather than a silent broken
 * seed file.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const SLUG_RE = /^[a-z0-9-]+$/;

function getArg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function ask(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ---- seedCaseSchema — mirrors SeedCase from scripts/seed-case-file.ts.
// Person entries are extended with optional globalPersonId so the
// generator can emit GlobalPerson links without violating the schema.

const personSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  summary: z.string().min(1),
  unlockStage: z.number().int(),
  sortOrder: z.number().int(),
  globalPersonId: z.number().int().optional(),
});

const recordSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  unlockStage: z.number().int(),
  sortOrder: z.number().int(),
});

const hintSchema = z.object({
  level: z.number().int(),
  title: z.string().min(1),
  content: z.string().min(1),
  unlockStage: z.number().int(),
  sortOrder: z.number().int(),
});

const checkpointSchema = z.object({
  stage: z.number().int(),
  prompt: z.string().min(1),
  acceptedAnswers: z.string().min(1),
  successMessage: z.string().min(1),
});

const seedCaseSchema = z.object({
  slug: z.string().regex(SLUG_RE),
  title: z.string().min(1),
  summary: z.string().min(1),
  players: z.string().min(1),
  duration: z.string().min(1),
  difficulty: z.string().min(1),
  maxStage: z.number().int(),
  activationCode: z.string().min(1),
  solutionSuspect: z.string().min(1),
  solutionMotive: z.string().min(1),
  solutionEvidence: z.string().min(1),
  debriefOverview: z.string().min(1),
  debriefWhatHappened: z.string().min(1),
  debriefWhyItWorked: z.string().min(1),
  debriefClosing: z.string().min(1),
  debriefSectionTitle: z.string().nullable(),
  debriefIntro: z.string().nullable(),
  people: z.array(personSchema),
  records: z.array(recordSchema).min(1),
  hints: z.array(hintSchema).min(1),
  checkpoints: z.array(checkpointSchema).min(1),
});

async function main() {
  const slug = getArg("slug");
  const title = getArg("title");

  if (!slug || !title) {
    throw new Error(
      "Usage: npm run new-case -- --slug <slug> --title <title>"
    );
  }
  if (!SLUG_RE.test(slug)) {
    throw new Error(
      `Invalid slug "${slug}" — must match ${SLUG_RE.toString()}.`
    );
  }

  const outDir = path.join("prisma", "seed", "cases");
  const outPath = path.join(outDir, `${slug}.ts`);
  if (fs.existsSync(outPath)) {
    throw new Error(
      `Refusing to overwrite ${outPath}. Delete it or pick a different slug.`
    );
  }

  const globalPersons = await prisma.globalPerson.findMany({
    orderBy: { lastName: "asc" },
    select: {
      id: true,
      bureauId: true,
      firstName: true,
      lastName: true,
      personType: true,
    },
  });

  let selectedIds: number[] = [];
  if (globalPersons.length > 0) {
    console.log("\nGlobalPersons available:");
    globalPersons.forEach((p, i) => {
      console.log(
        `  ${i + 1}. ${p.firstName} ${p.lastName} [${p.bureauId}] (${p.personType})`
      );
    });
    const answer = await ask(
      "\nWire in GlobalPersons? Enter comma-separated numbers (e.g. 1,3) or press Enter to skip: "
    );
    selectedIds = answer
      .split(",")
      .map((s) => s.trim())
      .map((s) => Number(s))
      .filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= globalPersons.length
      )
      .map((n) => globalPersons[n - 1].id);
  }

  const activationCode = `${slug.toUpperCase().replace(/-/g, "").slice(0, 6)}-001`;

  const caseData = {
    slug,
    title,
    summary: "TODO: Write a 1–2 sentence case summary.",
    players: "1–4",
    duration: "90–150 min",
    difficulty: "Moderate",
    maxStage: 3,
    activationCode,
    solutionSuspect: "TODO: suspect name|TODO: alias",
    solutionMotive: "TODO: motive description",
    solutionEvidence: "TODO: key evidence",
    debriefOverview: "TODO: One-sentence debrief overview.",
    debriefWhatHappened: "TODO: What actually happened.",
    debriefWhyItWorked: "TODO: Why the solution holds.",
    debriefClosing: "TODO: Closing note to the investigator.",
    debriefSectionTitle: null as string | null,
    debriefIntro: null as string | null,
    people: selectedIds.map((gpid, i) => ({
      name: "TODO: Character name",
      role: "TODO: Role",
      summary: "TODO: One-sentence character summary.",
      unlockStage: 1,
      sortOrder: i,
      globalPersonId: gpid,
    })),
    records: [
      {
        title: "TODO: Record title",
        category: "REPORT",
        summary: "TODO: One-sentence record summary.",
        body: "TODO: Record full text.",
        unlockStage: 1,
        sortOrder: 0,
      },
    ],
    hints: [
      {
        level: 1,
        title: "TODO: Hint title",
        content: "TODO: Hint content.",
        unlockStage: 1,
        sortOrder: 0,
      },
    ],
    checkpoints: [
      {
        stage: 1,
        prompt: "TODO: Checkpoint question?",
        acceptedAnswers: "TODO: answer|TODO: alias",
        successMessage: "TODO: Success message.",
      },
      {
        stage: 2,
        prompt: "TODO: Final checkpoint question?",
        acceptedAnswers: "TODO: answer|TODO: alias",
        successMessage: "TODO: Success message.",
      },
    ],
  };

  const parsed = seedCaseSchema.safeParse(caseData);
  if (!parsed.success) {
    console.error("Generator output failed schema validation:");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error("Generator self-check failed.");
  }

  fs.mkdirSync(outDir, { recursive: true });

  const fileBody = `/**
 * Seed data for: ${title}
 * Generated: ${new Date().toISOString()}
 *
 * Edit all TODO fields before running: npx tsx prisma/seed/cases/${slug}.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { prisma } from "../../../lib/prisma";

const caseData = ${JSON.stringify(caseData, null, 2)};

async function main() {
  const existing = await prisma.caseFile.findUnique({ where: { slug: caseData.slug } });
  if (existing) {
    console.log(\`Case "\${caseData.slug}" already exists. Delete it first or use a different slug.\`);
    process.exit(0);
  }

  const caseFile = await prisma.caseFile.create({
    data: {
      slug: caseData.slug,
      title: caseData.title,
      summary: caseData.summary,
      players: caseData.players,
      duration: caseData.duration,
      difficulty: caseData.difficulty,
      maxStage: caseData.maxStage,
      solutionSuspect: caseData.solutionSuspect,
      solutionMotive: caseData.solutionMotive,
      solutionEvidence: caseData.solutionEvidence,
      debriefOverview: caseData.debriefOverview,
      debriefWhatHappened: caseData.debriefWhatHappened,
      debriefWhyItWorked: caseData.debriefWhyItWorked,
      debriefClosing: caseData.debriefClosing,
      debriefSectionTitle: caseData.debriefSectionTitle,
      debriefIntro: caseData.debriefIntro,
    },
  });

  if (caseData.activationCode) {
    await prisma.activationCode.create({
      data: { code: caseData.activationCode, caseFileId: caseFile.id },
    });
  }

  await prisma.casePerson.createMany({
    data: caseData.people.map((p: any) => ({ ...p, caseFileId: caseFile.id })),
  });
  await prisma.caseRecord.createMany({
    data: caseData.records.map((r: any) => ({ ...r, caseFileId: caseFile.id })),
  });
  await prisma.caseHint.createMany({
    data: caseData.hints.map((h: any) => ({ ...h, caseFileId: caseFile.id })),
  });
  await prisma.caseCheckpoint.createMany({
    data: caseData.checkpoints.map((c: any) => ({ ...c, caseFileId: caseFile.id })),
  });

  console.log(\`Seeded: \${caseData.title} (slug: \${caseData.slug})\`);
  console.log(\`Activation code: \${caseData.activationCode}\`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
`;

  fs.writeFileSync(outPath, fileBody);

  console.log(`\nCreated: ${outPath}`);
  console.log(
    `Edit all TODO fields, then run:  npx tsx prisma/seed/cases/${slug}.ts`
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
