-- CreateTable
CREATE TABLE "GuildConfig" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "announceChannelId" TEXT,
    "deleteDisabledRoles" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EnabledGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnabledGame_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameRoleMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameRoleMapping_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserOptIn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optedIn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserGameRolePref" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PromptCooldown" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "lastPromptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShareRequestState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserSharedDetails" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "steamId" TEXT,
    "serverName" TEXT,
    "serverIp" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "EnabledGame_guildId_idx" ON "EnabledGame"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "EnabledGame_guildId_gameId_key" ON "EnabledGame"("guildId", "gameId");

-- CreateIndex
CREATE INDEX "GameRoleMapping_guildId_idx" ON "GameRoleMapping"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GameRoleMapping_guildId_gameId_key" ON "GameRoleMapping"("guildId", "gameId");

-- CreateIndex
CREATE INDEX "UserOptIn_guildId_idx" ON "UserOptIn"("guildId");

-- CreateIndex
CREATE INDEX "UserOptIn_userId_idx" ON "UserOptIn"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOptIn_guildId_userId_key" ON "UserOptIn"("guildId", "userId");

-- CreateIndex
CREATE INDEX "UserGameRolePref_guildId_userId_idx" ON "UserGameRolePref"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameRolePref_guildId_userId_gameId_key" ON "UserGameRolePref"("guildId", "userId", "gameId");

-- CreateIndex
CREATE INDEX "PromptCooldown_guildId_userId_idx" ON "PromptCooldown"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptCooldown_guildId_userId_gameId_key" ON "PromptCooldown"("guildId", "userId", "gameId");

-- CreateIndex
CREATE INDEX "ShareRequestState_guildId_userId_idx" ON "ShareRequestState"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareRequestState_guildId_userId_gameId_key" ON "ShareRequestState"("guildId", "userId", "gameId");

-- CreateIndex
CREATE INDEX "UserSharedDetails_guildId_userId_idx" ON "UserSharedDetails"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSharedDetails_guildId_userId_key" ON "UserSharedDetails"("guildId", "userId");
