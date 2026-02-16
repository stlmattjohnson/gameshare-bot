import type { Guild } from "discord.js";
import { randomUUID } from "crypto";
import { gameAddRequestRepo } from "../db/repositories/gameAddRequestRepo.ts";
import { customGameRepo } from "../db/repositories/customGameRepo.ts";
import { guildConfigService } from "./guildConfigService.ts";
import { roleService } from "./roleService.ts";

const makeCustomGameId = () => {
  return `cg_${randomUUID().slice(0, 10)}`;
};

export const adminRequestApprovalService = {
  /**
   * Approve a pending request:
   * - create/reuse CustomGame
   * - enable it for guild
   * - ensure role & mapping
   * - mark request approved
   * - BEST EFFORT: add the requester to the role
   */
  async approve(guild: Guild, guildId: string, requestId: number) {
    const pending = await gameAddRequestRepo.listPending(guildId);
    const req = pending.find((r) => r.id === requestId);
    if (!req)
      return {
        ok: false as const,
        message: "Request not found (maybe already handled).",
      };

    // Create or reuse custom game entry (name = presenceName)
    const existing = await customGameRepo.findByName(guildId, req.presenceName);
    const gameId = existing?.id ?? makeCustomGameId();
    const gameName = existing?.name ?? req.presenceName;

    if (!existing) {
      await customGameRepo.create(guildId, gameId, gameName, req.presenceName);
    }

    // Enable for guild
    await guildConfigService.enableGame(guildId, gameId);

    // Ensure role + mapping
    const role = await roleService.ensureGameRole(guild, gameName);
    await guildConfigService.setRoleId(guildId, gameId, role.id);

    // Mark request approved
    await gameAddRequestRepo.setStatus(requestId, "APPROVED");

    // BEST EFFORT: add role to the requester
    let requesterRoleAdded = false;
    let requesterRoleAddMessage: string | undefined;

    try {
      const member = await guild.members.fetch(req.userId).catch(() => null);
      if (!member) {
        requesterRoleAddMessage =
          "Requester not found in guild (maybe they left).";
      } else {
        // Only try if bot can manage the role (hierarchy + perms)
        const can = await roleService.canManageRole(guild, role);
        if (!can.ok) {
          requesterRoleAddMessage =
            can.reason ?? "Bot cannot manage the role (check role hierarchy).";
        } else if (member.roles.cache.has(role.id)) {
          requesterRoleAdded = true; // effectively already true
        } else {
          await member.roles.add(role).catch((e) => {
            requesterRoleAddMessage =
              (e as Error)?.message ?? "Failed to add role.";
          });

          if (!requesterRoleAddMessage) requesterRoleAdded = true;
        }
      }
    } catch (e) {
      requesterRoleAddMessage =
        (e as Error)?.message ?? "Failed to add requester to role.";
    }

    return {
      ok: true as const,
      gameId,
      gameName,
      roleId: role.id,
      requesterUserId: req.userId,
      requesterRoleAdded,
      requesterRoleAddMessage,
    };
  },

  async reject(guildId: string, requestId: number) {
    const pending = await gameAddRequestRepo.listPending(guildId);
    const req = pending.find((r) => r.id === requestId);
    if (!req)
      return {
        ok: false as const,
        message: "Request not found (maybe already handled).",
      };

    await gameAddRequestRepo.setStatus(requestId, "REJECTED");
    return { ok: true as const, requesterUserId: req.userId };
  },
};
