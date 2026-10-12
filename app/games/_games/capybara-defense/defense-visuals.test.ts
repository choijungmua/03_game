import { describe, expect, it } from "vitest";
import { RARITIES, getWavePressure } from "./defense-rules";
import { getBattlePressure, getDefenderVisual } from "./defense-visuals";

describe("defender grade and battlefield pressure", () => {
  it("keeps compact characters while increasing power and effects by grade", () => {
    for (let rank = 1; rank < RARITIES.length; rank++) {
      const current = RARITIES[rank], previous = RARITIES[rank - 1];
      expect(getDefenderVisual(current.id).size).toBe(getDefenderVisual(previous.id).size);
      expect(getDefenderVisual(current.id).size).toBeLessThan(50);
      expect(current.damageMultiplier).toBeGreaterThan(previous.damageMultiplier);
    }
    expect(getDefenderVisual("legendary").sparks).toBeGreaterThan(getDefenderVisual("common").sparks);
    expect(getDefenderVisual("apocalypse").sparks).toBeGreaterThan(getDefenderVisual("legendary").sparks);
  });
  it("reports actual enemy pressure, including threshold and terminal overflow", () => {
    expect(getBattlePressure(0, 80)).toMatchObject({ ratio: 0, level: "stable" });
    expect(getBattlePressure(32, 80).level).toBe("warning");
    expect(getBattlePressure(60, 80).level).toBe("danger");
    expect(getBattlePressure(81, 80)).toMatchObject({ ratio: 1, level: "danger" });
  });
  it("keeps opening waves approachable and progressively increases late resistance", () => {
    expect(getWavePressure(1)).toBe(getWavePressure(30));
    for (let round = 31; round <= 120; round++) expect(getWavePressure(round)).toBeGreaterThan(getWavePressure(round - 1));
    expect(getWavePressure(121)).toBe(getWavePressure(120));
  });
});
