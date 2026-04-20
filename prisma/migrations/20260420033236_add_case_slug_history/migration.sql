-- CreateTable
CREATE TABLE "CaseSlugHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseFileId" INTEGER NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseSlugHistory_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseSlugHistory_oldSlug_key" ON "CaseSlugHistory"("oldSlug");
