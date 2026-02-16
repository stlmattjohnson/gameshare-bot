import {
  ChannelType,
  ButtonInteraction,
  InteractionResponse,
  Client,
} from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import { dmShareFlowService } from "../../services/dmShareFlowService.ts";
import { catalogService } from "../../services/catalogService.ts";
import { guildConfigService } from "../../services/guildConfigService.ts";
import { resolveGuild } from "../utils.ts";
import { Share } from "../../domain/types.ts";

export const handleDmShareButtons = async (
  client: Client,
  interaction: ButtonInteraction,
  base: string,
): Promise<boolean | InteractionResponse<boolean>> => {
  const parsed = dmShareFlowService.parseDmId(interaction.customId);
  if (!parsed) return true;

  const { guildId, userId, gameId } = parsed;
  await interaction.deferUpdate().catch(() => null);

  const game = await catalogService.getAnyGameById(guildId, gameId);
  const gameName = game?.name ?? "that game";

  const share: Share = {
    guildId,
    userId,
    gameId,
    gameName,
    detailKind: "NONE",
  };

  if (base === CustomIds.DmShareNo) {
    await dmShareFlowService
      .setInFlight(guildId, userId, gameId, false)
      .catch(() => null);
    await interaction.message.edit({ components: [] }).catch(() => null);
    return true;
  }

  if (base === CustomIds.DmShareYes) {
    await interaction.message.edit({ components: [] }).catch(() => null);
    await dmShareFlowService.sendDetailPickerDm(interaction.user, share);
    return true;
  }

  if (base === CustomIds.DmCancelPost) {
    await interaction.message.edit({ components: [] }).catch(() => null);
    dmShareFlowService.cacheDelete(guildId, userId, gameId);
    await dmShareFlowService
      .setInFlight(guildId, userId, gameId, false)
      .catch(() => null);
    return true;
  }

  if (base === CustomIds.DmConfirmPost) {
    const cached = dmShareFlowService.cacheGet(guildId, userId, gameId);
    if (!cached) {
      await interaction.user
        .send("That share request expired. Please try again.")
        .catch(() => null);
      return true;
    }

    const cfg = await guildConfigService.getOrCreate(guildId);
    if (!cfg.announceChannelId) {
      await interaction.user
        .send(
          "Sharing is unavailable because the server hasn’t configured an announce channel. Ask an admin to run `/gameshare admin set-channel`.",
        )
        .catch(() => null);
      return true;
    }

    const guild = await resolveGuild(client, guildId);
    if (!guild) {
      await interaction.user
        .send("I couldn’t find that server. Ask an admin to re-invite the bot.")
        .catch(() => null);
      return true;
    }

    const channel = await guild.channels
      .fetch(cfg.announceChannelId)
      .catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.user
        .send(
          "Announce channel is missing or not a text channel. Ask an admin to re-set it.",
        )
        .catch(() => null);
      return true;
    }

    const roleId = await guildConfigService.getRoleId(guildId, gameId);
    const roleMention = roleId ? `<@&${roleId}>` : "";

    const detailPart =
      cached.detailKind === "NONE"
        ? ""
        : cached.detailKind === "STEAM"
          ? ` Join: Steam ID ${cached.detailValue}`
          : cached.detailKind === "SERVER_NAME"
            ? ` Join: ${cached.detailValue}`
            : ` Join: ${cached.detailValue}`;

    await channel.send(
      `${roleMention} <@${userId}> is playing **${cached.gameName}**.${detailPart}`.trim(),
    );

    await interaction.message.edit({ components: [] }).catch(() => null);
    dmShareFlowService.cacheDelete(guildId, userId, gameId);
    await dmShareFlowService
      .setInFlight(guildId, userId, gameId, false)
      .catch(() => null);

    await interaction.user.send("✅ Posted!").catch(() => null);
    return true;
  }

  return false;
};
