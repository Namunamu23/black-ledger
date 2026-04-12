import dotenv from "dotenv";
import { prisma } from "../lib/prisma";

dotenv.config({ path: ".env.local" });
dotenv.config();

type SeedCase = {
  slug: string;
  title: string;
  summary: string;
  players: string;
  duration: string;
  difficulty: string;
  maxStage: number;
  activationCode: string;
  solutionSuspect: string;
  solutionMotive: string;
  solutionEvidence: string;
  debriefOverview: string;
  debriefWhatHappened: string;
  debriefWhyItWorked: string;
  debriefClosing: string;
  people: {
    name: string;
    role: string;
    summary: string;
    unlockStage: number;
    sortOrder: number;
  }[];
  records: {
    title: string;
    category: string;
    summary: string;
    body: string;
    unlockStage: number;
    sortOrder: number;
  }[];
  hints: {
    level: number;
    title: string;
    content: string;
    unlockStage: number;
    sortOrder: number;
  }[];
  checkpoints: {
    stage: number;
    prompt: string;
    acceptedAnswers: string;
    successMessage: string;
  }[];
};

const cases: SeedCase[] = [
  {
    slug: "alder-street-review",
    title: "The Alder Street Review",
    summary:
      "A city compliance investigator dies near a municipal parking structure. The original case drifted toward a simple robbery narrative. Your review suggests the evidence tells another story.",
    players: "1–4",
    duration: "90–150 min",
    difficulty: "Moderate",
    maxStage: 3,
    activationCode: "ALDER-001-DEMO",
    solutionSuspect: "leah morn|leah",
    solutionMotive:
      "to stop elena from exposing the certification fraud|to stop elena from exposing the fraud|cover up the fraud|to cover up the fraud",
    solutionEvidence:
      "badge access log and procurement spreadsheet extract|access log and procurement spreadsheet extract|badge access log|procurement spreadsheet extract",
    debriefOverview:
      "Your review determined that the original robbery theory was incomplete and ultimately misleading.",
    debriefWhatHappened:
      "Elena Voss uncovered irregularities in the certification chain and moved closer to exposing a broader internal problem. Leah Morn, tied more directly to the record trail than originally understood, became involved in the fatal confrontation. After the death, the scene and interpretation of evidence were shaped to support a simpler robbery explanation.",
    debriefWhyItWorked:
      "The original case drifted toward the robbery narrative because the missing phone and scene framing offered an easy explanation. But when badge access records, witness timing, and internal procurement evidence were compared together, the professional motive and the overlooked participant became much harder to ignore.",
    debriefClosing:
      "The case was not solved by finding one dramatic twist. It was solved by recognizing that several smaller inconsistencies formed one coherent pattern. That is what the original investigation missed.",
    people: [
      {
        name: "Elena Voss",
        role: "Victim",
        summary:
          "Senior compliance investigator whose death triggered the Alder Street review.",
        unlockStage: 1,
        sortOrder: 1,
      },
      {
        name: "Daniel Reeve",
        role: "Contractor Supervisor",
        summary:
          "Had a visible conflict with Elena and looks suspicious early, but is not the killer.",
        unlockStage: 1,
        sortOrder: 2,
      },
      {
        name: "Mara Kessler",
        role: "Department Supervisor",
        summary:
          "Downplayed Elena’s concerns and concealed damaging department details after the death.",
        unlockStage: 2,
        sortOrder: 3,
      },
      {
        name: "Owen Vale",
        role: "Vendor Relations Manager",
        summary:
          "Tied to the pressure and concealment surrounding the case.",
        unlockStage: 2,
        sortOrder: 4,
      },
      {
        name: "Leah Morn",
        role: "Records Clerk",
        summary:
          "Easy to overlook in the original file, but directly connected to the fatal confrontation.",
        unlockStage: 3,
        sortOrder: 5,
      },
    ],
    records: [
      {
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
    hints: [
      {
        level: 1,
        title: "Start with the timeline",
        content:
          "Look for contradictions between the official incident framing and the movements implied by access and witness data.",
        unlockStage: 1,
        sortOrder: 1,
      },
      {
        level: 2,
        title: "Compare motive fields",
        content:
          "Do not focus only on the street-level explanation. Review how Elena’s professional work could create motive.",
        unlockStage: 2,
        sortOrder: 2,
      },
      {
        level: 3,
        title: "Look past the obvious suspect",
        content:
          "One of the earliest suspicious figures is real pressure, but not the final answer. Re-examine who was overlooked.",
        unlockStage: 3,
        sortOrder: 3,
      },
    ],
    checkpoints: [
      {
        stage: 1,
        prompt:
          "Which record should you compare next if you want to challenge the official timeline?",
        acceptedAnswers: "badge access log|access log|badge log",
        successMessage: "Stage 2 unlocked. New records and people are now available.",
      },
      {
        stage: 2,
        prompt:
          "Which overlooked person becomes much more important once the internal record trail is considered?",
        acceptedAnswers: "leah morn|leah",
        successMessage: "Final review stage unlocked. Theory submission is now available.",
      },
    ],
  },
  {
    slug: "riverglass-affair",
    title: "The Riverglass Affair",
    summary:
      "A museum acquisitions coordinator dies after raising concerns about forged provenance documents tied to a donor-backed exhibit. The official story suggests an isolated dispute. Your review suggests the paperwork tells a deeper story.",
    players: "1–4",
    duration: "100–160 min",
    difficulty: "Moderate+",
    maxStage: 3,
    activationCode: "RIVER-002-DEMO",
    solutionSuspect: "nina vale|nina",
    solutionMotive:
      "to stop arin from exposing the forged provenance|to cover up the forged provenance|cover up the forgery",
    solutionEvidence:
      "storage room key log and restoration invoice|key log and restoration invoice|storage room key log|restoration invoice",
    debriefOverview:
      "Your review showed that the exhibit controversy was not just administrative noise. The provenance issue created direct personal and institutional risk.",
    debriefWhatHappened:
      "Arin Dace moved closer to exposing forged provenance paperwork attached to a donor-backed acquisition. Nina Vale, who appeared peripheral at first, was more entangled in the documentation chain than expected. The fatal confrontation emerged from the need to stop disclosure before the paperwork trail became undeniable.",
    debriefWhyItWorked:
      "The original explanation focused on interpersonal conflict and donor pressure, which made the case feel messy but shallow. Once the key log and restoration documentation were compared, the movements and document trail aligned around a more direct concealment motive.",
    debriefClosing:
      "This case reinforces the same lesson in a different setting: institutional narratives often survive because they are easier to accept than document-driven contradictions.",
    people: [
      {
        name: "Arin Dace",
        role: "Victim",
        summary:
          "Museum acquisitions coordinator who raised serious concerns about provenance paperwork.",
        unlockStage: 1,
        sortOrder: 1,
      },
      {
        name: "Tomas Venn",
        role: "Donor Liaison",
        summary:
          "Visible public pressure around the exhibit made Tomas seem central from the start.",
        unlockStage: 1,
        sortOrder: 2,
      },
      {
        name: "Celia Hart",
        role: "Restoration Lead",
        summary:
          "Handled parts of the exhibit preparation and knew more about the object chain than she first admitted.",
        unlockStage: 2,
        sortOrder: 3,
      },
      {
        name: "Mira Quill",
        role: "Records Assistant",
        summary:
          "Handled archival paperwork and helped expose inconsistencies in internal handling.",
        unlockStage: 2,
        sortOrder: 4,
      },
      {
        name: "Nina Vale",
        role: "Collections Administrator",
        summary:
          "Appears procedural and low-visibility until the documentation chain is examined closely.",
        unlockStage: 3,
        sortOrder: 5,
      },
    ],
    records: [
      {
        title: "Initial Museum Security Summary",
        category: "Report",
        summary:
          "Frames the case as a late-night argument linked to exhibit pressure.",
        body:
          "The security summary focuses on interpersonal tension and a donor-sensitive timeline but leaves the provenance dispute underdeveloped.",
        unlockStage: 1,
        sortOrder: 1,
      },
      {
        title: "Courier Statement",
        category: "Witness Statement",
        summary:
          "A logistics account that becomes more useful once the document timeline is rechecked.",
        body:
          "The courier remembers an unusual delay and a document handoff that did not match the official chain described later.",
        unlockStage: 1,
        sortOrder: 2,
      },
      {
        title: "Storage Room Key Log",
        category: "Access Log",
        summary:
          "A key-control record that weakens one of the most important assumptions in the original story.",
        body:
          "The storage-room access history shows that an internal key movement occurred at a time that conflicts with the expected restoration workflow.",
        unlockStage: 2,
        sortOrder: 3,
      },
      {
        title: "Restoration Invoice",
        category: "Internal Record",
        summary:
          "A billing document whose detail level reveals more than it seems to at first glance.",
        body:
          "The restoration invoice references handling activity that does not match the formal provenance record, creating a bridge between internal procedure and forgery risk.",
        unlockStage: 3,
        sortOrder: 4,
      },
    ],
    hints: [
      {
        level: 1,
        title: "Follow the document chain",
        content:
          "Look beyond visible conflict and compare the document trail to who had reason to fear exposure.",
        unlockStage: 1,
        sortOrder: 1,
      },
      {
        level: 2,
        title: "Access matters",
        content:
          "A quiet administrative movement can matter more than a loud public dispute.",
        unlockStage: 2,
        sortOrder: 2,
      },
      {
        level: 3,
        title: "The overlooked role is the point",
        content:
          "The case turns once you stop assuming the most visible pressure source is the final answer.",
        unlockStage: 3,
        sortOrder: 3,
      },
    ],
    checkpoints: [
      {
        stage: 1,
        prompt:
          "Which record should you compare next if you want to test the official movement timeline around the restoration wing?",
        acceptedAnswers: "storage room key log|key log|storage log",
        successMessage: "Stage 2 unlocked. The internal access trail is now clearer.",
      },
      {
        stage: 2,
        prompt:
          "Which quieter staff member becomes much more important once the provenance handling trail is examined closely?",
        acceptedAnswers: "nina vale|nina",
        successMessage: "Final review stage unlocked. Theory submission is now available.",
      },
    ],
  },
];

async function seedCase(data: SeedCase) {
  const caseFile = await prisma.caseFile.upsert({
    where: { slug: data.slug },
    update: {
      title: data.title,
      summary: data.summary,
      players: data.players,
      duration: data.duration,
      difficulty: data.difficulty,
      maxStage: data.maxStage,
      solutionSuspect: data.solutionSuspect,
      solutionMotive: data.solutionMotive,
      solutionEvidence: data.solutionEvidence,
      debriefOverview: data.debriefOverview,
      debriefWhatHappened: data.debriefWhatHappened,
      debriefWhyItWorked: data.debriefWhyItWorked,
      debriefClosing: data.debriefClosing,
      isActive: true,
    },
    create: {
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      players: data.players,
      duration: data.duration,
      difficulty: data.difficulty,
      maxStage: data.maxStage,
      solutionSuspect: data.solutionSuspect,
      solutionMotive: data.solutionMotive,
      solutionEvidence: data.solutionEvidence,
      debriefOverview: data.debriefOverview,
      debriefWhatHappened: data.debriefWhatHappened,
      debriefWhyItWorked: data.debriefWhyItWorked,
      debriefClosing: data.debriefClosing,
      isActive: true,
    },
  });

  const existingCode = await prisma.activationCode.findUnique({
    where: { code: data.activationCode },
  });

  if (!existingCode) {
    await prisma.activationCode.create({
      data: {
        code: data.activationCode,
        caseFileId: caseFile.id,
      },
    });
  }

  await prisma.casePerson.deleteMany({ where: { caseFileId: caseFile.id } });
  await prisma.caseRecord.deleteMany({ where: { caseFileId: caseFile.id } });
  await prisma.caseHint.deleteMany({ where: { caseFileId: caseFile.id } });
  await prisma.caseCheckpoint.deleteMany({ where: { caseFileId: caseFile.id } });

  await prisma.casePerson.createMany({
    data: data.people.map((item) => ({
      caseFileId: caseFile.id,
      ...item,
    })),
  });

  await prisma.caseRecord.createMany({
    data: data.records.map((item) => ({
      caseFileId: caseFile.id,
      ...item,
    })),
  });

  await prisma.caseHint.createMany({
    data: data.hints.map((item) => ({
      caseFileId: caseFile.id,
      ...item,
    })),
  });

  await prisma.caseCheckpoint.createMany({
    data: data.checkpoints.map((item) => ({
      caseFileId: caseFile.id,
      ...item,
    })),
  });

  console.log(`Seeded case: ${data.title}`);
  console.log(`Activation code: ${data.activationCode}`);
}

async function main() {
  for (const caseData of cases) {
    await seedCase(caseData);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });