-- CreateTable
CREATE TABLE "AccessCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "unlocksTarget" JSONB NOT NULL,
    "requiresStage" INTEGER,
    "oneTimePerUser" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessCode_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessCodeRedemption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accessCodeId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "redeemedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessCodeRedemption_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "AccessCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessCodeRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessCodeRedemption_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HiddenEvidence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseFileId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "revealOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HiddenEvidence_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessCode_code_key" ON "AccessCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCodeRedemption_accessCodeId_userId_key" ON "AccessCodeRedemption"("accessCodeId", "userId");
