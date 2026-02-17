import { Client, Interaction } from "discord.js";
import { logger } from "./logger.ts";
import { handleGameshare } from "./commands/gameshare.ts";

import { handleButtonInteraction } from "./interaction/buttons/index.ts";
import { handleSelectInteraction } from "./interaction/selects/index.ts";
import { handleModalInteraction } from "./interaction/modals/index.ts";
import { registerReactionHandlers } from "./discord/reactions.ts";
import { registerPresenceHandler } from "./discord/presence.ts";

export function registerAppHandlers(client: Client) {
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      // Slash commands
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "gameshare") {
          await handleGameshare(interaction);
        }
        return;
      }
      // Admin + user UI buttons
      if (interaction.isButton()) {
        const handled = await handleButtonInteraction(client, interaction);
        if (handled) return;
      }

      // Select menus
      if (interaction.isStringSelectMenu()) {
        const handled = await handleSelectInteraction(interaction);
        if (handled) return;
      }

      // Modals
      if (interaction.isModalSubmit()) {
        const handled = await handleModalInteraction(interaction);
        if (handled) return;
      }
    } catch (err) {
      logger.error({ err }, "interactionCreate handler error");
      try {
        if (interaction.isRepliable()) {
          await interaction.reply({
            content: "Something went wrong. Check logs.",
            ephemeral: true,
          });
        }
      } catch {
        // ignore
      }
    }
  });

  // Register presence update handler
  registerPresenceHandler(client);
  // Register reaction-based role handlers
  registerReactionHandlers(client);
}
