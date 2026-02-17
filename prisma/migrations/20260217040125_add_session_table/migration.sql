-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roleId" TEXT,
    "detailKind" TEXT,
    "detailValue" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_messageId_key" ON "Session"("messageId");

-- CreateIndex
CREATE INDEX "Session_guildId_idx" ON "Session"("guildId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
