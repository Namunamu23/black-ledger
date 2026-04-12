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
    "debriefOverview" TEXT NOT NULL DEFAULT '',
    "debriefWhatHappened" TEXT NOT NULL DEFAULT '',
    "debriefWhyItWorked" TEXT NOT NULL DEFAULT '',
    "debriefClosing" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CaseFile" ("createdAt", "difficulty", "duration", "id", "isActive", "maxStage", "players", "slug", "solutionEvidence", "solutionMotive", "solutionSuspect", "summary", "title") SELECT "createdAt", "difficulty", "duration", "id", "isActive", "maxStage", "players", "slug", "solutionEvidence", "solutionMotive", "solutionSuspect", "summary", "title" FROM "CaseFile";
DROP TABLE "CaseFile";
ALTER TABLE "new_CaseFile" RENAME TO "CaseFile";
CREATE UNIQUE INDEX "CaseFile_slug_key" ON "CaseFile"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
