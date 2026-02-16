import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuInteraction,
} from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import { dmShareFlowService } from "../../services/dmShareFlowService.ts";
import { gameCatalog } from "../../catalog/catalog.ts";
import { customGameRepo } from "../../db/repositories/customGameRepo.ts";

export const handleDmDetailPick = async (
  interaction: StringSelectMenuInteraction,
): Promise<boolean> => {
  const parsed = dmShareFlowService.parseDmId(interaction.customId);
  if (!parsed) {
    return interaction
      .reply({ content: "That share request expired.", ephemeral: true })
      .then(() => true)
      .catch(() => true);
  }

  const { guildId, userId, gameId } = parsed;
  const game =
    gameCatalog.getById(gameId) ??
    (await customGameRepo.findById(guildId, gameId));
  const gameName = game?.name ?? "that game";

  const detailKind = (interaction.values[0] ?? "NONE") as any;
  const share: any = { guildId, userId, gameId, gameName, detailKind };

  if (detailKind === "NONE") {
    dmShareFlowService.cachePut(share);
    await interaction.user
      .send({
        content: `Preview:\n**${gameName}**\nNo extra details.\n\nPost this to the server?`,
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
      .catch(() => null);

    return true;
  }

  await interaction.showModal(dmShareFlowService.buildModal(detailKind, share));
  return true;
};
