import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
} from "discord.js";
import { safeEphemeralReply } from "../discord/responders.ts";
import {
  createUserRolesSession,
  renderUserRoles,
} from "../services/ux/userRolesUx.ts";
import { optInService } from "../services/optInService.ts";
import { userDataRepo } from "../db/repositories/userDataRepo.ts";
import { dmShareFlowService } from "../services/dmShareFlowService.ts";
import { handleSessions } from "./sessions.ts";
import { handleAdmin } from "./admin.ts";

export const gameshareCommand = new SlashCommandBuilder()
  .setName("gameshare")
  .setDescription("GameShare bot commands")
  .addSubcommandGroup((g) =>
    g
      .setName("admin")
      .setDescription("Admin configuration")
      .addSubcommand((s) =>
        s
          .setName("set-channel")
          .setDescription("Set the channel to post game share announcements")
          .addChannelOption((o) =>
            o
              .setName("channel")
              .setDescription("Announcement channel")
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText),
          ),
      )
      .addSubcommand((s) =>
        s
          .setName("set-request-channel")
          .setDescription(
            "Set the channel where unknown-game add requests are posted",
          )
          .addChannelOption((o) =>
            o
              .setName("channel")
              .setDescription("Request channel")
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText),
          ),
      )
      .addSubcommand((s) =>
        s
          .setName("configure-games")
          .setDescription("Enable/disable recognized games")
          .addStringOption((o) =>
            o
              .setName("query")
              .setDescription("Filter games by name (case-insensitive)")
              .setRequired(false)
              .setMaxLength(50),
          ),
      )
      .addSubcommand((s) =>
        s.setName("status").setDescription("Show config + health status"),
      )

      .addSubcommand((s) =>
        s
          .setName("requests")
          .setDescription("Review pending add-game requests"),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("opt-in")
      .setDescription("Opt in to presence-based game share prompts"),
  )
  .addSubcommand((s) =>
    s.setName("opt-out").setDescription("Opt out and stop DMs"),
  )
  .addSubcommand((s) =>
    s.setName("roles").setDescription("Pick which game roles you want"),
  )
  .addSubcommand((s) => s.setName("privacy").setDescription("Privacy details"))
  .addSubcommand((s) =>
    s
      .setName("sessions")
      .setDescription("List active gameshare sessions in this guild"),
  )
  .addSubcommand((s) =>
    s
      .setName("delete-my-data")
      .setDescription("Delete your saved data for this server"),
  )
  .addSubcommand((s) =>
    s
      .setName("cancel-timeouts")
      .setDescription("Clear any current game prompt timeouts for you"),
  )
  .setDMPermission(false);

export const handleGameshare = async (
  interaction: ChatInputCommandInteraction,
) => {
  if (!interaction.inGuild() || !interaction.guildId) {
    return safeEphemeralReply(interaction, {
      content: "This command can only be used in a server.",
    });
  }

  const subgroup = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  if (subgroup === "admin") {
    return handleAdmin(interaction, sub);
  }

  if (sub === "opt-in") {
    await optInService.setOptIn(interaction.guildId, interaction.user.id, true);
    return safeEphemeralReply(interaction, {
      content:
        "✅ You’re opted in.\n\nI’ll watch your Discord **Playing** presence in this server and DM you when you start an enabled game. Nothing is posted unless you confirm.",
    });
  }

  if (sub === "cancel-timeouts") {
    await dmShareFlowService.clearTimeouts(
      interaction.guildId,
      interaction.user.id,
    );
    return safeEphemeralReply(interaction, {
      content:
        "Cleared any active game prompt timeouts. You'll start receiving prompts again.",
    });
  }

  if (sub === "opt-out") {
    await optInService.setOptIn(
      interaction.guildId,
      interaction.user.id,
      false,
    );
    return safeEphemeralReply(interaction, {
      content: "✅ You’re opted out. I won’t DM you or monitor your presence.",
    });
  }

  if (sub === "roles") {
    const opted = await optInService.isOptedIn(
      interaction.guildId,
      interaction.user.id,
    );
    if (!opted) {
      return safeEphemeralReply(interaction, {
        content: "You must `/gameshare opt-in` first.",
      });
    }
    const state = {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      page: 0,
    };
    const key = createUserRolesSession(state);
    const ui = await renderUserRoles(key, state);
    return safeEphemeralReply(interaction, { ...ui, ephemeral: true });
  }

  if (sub === "sessions") {
    await handleSessions(interaction);
    return;
  }

  if (sub === "privacy") {
    return safeEphemeralReply(interaction, {
      content:
        "Privacy:\n- Opt-in required per server.\n- The bot checks your Discord **Playing** presence only after opt-in.\n- If you choose to share, it posts only what you confirm.\n- Optional details are limited to Steam ID / server name / server address.\n- You can remove all stored data with `/gameshare delete-my-data`.",
    });
  }

  if (sub === "delete-my-data") {
    await userDataRepo.deleteMyData(interaction.guildId, interaction.user.id);
    return safeEphemeralReply(interaction, {
      content: "✅ Deleted your saved data for this server.",
    });
  }

  return safeEphemeralReply(interaction, { content: "Unknown subcommand." });
};
