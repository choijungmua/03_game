// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createWorld, isBlockingTile, LOBBY_SEED, nearestWater, TILE } from "./world";

const GAMES = Array.from({ length: 7 }, (_, i) => ({ slug: `game-${i}`, title: `게임 ${i}` }));
const tileUnder = (world: ReturnType<typeof createWorld>, x: number, y: number) =>
  world.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));

describe("카피바라 습지 마을", () => {
  it("같은 seed는 항상 같은 맵이다", () => {
    const a = createWorld(LOBBY_SEED, GAMES);
    const b = createWorld(LOBBY_SEED, GAMES);
    for (let ty = -120; ty < 120; ty += 3) {
      for (let tx = -120; tx < 120; tx += 3) expect(a.tileAt(tx, ty)).toBe(b.tileAt(tx, ty));
    }
  });

  it("좌우로 넓게 퍼지고, 오두막 문은 한 줄이 아니며, 좌우 대칭이다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const { halfWidth, top, bottom } = world.village;
    expect(halfWidth * 2).toBeGreaterThan((bottom - top + 1) * 2.5);
    expect(new Set(world.doors.map((door) => door.y)).size).toBeGreaterThanOrEqual(3);
    const positions = new Set(world.doors.map((door) => `${door.x},${door.y}`));
    for (const door of world.doors) expect(positions.has(`${-door.x},${door.y}`)).toBe(true);
  });

  it("문 앞은 데크이고, 바로 뒤가 자기 오두막이며, 가로 데크에서 데크로 이어진다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    expect(world.buildings).toHaveLength(GAMES.length);
    for (const door of world.doors) {
      expect(tileUnder(world, door.x, door.y)).toBe("deck");
      expect(tileUnder(world, door.x, door.y - TILE)).toBe("building");
    }
    // 날개 오두막 문 앞에서 가로 데크까지 데크만 밟고 내려갈 수 있다
    const wing = world.doors[1];
    for (let y = wing.y; y <= world.spawn.y; y += TILE / 2) expect(tileUnder(world, wing.x - 1, y)).toBe("deck");
  });

  it("스폰·통나무 앞은 걸을 수 있고, 온천·통나무는 막힌다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    expect(tileUnder(world, world.spawn.x, world.spawn.y)).toBe("deck");
    expect(tileUnder(world, world.spring.x, world.spring.y)).toBe("spring");
    expect(world.seats).toHaveLength(4);
    for (const seat of world.seats) {
      expect(tileUnder(world, seat.seatX, seat.seatY)).toBe("log");
      expect(isBlockingTile(tileUnder(world, seat.seatX, seat.standY))).toBe(false);
    }
  });

  it("마을은 갈대 울타리로 막혀 있고 동·서·남 입구로만 나간다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const { halfWidth: W, top, bottom } = world.village;
    const deckRow = Math.floor(world.spawn.y / TILE);
    expect(world.tileAt(0, bottom + 1)).toBe("deck"); // 남문
    expect(world.tileAt(-W - 1, deckRow)).toBe("deck"); // 서문
    expect(world.tileAt(W, deckRow)).toBe("deck"); // 동문
    expect(world.tileAt(-W - 1, -5)).toBe("fence");
    expect(world.tileAt(0, top - 1)).toBe("fence");
    expect(world.tileAt(8, bottom + 1)).toBe("fence");
  });

  it("바깥 습지에는 막히는 지형(물·나무·바위)이 섞여 있다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const found = new Set<string>();
    for (let ty = 60; ty < 260; ty++) {
      for (let tx = 60; tx < 260; tx++) found.add(world.tileAt(tx, ty));
    }
    expect(["water", "tree", "rock", "grass", "mud"].every((tile) => found.has(tile))).toBe(true);
  });

  it("물가에 서면 가까운 물을 찾고, 스폰(마을 한가운데)에선 못 찾는다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const tileAt = world.tileAt.bind(world);
    expect(nearestWater(tileAt, world.spawn.x, world.spawn.y, TILE * 1.5)).toBeNull();
    // 물 바로 왼쪽의 걸을 수 있는 칸을 찾아 그 가운데에 선다
    let shore: { x: number; y: number } | null = null;
    for (let ty = 60; ty < 260 && !shore; ty++) {
      for (let tx = 60; tx < 260 && !shore; tx++) {
        if (world.tileAt(tx, ty) === "water" && !isBlockingTile(world.tileAt(tx - 1, ty))) {
          shore = { x: (tx - 0.5) * TILE, y: (ty + 0.5) * TILE };
        }
      }
    }
    expect(shore).not.toBeNull();
    if (!shore) return;
    expect(nearestWater(tileAt, shore.x, shore.y, TILE * 1.5)).toEqual({ x: shore.x + TILE, y: shore.y });
  });
});
