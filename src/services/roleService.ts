import { Guild, PermissionsBitField, Role } from "discord.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const roleService = {
  async ensureGameRole(guild: Guild, gameName: string): Promise<Role> {
    const me = guild.members.me;
    if (!me) throw new Error("Bot member not found in guild.");

    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      throw new Error("Missing Manage Roles permission.");
    }

    const roleName = `${config.rolePrefix}${gameName}`.slice(0, 100);
    const existing = guild.roles.cache.find((r) => r.name === roleName);

    if (existing) return existing;

    try {
      const role = await guild.roles.create({
        name: roleName,
        mentionable: true,
        reason: "GameShare: enabled game role"
      });
      logger.info({ guildId: guild.id, roleId: role.id, roleName }, "Created role");
      return role;
    } catch (err) {
      logger.error({ err, guildId: guild.id, roleName }, "Failed creating role");
      throw err;
    }
  },

  async canManageRole(guild: Guild, role: Role): Promise<{ ok: boolean; reason?: string }> {
    const me = guild.members.me;
    if (!me) return { ok: false, reason: "Bot not in guild member cache." };

    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return { ok: false, reason: "Bot lacks Manage Roles permission." };
    }
    if (!me.roles.highest || me.roles.highest.comparePositionTo(role) <= 0) {
      return { ok: false, reason: "Bot role is not higher than target role." };
    }
    return { ok: true };
  }
};
