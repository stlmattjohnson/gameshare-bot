import { REST, Routes } from "discord.js";
import { config } from "../config.js";
import { gameshareCommand } from "../commands/gameshare.js";
import { logger } from "../logger.js";

async function run() {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  const body = [gameshareCommand.toJSON()];

  try {
    await rest.put(Routes.applicationCommands(config.applicationId), { body });
    logger.info("Registered global application commands.");
  } catch (err) {
    logger.error({ err }, "Failed to register commands");
    process.exit(1);
  }
}

run();
