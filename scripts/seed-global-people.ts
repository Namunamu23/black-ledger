/**
 * GlobalPerson reference-data seed.
 *
 * Source of truth for the bureau identity index that /bureau/database queries.
 * Idempotent: each identity is `upsert`-ed by its unique bureauId, and every
 * destructive operation (per-person sub-tables, person-to-person connections)
 * is scoped to people defined in this seed. Re-running converges the database
 * to whatever this file declares without leaking duplicates and without
 * touching connections involving people added outside the seed.
 *
 * Safety gate: requires explicit opt-in via BL_ALLOW_GLOBAL_PEOPLE_SEED=true.
 * This replaces the older URL-pattern `assertSafeEnv` block — too blunt to
 * allow legitimate production seeding even though the script's writes are
 * fully scoped.
 *
 * Usage:
 *
 *     BL_ALLOW_GLOBAL_PEOPLE_SEED=true npm run seed:people
 */

import dotenv from "dotenv";
import { prisma } from "../lib/prisma";

dotenv.config({ path: ".env.local" });
dotenv.config();

const ALLOW_FLAG = "BL_ALLOW_GLOBAL_PEOPLE_SEED";

if (!process.env[ALLOW_FLAG]) {
  console.error(
    "\n  Refusing to run without explicit opt-in.\n\n" +
    "  This script seeds the GlobalPerson bureau identity index used by\n" +
    "  /bureau/database. It is idempotent and safe to run against any\n" +
    "  environment, but the explicit flag prevents accidental invocation.\n\n" +
    `  Set ${ALLOW_FLAG}=true and re-run:\n\n` +
    `    ${ALLOW_FLAG}=true npm run seed:people\n`
  );
  process.exit(1);
}

type RichPersonSeed = {
  bureauId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  knownLocation?: string;
  status: string;
  personType: string;
  classification: string;
  riskLevel: string;
  relevanceLevel: string;
  accessLevel: string;
  sourceReliability: string;
  confidenceLevel: string;
  watchlistFlag: string;
  profileSummary: string;
  internalNotes: string;
  aliases: string[];
  behavioralProfile: {
    behavioralRead: string;
    observedPatterns: string;
    stressIndicators: string;
    communicationStyle: string;
    socialBehavior: string;
    conflictHistory: string;
    motiveThreads: string;
    escalationIndicators: string;
    analystAssessment: string;
    analystConfidence: string;
  };
  digitalTraces: {
    category: string;
    label: string;
    value: string;
    confidence: string;
    notes: string;
    sortOrder: number;
  }[];
  timelineEvents: {
    dateLabel: string;
    category: string;
    title: string;
    summary: string;
    confidence: string;
    relatedCaseSlug?: string;
    sortOrder: number;
  }[];
  evidenceLinks: {
    evidenceType: string;
    title: string;
    summary: string;
    confidence: string;
    relatedCaseSlug?: string;
    relatedCaseTitle?: string;
    sortOrder: number;
  }[];
  analystNotes: {
    category: string;
    title: string;
    content: string;
    severity: string;
    visibility: string;
    sortOrder: number;
  }[];
};

