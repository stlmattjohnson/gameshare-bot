import { gameCatalog } from "../catalog/catalog.ts";
import { normalizeName } from "../catalog/normalize.ts";
import { customGameRepo } from "../db/repositories/customGameRepo.ts";

export type AnyGame = {
  id: string;
  name: string;
  kind: "STATIC" | "CUSTOM";
};

export const catalogService = {
  async matchPresence(guildId: string, presenceName: string): Promise<AnyGame | null> {
    const staticMatch = gameCatalog.matchPresenceGameNameToCatalog(presenceName);
    if (staticMatch) return { id: staticMatch.id, name: staticMatch.name, kind: "STATIC" };

    const norm = normalizeName(presenceName);
    const customs = await customGameRepo.list(guildId);
    for (const cg of customs) {
      const candidates = [cg.name, cg.presenceName].filter(Boolean) as string[];
      if (candidates.some((c) => normalizeName(c) === norm)) {
        return { id: cg.id, name: cg.name, kind: "CUSTOM" };
      }
    }
    return null;
  },

  async searchAll(guildId: string, query: string): Promise<AnyGame[]> {
    const statics = gameCatalog
      .search(query)
      .map((g) => ({ id: g.id, name: g.name, kind: "STATIC" as const }));

    const q = normalizeName(query);
    const customsRaw = await customGameRepo.list(guildId);
    const customs = customsRaw
      .filter((c) => !q || normalizeName(c.name).includes(q) || (c.presenceName && normalizeName(c.presenceName).includes(q)))
      .map((c) => ({ id: c.id, name: c.name, kind: "CUSTOM" as const }));

    // Put custom games first so they're easy to find
    return [...customs, ...statics];
  },

  async getAnyGameById(guildId: string, gameId: string): Promise<AnyGame | null> {
    const staticGame = gameCatalog.getById(gameId);
    if (staticGame) return { id: staticGame.id, name: staticGame.name, kind: "STATIC" };

    const custom = await customGameRepo.findById(guildId, gameId);
    if (custom) return { id: custom.id, name: custom.name, kind: "CUSTOM" };

    return null;
  },

  async getAnyGamesByIds(guildId: string, ids: string[]): Promise<AnyGame[]> {
    if (ids.length === 0) return [];

    // 1) statics
    const staticGames: AnyGame[] = [];
    const customIds: string[] = [];

    for (const id of ids) {
      const sg = gameCatalog.getById(id);
      if (sg) staticGames.push({ id: sg.id, name: sg.name, kind: "STATIC" });
      else customIds.push(id);
    }

    // 2) customs
    const customNameMap = await customGameRepo.getNamesByIds(guildId, customIds);
    const customGames: AnyGame[] = customIds
      .map((id) => {
        const name = customNameMap.get(id);
        return name ? ({ id, name, kind: "CUSTOM" } as const) : null;
      })
      .filter(Boolean) as AnyGame[];

    // preserve original order of ids
    const all = new Map<string, AnyGame>([...staticGames, ...customGames].map((g) => [g.id, g]));
    return ids.map((id) => all.get(id)).filter(Boolean) as AnyGame[];
  }
};
