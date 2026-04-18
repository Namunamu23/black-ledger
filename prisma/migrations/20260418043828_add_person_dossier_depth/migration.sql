-- CreateTable
CREATE TABLE "PersonBehavioralProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "globalPersonId" INTEGER NOT NULL,
    "behavioralRead" TEXT NOT NULL DEFAULT '',
    "observedPatterns" TEXT NOT NULL DEFAULT '',
    "stressIndicators" TEXT NOT NULL DEFAULT '',
    "communicationStyle" TEXT NOT NULL DEFAULT '',
    "socialBehavior" TEXT NOT NULL DEFAULT '',
    "conflictHistory" TEXT NOT NULL DEFAULT '',
    "motiveThreads" TEXT NOT NULL DEFAULT '',
    "escalationIndicators" TEXT NOT NULL DEFAULT '',
    "analystAssessment" TEXT NOT NULL DEFAULT '',
    "analystConfidence" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PersonBehavioralProfile_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonDigitalTrace" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "globalPersonId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonDigitalTrace_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonTimelineEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "globalPersonId" INTEGER NOT NULL,
    "dateLabel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "relatedCaseSlug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonTimelineEvent_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonEvidenceLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "globalPersonId" INTEGER NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "relatedCaseSlug" TEXT,
    "relatedCaseTitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonEvidenceLink_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonAnalystNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "globalPersonId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonAnalystNote_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GlobalPerson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bureauId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "knownLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "personType" TEXT NOT NULL DEFAULT 'PERSON_OF_INTEREST',
    "classification" TEXT NOT NULL DEFAULT 'STANDARD',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "relevanceLevel" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "profileSummary" TEXT NOT NULL DEFAULT '',
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "lastUpdatedLabel" TEXT NOT NULL DEFAULT 'Recently reviewed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "gender" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'STANDARD',
    "sourceReliability" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "confidenceLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "watchlistFlag" TEXT NOT NULL DEFAULT 'NONE'
);
INSERT INTO "new_GlobalPerson" ("bureauId", "classification", "createdAt", "dateOfBirth", "firstName", "fullName", "id", "internalNotes", "knownLocation", "lastName", "lastUpdatedLabel", "personType", "profileSummary", "relevanceLevel", "riskLevel", "status", "updatedAt") SELECT "bureauId", "classification", "createdAt", "dateOfBirth", "firstName", "fullName", "id", "internalNotes", "knownLocation", "lastName", "lastUpdatedLabel", "personType", "profileSummary", "relevanceLevel", "riskLevel", "status", "updatedAt" FROM "GlobalPerson";
DROP TABLE "GlobalPerson";
ALTER TABLE "new_GlobalPerson" RENAME TO "GlobalPerson";
CREATE UNIQUE INDEX "GlobalPerson_bureauId_key" ON "GlobalPerson"("bureauId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PersonBehavioralProfile_globalPersonId_key" ON "PersonBehavioralProfile"("globalPersonId");
