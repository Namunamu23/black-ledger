import dotenv from "dotenv";
import { prisma } from "../lib/prisma";

dotenv.config({ path: ".env.local" });
dotenv.config();

type GlobalPersonSeed = {
  bureauId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  knownLocation?: string;
  status: string;
  personType: string;
  classification: string;
  riskLevel: string;
  relevanceLevel: string;
  profileSummary: string;
  internalNotes: string;
  aliases: string[];
};

const people: GlobalPersonSeed[] = [
  {
    bureauId: "BL-PER-0001",
    firstName: "Elena",
    lastName: "Voss",
    dateOfBirth: "1981-04-17",
    knownLocation: "Municipal district office",
    status: "DECEASED",
    personType: "VICTIM",
    classification: "CASE_LINKED",
    riskLevel: "NONE",
    relevanceLevel: "HIGH",
    profileSummary:
      "Senior compliance investigator whose work placed her near a concealed certification trail.",
    internalNotes:
      "Primary victim in the Alder Street review. Her professional activity created the motive structure.",
    aliases: [],
  },
  {
    bureauId: "BL-PER-0002",
    firstName: "Leah",
    lastName: "Morn",
    dateOfBirth: "1990-11-03",
    knownLocation: "Records office network",
    status: "ACTIVE FILE",
    personType: "PERSON_OF_INTEREST",
    classification: "RESTRICTED",
    riskLevel: "MEDIUM",
    relevanceLevel: "HIGH",
    profileSummary:
      "Records clerk connected to the fatal confrontation in the Alder Street review.",
    internalNotes:
      "Initially low visibility. Became important after access and procurement records were compared.",
    aliases: ["L. Morn"],
  },
  {
    bureauId: "BL-PER-0003",
    firstName: "Daniel",
    lastName: "Reeve",
    knownLocation: "Contractor services",
    status: "CLEARED IN PRIMARY THEORY",
    personType: "DECOY_SUSPECT",
    classification: "CASE_LINKED",
    riskLevel: "LOW",
    relevanceLevel: "MEDIUM",
    profileSummary:
      "Contractor supervisor whose visible conflict made him appear suspicious early.",
    internalNotes:
      "Useful redirection subject. Not consistent with final evidence pattern.",
    aliases: [],
  },
  {
    bureauId: "BL-PER-0004",
    firstName: "Nina",
    lastName: "Vale",
    knownLocation: "Museum collections office",
    status: "ACTIVE FILE",
    personType: "PERSON_OF_INTEREST",
    classification: "RESTRICTED",
    riskLevel: "MEDIUM",
    relevanceLevel: "HIGH",
    profileSummary:
      "Collections administrator tied to the Riverglass provenance trail.",
    internalNotes:
      "Profile appears administrative until document chain is compared against access movement.",
    aliases: ["N. Vale"],
  },
  {
    bureauId: "BL-PER-0005",
    firstName: "Arin",
    lastName: "Dace",
    knownLocation: "Museum acquisitions department",
    status: "DECEASED",
    personType: "VICTIM",
    classification: "CASE_LINKED",
    riskLevel: "NONE",
    relevanceLevel: "HIGH",
    profileSummary:
      "Museum acquisitions coordinator who raised concerns about provenance paperwork.",
    internalNotes:
      "Primary victim in the Riverglass Affair.",
    aliases: [],
  },
  {
    bureauId: "BL-PER-0099",
    firstName: "Unknown",
    lastName: "Subject",
    knownLocation: "Undetermined",
    status: "UNCONFIRMED",
    personType: "UNKNOWN_PERSON",
    classification: "BLACK_LEDGER_INTERNAL",
    riskLevel: "UNKNOWN",
    relevanceLevel: "UNASSESSED",
    profileSummary:
      "Unresolved background profile reserved for future cross-case continuity.",
    internalNotes:
      "This subject is intentionally not tied to a current playable case. Used to make the bureau universe feel larger.",
    aliases: ["Subject 99", "Unidentified Associate"],
  },
];

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

async function main() {
  for (const person of people) {
    const created = await prisma.globalPerson.upsert({
      where: { bureauId: person.bureauId },
      update: {
        firstName: person.firstName,
        lastName: person.lastName,
        fullName: fullName(person.firstName, person.lastName),
        dateOfBirth: person.dateOfBirth,
        knownLocation: person.knownLocation,
        status: person.status,
        personType: person.personType,
        classification: person.classification,
        riskLevel: person.riskLevel,
        relevanceLevel: person.relevanceLevel,
        profileSummary: person.profileSummary,
        internalNotes: person.internalNotes,
      },
      create: {
        bureauId: person.bureauId,
        firstName: person.firstName,
        lastName: person.lastName,
        fullName: fullName(person.firstName, person.lastName),
        dateOfBirth: person.dateOfBirth,
        knownLocation: person.knownLocation,
        status: person.status,
        personType: person.personType,
        classification: person.classification,
        riskLevel: person.riskLevel,
        relevanceLevel: person.relevanceLevel,
        profileSummary: person.profileSummary,
        internalNotes: person.internalNotes,
      },
    });

    await prisma.personAlias.deleteMany({
      where: { globalPersonId: created.id },
    });

    for (const alias of person.aliases) {
      await prisma.personAlias.create({
        data: {
          globalPersonId: created.id,
          alias,
        },
      });
    }

    await prisma.casePerson.updateMany({
      where: {
        name: created.fullName,
      },
      data: {
        globalPersonId: created.id,
      },
    });

    console.log(`Seeded global person: ${created.bureauId} ${created.fullName}`);
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