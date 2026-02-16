import { StringSelectMenuInteraction } from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import {
  userRolesUxStore,
  renderUserRoles,
} from "../../services/ux/userRolesUx.ts";
import { guildConfigService } from "../../services/guildConfigService.ts";
import { userGameRolePrefRepo } from "../../db/repositories/userGameRolePrefRepo.ts";
import { gameCatalog } from "../../catalog/catalog.ts";
import { roleService } from "../../services/roleService.ts";

export const handleUserRolesPick = async (
  interaction: StringSelectMenuInteraction,
): Promise<boolean> => {
  const { base, key } = (() => {
    const parts = interaction.customId.split("|");
    return { base: parts[0] ?? "", key: parts[1] ?? null };
  })();

  if (base !== CustomIds.UserRolesPickSelect) return false;
  if (!key)
    return interaction
      .reply({
        content: "State expired. Run /gameshare roles",
        ephemeral: true,
      })
      .then(() => true)
      .catch(() => true);

  const state = userRolesUxStore.get(key);
  if (!state)
    return interaction
      .reply({
        content: "State expired. Run /gameshare roles",
        ephemeral: true,
      })
      .then(() => true)
      .catch(() => true);
  userRolesUxStore.touch(key);

  const enabledIds = await guildConfigService.listEnabledGameIds(state.guildId);
  const enabledSet = new Set(enabledIds);

  const current = new Set(
    await userGameRolePrefRepo.listSelectedGameIds(state.guildId, state.userId),
  );

  const enabledGames = enabledIds
    .map((id) => gameCatalog.getById(id))
    .filter(Boolean as any);
  const start = state.page * 20;
  const pageItems = enabledGames.slice(start, start + 20).map((g) => g!.id);

  for (const g of pageItems) current.delete(g);
  for (const v of interaction.values) if (enabledSet.has(v)) current.add(v);

  await userGameRolePrefRepo.setSelectedGameIds(
    state.guildId,
    state.userId,
    Array.from(current),
  );

  if (interaction.inGuild() && interaction.guild) {
    const guild = interaction.guild;
    const member = await guild.members.fetch(state.userId).catch(() => null);
    if (member) {
      for (const gameId of enabledIds) {
        const roleId = await guildConfigService.getRoleId(
          state.guildId,
          gameId,
        );
        if (!roleId) continue;
        const role = guild.roles.cache.get(roleId);
        if (!role) continue;

        const wants = current.has(gameId);
        const has = member.roles.cache.has(roleId);
        const can = await roleService.canManageRole(guild, role);

        if (!can.ok) continue;

        if (wants && !has) await member.roles.add(role).catch(() => null);
        if (!wants && has) await member.roles.remove(role).catch(() => null);
      }
    }
  }

  const refreshed = userRolesUxStore.get(key);
  if (!refreshed)
    return interaction
      .reply({
        content: "State expired. Run /gameshare roles",
        ephemeral: true,
      })
      .then(() => true)
      .catch(() => true);
  return interaction
    .update(await renderUserRoles(key, refreshed))
    .then(() => true)
    .catch(() => true);
};
