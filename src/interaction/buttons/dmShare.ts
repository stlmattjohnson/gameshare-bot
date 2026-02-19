import {
  ChannelType,
  ButtonInteraction,
  InteractionResponse,
  Client,
  EmbedBuilder,
} from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import { dmShareFlowService } from "../../services/dmShareFlowService.ts";
import { catalogService } from "../../services/catalogService.ts";
import { guildConfigService } from "../../services/guildConfigService.ts";
import { resolveGuild } from "../utils.ts";
import { Share } from "../../domain/types.ts";
import { roleService } from "../../services/roleService.ts";

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

  if (base === CustomIds.DmShareNeverGame) {
    await dmShareFlowService
      .ignoreGame(guildId, userId, gameId)
      .catch(() => null);
    await dmShareFlowService
      .setInFlight(guildId, userId, gameId, false)
      .catch(() => null);

    await interaction.message
      .edit({
        embeds: [
          new EmbedBuilder()
            .setTitle("Ignored")
            .setDescription(
              `Okay, I won't prompt you about **${gameName}** in this server.`,
            ),
        ],
        components: [],
      })
      .catch(() => null);
    return true;
  }

  if (base === CustomIds.DmTimeout1d || base === CustomIds.DmTimeout1w) {
    const days = base === CustomIds.DmTimeout1d ? 1 : 7;
    await dmShareFlowService
      .setTimeoutDays(guildId, userId, gameId, days)
      .catch(() => null);
    await dmShareFlowService
      .setInFlight(guildId, userId, gameId, false)
      .catch(() => null);

    const desc = `Okay, I won't prompt you about **${gameName}** for ${days} day${days === 1 ? "" : "s"}.\nYou can clear this later with "/gameshare cancel-timeouts".`;

    await interaction.message
      .edit({
        embeds: [
          new EmbedBuilder().setTitle("Prompts paused").setDescription(desc),
        ],
        components: [],
      })
      .catch(() => null);
    return true;
  }

  if (base === CustomIds.DmShareNo) {
    await dmShareFlowService
      .setInFlight(guildId, userId, gameId, false)
      .catch(() => null);
    await interaction.message
      .edit({
        embeds: [
          new EmbedBuilder()
            .setTitle("Got it")
            .setDescription(`We won't share this session of **${gameName}**`),
        ],
        components: [],
      })
      .catch(() => null);
    return true;
  }

  if (base === CustomIds.DmShareYes) {
    await interaction.message.edit({ components: [] }).catch(() => null);
    await dmShareFlowService.sendDetailPickerDm(interaction.user, share);
    return true;
  }

  if (base === CustomIds.DmCancelPost) {
    try {
      await interaction.message
        .edit({
          embeds: [
            new EmbedBuilder()
              .setTitle("Cancelled")
              .setDescription("Share cancelled — nothing was posted."),
          ],
          components: [],
        })
        .catch(() => null);
    } catch {}

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

    const detailText =
      cached.detailKind === "NONE"
        ? ""
        : cached.detailKind === "STEAM"
          ? `**Steam ID:** ${cached.detailValue}`
          : cached.detailKind === "SERVER_NAME"
            ? `**Server Name:** ${cached.detailValue}`
            : `**Server IP:** ${cached.detailValue}`;

    const embed = new EmbedBuilder()
      .setTitle(`🎮 **${gameName}**`)
      .setDescription(
        [`<@${userId}> is playing`, detailText || undefined]
          .filter(Boolean)
          .join("\n"),
      )
      .setFooter({
        text: roleId
          ? "Want to change your notifications for this game?\nReact ➕ to add the role, or ➖ to remove it."
          : "",
      });

    const sent = await channel
      .send({
        content: roleId ? roleMention : undefined,
        embeds: [embed],
        allowedMentions: roleId ? { roles: [roleId] } : undefined,
      })
      .catch(() => null);

    if (sent && roleId) {
      // Add reactions for users to opt-in / opt-out
      try {
        await sent.react("➕");
        await sent.react("➖");
      } catch {
        // ignore reaction failures
      }

      // Remember mapping from message -> guild/game for reaction handlers
      await dmShareFlowService.registerPostedMessage(
        sent.id,
        guildId,
        channel.id,
        userId,
        gameId,
        roleId,
        cached.detailKind,
        cached.detailValue,
      );

      // Ensure the sharer has the game role if they don't already.
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
          const can = await roleService.canManageRole(guild, role);
          const has = member.roles.cache.has(roleId);
          if (can.ok && !has) {
            await member.roles.add(role).catch(() => null);
          }
        }
      }
    }

    try {
      await interaction.message
        .edit({
          embeds: [
            new EmbedBuilder()
              .setTitle(`✅ ${gameName} session shared!`)
              .setDescription(`Posted in <#${cfg.announceChannelId}>.`),
          ],
          components: [],
        })
        .catch(() => null);
    } catch {}

    dmShareFlowService.cacheDelete(guildId, userId, gameId);
    await dmShareFlowService
      .setInFlight(guildId, userId, gameId, false)
      .catch(() => null);

    return true;
  }

  return false;
};
