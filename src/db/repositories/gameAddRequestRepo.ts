import { prisma } from "../prisma.js";

export const gameAddRequestRepo = {
  async create(guildId: string, userId: string, presenceName: string) {
    return prisma.gameAddRequest.create({
      data: { guildId, userId, presenceName, status: "PENDING" },
    });
  },

  async listPending(guildId: string) {
    return prisma.gameAddRequest.findMany({
      where: { guildId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  },

  async setStatus(id: number, status: "APPROVED" | "REJECTED") {
    return prisma.gameAddRequest.update({ where: { id }, data: { status } });
  },

  async existsPending(guildId: string, presenceName: string) {
    const row = await prisma.gameAddRequest.findFirst({
      where: { guildId, presenceName, status: "PENDING" },
    });
    return !!row;
  },
};
