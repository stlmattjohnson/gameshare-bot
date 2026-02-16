import { prisma } from "../prisma.js";

export const enabledGameRepo = {
  async listEnabledGameIds(guildId: string): Promise<string[]> {
    const rows = await prisma.enabledGame.findMany({ where: { guildId } });
    return rows.map((r) => r.gameId);
  },

  async isEnabled(guildId: string, gameId: string) {
    const row = await prisma.enabledGame.findUnique({
      where: { guildId_gameId: { guildId, gameId } },
    });
    return !!row;
  },

  async enable(guildId: string, gameId: string) {
    await prisma.enabledGame.upsert({
      where: { guildId_gameId: { guildId, gameId } },
      update: {},
      create: { guildId, gameId },
    });
  },

  async disable(guildId: string, gameId: string) {
    await prisma.enabledGame.deleteMany({ where: { guildId, gameId } });
  },
};
