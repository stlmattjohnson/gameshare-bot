import {
  PermissionFlagsBits,
  ButtonInteraction,
  InteractionResponse,
} from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import { guildConfigService } from "../../services/guildConfigService.ts";
import { catalogService } from "../../services/catalogService.ts";
import { roleService } from "../../services/roleService.ts";
import {
  adminUxStore,
  renderAdminConfigure,
} from "../../services/ux/adminConfigureGamesUx.ts";
import { expiredMessage, parseSessionCustomId } from "../utils.ts";

export const handleAdminConfigureButtons = async (
  interaction: ButtonInteraction,
  base: string,
): Promise<boolean | InteractionResponse<boolean>> => {
  const { key, b } = parseSessionCustomId(interaction.customId);

  // Main admin configure UI (prev/next/toggle/done)
  if (
    base === CustomIds.AdminConfigurePrev ||
    base === CustomIds.AdminConfigureNext ||
    base === CustomIds.AdminConfigureDone ||
    base === CustomIds.AdminConfigureToggleButton
  ) {
    if (!key)
      return interaction
        .reply(expiredMessage("/gameshare admin configure-games"))
        .then(() => true)
        .catch(() => true);

    const state = adminUxStore.get(key);
    if (!state)
      return interaction
        .reply(expiredMessage("/gameshare admin configure-games"))
        .then(() => true)
        .catch(() => true);
    adminUxStore.touch(key);

    if (!interaction.inGuild() || !interaction.guild)
      return interaction
        .reply({ content: "Guild only.", ephemeral: true })
        .then(() => true)
        .catch(() => true);

    const memberPerms = interaction.memberPermissions;
    const isAdmin =
      memberPerms?.has(PermissionFlagsBits.ManageGuild) ||
      memberPerms?.has(PermissionFlagsBits.Administrator);
    if (!isAdmin)
      return interaction
        .reply({ content: "Admin only.", ephemeral: true })
        .then(() => true)
        .catch(() => true);

    // Pagination
    if (
      base === CustomIds.AdminConfigurePrev ||
      base === CustomIds.AdminConfigureNext
    ) {
      const delta = base === CustomIds.AdminConfigureNext ? 1 : -1;
      const updated = adminUxStore.update(key, (s) => {
        const nextPage = Math.max(0, s.page + delta);
        return { ...s, page: nextPage };
      });

      if (!updated)
        return interaction
          .reply(expiredMessage("/gameshare admin configure-games"))
          .then(() => true)
          .catch(() => true);

      const ui = await renderAdminConfigure(key, updated);
      return interaction
        .update({ ...(ui as any), flags: undefined })
        .then(() => true)
        .catch(() => true);
    }

    // Per-game toggle button
    if (base === CustomIds.AdminConfigureToggleButton) {
      const gameId = b;
      if (!gameId)
        return interaction
          .reply(expiredMessage("/gameshare admin configure-games"))
          .then(() => true)
          .catch(() => true);

      const enabled = await guildConfigService.isEnabled(state.guildId, gameId);
      const game = await catalogService.getAnyGameById(state.guildId, gameId);
      if (!game)
        return interaction
          .reply({ content: "Game not found.", ephemeral: true })
          .then(() => true)
          .catch(() => true);

      const guild = interaction.guild;

      if (!enabled) {
        await guildConfigService.enableGame(state.guildId, gameId);
        const role = await roleService.ensureGameRole(guild, game.name);
        await guildConfigService.setRoleId(state.guildId, gameId, role.id);
      } else {
        await guildConfigService.disableGame(state.guildId, gameId);
      }

      const refreshed = adminUxStore.get(key);
      if (!refreshed)
        return interaction
          .reply(expiredMessage("/gameshare admin configure-games"))
          .then(() => true)
          .catch(() => true);

      const ui = await renderAdminConfigure(key, refreshed);
      return interaction
        .update({ ...(ui as any), flags: undefined })
        .then(() => true)
        .catch(() => true);
    }

    // Done: expire the session and acknowledge
    if (base === CustomIds.AdminConfigureDone) {
      adminUxStore.delete(key);
      return interaction
        .update({
          content: "Done editing game configuration.",
          components: [],
          embeds: [],
        })
        .then(() => true)
        .catch(() => true);
    }
  }

  // Delete-roles configuration buttons (not tied to the paged session)
  if (base === CustomIds.AdminConfigureDeleteRolesToggle) {
    if (!interaction.inGuild() || !interaction.guildId) {
      return interaction.reply({ content: "Guild only.", ephemeral: true });
    }
    const guildId = interaction.customId.split("|")[1];
    if (!guildId)
      return interaction.reply({
        content: "State expired. Run /gameshare admin configure-games again.",
        ephemeral: true,
      });

    const memberPerms = interaction.memberPermissions;
    const isAdmin =
      memberPerms?.has(PermissionFlagsBits.ManageGuild) ||
      memberPerms?.has(PermissionFlagsBits.Administrator);
    if (!isAdmin)
      return interaction.reply({ content: "Admin only.", ephemeral: true });

    const cfg = await guildConfigService.getOrCreate(guildId);
    await guildConfigService.setDeleteDisabledRoles(
      guildId,
      !cfg.deleteDisabledRoles,
    );

    return interaction.reply({
      content: `✅ Delete roles for disabled games is now **${!cfg.deleteDisabledRoles ? "ON" : "OFF"}**.`,
      ephemeral: true,
    });
  }

  if (base === CustomIds.AdminConfigureDeleteRolesConfirm) {
    return interaction.reply({
      content:
        "This build does not auto-delete roles yet (safe default). Disable games and manually delete roles if desired.",
      ephemeral: true,
    });
  }

  return false;
};
