import { createDiscordClient } from "./discord/client.ts";
import { config } from "./config.ts";
import { logger } from "./logger.ts";
import { initDb } from "./db/prisma.ts";
import { registerAppHandlers } from "./app.ts";

async function main() {
  await initDb();

  const client = createDiscordClient();
  registerAppHandlers(client);

  client.once('clientReady', () => {
    logger.info({ user: client.user?.tag }, "Bot ready");
    logger.info("If game detection fails, ensure Presence Intent is enabled in the Developer Portal.");
  });

  await client.login(config.discordToken);
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
