import { ModalSubmitInteraction } from "discord.js";
import { CustomIds } from "../../domain/constants.ts";
import {
  adminUxStore,
  renderAdminConfigure,
} from "../../services/ux/adminConfigureGamesUx.ts";
import { parseSessionCustomId, expiredMessage } from "../utils.ts";

export async function handleAdminConfigureSearch(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  const { base, key } = parseSessionCustomId(interaction.customId);

  if (base === CustomIds.AdminConfigureSearch) {
    if (!key)
      return interaction
        .reply(expiredMessage("/gameshare admin configure-games"))
        .then(() => true)
        .catch(() => true);

    const state = adminUxStore.get(key);
    if (!state)
      return interaction
        .reply(expiredMessage("/gameshare admin configure-games"))
        .then(() => true)
        .catch(() => true);
    adminUxStore.touch(key);

    const q = (interaction.fields.getTextInputValue("query") ?? "").trim();
    const next = adminUxStore.update(key, (s) => ({ ...s, query: q, page: 0 }));
    if (!next)
      return interaction
        .reply(expiredMessage("/gameshare admin configure-games"))
        .then(() => true)
        .catch(() => true);

    const ui = await renderAdminConfigure(key, next);
    return interaction
      .reply({ ...(ui as any), ephemeral: true })
      .then(() => true)
      .catch(() => true);
  }

  return false;
}
