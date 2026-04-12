-- AlterTable
ALTER TABLE "CaseFile" ADD COLUMN "canonicalEvidenceKeywords" TEXT;
ALTER TABLE "CaseFile" ADD COLUMN "canonicalMotiveKeywords" TEXT;
ALTER TABLE "CaseFile" ADD COLUMN "canonicalSuspect" TEXT;
ALTER TABLE "CaseFile" ADD COLUMN "debriefBody" TEXT;
ALTER TABLE "CaseFile" ADD COLUMN "debriefTitle" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TheorySubmission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "suspectName" TEXT NOT NULL,
    "motive" TEXT NOT NULL,
    "evidenceSummary" TEXT NOT NULL,
    "suspectScore" INTEGER NOT NULL DEFAULT 0,
    "motiveScore" INTEGER NOT NULL DEFAULT 0,
    "evidenceScore" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "resultLabel" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "feedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TheorySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TheorySubmission_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TheorySubmission" ("caseFileId", "createdAt", "evidenceSummary", "id", "motive", "suspectName", "userId") SELECT "caseFileId", "createdAt", "evidenceSummary", "id", "motive", "suspectName", "userId" FROM "TheorySubmission";
DROP TABLE "TheorySubmission";
ALTER TABLE "new_TheorySubmission" RENAME TO "TheorySubmission";
CREATE TABLE "new_UserCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "currentStage" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isSolved" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstOpenedAt" DATETIME,
    "lastViewedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "UserCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCase_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserCase" ("activatedAt", "caseFileId", "completedAt", "currentStage", "firstOpenedAt", "id", "lastViewedAt", "status", "userId") SELECT "activatedAt", "caseFileId", "completedAt", "currentStage", "firstOpenedAt", "id", "lastViewedAt", "status", "userId" FROM "UserCase";
DROP TABLE "UserCase";
ALTER TABLE "new_UserCase" RENAME TO "UserCase";
CREATE UNIQUE INDEX "UserCase_userId_caseFileId_key" ON "UserCase"("userId", "caseFileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
