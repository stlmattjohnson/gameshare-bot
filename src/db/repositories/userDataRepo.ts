import { prisma } from "../prisma.js";

export const userDataRepo = {
  async upsertDetails(
    guildId: string,
    userId: string,
    patch: {
      steamId?: string | null;
      serverName?: string | null;
      serverIp?: string | null;
    },
  ) {
    await prisma.userSharedDetails.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: patch,
      create: { guildId, userId, ...patch },
    });
  },

  async deleteMyData(guildId: string, userId: string) {
    await prisma.$transaction([
      prisma.userSharedDetails.deleteMany({ where: { guildId, userId } }),
      prisma.userGameRolePref.deleteMany({ where: { guildId, userId } }),
      prisma.promptCooldown.deleteMany({ where: { guildId, userId } }),
      prisma.shareRequestState.deleteMany({ where: { guildId, userId } }),
      prisma.userOptIn.deleteMany({ where: { guildId, userId } }),
      prisma.gamePromptTimeout.deleteMany({ where: { guildId, userId } }),
      prisma.ignoredGame.deleteMany({ where: { guildId, userId } }),
      prisma.ignoredUnknownGame.deleteMany({ where: { guildId, userId } }),
    ]);
  },
};
