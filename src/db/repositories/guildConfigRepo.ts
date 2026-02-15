import { prisma } from "../prisma.js";

export const guildConfigRepo = {
  async getOrCreate(guildId: string) {
    return prisma.guildConfig.upsert({
      where: { guildId },
      update: {},
      create: { guildId }
    });
  },

  async setAnnounceChannel(guildId: string, channelId: string | null) {
    return prisma.guildConfig.upsert({
      where: { guildId },
      update: { announceChannelId: channelId },
      create: { guildId, announceChannelId: channelId }
    });
  },

  async setDeleteDisabledRoles(guildId: string, enabled: boolean) {
    return prisma.guildConfig.upsert({
      where: { guildId },
      update: { deleteDisabledRoles: enabled },
      create: { guildId, deleteDisabledRoles: enabled }
    });
  }
};
