import { Client, Presence, EmbedBuilder, TextChannel } from "discord.js";
import { optInService } from "../services/optInService.ts";
import { extractPlayingName } from "../services/gameDetectionService.ts";
import { catalogService } from "../services/catalogService.ts";
import { dmShareFlowService } from "../services/dmShareFlowService.ts";
import { unknownGameRequestService } from "../services/unknownGameRequestService.ts";
import { logger } from "../logger.ts";
import { guildConfigService } from "../services/guildConfigService.ts";

const presenceDebounceMs = 750;
const lastHandledByUser = new Map<string, number>();

export const registerPresenceHandler = (client: Client) => {
  client.on(
    "presenceUpdate",
    async (oldPresence: Presence | null, newPresence: Presence) => {
      try {
        const guildId = newPresence.guild?.id;
        const userId = newPresence.userId;
        if (!guildId || !userId) return;

        const key = `${guildId}:${userId}`;
        const now = Date.now();
        const last = lastHandledByUser.get(key);
        if (last && now - last < presenceDebounceMs) return;
        lastHandledByUser.set(key, now);

        // If user's presence changed, expire any active sessions for that user in this guild
        try {
          const active = await dmShareFlowService.getActiveSessionsForUser(
            guildId,
            userId,
          );
          if (active && active.length) {
            // Process most recent sessions first and cap how many we touch
            const sorted = [...active].sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            );

            const guildObj = newPresence.guild
              ? newPresence.guild
              : await client.guilds.fetch(guildId).catch(() => null);

            for (const s of sorted) {
              try {
                if (!s.messageId) continue;
                const ch = guildObj
                  ? await guildObj.channels.fetch(s.channelId).catch(() => null)
                  : null;
                const msg =
                  ch && (ch as TextChannel).messages
                    ? await (ch as TextChannel).messages
                        .fetch(s.messageId)
                        .catch(() => null)
                    : null;
                if (msg) {
                  // Edit to past tense and remove details/react blurb
                  const newEmbed = msg.embeds[0]
                    ? new EmbedBuilder()
                        .setTitle(msg.embeds[0].title ?? "")
                        .setDescription(
                          s.userId ? `<@${s.userId}> was playing` : "",
                        )
                    : null;
                  if (newEmbed) {
                    await msg
                      .edit({ embeds: [newEmbed], content: undefined })
                      .catch(() => null);
                  }
                  // Remove all reactions
                  try {
                    await msg.reactions.removeAll().catch(() => {});
                  } catch {}
                }
              } catch (err) {
                // ignore per-session errors
              }
            }

            // mark all sessions inactive in DB in a single call
            await dmShareFlowService.markSessionsInactiveForUser(
              guildId,
              userId,
            );
          }
        } catch (err) {
          // non-fatal
        }

        // Compute old/new game names as early as possible and
        // short-circuit if there's no meaningful change.
        const oldName = extractPlayingName(oldPresence);
        const newName = extractPlayingName(newPresence);
        if (!newName || oldName === newName) return;

        const optedIn = await optInService.isOptedIn(guildId, userId);
        if (!optedIn) return;

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
        if (!enabled) {
          const ok = await unknownGameRequestService.shouldPrompt(
            guildId,
            userId,
            game.name,
          );
          if (!ok) return;

          await unknownGameRequestService.markPrompted(
            guildId,
            userId,
            game.name,
          );
          await unknownGameRequestService
            .sendDisabledKnownPrompt(newPresence.user!, guildId, game.name)
            .catch(() => null);
          return;
        }

        // Run ignore/timeout/cooldown checks in parallel – they don't
        // depend on each other and all just gate whether we can prompt.
        const [ignored, timedOut, canPrompt] = await Promise.all([
          dmShareFlowService.isIgnored(guildId, userId, game.id),
          dmShareFlowService.isTimedOut(guildId, userId, game.id),
          dmShareFlowService.canPrompt(guildId, userId, game.id),
        ]);

        if (ignored || timedOut || !canPrompt) return;

        const acquired = await dmShareFlowService.tryAcquirePromptSlot(
          guildId,
          userId,
          game.id,
        );
        if (!acquired) return;

        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return;

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
