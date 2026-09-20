import { describe, expect, it } from "vitest";
import { BAKED_FRAMES } from "./capybara-3d";
import { characterFit } from "./character-fit";
import { pngOutfitSources } from "./wardrobe";

describe("PNG character fitting", () => {
  it("keeps all original poses within normalized head bounds", () => {
    for (const frame of BAKED_FRAMES) {
      const fit = characterFit(frame);
      expect(fit.x - fit.rx, frame).toBeGreaterThan(0);
      expect(fit.x + fit.rx, frame).toBeLessThan(1);
      expect(fit.y - fit.ry, frame).toBeGreaterThan(0);
      expect(fit.neck, frame).toBeGreaterThan(fit.y);
    }
  });
  it("distinguishes diagonals from their left or right suffix", () => {
    expect(characterFit("stand-down-left").turn).toBe(-0.55);
    expect(characterFit("stand-up-left").turn).toBe(-1.65);
    expect(characterFit("stand-left").turn).toBe(-1);
    expect(characterFit("stand-down-right").turn).toBe(0.55);
  });
  it("follows the crouch and jump instead of reusing the standing head", () => {
    expect(characterFit("pick-1-down").y).toBeGreaterThan(characterFit("stand-down").y);
    expect(characterFit("pick-2-down").y).toBeLessThan(characterFit("stand-down").y);
    expect(characterFit("pick-2-down").raised).toBe(true);
  });
  it("does not download mismatched 3D garments or glasses for a PNG character", () => {
    expect(pngOutfitSources({ onepiece: "overalls", glasses: "wood" })).toEqual([]);
    expect(pngOutfitSources({ hat: "straw", glasses: "wood" })).toHaveLength(1);
  });
});
