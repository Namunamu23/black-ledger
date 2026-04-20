-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SupportMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SupportMessage" ("createdAt", "email", "id", "message", "name") SELECT "createdAt", "email", "id", "message", "name" FROM "SupportMessage";
DROP TABLE "SupportMessage";
ALTER TABLE "new_SupportMessage" RENAME TO "SupportMessage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
