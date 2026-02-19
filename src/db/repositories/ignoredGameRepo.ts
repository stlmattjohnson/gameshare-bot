import { prisma } from "../prisma.js";

export const ignoredGameRepo = {
  async isIgnored(guildId: string, userId: string, gameId: string) {
    const row = await prisma.ignoredGame.findUnique({
      where: { guildId_userId_gameId: { guildId, userId, gameId } },
    });
    return !!row;
  },

  async ignore(guildId: string, userId: string, gameId: string) {
    await prisma.ignoredGame.upsert({
      where: { guildId_userId_gameId: { guildId, userId, gameId } },
      update: {},
      create: { guildId, userId, gameId },
    });
  },

  async clearIgnore(guildId: string, userId: string, gameId: string) {
    await prisma.ignoredGame.deleteMany({ where: { guildId, userId, gameId } });
  },

  async listIgnoredGameIds(guildId: string, userId: string): Promise<string[]> {
    const rows = await prisma.ignoredGame.findMany({
      where: { guildId, userId },
      select: { gameId: true },
    });
    return rows.map((r) => r.gameId);
  },
};
