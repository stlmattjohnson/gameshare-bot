import { describe, it, expect } from "vitest";
import { normalizeName } from "../catalog/normalize.js";
import { gameCatalog } from "../catalog/catalog.js";

describe("string matching", () => {
  it("normalizes names", () => {
    expect(normalizeName("  HELLDIVERS™  2 ")).toBe("helldivers 2");
  });

  it("matches catalog by presence", () => {
    const m = gameCatalog.matchPresenceGameNameToCatalog("Counter-Strike 2");
    expect(m?.id).toBe("g001");
  });
});
