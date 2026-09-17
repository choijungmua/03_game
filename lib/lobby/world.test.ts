// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BATH_RX,
  BATH_RY,
  BATH_OFFSET_Y,
  BUILDING_DEPTH,
  BUILDING_WIDTH,
  createWorld,
  ellipseDistance,
  isBlockingTile,
  LOBBY_SEED,
  nearestWater,
  SPRING_COLLIDER_OFFSET_Y,
  SPRING_COLLIDER_RY,
  REST_CY,
  SPRING_RX,
  SPRING_RY,
  TILE,
} from "./world";

const GAMES = Array.from({ length: 7 }, (_, i) => ({ slug: `game-${i}`, title: `게임 ${i}` }));
const tileUnder = (world: ReturnType<typeof createWorld>, x: number, y: number) =>
  world.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
/** 스폰에서 상하좌우로 걸어서 닿는 칸들 ("tx,ty") */
function walkableFromSpawn(world: ReturnType<typeof createWorld>) {
  const start = `${Math.floor(world.spawn.x / TILE)},${Math.floor(world.spawn.y / TILE)}`;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const [tx, ty] = (queue.pop() ?? "").split(",").map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const key = `${tx + dx},${ty + dy}`;
      if (seen.has(key) || Math.abs(tx + dx) > 100 || Math.abs(ty + dy) > 70 || isBlockingTile(world.tileAt(tx + dx, ty + dy))) continue;
      seen.add(key);
      queue.push(key);
    }
  }
  return seen;
}
const blockedAt = (world: ReturnType<typeof createWorld>, x: number, y: number) => world.blockedAt(x, y);

