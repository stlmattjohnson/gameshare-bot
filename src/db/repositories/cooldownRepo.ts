import { prisma } from "../prisma.js";

export const cooldownRepo = {
  async getLastPromptedAt(guildId: string, userId: string, gameId: string): Promise<Date | null> {
    const row = await prisma.promptCooldown.findUnique({
      where: { guildId_userId_gameId: { guildId, userId, gameId } }
    });
    return row?.lastPromptedAt ?? null;
  },

  async touch(guildId: string, userId: string, gameId: string, when: Date) {
    await prisma.promptCooldown.upsert({
      where: { guildId_userId_gameId: { guildId, userId, gameId } },
      update: { lastPromptedAt: when },
      create: { guildId, userId, gameId, lastPromptedAt: when }
    });
  }
};
