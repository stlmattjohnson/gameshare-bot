import games from "./games.json" assert { type: "json" };
import { normalizeName } from "./normalize.js";
import { aliases } from "./aliases.js";

export type GameCatalogItem = {
  id: string;
  name: string;
  steamAppId?: number;
};

const list = games as GameCatalogItem[];

const byId = new Map(list.map((g) => [g.id, g]));
const byNormName = new Map(list.map((g) => [normalizeName(g.name), g]));

export const gameCatalog = {
  all(): GameCatalogItem[] {
    return list;
  },
  getById(id: string): GameCatalogItem | undefined {
    return byId.get(id);
  },
  search(query: string): GameCatalogItem[] {
    const q = normalizeName(query);
    if (!q) return list;
    return list.filter((g) => normalizeName(g.name).includes(q));
  },
  matchPresenceGameNameToCatalog(presenceName: string): GameCatalogItem | null {
    const norm = normalizeName(presenceName);
    const aliasTarget = aliases[norm] ? normalizeName(aliases[norm]!) : null;
    const direct = byNormName.get(norm);
    if (direct) return direct;
    if (aliasTarget) {
      const aliased = byNormName.get(aliasTarget);
      if (aliased) return aliased;
    }
    // Heuristic: remove trailing " (…)" or " - …"
    const simplified = norm.replace(/\s*\(.*\)\s*$/, "").replace(/\s*-\s*.*$/, "").trim();
    return byNormName.get(simplified) ?? null;
  }
};
