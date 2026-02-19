import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionReplyOptions,
} from "discord.js";
import { CustomIds, PageSize } from "../../domain/constants.ts";
import { guildConfigService } from "../guildConfigService.ts";
import { userGameRolePrefRepo } from "../../db/repositories/userGameRolePrefRepo.ts";
import { StateStore } from "./stateStore.ts";
import { catalogService } from "../catalogService.ts";
import { ignoredGameRepo } from "../../db/repositories/ignoredGameRepo.ts";

export type UserRolesState = {
  guildId: string;
  userId: string;
  page: number;
};

export const userRolesUxStore = new StateStore<UserRolesState>(15 * 60_000);

export const createUserRolesSession = (state: UserRolesState): string => {
  return userRolesUxStore.put(state);
};

export const renderUserRoles = async (
  sessionKey: string,
  state: UserRolesState,
): Promise<InteractionReplyOptions> => {
  const enabledIds = await guildConfigService.listEnabledGameIds(state.guildId);
  const enabledGames = await catalogService.getAnyGamesByIds(
    state.guildId,
    enabledIds,
  );

  const ignoredIds = new Set(
    await ignoredGameRepo.listIgnoredGameIds(state.guildId, state.userId),
  );

  const nonIgnoredGames = enabledGames.filter((g) => !ignoredIds.has(g.id));
  const ignoredGames = enabledGames.filter((g) => ignoredIds.has(g.id));

  nonIgnoredGames.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  ignoredGames.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const orderedGames = [...nonIgnoredGames, ...ignoredGames];

  const selected = new Set(
    await userGameRolePrefRepo.listSelectedGameIds(state.guildId, state.userId),
  );

  const start = state.page * PageSize.UserGames;
  const pageItems = orderedGames.slice(start, start + PageSize.UserGames);

  const embed = new EmbedBuilder()
    .setTitle("Your Game Roles")
    .setDescription(
      [
        `Enabled games: **${enabledGames.length}**`,
        enabledGames.length === 0
          ? "Showing 0 of 0"
          : `Showing ${start + 1}-${Math.min(start + pageItems.length, enabledGames.length)}`,
        "",
        "Use the buttons below to select which game roles you want.",
        "✅ means you currently have that role; changes apply immediately.",
        "❌ means you've chosen to ignore prompts for that game.",
      ].join("\n"),
    );

  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (pageItems.length > 0) {
    const gameButtons = pageItems.map((g) => {
      const isSelected = selected.has(g.id);
      const isIgnored = ignoredIds.has(g.id);
      const prefix = isIgnored ? "❌" : isSelected ? "✅" : "⬜";

      return new ButtonBuilder()
        .setCustomId(`${CustomIds.UserRolesToggleButton}|${sessionKey}|${g.id}`)
        .setLabel(`${prefix} ${g.name.slice(0, 70)}`)
        .setStyle(
          isIgnored
            ? ButtonStyle.Danger
            : isSelected
              ? ButtonStyle.Success
              : ButtonStyle.Secondary,
        );
    });

    for (let i = 0; i < gameButtons.length; i += 5) {
      const chunk = gameButtons.slice(i, i + 5);
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(...chunk),
      );
    }
  } else {
    embed.addFields([
      {
        name: "No enabled games",
        value:
          "Ask an admin to enable games in `/gameshare admin configure-games`.",
      },
    ]);
  }

  const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CustomIds.UserRolesPrev}|${sessionKey}`)
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.page <= 0),
    new ButtonBuilder()
      .setCustomId(`${CustomIds.UserRolesNext}|${sessionKey}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(start + PageSize.UserGames >= enabledGames.length),
  );

  if (enabledGames.length > 0) {
    rowButtons.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CustomIds.UserRolesClearAll}|${sessionKey}`)
        .setLabel("Clear all my game roles")
        .setStyle(ButtonStyle.Danger),
    );
  }

  components.push(rowButtons);
  return { embeds: [embed], components };
};
