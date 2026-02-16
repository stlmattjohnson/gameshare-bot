import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
} from "discord.js";
import { safeEphemeralReply } from "../discord/responders.ts";
import { guildConfigService } from "../services/guildConfigService.ts";
import {
  createAdminSession,
  renderAdminConfigure,
} from "../services/ux/adminConfigureGamesUx.ts";
import {
  createUserRolesSession,
  renderUserRoles,
} from "../services/ux/userRolesUx.ts";
import { optInService } from "../services/optInService.ts";
import { userDataRepo } from "../db/repositories/userDataRepo.ts";
import { catalogService } from "../services/catalogService.ts";
import {
  createAdminRequestsSession,
  renderAdminRequests,
} from "../services/ux/adminRequestsUx.ts";

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
          .setDescription("Enable/disable recognized games"),
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
      .setName("delete-my-data")
      .setDescription("Delete your saved data for this server"),
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
    const member = interaction.memberPermissions;
    const isAdmin =
      member?.has(PermissionFlagsBits.ManageGuild) ||
      member?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      return safeEphemeralReply(interaction, {
        content: "Admin only. You need **Manage Server** or **Administrator**.",
      });
    }

    if (sub === "set-channel") {
      const ch = interaction.options.getChannel("channel", true);
      if (ch.type !== ChannelType.GuildText) {
        return safeEphemeralReply(interaction, {
          content: "Please select a text channel.",
        });
      }

      const me = interaction.guild?.members.me;
      if (!me)
        return safeEphemeralReply(interaction, {
          content: "Bot member not found.",
        });

      const perms = (ch as TextChannel).permissionsFor(me);
      if (!perms?.has(["ViewChannel", "SendMessages"])) {
        return safeEphemeralReply(interaction, {
          content:
            "I can't post in that channel. Grant **View Channel** + **Send Messages**.",
        });
      }

      await guildConfigService.setAnnounceChannel(interaction.guildId, ch.id);
      return safeEphemeralReply(interaction, {
        content: `✅ Announce channel set to <#${ch.id}>`,
      });
    }

    if (sub === "configure-games") {
      const state = { guildId: interaction.guildId, query: "", page: 0 };
      const key = createAdminSession(state);
      const ui = await renderAdminConfigure(key, state);
      return safeEphemeralReply(interaction, ui);
    }

    if (sub === "status") {
      const cfg = await guildConfigService.getOrCreate(interaction.guildId);
      const enabledIds = await guildConfigService.listEnabledGameIds(
        interaction.guildId,
      );
      const mappings = await guildConfigService.listMappings(
        interaction.guildId,
      );

      const enabledGames = await catalogService.getAnyGamesByIds(
        interaction.guildId,
        enabledIds,
      );

      const enabledNames = enabledGames.map((g) => g.name).slice(0, 25);

      const missingRoles = mappings
        .filter((m) => !interaction.guild?.roles.cache.has(m.roleId))
        .slice(0, 10);

      const presenceIntentHint =
        "If game detection isn’t working: enable **Presence Intent** in the Discord Developer Portal (Bot → Privileged Gateway Intents → Presence Intent) and re-invite / restart.";

      return safeEphemeralReply(interaction, {
        content: [
          `**Announce channel:** ${cfg.announceChannelId ? `<#${cfg.announceChannelId}>` : "_not set_"}`,
          `**Enabled games:** ${enabledIds.length}`,
          `**Delete roles for disabled games (default OFF):** ${cfg.deleteDisabledRoles ? "ON" : "OFF"}`,
          "",
          enabledNames.length
            ? `**Some enabled games:** ${enabledNames.join(", ")}`
            : "",
          missingRoles.length
            ? `**Missing mapped roles:** ${missingRoles.map((m) => m.gameId).join(", ")}`
            : "",
          "",
          presenceIntentHint,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }

    if (sub === "requests") {
      const state = { guildId: interaction.guildId, page: 0 };
      const key = createAdminRequestsSession(state);
      const ui = await renderAdminRequests(key, state);
      return safeEphemeralReply(interaction, ui);
    }

    if (sub === "set-request-channel") {
      const ch = interaction.options.getChannel("channel", true);
      if (ch.type !== ChannelType.GuildText) {
        return safeEphemeralReply(interaction, {
          content: "Please select a text channel.",
        });
      }

      const me = interaction.guild?.members.me;
      if (!me)
        return safeEphemeralReply(interaction, {
          content: "Bot member not found.",
        });

      const perms = (ch as TextChannel).permissionsFor(me);
      if (!perms?.has(["ViewChannel", "SendMessages"])) {
        return safeEphemeralReply(interaction, {
          content:
            "I can't post in that channel. Grant **View Channel** + **Send Messages**.",
        });
      }

      await guildConfigService.setRequestChannel(interaction.guildId, ch.id);
      return safeEphemeralReply(interaction, {
        content: `✅ Request channel set to <#${ch.id}>`,
      });
    }

    if (sub === "requests") {
      // Just display instructions; actual rendering uses interaction handlers with buttons
      return safeEphemeralReply(interaction, {
        content: "Use the buttons below to review requests.",
      });
    }

    return safeEphemeralReply(interaction, {
      content: "Unknown admin subcommand.",
    });
  }

  if (sub === "opt-in") {
    await optInService.setOptIn(interaction.guildId, interaction.user.id, true);
    return safeEphemeralReply(interaction, {
      content:
        "✅ You’re opted in.\n\nI’ll watch your Discord **Playing** presence in this server and DM you when you start an enabled game. Nothing is posted unless you confirm.",
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
    return safeEphemeralReply(interaction, { ...(ui as any), ephemeral: true });
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
