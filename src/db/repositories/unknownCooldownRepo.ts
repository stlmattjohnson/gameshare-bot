import { prisma } from "../prisma.js";

export const unknownCooldownRepo = {
  async getLast(guildId: string, userId: string, presenceName: string) {
    const row = await prisma.unknownGamePromptCooldown.findUnique({
      where: { guildId_userId_presenceName: { guildId, userId, presenceName } }
    });
    return row?.lastPromptedAt ?? null;
  },

  async touch(guildId: string, userId: string, presenceName: string, when: Date) {
    await prisma.unknownGamePromptCooldown.upsert({
      where: { guildId_userId_presenceName: { guildId, userId, presenceName } },
      update: { lastPromptedAt: when },
      create: { guildId, userId, presenceName, lastPromptedAt: when }
    });
  }
};
