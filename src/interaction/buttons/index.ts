import { ButtonInteraction, Client, InteractionResponse } from "discord.js";
import { parseSessionCustomId } from "../utils.ts";
import { CustomIds } from "../../domain/constants.ts";
import { handleAdminRequests } from "./adminRequests.ts";
import { handleUnknownRequests } from "./unknownRequests.ts";
import { handleDmShareButtons } from "./dmShare.ts";
import { handleAdminConfigureButtons } from "./adminConfigure.ts";
import { handleUserRolesButtons } from "./userRoles.ts";

export async function handleButtonInteraction(
  client: Client,
  interaction: ButtonInteraction,
): Promise<boolean | InteractionResponse<boolean>> {
  const {
    base,
    key,
    b: encodedPresence,
  } = parseSessionCustomId(interaction.customId);

  // Admin Requests (prev/next/done/approve/reject)
  if (
    base === CustomIds.AdminRequestsPrev ||
    base === CustomIds.AdminRequestsNext ||
    base === CustomIds.AdminRequestsDone ||
    base === CustomIds.AdminRequestsApprove ||
    base === CustomIds.AdminRequestsReject
  ) {
    return handleAdminRequests(client, interaction, base, key, encodedPresence);
  }

  // Unknown request buttons (DM)
  if (
    base === CustomIds.UnknownRequestAdd ||
    base === CustomIds.UnknownNotNow
  ) {
    return handleUnknownRequests(
      client,
      interaction,
      base,
      key,
      encodedPresence,
    );
  }

  // DM Share Flow Buttons
  if (
    base === CustomIds.DmShareYes ||
    base === CustomIds.DmShareNo ||
    base === CustomIds.DmTimeout1d ||
    base === CustomIds.DmTimeout1w ||
    base === CustomIds.DmConfirmPost ||
    base === CustomIds.DmCancelPost
  ) {
    return handleDmShareButtons(client, interaction, base);
  }

  // User roles UI buttons
  if (
    base === CustomIds.UserRolesPrev ||
    base === CustomIds.UserRolesNext ||
    base === CustomIds.UserRolesClearAll ||
    base === CustomIds.UserRolesToggleButton
  ) {
    return handleUserRolesButtons(interaction, base);
  }

  // Admin configure UI buttons
  if (
    base === CustomIds.AdminConfigurePrev ||
    base === CustomIds.AdminConfigureNext ||
    base === CustomIds.AdminConfigureDone ||
    base === CustomIds.AdminConfigureToggleButton
  ) {
    return handleAdminConfigureButtons(interaction, base);
  }

  return false;
}

export default null;
