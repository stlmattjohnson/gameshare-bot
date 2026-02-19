-- CreateTable
CREATE TABLE "GamePromptTimeout" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "until" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "GamePromptTimeout_guildId_userId_idx" ON "GamePromptTimeout"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GamePromptTimeout_guildId_userId_gameId_key" ON "GamePromptTimeout"("guildId", "userId", "gameId");
