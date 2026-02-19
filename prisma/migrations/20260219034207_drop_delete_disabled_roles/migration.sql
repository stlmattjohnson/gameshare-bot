/*
  Warnings:

  - You are about to drop the column `deleteDisabledRoles` on the `GuildConfig` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GuildConfig" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "announceChannelId" TEXT,
    "requestChannelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_GuildConfig" ("announceChannelId", "createdAt", "guildId", "requestChannelId", "updatedAt") SELECT "announceChannelId", "createdAt", "guildId", "requestChannelId", "updatedAt" FROM "GuildConfig";
DROP TABLE "GuildConfig";
ALTER TABLE "new_GuildConfig" RENAME TO "GuildConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
