-- CreateTable
CREATE TABLE "IgnoredGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IgnoredUnknownGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "presenceName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "IgnoredGame_guildId_userId_idx" ON "IgnoredGame"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "IgnoredGame_guildId_userId_gameId_key" ON "IgnoredGame"("guildId", "userId", "gameId");

-- CreateIndex
CREATE INDEX "IgnoredUnknownGame_guildId_userId_idx" ON "IgnoredUnknownGame"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "IgnoredUnknownGame_guildId_userId_presenceName_key" ON "IgnoredUnknownGame"("guildId", "userId", "presenceName");
