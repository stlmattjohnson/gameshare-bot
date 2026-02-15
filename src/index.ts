import { createDiscordClient } from "./discord/client.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { initDb } from "./db/prisma.js";
import { registerAppHandlers } from "./app.js";

async function main() {
  await initDb();

  const client = createDiscordClient();
  registerAppHandlers(client);

  client.once("ready", () => {
    logger.info({ user: client.user?.tag }, "Bot ready");
    logger.info("If game detection fails, ensure Presence Intent is enabled in the Developer Portal.");
  });

  await client.login(config.discordToken);
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
