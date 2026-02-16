import {
  PermissionFlagsBits,
  ButtonInteraction,
  InteractionResponse,
} from "discord.js";
import { guildConfigService } from "../../services/guildConfigService.ts";

export async function handleAdminConfigureButtons(
  client: any,
  interaction: ButtonInteraction,
  base: string,
  key: string | null,
  encodedPresence: string | null,
): Promise<boolean | InteractionResponse<boolean>> {
  if (base === "admin_cfg_delete_roles_toggle") {
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

  if (base === "admin_cfg_delete_roles_confirm") {
    return interaction.reply({
      content:
        "This build does not auto-delete roles yet (safe default). Disable games and manually delete roles if desired.",
      ephemeral: true,
    });
  }

  return false;
}
