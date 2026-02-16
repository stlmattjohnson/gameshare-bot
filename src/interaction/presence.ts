import { Presence } from "discord.js";
import { optInService } from "../services/optInService.ts";
import {
  extractPlayingName,
  matchPresenceToCatalog,
} from "../services/gameDetectionService.ts";
import { dmShareFlowService } from "../services/dmShareFlowService.ts";
import { catalogService } from "../services/catalogService.ts";
import { unknownGameRequestService } from "../services/unknownGameRequestService.ts";
import { customGameRepo } from "../db/repositories/customGameRepo.ts";
import { logger } from "../logger.ts";
import { guildConfigService } from "../services/guildConfigService.ts";

export const registerPresenceHandler = (client: any) => {
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

        const matched =
          matchPresenceToCatalog(newName) ??
          (await customGameRepo.findByName(guildId, newName));
        if (!matched) return;

        const enabled = await guildConfigService.isEnabled(guildId, matched.id);
        if (!enabled) return;

        const canPrompt = await dmShareFlowService.canPrompt(
          guildId,
          userId,
          matched.id,
        );
        if (!canPrompt) return;

        const inFlight = await dmShareFlowService.isInFlight(
          guildId,
          userId,
          matched.id,
        );
        if (inFlight) return;

        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return;

        await dmShareFlowService.setInFlight(guildId, userId, matched.id, true);
        await dmShareFlowService.markPrompted(guildId, userId, matched.id);

        await dmShareFlowService.sendInitialDm(user, {
          guildId,
          userId,
          gameId: matched.id,
          gameName: matched.name,
          detailKind: "NONE",
        });
      } catch (err) {
        logger.warn({ err }, "presenceUpdate handler failed");
      }
    },
  );
};
