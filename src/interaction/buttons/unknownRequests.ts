import {
  ChannelType,
  ButtonInteraction,
  InteractionResponse,
  Client,
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
    return true;
  }

  const req = await unknownGameRequestService.createRequest(
    key,
    interaction.user.id,
    presenceName,
  );
  if (!req) {
    await interaction.user
      .send("✅ A request for that game is already pending with the admins.")
      .catch(() => null);
    return true;
  }

  const cfg = await guildConfigService.getOrCreate(key);
  if (!cfg.requestChannelId) {
    await interaction.user
      .send(
        "✅ Request created, but the server hasn’t set a request channel. Ask an admin to run `/gameshare admin set-request-channel`.",
      )
      .catch(() => null);
    return true;
  }

  const guild = await resolveGuild(client, key);
  if (!guild) {
    await interaction.user
      .send("✅ Request saved, but I can’t access that server right now.")
      .catch(() => null);
    return true;
  }

  const ch = await guild.channels.fetch(cfg.requestChannelId).catch(() => null);
  if (!ch || ch.type !== ChannelType.GuildText) {
    await interaction.user
      .send(
        "✅ Request saved, but the configured request channel is missing or not a text channel.",
      )
      .catch(() => null);
    return true;
  }

  await ch.send(
    [
      `🆕 **Game Add Request**`,
      `Requested by: <@${interaction.user.id}>`,
      `Game name: **${presenceName}**`,
      "",
      "Admins: approve/reject in `/gameshare admin requests`.",
    ].join("\n"),
  );

  await interaction.user
    .send("✅ Sent to admins for review.")
    .catch(() => null);
  return true;
};
