// @vitest-environment node
import { describe, expect, it } from "vitest";

import { applesLeft, nearestTree, pickApple, rollApple } from "./apples";
import { APPLE_KINDS, APPLE_ODDS, APPLE_REACH, APPLE_REGROW_MS, APPLES_PER_TREE } from "./constants";
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

  it("딴 사과 종류는 확률대로: 보통 사과가 제일 흔하고, 썩은 사과 다음, 초록 사과가 제일 드물다", () => {
    expect(Object.values(APPLE_ODDS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(rollApple(0)).toBe("사과");
    expect(rollApple(0.999999)).toBe("썩은 사과");
    const counts = { 사과: 0, "초록 사과": 0, "썩은 사과": 0 };
    for (let i = 0; i < 1000; i++) counts[rollApple(i / 1000)] += 1;
    for (const kind of APPLE_KINDS) expect(counts[kind] / 1000).toBeCloseTo(APPLE_ODDS[kind], 2);
    expect(counts.사과).toBeGreaterThan(counts["썩은 사과"]);
    expect(counts["썩은 사과"]).toBeGreaterThan(counts["초록 사과"]);
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
