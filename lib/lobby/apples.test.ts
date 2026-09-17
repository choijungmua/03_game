// @vitest-environment node
import { describe, expect, it } from "vitest";

import { applesLeft, nearestTree, pickApple } from "./apples";
import { APPLE_REACH, APPLE_REGROW_MS, APPLES_PER_TREE } from "./constants";
import { createWorld, isBlockingTile, LOBBY_SEED, TILE } from "./world";

const GAMES = Array.from({ length: 7 }, (_, i) => ({ slug: `game-${i}`, title: `게임 ${i}` }));

describe("사과나무", () => {
  it("다 따면 더 못 따고, 시간이 지나면 다시 열린다", () => {
    const picked: number[] = [];
    for (let i = 0; i < APPLES_PER_TREE; i++) expect(pickApple(picked, 1000 + i)).toBe(true);
    expect(applesLeft(picked, 2000)).toBe(0);
    expect(pickApple(picked, 2000)).toBe(false);
    expect(applesLeft(picked, 1000 + APPLE_REGROW_MS)).toBe(1);
    expect(pickApple(picked, 1000 + APPLE_REGROW_MS)).toBe(true);
    expect(picked).toHaveLength(APPLES_PER_TREE);
  });

  it("마을 안 나무 타일에 서 있고, 바로 앞에서 딸 수 있다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    expect(world.appleTrees.length).toBeGreaterThanOrEqual(4);
    world.appleTrees.forEach((tree, i) => {
      const tx = Math.floor(tree.x / TILE);
      const ty = Math.floor(tree.y / TILE) - 1;
      expect(world.tileAt(tx, ty)).toBe("tree");
      expect(isBlockingTile(world.tileAt(tx, ty + 1))).toBe(false);
      expect(nearestTree(world.appleTrees, tree.x, tree.y + TILE * 0.5, APPLE_REACH)).toBe(i);
    });
    expect(nearestTree(world.appleTrees, world.spawn.x, world.spawn.y, APPLE_REACH)).toBe(-1);
  });
});
