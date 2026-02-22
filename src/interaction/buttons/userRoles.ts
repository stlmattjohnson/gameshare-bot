import { ButtonInteraction, InteractionResponse } from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import { parseSessionCustomId } from "../utils.ts";
import {
  userRolesUxStore,
  renderUserRoles,
} from "../../services/ux/userRolesUx.ts";
import { guildConfigService } from "../../services/guildConfigService.ts";
import { userGameRolePrefRepo } from "../../db/repositories/userGameRolePrefRepo.ts";
import { roleService } from "../../services/roleService.ts";
import { ignoredGameRepo } from "../../db/repositories/ignoredGameRepo.ts";
import { ignoredUnknownGameRepo } from "../../db/repositories/ignoredUnknownGameRepo.ts";

export const handleUserRolesButtons = async (
  interaction: ButtonInteraction,
  base: string,
): Promise<boolean | InteractionResponse<boolean>> => {
  const { key, b: gameId } = parseSessionCustomId(interaction.customId);

  if (
    base !== CustomIds.UserRolesPrev &&
    base !== CustomIds.UserRolesNext &&
    base !== CustomIds.UserRolesClearAll &&
    base !== CustomIds.UserRolesToggleButton
  ) {
    return false;
  }

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

  // Pagination
  if (base === CustomIds.UserRolesPrev || base === CustomIds.UserRolesNext) {
    const delta = base === CustomIds.UserRolesNext ? 1 : -1;
    const updated = userRolesUxStore.update(key, (s) => {
      const nextPage = Math.max(0, s.page + delta);
      return { ...s, page: nextPage };
    });

    if (!updated)
      return interaction
        .reply({
          content: "State expired. Run /gameshare roles",
          ephemeral: true,
        })
        .then(() => true)
        .catch(() => true);

    const ui = await renderUserRoles(key, updated);
    return interaction
      .update({ ...(ui as any), flags: undefined })
      .then(() => true)
      .catch(() => true);
  }

  // Clear all selections
  if (base === CustomIds.UserRolesClearAll) {
    await userGameRolePrefRepo.setSelectedGameIds(
      state.guildId,
      state.userId,
      [],
    );

    if (interaction.inGuild() && interaction.guild) {
      const guild = interaction.guild;
      const enabledIds = await guildConfigService.listEnabledGameIds(
        state.guildId,
      );
      const member = await guild.members.fetch(state.userId).catch(() => null);
      if (member) {
        for (const gid of enabledIds) {
          const roleId = await guildConfigService.getRoleId(state.guildId, gid);
          if (!roleId) continue;
          const role = guild.roles.cache.get(roleId);
          if (!role) continue;

          const has = member.roles.cache.has(roleId);
          const can = await roleService.canManageRole(guild, role);
          if (!can.ok) continue;

          if (has) await member.roles.remove(role).catch(() => null);
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

    const ui = await renderUserRoles(key, refreshed);
    return interaction
      .update({ ...(ui as any), flags: undefined })
      .then(() => true)
      .catch(() => true);
  }

  // Per-game toggle button
  if (base === CustomIds.UserRolesToggleButton) {
    if (!gameId)
      return interaction
        .reply({
          content: "State expired. Run /gameshare roles",
          ephemeral: true,
        })
        .then(() => true)
        .catch(() => true);

    const isIgnoredUnknown = await ignoredUnknownGameRepo.isIgnored(
      state.guildId,
      state.userId,
      gameId,
    );

    if (isIgnoredUnknown) {
      await ignoredUnknownGameRepo.clearIgnore(
        state.guildId,
        state.userId,
        gameId,
      );

      const refreshed = userRolesUxStore.get(key);
      if (!refreshed)
        return interaction
          .reply({
            content: "State expired. Run /gameshare roles",
            ephemeral: true,
          })
          .then(() => true)
          .catch(() => true);

      const ui = await renderUserRoles(key, refreshed);
      return interaction
        .update({ ...(ui as any), flags: undefined })
        .then(() => true)
        .catch(() => true);
    }

    const enabledIds = await guildConfigService.listEnabledGameIds(
      state.guildId,
    );
    const enabledSet = new Set(enabledIds);
    if (!enabledSet.has(gameId)) {
      return interaction
        .reply({ content: "That game is not enabled.", ephemeral: true })
        .then(() => true)
        .catch(() => true);
    }

    const ignoredKnownGameIds = new Set(
      await ignoredGameRepo.listIgnoredGameIds(state.guildId, state.userId),
    );

    const ignoredUnknownGameIds = new Set(
      await ignoredUnknownGameRepo.listIgnoredGameIds(
        state.guildId,
        state.userId,
      ),
    );

    const ignoredIds = new Set([
      ...ignoredKnownGameIds,
      ...ignoredUnknownGameIds,
    ]);

    // If this game is currently ignored, clear the ignore state only.
    if (ignoredIds.has(gameId)) {
      await ignoredGameRepo.clearIgnore(state.guildId, state.userId, gameId);
    } else {
      const current = new Set(
        await userGameRolePrefRepo.listSelectedGameIds(
          state.guildId,
          state.userId,
        ),
      );

      let newArray = [];

      if (current.has(gameId))
        newArray = Array.from(current).filter((id) => id !== gameId);
      else newArray = [...Array.from(current), gameId];

      await userGameRolePrefRepo.setSelectedGameIds(
        state.guildId,
        state.userId,
        newArray,
      );

      if (interaction.inGuild() && interaction.guild) {
        const guild = interaction.guild;
        const member = await guild.members
          .fetch(state.userId)
          .catch(() => null);
        if (member) {
          const roleId = await guildConfigService.getRoleId(
            state.guildId,
            gameId,
          );
          if (roleId) {
            const role = guild.roles.cache.get(roleId);
            if (role) {
              const wants = current.has(gameId);
              const has = member.roles.cache.has(roleId);
              const can = await roleService.canManageRole(guild, role);
              if (can.ok) {
                if (wants && !has)
                  await member.roles.add(role).catch(() => null);
                if (!wants && has)
                  await member.roles.remove(role).catch(() => null);
              }
            }
          }
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

    const ui = await renderUserRoles(key, refreshed);
    return interaction
      .update({ ...(ui as any), flags: undefined })
      .then(() => true)
      .catch(() => true);
  }

  return false;
};
