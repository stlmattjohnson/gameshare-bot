import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionReplyOptions,
} from "discord.js";
import { CustomIds, PageSize } from "../../domain/constants.ts";
import { guildConfigService } from "../guildConfigService.ts";
import { StateStore } from "./stateStore.ts";
import { catalogService } from "../catalogService.ts";

export type AdminUxState = {
  guildId: string;
  query: string;
  page: number;
};

// 15-minute admin UI sessions
export const adminUxStore = new StateStore<AdminUxState>(15 * 60_000);

export const createAdminSession = (state: AdminUxState): string => {
  return adminUxStore.put(state);
};

export const renderAdminConfigure = async (
  sessionKey: string,
  state: AdminUxState,
): Promise<InteractionReplyOptions> => {
  const results = await catalogService.searchAll(state.guildId, state.query);
  const start = state.page * PageSize.AdminGames;
  const pageItems = results.slice(start, start + PageSize.AdminGames);

  const enabledIds = new Set(
    await guildConfigService.listEnabledGameIds(state.guildId),
  );

  const embed = new EmbedBuilder()
    .setTitle("Configure Games")
    .setDescription(
      [
        `Search: \`${state.query || "(none)"}\``,
        results.length === 0
          ? "Showing 0 of 0"
          : `Showing ${start + 1}-${Math.min(start + pageItems.length, results.length)} of ${results.length}`,
        "",
        "Use the buttons below to enable or disable games for this server.",
        "Tip: rerun /gameshare admin configure-games with the optional query argument to filter games.",
      ].join("\n"),
    );

  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (pageItems.length > 0) {
    const gameButtons = pageItems.map((g) => {
      const enabled = enabledIds.has(g.id);
      const prefix = enabled ? "✅" : "⬜";

      return new ButtonBuilder()
        .setCustomId(
          `${CustomIds.AdminConfigureToggleButton}|${sessionKey}|${g.id}`,
        )
        .setLabel(`${prefix} ${g.name.slice(0, 70)}`)
        .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary);
    });

    for (let i = 0; i < gameButtons.length; i += 5) {
      const chunk = gameButtons.slice(i, i + 5);
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(...chunk),
      );
    }
  } else {
    embed.addFields([
      { name: "No results", value: "Try a different search term." },
    ]);
  }

  const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
      .setStyle(ButtonStyle.Primary),
  );

  const cfg = await guildConfigService.getOrCreate(state.guildId);

  const rowDeleteOpt = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(
        `${CustomIds.AdminConfigureDeleteRolesToggle}|${state.guildId}`,
      )
      .setLabel(
        `Delete roles for disabled games: ${cfg.deleteDisabledRoles ? "ON" : "OFF"}`,
      )
      .setStyle(
        cfg.deleteDisabledRoles ? ButtonStyle.Success : ButtonStyle.Secondary,
      ),
    new ButtonBuilder()
      .setCustomId(
        `${CustomIds.AdminConfigureDeleteRolesConfirm}|${state.guildId}`,
      )
      .setLabel("Delete disabled roles NOW…")
      .setStyle(ButtonStyle.Danger),
  );

  components.push(rowButtons, rowDeleteOpt);
  return { embeds: [embed], components };
};

export const buildAdminSearchModal = () => {
  throw new Error(
    "Admin search modal is no longer used. Use the query option on /gameshare admin configure-games instead.",
  );
};
