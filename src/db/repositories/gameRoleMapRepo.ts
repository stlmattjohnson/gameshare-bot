import { prisma } from "../prisma.js";

export const gameRoleMapRepo = {
  async getRoleId(guildId: string, gameId: string): Promise<string | null> {
    const row = await prisma.gameRoleMapping.findUnique({
      where: { guildId_gameId: { guildId, gameId } }
    });
    return row?.roleId ?? null;
  },

  async setRoleId(guildId: string, gameId: string, roleId: string) {
    await prisma.gameRoleMapping.upsert({
      where: { guildId_gameId: { guildId, gameId } },
      update: { roleId },
      create: { guildId, gameId, roleId }
    });
  },

  async listMappings(guildId: string) {
    return prisma.gameRoleMapping.findMany({ where: { guildId } });
  }
};
