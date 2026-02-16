import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionUpdateOptions,
  StringSelectMenuBuilder,
} from "discord.js";
import { CustomIds, PageSize, Limits } from "../../domain/constants.ts";
import { guildConfigService } from "../guildConfigService.ts";
import { userGameRolePrefRepo } from "../../db/repositories/userGameRolePrefRepo.ts";
import { StateStore } from "./stateStore.ts";
import { catalogService } from "../catalogService.ts";

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
): Promise<InteractionUpdateOptions> => {
  const enabledIds = await guildConfigService.listEnabledGameIds(state.guildId);
  const enabledGames = await catalogService.getAnyGamesByIds(
    state.guildId,
    enabledIds,
  );

  const selected = new Set(
    await userGameRolePrefRepo.listSelectedGameIds(state.guildId, state.userId),
  );

  const start = state.page * PageSize.UserGames;
  const pageItems = enabledGames.slice(start, start + PageSize.UserGames);

  const embed = new EmbedBuilder()
    .setTitle("Your Game Roles")
    .setDescription(
      [
        `Enabled games: **${enabledGames.length}**`,
        enabledGames.length === 0
          ? "Showing 0 of 0"
          : `Showing ${start + 1}-${Math.min(start + pageItems.length, enabledGames.length)}`,
      ].join("\n"),
    );

  const components: any[] = [];

  if (pageItems.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`${CustomIds.UserRolesPickSelect}|${sessionKey}`)
      .setPlaceholder("Select the games you want roles for")
      .setMinValues(0)
      .setMaxValues(Math.min(Limits.SelectMaxOptions, pageItems.length))
      .addOptions(
        pageItems.map((g) => ({
          label: g.name.slice(0, 100),
          value: g.id,
          description: selected.has(g.id) ? "Selected" : "Not selected",
        })),
      );

    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
    );
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
    new ButtonBuilder()
      .setCustomId(`${CustomIds.UserRolesClearAll}|${sessionKey}`)
      .setLabel("Clear all my game roles")
      .setStyle(ButtonStyle.Danger),
  );

  components.push(rowButtons);
  return { embeds: [embed], components };
};
