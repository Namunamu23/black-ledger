/**
 * Seed data for: The Harbor Fog
 * Generated: 2026-04-23T03:43:17.376Z
 *
 * Edit all TODO fields before running: npx tsx prisma/seed/cases/harbor-fog.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { prisma } from "../../../lib/prisma";

const caseData = {
  "slug": "harbor-fog",
  "title": "The Harbor Fog",
  "summary": "TODO: Write a 1–2 sentence case summary.",
  "players": "1–4",
  "duration": "90–150 min",
  "difficulty": "Moderate",
  "maxStage": 3,
  "activationCode": "HARBOR-001",
  "solutionSuspect": "TODO: suspect name|TODO: alias",
  "solutionMotive": "TODO: motive description",
  "solutionEvidence": "TODO: key evidence",
  "debriefOverview": "TODO: One-sentence debrief overview.",
  "debriefWhatHappened": "TODO: What actually happened.",
  "debriefWhyItWorked": "TODO: Why the solution holds.",
  "debriefClosing": "TODO: Closing note to the investigator.",
  "debriefSectionTitle": null,
  "debriefIntro": null,
  "people": [],
  "records": [
    {
      "title": "TODO: Record title",
      "category": "REPORT",
      "summary": "TODO: One-sentence record summary.",
      "body": "TODO: Record full text.",
      "unlockStage": 1,
      "sortOrder": 0
    }
  ],
  "hints": [
    {
      "level": 1,
      "title": "TODO: Hint title",
      "content": "TODO: Hint content.",
      "unlockStage": 1,
      "sortOrder": 0
    }
  ],
  "checkpoints": [
    {
      "stage": 1,
      "prompt": "TODO: Checkpoint question?",
      "acceptedAnswers": "TODO: answer|TODO: alias",
      "successMessage": "TODO: Success message."
    },
    {
      "stage": 2,
      "prompt": "TODO: Final checkpoint question?",
      "acceptedAnswers": "TODO: answer|TODO: alias",
      "successMessage": "TODO: Success message."
    }
  ]
};

async function main() {
  const existing = await prisma.caseFile.findUnique({ where: { slug: caseData.slug } });
  if (existing) {
    console.log(`Case "${caseData.slug}" already exists. Delete it first or use a different slug.`);
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

  console.log(`Seeded: ${caseData.title} (slug: ${caseData.slug})`);
  console.log(`Activation code: ${caseData.activationCode}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
