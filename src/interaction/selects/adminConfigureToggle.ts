import { PermissionFlagsBits, StringSelectMenuInteraction } from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import { adminUxStore, renderAdminConfigure } from "../../services/ux/adminConfigureGamesUx.ts";
import { guildConfigService } from "../../services/guildConfigService.ts";
import { catalogService } from "../../services/catalogService.ts";
import { roleService } from "../../services/roleService.ts";

export async function handleAdminConfigureToggle(interaction: StringSelectMenuInteraction): Promise<boolean> {
  const { base, key } = (() => {
    const parts = interaction.customId.split("|");
    return { base: parts[0] ?? "", key: parts[1] ?? null };
  })();

  if (base !== CustomIds.AdminConfigureToggleSelect) return false;
  if (!key) return interaction.reply({ content: "State expired. Run /gameshare admin configure-games", ephemeral: true }).then(() => true).catch(() => true);

  const state = adminUxStore.get(key);
  if (!state) return interaction.reply({ content: "State expired. Run /gameshare admin configure-games", ephemeral: true }).then(() => true).catch(() => true);
  adminUxStore.touch(key);

  if (!interaction.inGuild() || !interaction.guild) return interaction.reply({ content: "Guild only.", ephemeral: true }).then(() => true).catch(() => true);

  const memberPerms = interaction.memberPermissions;
  const isAdmin = memberPerms?.has(PermissionFlagsBits.ManageGuild) || memberPerms?.has(PermissionFlagsBits.Administrator);
  if (!isAdmin) return interaction.reply({ content: "Admin only.", ephemeral: true }).then(() => true).catch(() => true);

  const guild = interaction.guild;

  for (const gameId of interaction.values) {
    const enabled = await guildConfigService.isEnabled(state.guildId, gameId);
    const game = await catalogService.getAnyGameById(state.guildId, gameId);
    if (!game) continue;

    if (!enabled) {
      await guildConfigService.enableGame(state.guildId, gameId);
      const role = await roleService.ensureGameRole(guild, game.name);
      await guildConfigService.setRoleId(state.guildId, gameId, role.id);
    } else {
      await guildConfigService.disableGame(state.guildId, gameId);
    }
  }

  const refreshed = adminUxStore.get(key);
  if (!refreshed) return interaction.reply({ content: "State expired. Run /gameshare admin configure-games", ephemeral: true }).then(() => true).catch(() => true);
  return interaction.update(await renderAdminConfigure(key, refreshed)).then(() => true).catch(() => true);
}
