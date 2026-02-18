import { ModalSubmitInteraction, InteractionResponse } from "discord.js";
import { parseSessionCustomId } from "../utils.ts";
import { CustomIds } from "../../domain/constants.ts";
import { handleDmModals } from "./dmModals.ts";

export const handleModalInteraction = async (
  interaction: ModalSubmitInteraction,
): Promise<boolean | InteractionResponse<boolean>> => {
  const { base } = parseSessionCustomId(interaction.customId);

  if (
    base === CustomIds.DmModalSteam ||
    base === CustomIds.DmModalServerName ||
    base === CustomIds.DmModalServerIp
  ) {
    return handleDmModals(interaction);
  }

  return false;
};

export default null;
