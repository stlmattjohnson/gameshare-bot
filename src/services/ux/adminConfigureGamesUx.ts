import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionUpdateOptions
} from "discord.js";
import { gameCatalog } from "../../catalog/catalog.js";
import { CustomIds, PageSize, Limits } from "../../domain/constants.js";
import { guildConfigService } from "../guildConfigService.js";
import { StateStore } from "./stateStore.js";

export type AdminUxState = {
  guildId: string;
  query: string;
  page: number;
};

// 15-minute admin UI sessions
export const adminUxStore = new StateStore<AdminUxState>(15 * 60_000);

export function createAdminSession(state: AdminUxState): string {
  return adminUxStore.put(state);
}

export async function renderAdminConfigure(
  sessionKey: string,
  state: AdminUxState
): Promise<InteractionUpdateOptions> {
  const results = gameCatalog.search(state.query);
  const start = state.page * PageSize.AdminGames;
  const pageItems = results.slice(start, start + PageSize.AdminGames);

  const enabledIds = new Set(await guildConfigService.listEnabledGameIds(state.guildId));

  const embed = new EmbedBuilder()
    .setTitle("Configure Games")
    .setDescription(
      [
        `Search: \`${state.query || "(none)"}\``,
        results.length === 0
          ? "Showing 0 of 0"
          : `Showing ${start + 1}-${Math.min(start + pageItems.length, results.length)} of ${results.length}`,
        "",
        "Select games below to enable/disable."
      ].join("\n")
    );

  const components: any[] = [];

  // Only render select menu when we have items; Discord rejects empty options/max_values=0.
  if (pageItems.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`${CustomIds.AdminConfigureToggleSelect}|${sessionKey}`)
      .setPlaceholder("Toggle games (enable/disable)")
      .setMinValues(0)
      .setMaxValues(Math.min(Limits.SelectMaxOptions, pageItems.length))
      .addOptions(
        pageItems.map((g) => ({
          label: g.name.slice(0, 100),
          value: g.id,
          description: enabledIds.has(g.id) ? "Enabled" : "Disabled"
        }))
      );

    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  } else {
    embed.addFields([{ name: "No results", value: "Try a different search term." }]);
  }

  const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CustomIds.AdminConfigureSearch}|${sessionKey}`)
      .setLabel("Search")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${CustomIds.AdminConfigurePrev}|${sessionKey}`)
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.page <= 0),
    new ButtonBuilder()
      .setCustomId(`${CustomIds.AdminConfigureNext}|${sessionKey}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(start + PageSize.AdminGames >= results.length),
    new ButtonBuilder()
      .setCustomId(`${CustomIds.AdminConfigureDone}|${sessionKey}`)
      .setLabel("Done")
      .setStyle(ButtonStyle.Primary)
  );

  const cfg = await guildConfigService.getOrCreate(state.guildId);

  const rowDeleteOpt = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CustomIds.AdminConfigureDeleteRolesToggle}|${state.guildId}`)
      .setLabel(`Delete roles for disabled games: ${cfg.deleteDisabledRoles ? "ON" : "OFF"}`)
      .setStyle(cfg.deleteDisabledRoles ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${CustomIds.AdminConfigureDeleteRolesConfirm}|${state.guildId}`)
      .setLabel("Delete disabled roles NOW…")
      .setStyle(ButtonStyle.Danger)
  );

  components.push(rowButtons, rowDeleteOpt);
  return { embeds: [embed], components };
}

export function buildAdminSearchModal(sessionKey: string) {
  const modal = new ModalBuilder()
    .setCustomId(`${CustomIds.AdminConfigureSearch}|${sessionKey}`)
    .setTitle("Search games");

  const input = new TextInputBuilder()
    .setCustomId("query")
    .setLabel("Search query")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(50)
    .setPlaceholder("e.g., helldivers");

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  return modal;
}
