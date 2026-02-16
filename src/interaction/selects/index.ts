import { StringSelectMenuInteraction, InteractionResponse } from "discord.js";
import { parseSessionCustomId } from "../utils.ts";
import { CustomIds } from "../../domain/constants.ts";
import { handleDmDetailPick } from "./dmDetailPick.ts";
import { handleAdminConfigureToggle } from "./adminConfigureToggle.ts";
import { handleUserRolesPick } from "./userRolesPick.ts";

export async function handleSelectInteraction(
  interaction: StringSelectMenuInteraction,
): Promise<boolean | InteractionResponse<boolean>> {
  const { base } = parseSessionCustomId(interaction.customId);

  if (base === CustomIds.DmDetailPick) return handleDmDetailPick(interaction);
  if (base === CustomIds.AdminConfigureToggleSelect)
    return handleAdminConfigureToggle(interaction);
  if (base === CustomIds.UserRolesPickSelect)
    return handleUserRolesPick(interaction);

  return false;
}

export default null;
