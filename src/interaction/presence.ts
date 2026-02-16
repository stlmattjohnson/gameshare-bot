import { Client, Presence } from "discord.js";
import { optInService } from "../services/optInService.ts";
import { extractPlayingName } from "../services/gameDetectionService.ts";
import { catalogService } from "../services/catalogService.ts";
import { dmShareFlowService } from "../services/dmShareFlowService.ts";
import { unknownGameRequestService } from "../services/unknownGameRequestService.ts";
import { logger } from "../logger.ts";
import { guildConfigService } from "../services/guildConfigService.ts";

export const registerPresenceHandler = (client: Client) => {
  client.on(
    "presenceUpdate",
    async (oldPresence: Presence | null, newPresence: Presence) => {
      try {
        const guildId = newPresence.guild?.id;
        const userId = newPresence.userId;
        if (!guildId || !userId) return;

        const optedIn = await optInService.isOptedIn(guildId, userId);
        if (!optedIn) return;

        const oldName = extractPlayingName(oldPresence);
        const newName = extractPlayingName(newPresence);
        if (!newName || oldName === newName) return;

        const game = await catalogService.matchPresence(guildId, newName);
        if (!game) {
          const ok = await unknownGameRequestService.shouldPrompt(
            guildId,
            userId,
            newName,
          );
          if (!ok) return;

          await unknownGameRequestService.markPrompted(
            guildId,
            userId,
            newName,
          );
          await unknownGameRequestService
            .sendUnknownPrompt(newPresence.user!, guildId, newName)
            .catch(() => null);
          return;
        }

        const enabled = await guildConfigService.isEnabled(guildId, game.id);
        if (!enabled) return;

        const canPrompt = await dmShareFlowService.canPrompt(
          guildId,
          userId,
          game.id,
        );
        if (!canPrompt) return;

        const inFlight = await dmShareFlowService.isInFlight(
          guildId,
          userId,
          game.id,
        );
        if (inFlight) return;

        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return;

        await dmShareFlowService.setInFlight(guildId, userId, game.id, true);
        await dmShareFlowService.markPrompted(guildId, userId, game.id);

        await dmShareFlowService.sendInitialDm(user, {
          guildId,
          userId,
          gameId: game.id,
          gameName: game.name,
          detailKind: "NONE",
        });
      } catch (err) {
        logger.warn({ err }, "presenceUpdate handler failed");
      }
    },
  );
};
