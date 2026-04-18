-- CreateTable
CREATE TABLE "GlobalPerson" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PersonAlias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "globalPersonId" INTEGER NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL DEFAULT 'KNOWN_ALIAS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonAlias_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonConnection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourcePersonId" INTEGER NOT NULL,
    "targetPersonId" INTEGER NOT NULL,
    "connectionType" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonConnection_sourcePersonId_fkey" FOREIGN KEY ("sourcePersonId") REFERENCES "GlobalPerson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonConnection_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "GlobalPerson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CasePerson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseFileId" INTEGER NOT NULL,
    "globalPersonId" INTEGER,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "unlockStage" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CasePerson_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CasePerson_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CasePerson" ("caseFileId", "createdAt", "id", "name", "role", "sortOrder", "summary", "unlockStage") SELECT "caseFileId", "createdAt", "id", "name", "role", "sortOrder", "summary", "unlockStage" FROM "CasePerson";
DROP TABLE "CasePerson";
ALTER TABLE "new_CasePerson" RENAME TO "CasePerson";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GlobalPerson_bureauId_key" ON "GlobalPerson"("bureauId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonAlias_globalPersonId_alias_key" ON "PersonAlias"("globalPersonId", "alias");
