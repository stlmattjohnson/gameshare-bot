import { prisma } from "../prisma.js";

export const userGameRolePrefRepo = {
  async listSelectedGameIds(
    guildId: string,
    userId: string,
  ): Promise<string[]> {
    const rows = await prisma.userGameRolePref.findMany({
      where: { guildId, userId },
    });
    return rows.map((r) => r.gameId);
  },

  async setSelectedGameIds(guildId: string, userId: string, gameIds: string[]) {
    await prisma.$transaction([
      prisma.userGameRolePref.deleteMany({ where: { guildId, userId } }),
      prisma.userGameRolePref.createMany({
        data: gameIds.map((gameId) => ({ guildId, userId, gameId })),
      }),
    ]);
  },

  async clear(guildId: string, userId: string) {
    await prisma.userGameRolePref.deleteMany({ where: { guildId, userId } });
  },
};
