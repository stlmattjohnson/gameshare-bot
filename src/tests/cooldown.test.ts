import { describe, it, expect } from "vitest";

describe("cooldown", () => {
  it("basic arithmetic sanity", () => {
    const mins = 30;
    expect(mins * 60_000).toBe(1_800_000);
  });
});
