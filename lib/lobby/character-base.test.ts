// @vitest-environment node
import { describe, expect, it } from "vitest";
import { characterBaseBounds } from "./character-base";

describe("original PNG pose scale", () => {
  it("keeps seated PNG heads at standing scale without moving the feet", () => {
    const bounds = [10, 20, 100] as const;
    const [left, top, size] = characterBaseBounds("idle-down", bounds);
    expect(size).toBe(80);
    expect(left + size / 2).toBe(60);
    expect(top + size * (1000 / 1024)).toBe(20 + 100 * (1000 / 1024));
  });

  it("normalizes sleep and the wider rear seated art but preserves standing poses", () => {
    const bounds = [0, 0, 100] as const;
    expect(characterBaseBounds("sleep-1", bounds)[2]).toBe(80);
    expect(characterBaseBounds("idle-up", bounds)[2]).toBe(72);
    expect(characterBaseBounds("stand-down", bounds)).toEqual(bounds);
    expect(characterBaseBounds("pick-1-down", bounds)).toEqual(bounds);
  });
});
