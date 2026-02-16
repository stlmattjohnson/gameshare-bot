import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionReplyOptions,
  InteractionUpdateOptions
} from "discord.js";
import { StateStore } from "./stateStore.js";
import { CustomIds } from "../../domain/constants.js";
import { gameAddRequestRepo } from "../../db/repositories/gameAddRequestRepo.js";

export type AdminRequestsState = {
  guildId: string;
  page: number;
};

const PAGE_SIZE = 5;

// 15-minute sessions like your other UIs
export const adminRequestsUxStore = new StateStore<AdminRequestsState>(15 * 60_000);

export function createAdminRequestsSession(state: AdminRequestsState): string {
  return adminRequestsUxStore.put(state);
}

async function buildAdminRequestsView(sessionKey: string, state: AdminRequestsState) {
  const all = await gameAddRequestRepo.listPending(state.guildId);
  const total = all.length;

  const maxPage = total === 0 ? 0 : Math.max(0, Math.floor((total - 1) / PAGE_SIZE));
  const page = Math.min(Math.max(state.page, 0), maxPage);

  const start = page * PAGE_SIZE;
  const pageItems = all.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle("Pending Game Add Requests")
    .setDescription(
      total === 0
        ? "No pending requests."
        : `Showing ${start + 1}-${Math.min(start + pageItems.length, total)} of ${total}`
    );

  if (pageItems.length > 0) {
    for (const req of pageItems) {
      embed.addFields([
        {
          name: `#${req.id} — ${req.presenceName}`,
          value: `Requested by <@${req.userId}>\nCreated: <t:${Math.floor(
            req.createdAt.getTime() / 1000
          )}:R>`
        }
      ]);
    }
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CustomIds.AdminRequestsPrev}|${sessionKey}`)
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`${CustomIds.AdminRequestsNext}|${sessionKey}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= maxPage),
    new ButtonBuilder()
      .setCustomId(`${CustomIds.AdminRequestsDone}|${sessionKey}`)
      .setLabel("Done")
      .setStyle(ButtonStyle.Primary)
  );

  // One row per request with approve/reject buttons
  const decisionRows = pageItems.map((req) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CustomIds.AdminRequestsApprove}|${sessionKey}|${req.id}`)
        .setLabel(`Approve: ${req.presenceName}`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${CustomIds.AdminRequestsReject}|${sessionKey}|${req.id}`)
        .setLabel(`Reject: ${req.presenceName}`)
        .setStyle(ButtonStyle.Danger)
    )
  );

  return {
    embeds: [embed],
    components: [navRow, ...decisionRows]
  };
}

/**
 * Use this when sending an initial ephemeral reply (slash command).
 */
export async function renderAdminRequests(
  sessionKey: string,
  state: AdminRequestsState
): Promise<InteractionReplyOptions> {
  const view = await buildAdminRequestsView(sessionKey, state);
  return { ...view, ephemeral: true };
}

/**
 * Use this when updating an existing interaction message (buttons).
 * Note: update/edit options do NOT allow `ephemeral`.
 */
export async function renderAdminRequestsUpdate(
  sessionKey: string,
  state: AdminRequestsState
): Promise<InteractionUpdateOptions> {
  return buildAdminRequestsView(sessionKey, state);
}
