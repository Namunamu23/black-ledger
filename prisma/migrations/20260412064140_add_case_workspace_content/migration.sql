-- CreateTable
CREATE TABLE "CasePerson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseFileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CasePerson_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseFileId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseRecord_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseHint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseFileId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseHint_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TheorySubmission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "suspectName" TEXT NOT NULL,
    "motive" TEXT NOT NULL,
    "evidenceSummary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TheorySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TheorySubmission_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
