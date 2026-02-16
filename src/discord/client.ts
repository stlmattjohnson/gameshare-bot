import { Client, GatewayIntentBits, Partials } from "discord.js";
import { logger } from "../logger.ts";

export const createDiscordClient = () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.Reaction,
      Partials.User,
    ],
  });

  client.on("error", (err) => logger.error({ err }, "Discord client error"));
  client.on("warn", (msg) => logger.warn({ msg }, "Discord client warning"));

  return client;
};
