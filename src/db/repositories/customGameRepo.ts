import { prisma } from "../prisma.js";

export const customGameRepo = {
  async list(guildId: string) {
    return prisma.customGame.findMany({
      where: { guildId },
      orderBy: { name: "asc" },
    });
  },

  async findByName(guildId: string, name: string) {
    return prisma.customGame.findFirst({ where: { guildId, name } });
  },

  async findById(guildId: string, id: string) {
    return prisma.customGame.findFirst({ where: { guildId, id } });
  },

  async create(
    guildId: string,
    id: string,
    name: string,
    presenceName?: string | null,
  ) {
    return prisma.customGame.create({
      data: { guildId, id, name, presenceName: presenceName ?? null },
    });
  },

  // ✅ NEW: bulk lookup by IDs
  async getNamesByIds(
    guildId: string,
    ids: string[],
  ): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await prisma.customGame.findMany({
      where: { guildId, id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  },
};
