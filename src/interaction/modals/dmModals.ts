import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalSubmitInteraction,
} from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import { dmShareFlowService } from "../../services/dmShareFlowService.ts";
import { catalogService } from "../../services/catalogService.ts";
import { parseSessionCustomId } from "../utils.ts";

export const handleDmModals = async (
  interaction: ModalSubmitInteraction,
): Promise<boolean> => {
  const { base } = parseSessionCustomId(interaction.customId);

  if (
    base === CustomIds.DmModalSteam ||
    base === CustomIds.DmModalServerName ||
    base === CustomIds.DmModalServerIp
  ) {
    const parsed = dmShareFlowService.parseDmId(interaction.customId);
    if (!parsed) {
      return interaction
        .reply({ content: "That share request expired.", ephemeral: true })
        .then(() => true)
        .catch(() => true);
    }

    const { guildId, userId, gameId } = parsed;
    const game = await catalogService.getAnyGameById(guildId, gameId);
    const gameName = game?.name ?? "that game";

    const detailKind: any =
      base === CustomIds.DmModalSteam
        ? "STEAM"
        : base === CustomIds.DmModalServerName
          ? "SERVER_NAME"
          : "SERVER_IP";

    const value = interaction.fields.getTextInputValue("value")?.trim() ?? "";
    const valid = dmShareFlowService.validateDetail(detailKind, value);

    if (!valid.ok) {
      return interaction
        .reply({
          content: `❌ ${valid.message ?? "Invalid value."}`,
          ephemeral: true,
        })
        .then(() => true)
        .catch(() => true);
    }

    const share: any = {
      guildId,
      userId,
      gameId,
      gameName,
      detailKind,
      detailValue: value,
    };
    dmShareFlowService.cachePut(share);

    return interaction
      .reply({
        content: `Preview:\n**${gameName}**\n${detailKind === "STEAM" ? `Steam ID: ${value}` : detailKind === "SERVER_NAME" ? `Server: ${value}` : `Join: ${value}`}\n\nPost this to the server?`,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(
                dmShareFlowService.dmId(CustomIds.DmConfirmPost, share),
              )
              .setLabel("Confirm")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(
                dmShareFlowService.dmId(CustomIds.DmCancelPost, share),
              )
              .setLabel("Cancel")
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      })
      .then(() => true)
      .catch(() => true);
  }

  return false;
};
