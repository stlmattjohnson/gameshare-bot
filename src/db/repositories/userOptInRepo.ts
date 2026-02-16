import { prisma } from "../prisma.js";

export const userOptInRepo = {
  async setOptIn(guildId: string, userId: string, optedIn: boolean) {
    await prisma.userOptIn.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: { optedIn },
      create: { guildId, userId, optedIn },
    });
  },

  async isOptedIn(guildId: string, userId: string): Promise<boolean> {
    const row = await prisma.userOptIn.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    return row?.optedIn ?? false;
  },
};
