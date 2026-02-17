import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { dmShareFlowService } from "../services/dmShareFlowService.ts";
import { catalogService } from "../services/catalogService.ts";
import { logger } from "../logger.ts";

export const sessionsCommand = new SlashCommandBuilder()
  .setName("sessions")
  .setDescription("List active gameshare sessions in this guild");

export async function handleSessions(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({
      content: "This command can only be used in a server (guild).",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  try {
    const guildId = interaction.guildId;
    const sessions =
      await dmShareFlowService.getActiveSessionsForGuild(guildId);
    if (!sessions || sessions.length === 0) {
      await interaction.editReply({ content: "No active sessions." });
      return;
    }

    // Group by gameId preserving grouping order by game name
    const gameIds = Array.from(new Set(sessions.map((s) => s.gameId)));
    const games = await catalogService.getAnyGamesByIds(guildId, gameIds);
    // Map id -> name
    const gameNameMap = new Map(games.map((g) => [g.id, g.name]));

    // Group sessions by gameId
    const grouped = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const list = grouped.get(s.gameId) ?? [];
      list.push(s);
      grouped.set(s.gameId, list);
    }

    // Sort gameIds by game name
    const sortedGameIds = Array.from(grouped.keys()).sort((a, b) => {
      const an = gameNameMap.get(a) ?? a;
      const bn = gameNameMap.get(b) ?? b;
      return an.localeCompare(bn);
    });

    const parts: string[] = [];
    parts.push(
      `**Active Sessions in ${interaction.guild?.name ?? "this guild"}**`,
    );
    parts.push("============");

    for (const gid of sortedGameIds) {
      const name = gameNameMap.get(gid) ?? gid;
      const rows = grouped.get(gid) ?? [];

      parts.push(`**${name}**`);
      parts.push("------------");
      parts.push("__**User — Details — Since**__");

      for (const r of rows) {
        const userLabel = `<@${r.userId}>`;

        const detail =
          r.detailKind && r.detailKind !== "NONE"
            ? r.detailKind === "STEAM"
              ? `Steam: ${r.detailValue}`
              : r.detailKind === "SERVER_NAME"
                ? `Server Name: ${r.detailValue}`
                : `IP: ${r.detailValue}`
            : "(none)";

        const since = r.createdAt
          ? `<t:${Math.floor(new Date(r.createdAt).getTime() / 1000)}:R>`
          : "-";

        parts.push(`- ${userLabel} — ${detail} — ${since}`);
      }

      // separator between groups
      parts.push("============");
    }

    const content = parts.join("\n");
    await interaction.editReply({ content });
  } catch (err) {
    logger.error({ err }, "Failed to fetch sessions");
    try {
      await interaction.editReply({ content: "Failed to list sessions." });
    } catch {
      // ignore
    }
  }
}

export default sessionsCommand;