const people: RichPersonSeed[] = [
  {
    bureauId: "BL-PER-0001",
    firstName: "Elena",
    lastName: "Voss",
    dateOfBirth: "1981-04-17",
    gender: "Female",
    knownLocation: "Municipal district office",
    status: "DECEASED",
    personType: "VICTIM",
    classification: "CASE_LINKED",
    riskLevel: "NONE",
    relevanceLevel: "HIGH",
    accessLevel: "INVESTIGATOR",
    sourceReliability: "HIGH",
    confidenceLevel: "HIGH",
    watchlistFlag: "VICTIM FILE",
    profileSummary:
      "Senior compliance investigator whose internal review placed her near a concealed certification trail before her death.",
    internalNotes:
      "Primary victim in the Alder Street review. Her professional activity created the motive structure. Do not treat the original robbery narrative as reliable without comparing access logs and procurement documentation.",
    aliases: [],
    behavioralProfile: {
      behavioralRead:
        "Organized, procedure-driven, and unusually persistent once inconsistencies appeared in department records.",
      observedPatterns:
        "Repeated escalation through formal channels. Avoided informal confrontation until documentation was secured.",
      stressIndicators:
        "Increased after-hours access, repeated print/export behavior, and unsent draft correspondence in the days before death.",
      communicationStyle:
        "Direct, document-heavy, and careful with written claims. Preferred evidence references over personal accusations.",
      socialBehavior:
        "Limited workplace social circle. Maintained professional distance from subjects under review.",
      conflictHistory:
        "Documented friction with contractor-facing staff and internal records personnel.",
      motiveThreads:
        "Her review threatened to expose certification irregularities and internal approval patterns.",
      escalationIndicators:
        "Moved from quiet document review to preparing a formal disclosure package.",
      analystAssessment:
        "Victim profile supports a work-related motive. Her actions likely forced the responsible party to act before the record trail became public.",
      analystConfidence: "HIGH",
    },
    digitalTraces: [
      {
        category: "EMAIL_FRAGMENT",
        label: "Draft disclosure thread",
        value: "e.voss / compliance-review / redacted",
        confidence: "HIGH",
        notes: "Unsent draft references certification irregularities.",
        sortOrder: 1,
      },
      {
        category: "DEVICE_ACTIVITY",
        label: "After-hours workstation access",
        value: "Municipal terminal access window / 21:40–22:16",
        confidence: "MEDIUM",
        notes: "Activity aligns with final week review pattern.",
        sortOrder: 2,
      },
    ],
    timelineEvents: [
      {
        dateLabel: "T-09 days",
        category: "DOCUMENT REVIEW",
        title: "Certification chain flagged",
        summary:
          "Elena marks repeated approval patterns in municipal certification records.",
        confidence: "HIGH",
        relatedCaseSlug: "alder-street-review",
        sortOrder: 1,
      },
      {
        dateLabel: "T-01 day",
        category: "LAST MOVEMENT",
        title: "Final known work activity",
        summary:
          "Late activity appears tied to export preparation and access-log comparison.",
        confidence: "MEDIUM",
        relatedCaseSlug: "alder-street-review",
        sortOrder: 2,
      },
    ],
    evidenceLinks: [
      {
        evidenceType: "DOCUMENT",
        title: "Procurement Spreadsheet Extract",
        summary:
          "Supports the theory that Elena identified a repeating approval trail.",
        confidence: "HIGH",
        relatedCaseSlug: "alder-street-review",
        relatedCaseTitle: "The Alder Street Review",
        sortOrder: 1,
      },
      {
        evidenceType: "ACCESS LOG",
        title: "Badge Access Log",
        summary:
          "Creates contradiction between official movement assumptions and internal access records.",
        confidence: "HIGH",
        relatedCaseSlug: "alder-street-review",
        relatedCaseTitle: "The Alder Street Review",
        sortOrder: 2,
      },
    ],
    analystNotes: [
      {
        category: "FOLLOW_UP_REQUIRED",
        title: "Original scene framing requires caution",
        content:
          "The missing phone created a convenient robbery theory, but the work-related records provide a stronger motive path.",
        severity: "HIGH",
        visibility: "INTERNAL",
        sortOrder: 1,
      },
    ],
  },
  {
    bureauId: "BL-PER-0002",
    firstName: "Leah",
    lastName: "Morn",
    dateOfBirth: "1990-11-03",
    gender: "Female",
    knownLocation: "Records office network",
    status: "ACTIVE FILE",
    personType: "PERSON_OF_INTEREST",
    classification: "RESTRICTED",
    riskLevel: "MEDIUM",
    relevanceLevel: "HIGH",
    accessLevel: "RESTRICTED REVIEW",
    sourceReliability: "MEDIUM-HIGH",
    confidenceLevel: "HIGH",
    watchlistFlag: "CASE RESOLUTION SUBJECT",
    profileSummary:
      "Records clerk whose low-visibility administrative position masked a direct connection to the Alder Street fatal confrontation.",
    internalNotes:
      "Initially appeared peripheral. Became a high-priority profile after badge access and procurement records were compared. Behavioral read suggests concealment pressure rather than spontaneous escalation.",
    aliases: ["L. Morn", "LM-Records"],
    behavioralProfile: {
      behavioralRead:
        "Low-visibility operator with strong procedural awareness. Avoids direct confrontation when a document trail can be controlled.",
      observedPatterns:
        "Appears in administrative gaps, access anomalies, and quiet record-handling events rather than overt conflict.",
      stressIndicators:
        "Inconsistent presence near record correction windows. Increased indirect contact with affected files.",
      communicationStyle:
        "Brief, procedural, and deflective. Uses office process language to avoid substantive questions.",
      socialBehavior:
        "Limited visible conflict history. Maintains working familiarity with multiple departments without drawing attention.",
      conflictHistory:
        "No loud documented conflict with Elena, which is exactly why the profile was underweighted in the original review.",
      motiveThreads:
        "Possible exposure through certification fraud trail and record-handling inconsistencies.",
      escalationIndicators:
        "Movement pattern becomes more relevant only after access logs are compared to witness timing.",
      analystAssessment:
        "High-value subject profile. The absence of obvious motive was part of the concealment advantage.",
      analystConfidence: "HIGH",
    },
    digitalTraces: [
      {
        category: "LOGIN_ANOMALY",
        label: "Records terminal overlap",
        value: "LM account session / time window redacted",
        confidence: "MEDIUM",
        notes:
          "Session proximity overlaps with internal record correction activity.",
        sortOrder: 1,
      },
      {
        category: "ALIAS_MARKER",
        label: "Internal shorthand",
        value: "LM-Records",
        confidence: "LOW",
        notes: "Appears in informal routing notes.",
        sortOrder: 2,
      },
    ],
    timelineEvents: [
      {
        dateLabel: "T-06 days",
        category: "DOCUMENT CONTACT",
        title: "Records access near flagged approval chain",
        summary:
          "Administrative activity appears near files Elena had recently reviewed.",
        confidence: "MEDIUM",
        relatedCaseSlug: "alder-street-review",
        sortOrder: 1,
      },
      {
        dateLabel: "T-00",
        category: "CASE TURNING POINT",
        title: "Overlooked profile becomes central",
        summary:
          "Subject becomes significant once access data and procurement documents are read together.",
        confidence: "HIGH",
        relatedCaseSlug: "alder-street-review",
        sortOrder: 2,
      },
    ],
    evidenceLinks: [
      {
        evidenceType: "ACCESS LOG",
        title: "Badge Access Log",
        summary:
          "Timeline evidence elevates Leah from background staff to relevant subject.",
        confidence: "HIGH",
        relatedCaseSlug: "alder-street-review",
        relatedCaseTitle: "The Alder Street Review",
        sortOrder: 1,
      },
      {
        evidenceType: "INTERNAL RECORD",
        title: "Procurement Spreadsheet Extract",
        summary:
          "Document trail provides motive context for concealment and confrontation.",
        confidence: "HIGH",
        relatedCaseSlug: "alder-street-review",
        relatedCaseTitle: "The Alder Street Review",
        sortOrder: 2,
      },
    ],
    analystNotes: [
      {
        category: "CONTRADICTION",
        title: "Low-conflict profile misled original review",
        content:
          "The original case favored visible conflict. This subject's relevance depends on document position, not public hostility.",
        severity: "HIGH",
        visibility: "INTERNAL",
        sortOrder: 1,
      },
      {
        category: "FOLLOW_UP_REQUIRED",
        title: "Compare all administrative correction windows",
        content:
          "Future related cases should flag quiet document custodians earlier in the review process.",
        severity: "MEDIUM",
        visibility: "INTERNAL",
        sortOrder: 2,
      },
    ],
  },
  {
    bureauId: "BL-PER-0003",
    firstName: "Daniel",
    lastName: "Reeve",
    dateOfBirth: "1978-09-21",
    gender: "Male",
    knownLocation: "Contractor services",
    status: "CLEARED IN PRIMARY THEORY",
    personType: "DECOY_SUSPECT",
    classification: "CASE_LINKED",
    riskLevel: "LOW",
    relevanceLevel: "MEDIUM",
    accessLevel: "STANDARD",
    sourceReliability: "MEDIUM",
    confidenceLevel: "MEDIUM",
    watchlistFlag: "MISDIRECTION PROFILE",
    profileSummary:
      "Contractor supervisor whose visible conflict with Elena made him appear suspicious early in the Alder Street review.",
    internalNotes:
      "Useful pressure subject but not consistent with final evidence pattern. Retain as example of visible conflict bias.",
    aliases: [],
    behavioralProfile: {
      behavioralRead:
        "Externally reactive and easy to frame as hostile, but profile lacks document-control leverage.",
      observedPatterns:
        "Visible frustration, direct argument style, poor optics under witness review.",
      stressIndicators:
        "Defensive in statements when contractor delays were mentioned.",
      communicationStyle:
        "Blunt and reactive. Does not appear skilled at procedural concealment.",
      socialBehavior:
        "Known to escalate verbally during workplace disputes.",
      conflictHistory:
        "Documented argument with Elena increased suspicion early.",
      motiveThreads:
        "Possible embarrassment and contractor pressure, but weaker than the internal record motive.",
      escalationIndicators:
        "No evidence of access or document manipulation matching the final theory.",
      analystAssessment:
        "High-noise, low-resolution suspect. Useful as redirection but not final answer.",
      analystConfidence: "MEDIUM",
    },
    digitalTraces: [
      {
        category: "PHONE_FRAGMENT",
        label: "Contractor contact window",
        value: "ending / 44 / redacted",
        confidence: "LOW",
        notes: "Associated with routine scheduling, not concealment.",
        sortOrder: 1,
      },
    ],
    timelineEvents: [
      {
        dateLabel: "T-03 days",
        category: "VISIBLE CONFLICT",
        title: "Argument reported",
        summary:
          "Witnesses recall tension between Daniel and Elena, making him an early focus.",
        confidence: "MEDIUM",
        relatedCaseSlug: "alder-street-review",
        sortOrder: 1,
      },
    ],
    evidenceLinks: [
      {
        evidenceType: "WITNESS STATEMENT",
        title: "Garage Attendant Statement",
        summary:
          "Supports visible tension, but does not provide enough evidence for final resolution.",
        confidence: "MEDIUM",
        relatedCaseSlug: "alder-street-review",
        relatedCaseTitle: "The Alder Street Review",
        sortOrder: 1,
      },
    ],
    analystNotes: [
      {
        category: "ANALYST_WARNING",
        title: "Visible conflict bias",
        content:
          "This profile demonstrates why obvious hostility should not outweigh access and document evidence.",
        severity: "MEDIUM",
        visibility: "INTERNAL",
        sortOrder: 1,
      },
    ],
  },
  {
    bureauId: "BL-PER-0004",
    firstName: "Nina",
    lastName: "Vale",
    dateOfBirth: "1987-01-12",
    gender: "Female",
    knownLocation: "Museum collections office",
    status: "ACTIVE FILE",
    personType: "PERSON_OF_INTEREST",
    classification: "RESTRICTED",
    riskLevel: "MEDIUM",
    relevanceLevel: "HIGH",
    accessLevel: "RESTRICTED REVIEW",
    sourceReliability: "MEDIUM-HIGH",
    confidenceLevel: "HIGH",
    watchlistFlag: "DOCUMENT CHAIN SUBJECT",
    profileSummary:
      "Collections administrator tied to the Riverglass provenance trail and documentation inconsistencies.",
    internalNotes:
      "Profile appears procedural until the restoration invoice and storage-room key log are compared. Similar pattern to low-visibility administrative subjects in other files.",
    aliases: ["N. Vale", "NV Collections"],
    behavioralProfile: {
      behavioralRead:
        "Administrative control profile. Maintains distance from visible conflict while remaining close to document flow.",
      observedPatterns:
        "Appears around correction, routing, and custody ambiguity rather than direct confrontation.",
      stressIndicators:
        "Increased presence around restoration documentation after provenance concerns escalated.",
      communicationStyle:
        "Measured, formal, and process-focused. Avoids unnecessary detail.",
      socialBehavior:
        "Trusted procedural role inside the museum environment.",
      conflictHistory:
        "No strong public conflict, but document trail creates motive pressure.",
      motiveThreads:
        "Potential exposure through forged provenance paperwork.",
      escalationIndicators:
        "Key log and invoice mismatches become relevant together.",
      analystAssessment:
        "High-priority Riverglass subject. Administrative role created both access and plausible invisibility.",
      analystConfidence: "HIGH",
    },
    digitalTraces: [
      {
        category: "DOCUMENT_METADATA",
        label: "Restoration invoice routing",
        value: "collection-admin / routing chain redacted",
        confidence: "MEDIUM",
        notes: "Metadata aligns with disputed handling sequence.",
        sortOrder: 1,
      },
      {
        category: "ONLINE_ALIAS",
        label: "Collections shorthand",
        value: "NV Collections",
        confidence: "LOW",
        notes: "Appears in internal label fragments.",
        sortOrder: 2,
      },
    ],
    timelineEvents: [
      {
        dateLabel: "T-08 days",
        category: "PROVENANCE REVIEW",
        title: "Forgery concern escalates",
        summary:
          "Arin Dace pushes concerns about documentation tied to a donor-backed exhibit.",
        confidence: "HIGH",
        relatedCaseSlug: "riverglass-affair",
        sortOrder: 1,
      },
      {
        dateLabel: "T-02 days",
        category: "ACCESS ANOMALY",
        title: "Storage key movement flagged",
        summary:
          "Key log activity increases relevance of the collections administrator profile.",
        confidence: "MEDIUM",
        relatedCaseSlug: "riverglass-affair",
        sortOrder: 2,
      },
    ],
    evidenceLinks: [
      {
        evidenceType: "ACCESS LOG",
        title: "Storage Room Key Log",
        summary:
          "Weakens the official restoration movement timeline.",
        confidence: "HIGH",
        relatedCaseSlug: "riverglass-affair",
        relatedCaseTitle: "The Riverglass Affair",
        sortOrder: 1,
      },
      {
        evidenceType: "INVOICE",
        title: "Restoration Invoice",
        summary:
          "Provides the document bridge between provenance risk and internal access.",
        confidence: "HIGH",
        relatedCaseSlug: "riverglass-affair",
        relatedCaseTitle: "The Riverglass Affair",
        sortOrder: 2,
      },
    ],
    analystNotes: [
      {
        category: "PATTERN_MATCH",
        title: "Low-visibility administrative pattern",
        content:
          "Profile resembles other Black Ledger subjects whose risk appears only after document-chain reconstruction.",
        severity: "HIGH",
        visibility: "INTERNAL",
        sortOrder: 1,
      },
    ],
  },
  {
    bureauId: "BL-PER-0005",
    firstName: "Arin",
    lastName: "Dace",
    dateOfBirth: "1984-06-02",
    gender: "Male",
    knownLocation: "Museum acquisitions department",
    status: "DECEASED",
    personType: "VICTIM",
    classification: "CASE_LINKED",
    riskLevel: "NONE",
    relevanceLevel: "HIGH",
    accessLevel: "INVESTIGATOR",
    sourceReliability: "HIGH",
    confidenceLevel: "HIGH",
    watchlistFlag: "VICTIM FILE",
    profileSummary:
      "Museum acquisitions coordinator who raised concerns about forged provenance paperwork before his death.",
    internalNotes:
      "Primary victim in the Riverglass Affair. His document review created exposure risk for multiple museum-side profiles.",
    aliases: [],
    behavioralProfile: {
      behavioralRead:
        "Detail-oriented acquisitions professional with a strong paper-trail focus.",
      observedPatterns:
        "Repeatedly checked provenance history against restoration handling and donor communications.",
      stressIndicators:
        "Increased private notes and delayed response windows before death.",
      communicationStyle:
        "Careful, formal, and evidence-oriented.",
      socialBehavior:
        "Maintained cordial professional contact but became more guarded near the end of the review window.",
      conflictHistory:
        "Tension connected to exhibit pressure and donor timeline.",
      motiveThreads:
        "Disclosure of forged provenance threatened reputation, money, and institutional relationships.",
      escalationIndicators:
        "Moved from concern to formal challenge of provenance documentation.",
      analystAssessment:
        "Victim profile supports motive based on document exposure rather than personal dispute alone.",
      analystConfidence: "HIGH",
    },
    digitalTraces: [
      {
        category: "EMAIL_FRAGMENT",
        label: "Provenance concern draft",
        value: "a.dace / provenance-review / redacted",
        confidence: "HIGH",
        notes: "References contradiction in object history.",
        sortOrder: 1,
      },
    ],
    timelineEvents: [
      {
        dateLabel: "T-10 days",
        category: "DOCUMENT REVIEW",
        title: "Provenance issue identified",
        summary:
          "Arin identifies inconsistencies in exhibit provenance paperwork.",
        confidence: "HIGH",
        relatedCaseSlug: "riverglass-affair",
        sortOrder: 1,
      },
    ],
    evidenceLinks: [
      {
        evidenceType: "INVOICE",
        title: "Restoration Invoice",
        summary:
          "Ties Arin's concerns to the handling chain under review.",
        confidence: "HIGH",
        relatedCaseSlug: "riverglass-affair",
        relatedCaseTitle: "The Riverglass Affair",
        sortOrder: 1,
      },
    ],
    analystNotes: [
      {
        category: "FOLLOW_UP_REQUIRED",
        title: "Donor pressure angle remains incomplete",
        content:
          "Victim's document trail is strong, but institutional pressure should remain indexed for future case continuity.",
        severity: "MEDIUM",
        visibility: "INTERNAL",
        sortOrder: 1,
      },
    ],
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
    accessLevel: "INTERNAL ONLY",
    sourceReliability: "LOW",
    confidenceLevel: "LOW",
    watchlistFlag: "CONTINUITY MARKER",
    profileSummary:
      "Unresolved background profile reserved for future cross-case continuity and unknown-subject references.",
    internalNotes:
      "This subject is intentionally not tied to a current playable case. Maintain as a continuity marker to make the bureau universe feel wider than the active catalog.",
    aliases: ["Subject 99", "Unidentified Associate", "Archive Shadow"],
    behavioralProfile: {
      behavioralRead:
        "Insufficient behavioral data. Existing markers suggest indirect presence rather than confirmed participation.",
      observedPatterns:
        "Appears only through secondary references and unresolved trace fragments.",
      stressIndicators:
        "Unknown.",
      communicationStyle:
        "Unknown.",
      socialBehavior:
        "Unknown.",
      conflictHistory:
        "No confirmed conflict history.",
      motiveThreads:
        "No confirmed motive. Possible continuity relevance only.",
      escalationIndicators:
        "No confirmed escalation pattern.",
      analystAssessment:
        "Retain in database as unresolved cross-case infrastructure. Do not over-prioritize without a direct evidence link.",
      analystConfidence: "LOW",
    },
    digitalTraces: [
      {
        category: "METADATA_FLAG",
        label: "Unresolved archive reference",
        value: "BL-shadow-ref / redacted",
        confidence: "LOW",
        notes: "Not enough context for case-level use.",
        sortOrder: 1,
      },
    ],
    timelineEvents: [
      {
        dateLabel: "Unknown",
        category: "UNRESOLVED",
        title: "Profile created from continuity fragment",
        summary:
          "The subject exists as a placeholder for future linked-case intelligence.",
        confidence: "LOW",
        sortOrder: 1,
      },
    ],
    evidenceLinks: [
      {
        evidenceType: "SEALED REFERENCE",
        title: "Unresolved Archive Marker",
        summary:
          "No current playable evidence confirms the subject's role.",
        confidence: "LOW",
        sortOrder: 1,
      },
    ],
    analystNotes: [
      {
        category: "SEALED_OR_RESTRICTED",
        title: "Future continuity profile",
        content:
          "Keep visible in the global database to reinforce that the Black Ledger universe is broader than owned cases.",
        severity: "LOW",
        visibility: "INTERNAL",
        sortOrder: 1,
      },
    ],
  },
];

