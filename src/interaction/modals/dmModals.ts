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
import { DetailKind, Share } from "../../domain/types.ts";

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

    const detailKind: DetailKind =
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

    const share: Share = {
      guildId,
      userId,
      gameId,
      gameName,
      detailKind,
      detailValue: value,
    };

    // Defer the modal reply (ephemeral) because updating the DM may take longer
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch {}

    dmShareFlowService.cachePut(share);
    await dmShareFlowService
      .sendPreviewDm(interaction.user, share)
      .catch(() => {});

    try {
      await interaction.editReply({
        content: "Confirm the preview to post your message!",
      });
    } catch {
      try {
        await interaction.reply({
          content: "Confirm the preview to post your message!",
          ephemeral: true,
        });
      } catch {}
    }

    return true;
  }

  return false;
};
