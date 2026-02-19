import { prisma } from "../prisma.js";

export const gamePromptTimeoutRepo = {
  async get(guildId: string, userId: string, gameId: string) {
    return prisma.gamePromptTimeout.findUnique({
      where: { guildId_userId_gameId: { guildId, userId, gameId } },
    });
  },

  async upsert(guildId: string, userId: string, gameId: string, until: Date) {
    return prisma.gamePromptTimeout.upsert({
      where: { guildId_userId_gameId: { guildId, userId, gameId } },
      update: { until },
      create: { guildId, userId, gameId, until },
    });
  },

  async clearForUser(guildId: string, userId: string) {
    await prisma.gamePromptTimeout.deleteMany({
      where: { guildId, userId },
    });
  },
};