const connections = [
  {
    sourceBureauId: "BL-PER-0002",
    targetBureauId: "BL-PER-0001",
    connectionType: "SUBJECT_TO_VICTIM",
    summary:
      "Leah Morn's relevance increases after Elena Voss's record trail is reconstructed.",
    visibility: "STANDARD",
  },
  {
    sourceBureauId: "BL-PER-0003",
    targetBureauId: "BL-PER-0001",
    connectionType: "VISIBLE_CONFLICT",
    summary:
      "Daniel Reeve had visible workplace tension with Elena, creating early investigative noise.",
    visibility: "STANDARD",
  },
  {
    sourceBureauId: "BL-PER-0004",
    targetBureauId: "BL-PER-0005",
    connectionType: "DOCUMENT_CHAIN_EXPOSURE",
    summary:
      "Nina Vale's profile becomes relevant through document-chain pressure around Arin Dace's provenance concerns.",
    visibility: "STANDARD",
  },
  {
    sourceBureauId: "BL-PER-0099",
    targetBureauId: "BL-PER-0002",
    connectionType: "UNRESOLVED_ARCHIVE_PROXIMITY",
    summary:
      "Unconfirmed continuity marker. No direct case-level conclusion should be drawn yet.",
    visibility: "INTERNAL",
  },
];

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

