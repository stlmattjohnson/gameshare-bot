import { ActivityType, Presence } from "discord.js";
import { gameCatalog } from "../catalog/catalog.js";

export function extractPlayingName(presence: Presence | null): string | null {
  if (!presence) return null;
  const act =
    presence.activities.find((a) => a.type === ActivityType.Playing) ??
    presence.activities.find((a) => a.name && a.type !== ActivityType.Custom);

  return act?.name ?? null;
}

export function matchPresenceToCatalog(presenceGameName: string) {
  return gameCatalog.matchPresenceGameNameToCatalog(presenceGameName);
}
