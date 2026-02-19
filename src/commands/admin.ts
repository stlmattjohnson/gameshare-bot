import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { safeEphemeralReply } from "../discord/responders.ts";
import { guildConfigService } from "../services/guildConfigService.ts";
import {
  createAdminSession,
  renderAdminConfigure,
} from "../services/ux/adminConfigureGamesUx.ts";
import { catalogService } from "../services/catalogService.ts";
import {
  createAdminRequestsSession,
  renderAdminRequests,
} from "../services/ux/adminRequestsUx.ts";

export async function handleAdmin(
  interaction: ChatInputCommandInteraction,
  sub: string,
) {
  const member = interaction.memberPermissions;
  const isAdmin =
    member?.has(PermissionFlagsBits.ManageGuild) ||
    member?.has(PermissionFlagsBits.Administrator);

  if (!interaction.inGuild() || !interaction.guildId) {
    return safeEphemeralReply(interaction, {
      content: "This command can only be used in a server.",
    });
  }

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
    const query = (interaction.options.getString("query") ?? "").trim();
    const state = {
      guildId: interaction.guildId,
      query,
      page: 0,
    };
    const key = createAdminSession(state);
    const ui = await renderAdminConfigure(key, state);
    return safeEphemeralReply(interaction, ui);
  }

  if (sub === "status") {
    const cfg = await guildConfigService.getOrCreate(interaction.guildId);
    const enabledIds = await guildConfigService.listEnabledGameIds(
      interaction.guildId,
    );
    const mappings = await guildConfigService.listMappings(interaction.guildId);

    const enabledGames = await catalogService.getAnyGamesByIds(
      interaction.guildId,
      enabledIds,
    );

    const enabledNames = enabledGames
      .map((g) => g.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .slice(0, 25);

    const missingRoles = mappings
      .filter((m) => !interaction.guild?.roles.cache.has(m.roleId))
      .slice(0, 10);

    const missingGameIds = missingRoles.map((m) => m.gameId);
    const missingGames = missingGameIds.length
      ? await catalogService.getAnyGamesByIds(
          interaction.guildId,
          missingGameIds,
        )
      : [];

    const missingNameById = new Map(
      missingGames.map((g) => [g.id, g.name] as const),
    );

    const missingNames = Array.from(
      new Set(
        missingRoles.map((m) => missingNameById.get(m.gameId) ?? m.gameId),
      ),
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    const lines = [
      `**Announce channel:** ${cfg.announceChannelId ? `<#${cfg.announceChannelId}>` : "_not set_"}`,
      `**Request channel:** ${cfg.requestChannelId ? `<#${cfg.requestChannelId}>` : "_not set_"}`,
      `**Enabled games:** ${enabledIds.length}`,
      "",
      enabledNames.length
        ? `**Some enabled games:** ${enabledNames.join(", ")}`
        : "",
      missingNames.length
        ? `**Missing mapped roles:** ${missingNames.join(", ")}`
        : "",
    ].filter(Boolean);

    const embed = new EmbedBuilder()
      .setTitle("GameShare status")
      .setDescription(lines.join("\n"));

    return safeEphemeralReply(interaction, {
      embeds: [embed],
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
