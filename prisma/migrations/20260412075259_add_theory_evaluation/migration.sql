/*
  Warnings:

  - You are about to drop the column `canonicalEvidenceKeywords` on the `CaseFile` table. All the data in the column will be lost.
  - You are about to drop the column `canonicalMotiveKeywords` on the `CaseFile` table. All the data in the column will be lost.
  - You are about to drop the column `canonicalSuspect` on the `CaseFile` table. All the data in the column will be lost.
  - You are about to drop the column `debriefBody` on the `CaseFile` table. All the data in the column will be lost.
  - You are about to drop the column `debriefTitle` on the `CaseFile` table. All the data in the column will be lost.
  - You are about to drop the column `evidenceScore` on the `TheorySubmission` table. All the data in the column will be lost.
  - You are about to drop the column `motiveScore` on the `TheorySubmission` table. All the data in the column will be lost.
  - You are about to drop the column `suspectScore` on the `TheorySubmission` table. All the data in the column will be lost.
  - You are about to drop the column `totalScore` on the `TheorySubmission` table. All the data in the column will be lost.
  - You are about to drop the column `isSolved` on the `UserCase` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CaseFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "players" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "maxStage" INTEGER NOT NULL DEFAULT 3,
    "solutionSuspect" TEXT NOT NULL DEFAULT '',
    "solutionMotive" TEXT NOT NULL DEFAULT '',
    "solutionEvidence" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CaseFile" ("createdAt", "difficulty", "duration", "id", "isActive", "maxStage", "players", "slug", "summary", "title") SELECT "createdAt", "difficulty", "duration", "id", "isActive", "maxStage", "players", "slug", "summary", "title" FROM "CaseFile";
DROP TABLE "CaseFile";
ALTER TABLE "new_CaseFile" RENAME TO "CaseFile";
CREATE UNIQUE INDEX "CaseFile_slug_key" ON "CaseFile"("slug");
CREATE TABLE "new_TheorySubmission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "suspectName" TEXT NOT NULL,
    "motive" TEXT NOT NULL,
    "evidenceSummary" TEXT NOT NULL,
    "suspectCorrect" BOOLEAN NOT NULL DEFAULT false,
    "motiveCorrect" BOOLEAN NOT NULL DEFAULT false,
    "evidenceCorrect" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "resultLabel" TEXT NOT NULL DEFAULT 'UNSCORED',
    "feedback" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TheorySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TheorySubmission_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TheorySubmission" ("caseFileId", "createdAt", "evidenceSummary", "feedback", "id", "motive", "resultLabel", "suspectName", "userId") SELECT "caseFileId", "createdAt", "evidenceSummary", coalesce("feedback", '') AS "feedback", "id", "motive", "resultLabel", "suspectName", "userId" FROM "TheorySubmission";
DROP TABLE "TheorySubmission";
ALTER TABLE "new_TheorySubmission" RENAME TO "TheorySubmission";
CREATE TABLE "new_UserCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "currentStage" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
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
