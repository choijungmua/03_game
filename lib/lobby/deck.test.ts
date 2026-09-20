import { describe, expect, it } from "vitest";

import { deckTextureMode } from "./deck";
import type { Tile } from "./world";

const tiles = (deckTiles: readonly string[]) => (tx: number, ty: number): Tile =>
  deckTiles.includes(`${tx},${ty}`) ? "deck" : "meadow";

describe("deckTextureMode", () => {
  it("returns horizontal when the deck continues left and right", () => {
    const tileAt = tiles(["-1,0", "0,0", "1,0"]);

    const mode = deckTextureMode(tileAt, 0, 0);

    expect(mode).toBe("horizontal");
  });

  it("returns vertical when the deck continues up and down", () => {
    const tileAt = tiles(["0,-1", "0,0", "0,1"]);

    const mode = deckTextureMode(tileAt, 0, 0);

    expect(mode).toBe("vertical");
  });

  it("returns connector when the deck turns or branches", () => {
    const tileAt = tiles(["0,-1", "0,0", "1,0"]);

    const mode = deckTextureMode(tileAt, 0, 0);

    expect(mode).toBe("connector");
  });

  it("returns vertical for a wide vertical deck", () => {
    const deckTiles = Array.from({ length: 15 }, (_, index) => {
      const tx = (index % 3) - 1;
      const ty = Math.floor(index / 3) - 2;
      return `${tx},${ty}`;
    });
    const tileAt = tiles(deckTiles);

    const mode = deckTextureMode(tileAt, 0, 0);

    expect(mode).toBe("vertical");
  });
});
