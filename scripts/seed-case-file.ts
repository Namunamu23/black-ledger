import dotenv from "dotenv";
import { prisma } from "../lib/prisma";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const caseFile = await prisma.caseFile.upsert({
    where: { slug: "alder-street-review" },
    update: {
      title: "The Alder Street Review",
      summary:
        "A city compliance investigator dies near a municipal parking structure. The original case drifted toward a simple robbery narrative. Your review suggests the evidence tells another story.",
      players: "1–4",
      duration: "90–150 min",
      difficulty: "Moderate",
      maxStage: 3,
      solutionSuspect: "leah morn|leah",
      solutionMotive:
        "to stop elena from exposing the certification fraud|to stop elena from exposing the fraud|cover up the fraud|to cover up the fraud",
      solutionEvidence:
        "badge access log and procurement spreadsheet extract|access log and procurement spreadsheet extract|badge access log|procurement spreadsheet extract",
      isActive: true,
    },
    create: {
      slug: "alder-street-review",
      title: "The Alder Street Review",
      summary:
        "A city compliance investigator dies near a municipal parking structure. The original case drifted toward a simple robbery narrative. Your review suggests the evidence tells another story.",
      players: "1–4",
      duration: "90–150 min",
      difficulty: "Moderate",
      maxStage: 3,
      solutionSuspect: "leah morn|leah",
      solutionMotive:
        "to stop elena from exposing the certification fraud|to stop elena from exposing the fraud|cover up the fraud|to cover up the fraud",
      solutionEvidence:
        "badge access log and procurement spreadsheet extract|access log and procurement spreadsheet extract|badge access log|procurement spreadsheet extract",
      isActive: true,
    },
  });

  const existingCode = await prisma.activationCode.findUnique({
    where: { code: "ALDER-001-DEMO" },
  });

  if (!existingCode) {
    await prisma.activationCode.create({
      data: {
        code: "ALDER-001-DEMO",
        caseFileId: caseFile.id,
      },
    });
  }

  await prisma.casePerson.deleteMany({
    where: { caseFileId: caseFile.id },
  });

  await prisma.caseRecord.deleteMany({
    where: { caseFileId: caseFile.id },
  });

  await prisma.caseHint.deleteMany({
    where: { caseFileId: caseFile.id },
  });

  await prisma.caseCheckpoint.deleteMany({
    where: { caseFileId: caseFile.id },
  });

  await prisma.casePerson.createMany({
    data: [
      {
        caseFileId: caseFile.id,
        name: "Elena Voss",
        role: "Victim",
        summary:
          "Senior compliance investigator whose death triggered the Alder Street review.",
        unlockStage: 1,
        sortOrder: 1,
      },
      {
        caseFileId: caseFile.id,
        name: "Daniel Reeve",
        role: "Contractor Supervisor",
        summary:
          "Had a visible conflict with Elena and looks suspicious early, but is not the killer.",
        unlockStage: 1,
        sortOrder: 2,
      },
      {
        caseFileId: caseFile.id,
        name: "Mara Kessler",
        role: "Department Supervisor",
        summary:
          "Downplayed Elena’s concerns and concealed damaging department details after the death.",
        unlockStage: 2,
        sortOrder: 3,
      },
      {
        caseFileId: caseFile.id,
        name: "Owen Vale",
        role: "Vendor Relations Manager",
        summary:
          "Tied to the pressure and concealment surrounding the case.",
        unlockStage: 2,
        sortOrder: 4,
      },
      {
        caseFileId: caseFile.id,
        name: "Leah Morn",
        role: "Records Clerk",
        summary:
          "Easy to overlook in the original file, but directly connected to the fatal confrontation.",
        unlockStage: 3,
        sortOrder: 5,
      },
    ],
  });

  await prisma.caseRecord.createMany({
    data: [
      {
        caseFileId: caseFile.id,
        title: "Original Incident Report",
        category: "Report",
        summary:
          "The original police summary that frames the case as a likely robbery.",
        body:
          "Initial responding officers noted the missing phone and treated the death as a likely robbery-related incident. The report focuses heavily on the location and missing property rather than Elena’s professional work.",
        unlockStage: 1,
        sortOrder: 1,
      },
      {
        caseFileId: caseFile.id,
        title: "Garage Attendant Statement",
        category: "Witness Statement",
        summary:
          "A witness account that appears ordinary until compared with the movement timeline.",
        body:
          "The attendant recalls seeing Elena in the area and hearing a raised exchange, but the timing detail becomes much more important when checked against access records and known movements.",
        unlockStage: 1,
        sortOrder: 2,
      },
      {
        caseFileId: caseFile.id,
        title: "Badge Access Log",
        category: "Access Log",
        summary:
          "A timeline of building access events tied to staff and contractors.",
        body:
          "The access data introduces a timing inconsistency that undermines one of the stated alibis. When compared carefully against witness timing, it suggests the original reconstruction was incomplete.",
        unlockStage: 2,
        sortOrder: 3,
      },
      {
        caseFileId: caseFile.id,
        title: "Procurement Spreadsheet Extract",
        category: "Internal Record",
        summary:
          "A narrow extract of records tied to the certification chain under review.",
        body:
          "The extract shows unusual repetition in approvals and vendor relationships, suggesting that Elena’s review had exposed something more serious than a random confrontation.",
        unlockStage: 3,
        sortOrder: 4,
      },
    ],
  });

  await prisma.caseHint.createMany({
    data: [
      {
        caseFileId: caseFile.id,
        level: 1,
        title: "Start with the timeline",
        content:
          "Look for contradictions between the official incident framing and the movements implied by access and witness data.",
        unlockStage: 1,
        sortOrder: 1,
      },
      {
        caseFileId: caseFile.id,
        level: 2,
        title: "Compare motive fields",
        content:
          "Do not focus only on the street-level explanation. Review how Elena’s professional work could create motive.",
        unlockStage: 2,
        sortOrder: 2,
      },
      {
        caseFileId: caseFile.id,
        level: 3,
        title: "Look past the obvious suspect",
        content:
          "One of the earliest suspicious figures is real pressure, but not the final answer. Re-examine who was overlooked.",
        unlockStage: 3,
        sortOrder: 3,
      },
    ],
  });

  await prisma.caseCheckpoint.createMany({
    data: [
      {
        caseFileId: caseFile.id,
        stage: 1,
        prompt:
          "Which record should you compare next if you want to challenge the official timeline?",
        acceptedAnswers: "badge access log|access log|badge log",
        successMessage: "Stage 2 unlocked. New records and people are now available.",
      },
      {
        caseFileId: caseFile.id,
        stage: 2,
        prompt:
          "Which overlooked person becomes much more important once the internal record trail is considered?",
        acceptedAnswers: "leah morn|leah",
        successMessage: "Final review stage unlocked. Theory submission is now available.",
      },
    ],
  });

  console.log("Case file ready.");
  console.log("Demo activation code: ALDER-001-DEMO");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });