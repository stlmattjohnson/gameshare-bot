import { Client, GatewayIntentBits, Partials } from "discord.js";
import { logger } from "../logger.js";

export function createDiscordClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.DirectMessages
      // Note: GuildMembers is not strictly required if we only add/remove roles on known GuildMember from interactions.
      // If you later need to fetch members by ID, add GatewayIntentBits.GuildMembers.
    ],
    partials: [Partials.Channel] // needed for DMs
  });

  client.on("error", (err) => logger.error({ err }, "Discord client error"));
  client.on("warn", (msg) => logger.warn({ msg }, "Discord client warning"));

  return client;
}
