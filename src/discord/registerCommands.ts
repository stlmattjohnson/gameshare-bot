import { REST, Routes } from "discord.js";
import { config } from "../config.ts";
import { gameshareCommand } from "../commands/gameshare.ts";
import { logger } from "../logger.ts";

const run = async () => {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  const body = [gameshareCommand.toJSON()];

  try {
    await rest.put(Routes.applicationCommands(config.applicationId), { body });
    logger.info("Registered global application commands.");
  } catch (err) {
    logger.error({ err }, "Failed to register commands");
    process.exit(1);
  }
};

run();