describe("카피바라 습지 마을", () => {
  it("같은 seed는 항상 같은 맵이다", () => {
    const a = createWorld(LOBBY_SEED, GAMES);
    const b = createWorld(LOBBY_SEED, GAMES);
    for (let ty = -120; ty < 120; ty += 3) {
      for (let tx = -120; tx < 120; tx += 3) expect(a.tileAt(tx, ty)).toBe(b.tileAt(tx, ty));
    }
  });

  it("오두막 문은 한 줄이 아니고 좌우 대칭이다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    expect(new Set(world.doors.map((door) => door.y)).size).toBeGreaterThanOrEqual(3);
    const positions = new Set(world.doors.map((door) => `${door.x},${door.y}`));
    for (const door of world.doors) expect(positions.has(`${-door.x},${door.y}`)).toBe(true);
  });

  it.each([7, 16])("오두막 %i채: 문 앞은 데크, 바로 뒤는 자기 오두막이고, 스폰에서 모든 문까지 걸어갈 수 있다", (count) => {
    const games = Array.from({ length: count }, (_, i) => ({ slug: `game-${i}`, title: `게임 ${i}` }));
    const world = createWorld(LOBBY_SEED, games);
    expect(world.buildings).toHaveLength(count);
    const reachable = walkableFromSpawn(world);
    for (const door of world.doors) {
      expect(tileUnder(world, door.x, door.y)).toBe("deck");
      expect(tileUnder(world, door.x, door.y - TILE)).toBe("building");
      expect(reachable.has(`${Math.floor(door.x / TILE)},${Math.floor(door.y / TILE)}`)).toBe(true);
    }
    // 오두막끼리 겹치지 않는다
    const cells = new Set<string>();
    let total = 0;
    for (const building of world.buildings) {
      for (let dy = 1; dy <= BUILDING_DEPTH; dy++) {
        for (let dx = 0; dx < BUILDING_WIDTH; dx++) {
          cells.add(`${building.tx + dx},${building.frontY / TILE - dy}`);
          total++;
        }
      }
    }
    expect(cells.size).toBe(total);
  });

  it("스폰·통나무 앞은 걸을 수 있고, 온천·통나무는 막힌다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    expect(tileUnder(world, world.spawn.x, world.spawn.y)).toBe("deck");
    for (const spring of world.springs) expect(tileUnder(world, spring.x, spring.y)).toBe("spring");
    expect(world.seats).toHaveLength(6); // 노천탕 앞 2 + 남문 데크 옆 2 + 강가 쉼터 2
    for (const seat of world.seats) {
      // 두 자리 모두 통나무 위이고, 일어나면 그 자리 바로 앞에 선다
      for (const spotX of seat.spots) {
        expect(tileUnder(world, spotX, seat.seatY)).toBe("log");
        expect(isBlockingTile(tileUnder(world, spotX, seat.standY))).toBe(false);
      }
    }
  });

  it("온천은 여러 개이고, 둘레 한 칸까지 데크·오두막·통나무·등불과 겹치지 않으며, 목욕 자리는 전부 온천 안이다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    expect(world.springs.length).toBeGreaterThanOrEqual(3);
    for (const spring of world.springs) {
      let springTiles = 0;
      const [cx, cy] = [Math.floor(spring.x / TILE), Math.floor(spring.y / TILE)];
      for (let ty = cy - 8; ty <= cy + 8; ty++) {
        for (let tx = cx - 8; tx <= cx + 8; tx++) {
          const tile = world.tileAt(tx, ty);
          const around = ellipseDistance((tx + 0.5) * TILE - spring.x, (ty + 0.5) * TILE - spring.y, SPRING_RX + 1, SPRING_RY + 1);
          if (around >= 1) continue;
          if (tile === "spring") springTiles++;
          expect(["spring", "meadow"]).toContain(tile);
        }
      }
      expect(springTiles).toBeGreaterThan(35);
      const bathCenterY = spring.y + BATH_OFFSET_Y * TILE;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        const x = spring.x + Math.cos(angle) * BATH_RX * TILE;
        const y = bathCenterY + Math.sin(angle) * BATH_RY * TILE;
        expect(tileUnder(world, x, y)).toBe("spring");
      }
    }
  });

  it("온천마다 곡선과 건물 그림의 빈 여백은 막지 않고 실제 바닥 면만 막는다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const building = world.buildings[0];
    expect(building).toBeDefined();
    if (!building) return;

    for (const spring of world.springs) {
      const colliderY = spring.y + SPRING_COLLIDER_OFFSET_Y * TILE;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        const dx = Math.cos(angle) * SPRING_RX * TILE;
        const dy = Math.sin(angle) * SPRING_COLLIDER_RY * TILE;
        expect(blockedAt(world, spring.x + dx * 1.05, colliderY + dy * 1.05)).toBe(false);
        expect(blockedAt(world, spring.x + dx * 0.95, colliderY + dy * 0.95)).toBe(true);
      }
      expect(spring.layerY).toBe(spring.y);
      expect(blockedAt(world, spring.x, spring.y + TILE * 3.5)).toBe(true);
    }

    const centerX = (building.tx + 3) * TILE;
    expect(blockedAt(world, centerX, building.frontY - TILE * 3)).toBe(false);
    expect(blockedAt(world, centerX, building.frontY - TILE * 0.1)).toBe(true);
  });

  it("방명록 게시판은 막히고, 게시판 앞(Space로 여는 자리)은 스폰 가까이 걸을 수 있는 자리다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const { x, y } = world.guestbook;
    expect(tileUnder(world, x, y - TILE)).toBe("guestbook");
    expect(isBlockingTile("guestbook")).toBe(true);
    expect(isBlockingTile(tileUnder(world, x, y))).toBe(false);
    expect(Math.hypot(x - world.spawn.x, y - world.spawn.y)).toBeLessThan(TILE * 5);
    expect(world.props).toContainEqual({ kind: "guestbook-board", tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) - 1 });
  });

  it("마을은 갈대 울타리로 막혀 있고 동·서·남 입구로만 나간다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const { halfWidth: W, top, bottom } = world.village;
    expect(world.tileAt(0, bottom + 1)).toBe("deck"); // 남문
    expect(world.tileAt(-W - 1, 0)).toBe("deck"); // 서문
    expect(world.tileAt(W, 0)).toBe("deck"); // 동문
    expect(world.tileAt(-W - 1, -5)).toBe("fence");
    expect(world.tileAt(0, top - 1)).toBe("fence");
    expect(world.tileAt(8, bottom + 1)).toBe("fence");
  });

  it("스폰에서 진흙길을 따라 걸어서 강가 쉼터 잔교와 동·서 길 끝까지 갈 수 있다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const seen = walkableFromSpawn(world);
    expect(world.tileAt(0, REST_CY)).toBe("deck");
    expect(seen.has(`0,${REST_CY}`)).toBe(true);
    const W = world.village.halfWidth;
    const trailEnd = [...seen].filter((key) => Math.abs(Number(key.split(",")[0]) + 0.5) >= W + 29);
    expect(trailEnd.length).toBeGreaterThan(0);
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
