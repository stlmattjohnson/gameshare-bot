-- CreateTable
CREATE TABLE "PostedMessage" (
    "messageId" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PostedMessage_guildId_idx" ON "PostedMessage"("guildId");
