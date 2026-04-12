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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CaseFile" ("createdAt", "difficulty", "duration", "id", "isActive", "players", "slug", "summary", "title") SELECT "createdAt", "difficulty", "duration", "id", "isActive", "players", "slug", "summary", "title" FROM "CaseFile";
DROP TABLE "CaseFile";
ALTER TABLE "new_CaseFile" RENAME TO "CaseFile";
CREATE UNIQUE INDEX "CaseFile_slug_key" ON "CaseFile"("slug");
CREATE TABLE "new_CaseHint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseFileId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "unlockStage" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseHint_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CaseHint" ("caseFileId", "content", "createdAt", "id", "level", "sortOrder", "title") SELECT "caseFileId", "content", "createdAt", "id", "level", "sortOrder", "title" FROM "CaseHint";
DROP TABLE "CaseHint";
ALTER TABLE "new_CaseHint" RENAME TO "CaseHint";
CREATE TABLE "new_CasePerson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseFileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "unlockStage" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CasePerson_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CasePerson" ("caseFileId", "createdAt", "id", "name", "role", "sortOrder", "summary") SELECT "caseFileId", "createdAt", "id", "name", "role", "sortOrder", "summary" FROM "CasePerson";
DROP TABLE "CasePerson";
ALTER TABLE "new_CasePerson" RENAME TO "CasePerson";
CREATE TABLE "new_CaseRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseFileId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "unlockStage" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseRecord_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CaseRecord" ("body", "caseFileId", "category", "createdAt", "id", "sortOrder", "summary", "title") SELECT "body", "caseFileId", "category", "createdAt", "id", "sortOrder", "summary", "title" FROM "CaseRecord";
DROP TABLE "CaseRecord";
ALTER TABLE "new_CaseRecord" RENAME TO "CaseRecord";
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
INSERT INTO "new_UserCase" ("activatedAt", "caseFileId", "id", "userId") SELECT "activatedAt", "caseFileId", "id", "userId" FROM "UserCase";
DROP TABLE "UserCase";
ALTER TABLE "new_UserCase" RENAME TO "UserCase";
CREATE UNIQUE INDEX "UserCase_userId_caseFileId_key" ON "UserCase"("userId", "caseFileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
