import { ButtonInteraction, InteractionResponse } from "discord.js";
import { parseSessionCustomId } from "../utils.ts";
import { CustomIds } from "../../domain/constants.ts";
import { handleAdminRequests } from "./adminRequests.ts";
import { handleUnknownRequests } from "./unknownRequests.ts";
import { handleDmShareButtons } from "./dmShare.ts";
import { handleAdminConfigureButtons } from "./adminConfigure.ts";

export async function handleButtonInteraction(client: any, interaction: ButtonInteraction): Promise<boolean | InteractionResponse<boolean>> {
  const { base, key, b: encodedPresence } = parseSessionCustomId(interaction.customId);

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
  if (base === CustomIds.UnknownRequestAdd || base === CustomIds.UnknownNotNow) {
    return handleUnknownRequests(client, interaction, base, key, encodedPresence);
  }

  // DM Share Flow Buttons
  if (
    base === CustomIds.DmShareYes ||
    base === CustomIds.DmShareNo ||
    base === CustomIds.DmConfirmPost ||
    base === CustomIds.DmCancelPost
  ) {
    return handleDmShareButtons(client, interaction, base, key, encodedPresence);
  }

  // Admin configure small buttons
  if (base === CustomIds.AdminConfigureDeleteRolesToggle || base === CustomIds.AdminConfigureDeleteRolesConfirm) {
    return handleAdminConfigureButtons(client, interaction, base, key, encodedPresence);
  }

  return false;
}

export default null;
