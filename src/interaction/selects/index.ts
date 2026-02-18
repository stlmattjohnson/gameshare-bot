import { StringSelectMenuInteraction, InteractionResponse } from "discord.js";
import { parseSessionCustomId } from "../utils.ts";
import { CustomIds } from "../../domain/constants.ts";
import { handleDmDetailPick } from "./dmDetailPick.ts";

export const handleSelectInteraction = async (
  interaction: StringSelectMenuInteraction,
): Promise<boolean | InteractionResponse<boolean>> => {
  const { base } = parseSessionCustomId(interaction.customId);

  if (base === CustomIds.DmDetailPick) return handleDmDetailPick(interaction);

  return false;
};

export default null;
