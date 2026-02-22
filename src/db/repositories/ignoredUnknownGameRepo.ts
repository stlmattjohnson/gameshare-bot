import { prisma } from "../prisma.js";

export const ignoredUnknownGameRepo = {
  async isIgnored(guildId: string, userId: string, presenceName: string) {
    const row = await prisma.ignoredUnknownGame.findUnique({
      where: {
        guildId_userId_presenceName: { guildId, userId, presenceName },
      },
    });
    return !!row;
  },

  async ignore(guildId: string, userId: string, presenceName: string) {
    await prisma.ignoredUnknownGame.upsert({
      where: {
        guildId_userId_presenceName: { guildId, userId, presenceName },
      },
      update: {},
      create: { guildId, userId, presenceName },
    });
  },

  async clearIgnore(guildId: string, userId: string, presenceName: string) {
    await prisma.ignoredUnknownGame.deleteMany({
      where: { guildId, userId, presenceName },
    });
  },

  async listIgnoredGameIds(guildId: string, userId: string): Promise<string[]> {
    const rows = await prisma.ignoredUnknownGame.findMany({
      where: { guildId, userId },
      select: { presenceName: true },
    });
    return rows.map((r) => r.presenceName);
  },
};
