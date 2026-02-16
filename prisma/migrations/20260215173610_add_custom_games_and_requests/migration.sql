-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN "requestChannelId" TEXT;

-- CreateTable
CREATE TABLE "CustomGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "presenceName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomGame_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameAddRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "presenceName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameAddRequest_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnknownGamePromptCooldown" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "presenceName" TEXT NOT NULL,
    "lastPromptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CustomGame_guildId_idx" ON "CustomGame"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomGame_guildId_name_key" ON "CustomGame"("guildId", "name");

-- CreateIndex
CREATE INDEX "GameAddRequest_guildId_idx" ON "GameAddRequest"("guildId");

-- CreateIndex
CREATE INDEX "GameAddRequest_guildId_status_idx" ON "GameAddRequest"("guildId", "status");

-- CreateIndex
CREATE INDEX "UnknownGamePromptCooldown_guildId_userId_idx" ON "UnknownGamePromptCooldown"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UnknownGamePromptCooldown_guildId_userId_presenceName_key" ON "UnknownGamePromptCooldown"("guildId", "userId", "presenceName");
