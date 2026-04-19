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
    "suspectCorrect" BOOLEAN NOT NULL DEFAULT false,
    "motiveCorrect" BOOLEAN NOT NULL DEFAULT false,
    "evidenceCorrect" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "resultLabel" TEXT NOT NULL,
    "feedback" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TheorySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TheorySubmission_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TheorySubmission" ("caseFileId", "createdAt", "evidenceCorrect", "evidenceSummary", "feedback", "id", "motive", "motiveCorrect", "resultLabel", "score", "suspectCorrect", "suspectName", "userId") SELECT "caseFileId", "createdAt", "evidenceCorrect", "evidenceSummary", "feedback", "id", "motive", "motiveCorrect", "resultLabel", "score", "suspectCorrect", "suspectName", "userId" FROM "TheorySubmission";
DROP TABLE "TheorySubmission";
ALTER TABLE "new_TheorySubmission" RENAME TO "TheorySubmission";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
