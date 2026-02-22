import {
  ChannelType,
  ButtonInteraction,
  InteractionResponse,
  Client,
  EmbedBuilder,
} from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import { unknownGameRequestService } from "../../services/unknownGameRequestService.ts";
import { guildConfigService } from "../../services/guildConfigService.ts";
import { resolveGuild } from "../utils.ts";

export const handleUnknownRequests = async (
  client: Client,
  interaction: ButtonInteraction,
  base: string,
  key: string | null,
  encodedPresence: string | null,
): Promise<boolean | InteractionResponse<boolean>> => {
  await interaction.deferUpdate().catch(() => null);

  if (!key || !encodedPresence) {
    await interaction.user.send("That request expired.").catch(() => null);
    await interaction.message.edit({ components: [] }).catch(() => null);
    return true;
  }

  const presenceName = decodeURIComponent(encodedPresence).trim();
  if (!presenceName) {
    await interaction.user.send("That request expired.").catch(() => null);
    await interaction.message.edit({ components: [] }).catch(() => null);
    return true;
  }

  await interaction.message.edit({ components: [] }).catch(() => null);

  if (base === CustomIds.UnknownNotNow) {
    await interaction.message
      .edit({
        components: [],
        content: `No problem! I won't ask to enable **${presenceName}** this time.`,
        embeds: [],
      })
      .catch(() => null);
    return true;
  }

  if (base === CustomIds.UnknownIgnore) {
    await unknownGameRequestService.markIgnored(
      key,
      interaction.user.id,
      presenceName,
    );
    await interaction.message
      .edit({
        components: [],
        content: `Okay, I won't prompt you about **${presenceName}** in this server.`,
        embeds: [],
      })
      .catch(() => null);
    return true;
  }

  const req = await unknownGameRequestService.createRequest(
    key,
    interaction.user.id,
    presenceName,
  );
  if (!req) {
    await interaction.message
      .edit({
        components: [],
        content:
          "✅ A request for that game is already pending with the admins.",
        embeds: [],
      })
      .catch(() => null);
    return true;
  }

  const cfg = await guildConfigService.getOrCreate(key);
  if (!cfg.requestChannelId) {
    await interaction.message
      .edit({
        components: [],
        content:
          "✅ Request created, but the server hasn’t set a request channel. Ask an admin to run `/gameshare admin set-request-channel`.",
        embeds: [],
      })
      .catch(() => null);
    return true;
  }

  const guild = await resolveGuild(client, key);
  if (!guild) {
    await interaction.message
      .edit({
        components: [],
        content: "✅ Request saved, but I can’t access that server right now.",
        embeds: [],
      })
      .catch(() => null);
    return true;
  }

  const ch = await guild.channels.fetch(cfg.requestChannelId).catch(() => null);
  if (!ch || ch.type !== ChannelType.GuildText) {
    await interaction.message
      .edit({
        components: [],
        content:
          "✅ Request saved, but the configured request channel is missing or not a text channel.",
        embeds: [],
      })
      .catch(() => null);
    return true;
  }

  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`🆕 Gameshare Add/Enable Request`)
        .setDescription(
          `**Game name:** ${presenceName}\n**Requested by:** <@${interaction.user.id}>`,
        )
        .setFooter({
          text: "Admins: approve/reject in `/gameshare admin requests`.",
        }),
    ],
  });

  await interaction.message
    .edit({
      components: [],
      content: `✅ Sent **${presenceName}** to admins for review in this server.`,
      embeds: [],
    })
    .catch(() => null);

  return true;
};