async function main() {
  const peopleByBureauId = new Map<string, number>();

  for (const person of people) {
    const created = await prisma.globalPerson.upsert({
      where: { bureauId: person.bureauId },
      update: {
        firstName: person.firstName,
        lastName: person.lastName,
        fullName: fullName(person.firstName, person.lastName),
        dateOfBirth: person.dateOfBirth,
        gender: person.gender,
        knownLocation: person.knownLocation,
        status: person.status,
        personType: person.personType,
        classification: person.classification,
        riskLevel: person.riskLevel,
        relevanceLevel: person.relevanceLevel,
        accessLevel: person.accessLevel,
        sourceReliability: person.sourceReliability,
        confidenceLevel: person.confidenceLevel,
        watchlistFlag: person.watchlistFlag,
        profileSummary: person.profileSummary,
        internalNotes: person.internalNotes,
      },
      create: {
        bureauId: person.bureauId,
        firstName: person.firstName,
        lastName: person.lastName,
        fullName: fullName(person.firstName, person.lastName),
        dateOfBirth: person.dateOfBirth,
        gender: person.gender,
        knownLocation: person.knownLocation,
        status: person.status,
        personType: person.personType,
        classification: person.classification,
        riskLevel: person.riskLevel,
        relevanceLevel: person.relevanceLevel,
        accessLevel: person.accessLevel,
        sourceReliability: person.sourceReliability,
        confidenceLevel: person.confidenceLevel,
        watchlistFlag: person.watchlistFlag,
        profileSummary: person.profileSummary,
        internalNotes: person.internalNotes,
      },
    });

    peopleByBureauId.set(person.bureauId, created.id);

    await prisma.personAlias.deleteMany({
      where: { globalPersonId: created.id },
    });
    await prisma.personBehavioralProfile.deleteMany({
      where: { globalPersonId: created.id },
    });
    await prisma.personDigitalTrace.deleteMany({
      where: { globalPersonId: created.id },
    });
    await prisma.personTimelineEvent.deleteMany({
      where: { globalPersonId: created.id },
    });
    await prisma.personEvidenceLink.deleteMany({
      where: { globalPersonId: created.id },
    });
    await prisma.personAnalystNote.deleteMany({
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

    await prisma.personBehavioralProfile.create({
      data: {
        globalPersonId: created.id,
        ...person.behavioralProfile,
      },
    });

    await prisma.personDigitalTrace.createMany({
      data: person.digitalTraces.map((trace) => ({
        globalPersonId: created.id,
        ...trace,
      })),
    });

    await prisma.personTimelineEvent.createMany({
      data: person.timelineEvents.map((event) => ({
        globalPersonId: created.id,
        ...event,
      })),
    });

    await prisma.personEvidenceLink.createMany({
      data: person.evidenceLinks.map((link) => ({
        globalPersonId: created.id,
        ...link,
      })),
    });

    await prisma.personAnalystNote.createMany({
      data: person.analystNotes.map((note) => ({
        globalPersonId: created.id,
        ...note,
      })),
    });

    await prisma.casePerson.updateMany({
      where: {
        name: created.fullName,
      },
      data: {
        globalPersonId: created.id,
      },
    });

    console.log(`Seeded global person dossier: ${created.bureauId} ${created.fullName}`);
  }

  // Scoped delete: only wipe connections involving a person we are about
  // to seed. Connections between two non-seeded people (e.g. ones an admin
  // added manually) are preserved. This is what makes the script safe to
  // re-run against production without nuking unrelated data.
  const seededPersonIds = Array.from(peopleByBureauId.values());
  if (seededPersonIds.length > 0) {
    await prisma.personConnection.deleteMany({
      where: {
        OR: [
          { sourcePersonId: { in: seededPersonIds } },
          { targetPersonId: { in: seededPersonIds } },
        ],
      },
    });
  }

  for (const connection of connections) {
    const sourcePersonId = peopleByBureauId.get(connection.sourceBureauId);
    const targetPersonId = peopleByBureauId.get(connection.targetBureauId);

    if (!sourcePersonId || !targetPersonId) {
      continue;
    }

    await prisma.personConnection.create({
      data: {
        sourcePersonId,
        targetPersonId,
        connectionType: connection.connectionType,
        summary: connection.summary,
        visibility: connection.visibility,
      },
    });
  }

  console.log("Global people dossier seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });