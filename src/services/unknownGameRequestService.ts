import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  User,
} from "discord.js";
import { unknownCooldownRepo } from "../db/repositories/unknownCooldownRepo.ts";
import { gameAddRequestRepo } from "../db/repositories/gameAddRequestRepo.ts";
import { config } from "../config.ts";
import { logger } from "../logger.ts";
import { CustomIds } from "../domain/constants.ts";

const addMinutes = (d: Date, minutes: number) => {
  return new Date(d.getTime() + minutes * 60_000);
};

export const unknownGameRequestService = {
  async shouldPrompt(guildId: string, userId: string, presenceName: string) {
    const last = await unknownCooldownRepo.getLast(
      guildId,
      userId,
      presenceName,
    );
    if (!last) return true;
    return addMinutes(last, config.promptCooldownMinutes) < new Date();
  },

  async markPrompted(guildId: string, userId: string, presenceName: string) {
    await unknownCooldownRepo.touch(guildId, userId, presenceName, new Date());
  },

  async sendUnknownPrompt(user: User, guildId: string, presenceName: string) {
    const embed = new EmbedBuilder()
      .setTitle("Game not recognized")
      .setDescription(
        `I see you're playing **${presenceName}**, but it isn't in this server’s recognized game list.\n\nWant to ask the admins to add it?`,
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${CustomIds.UnknownRequestAdd}|${guildId}|${encodeURIComponent(presenceName)}`.slice(
            0,
            100,
          ),
        )
        .setLabel("Request Add")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(
          `${CustomIds.UnknownNotNow}|${guildId}|${encodeURIComponent(presenceName)}`.slice(
            0,
            100,
          ),
        )
        .setLabel("Not now")
        .setStyle(ButtonStyle.Secondary),
    );

    await user.send({ embeds: [embed], components: [row] });
    logger.info(
      { guildId, userId: user.id, presenceName },
      "Sent unknown-game prompt",
    );
  },

  async createRequest(guildId: string, userId: string, presenceName: string) {
    // avoid duplicate spam
    const already = await gameAddRequestRepo.existsPending(
      guildId,
      presenceName,
    );
    if (already) return null;
    return gameAddRequestRepo.create(guildId, userId, presenceName);
  },
};
