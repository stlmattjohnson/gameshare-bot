import {
  PermissionFlagsBits,
  ButtonInteraction,
  InteractionResponse,
} from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import {
  adminRequestsUxStore,
  renderAdminRequests,
  renderAdminRequestsUpdate,
} from "../../services/ux/adminRequestsUx.ts";
import { adminRequestApprovalService } from "../../services/adminRequestApprovalService.ts";
import { expiredMessage, resolveGuild } from "../utils.ts";

export async function handleAdminRequests(
  client: any,
  interaction: ButtonInteraction,
  base: string,
  key: string | null,
  encodedPresence: string | null,
): Promise<boolean | InteractionResponse<boolean>> {
  if (!key)
    return interaction.reply(expiredMessage("/gameshare admin requests"));

  const state = adminRequestsUxStore.get(key);
  if (!state)
    return interaction.reply(expiredMessage("/gameshare admin requests"));
  adminRequestsUxStore.touch(key);

  const memberPerms = interaction.memberPermissions;
  const isAdmin =
    memberPerms?.has(PermissionFlagsBits.ManageGuild) ||
    memberPerms?.has(PermissionFlagsBits.Administrator);
  if (!isAdmin)
    return interaction.reply({ content: "Admin only.", ephemeral: true });

  // Prev
  if (base === CustomIds.AdminRequestsPrev) {
    const next = adminRequestsUxStore.update(key, (s) => ({
      ...s,
      page: Math.max(0, s.page - 1),
    }));
    if (!next)
      return interaction.reply(expiredMessage("/gameshare admin requests"));
    const ui = await renderAdminRequests(key, next);
    const { ephemeral, ...updateOptions } = ui as any;
    return interaction
      .update(updateOptions)
      .then(() => true)
      .catch(() => true);
  }

  // Next
  if (base === CustomIds.AdminRequestsNext) {
    const next = adminRequestsUxStore.update(key, (s) => ({
      ...s,
      page: s.page + 1,
    }));
    if (!next)
      return interaction.reply(expiredMessage("/gameshare admin requests"));
    const ui = await renderAdminRequests(key, next);
    const { ephemeral, ...updateOptions } = ui as any;
    return interaction
      .update(updateOptions)
      .then(() => true)
      .catch(() => true);
  }

  // Done
  if (base === CustomIds.AdminRequestsDone) {
    adminRequestsUxStore.delete(key);
    return interaction
      .update({ content: "✅ Done.", embeds: [], components: [] })
      .then(() => true)
      .catch(() => true);
  }

  // Approve / Reject
  if (
    base === CustomIds.AdminRequestsApprove ||
    base === CustomIds.AdminRequestsReject
  ) {
    if (!encodedPresence)
      return interaction.reply(expiredMessage("/gameshare admin requests"));

    const requestId = Number(encodedPresence);
    if (!Number.isFinite(requestId))
      return interaction.reply({
        content: "Invalid request id.",
        ephemeral: true,
      });

    await interaction.deferUpdate().catch(() => null);

    if (base === CustomIds.AdminRequestsReject) {
      const res = await adminRequestApprovalService.reject(
        state.guildId,
        requestId,
      );
      if (!res.ok) {
        await interaction
          .followUp({ content: `⚠️ ${res.message}`, ephemeral: true })
          .catch(() => null);
      }
      const refreshed = adminRequestsUxStore.get(key);
      if (!refreshed) return true;
      await interaction
        .editReply(await renderAdminRequestsUpdate(key, refreshed))
        .catch(() => null);
      return true;
    }

    const guild = await resolveGuild(client, state.guildId);
    if (!guild) {
      await interaction
        .followUp({
          content:
            "I can’t access this server right now. Is the bot still in the guild?",
          ephemeral: true,
        })
        .catch(() => null);
      return true;
    }

    const res = await adminRequestApprovalService.approve(
      guild,
      state.guildId,
      requestId,
    );
    if (!res.ok) {
      await interaction
        .followUp({ content: `⚠️ ${res.message}`, ephemeral: true })
        .catch(() => null);
    } else {
      const addLine = res.requesterRoleAdded
        ? `✅ Added requester <@${res.requesterUserId}> to the role.`
        : `⚠️ Could not add requester <@${res.requesterUserId}> to the role: ${res.requesterRoleAddMessage ?? "unknown reason"}`;
      await interaction
        .followUp({
          content: `✅ Approved. Added **${res.gameName}** and enabled it for this server.\n${addLine}`,
          ephemeral: true,
        })
        .catch(() => null);
    }

    const refreshed = adminRequestsUxStore.get(key);
    if (!refreshed) return true;
    await interaction
      .editReply(await renderAdminRequestsUpdate(key, refreshed))
      .catch(() => null);
    return true;
  }

  return false;
}
