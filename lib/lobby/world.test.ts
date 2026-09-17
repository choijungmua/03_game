// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BATH_RX,
  BATH_RY,
  BATH_OFFSET_Y,
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
const blockedAt = (world: ReturnType<typeof createWorld>, x: number, y: number) => world.blockedAt(x, y);

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
    expect(world.seats).toHaveLength(6); // 마을 4 + 강가 쉼터 2
    for (const seat of world.seats) {
      // 두 자리 모두 통나무 위이고, 일어나면 그 자리 바로 앞에 선다
      for (const spotX of seat.spots) {
        expect(tileUnder(world, spotX, seat.seatY)).toBe("log");
        expect(isBlockingTile(tileUnder(world, spotX, seat.standY))).toBe(false);
      }
    }
  });

  it("온천은 넓고, 둘레 한 칸까지 데크·오두막·통나무·등불과 겹치지 않으며, 목욕 자리는 전부 온천 안이다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const { spring } = world;
    let springTiles = 0;
    for (let ty = -15; ty <= 15; ty++) {
      for (let tx = -15; tx <= 15; tx++) {
        const tile = world.tileAt(tx, ty);
        if (tile === "spring") springTiles++;
        const around = ellipseDistance((tx + 0.5) * TILE - spring.x, (ty + 0.5) * TILE - spring.y, SPRING_RX + 1, SPRING_RY + 1);
        if (around < 1) expect(["spring", "meadow"]).toContain(tile);
      }
    }
    expect(springTiles).toBeGreaterThan(35); // 예전 반지름 2.6 원은 약 21칸
    const bathCenterY = spring.y + BATH_OFFSET_Y * TILE;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      const x = spring.x + Math.cos(angle) * BATH_RX * TILE;
      const y = bathCenterY + Math.sin(angle) * BATH_RY * TILE;
      expect(tileUnder(world, x, y)).toBe("spring");
    }
  });

  it("온천 곡선과 건물 그림의 빈 여백은 막지 않고 실제 바닥 면만 막는다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const building = world.buildings[0];
    expect(building).toBeDefined();
    if (!building) return;

    const colliderY = world.spring.y + SPRING_COLLIDER_OFFSET_Y * TILE;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      const dx = Math.cos(angle) * SPRING_RX * TILE;
      const dy = Math.sin(angle) * SPRING_COLLIDER_RY * TILE;
      expect(blockedAt(world, world.spring.x + dx * 1.05, colliderY + dy * 1.05)).toBe(false);
      expect(blockedAt(world, world.spring.x + dx * 0.95, colliderY + dy * 0.95)).toBe(true);
    }

    expect(world.spring.layerY).toBe(world.spring.y);

    expect(blockedAt(world, world.spring.x + TILE * 3.5, world.spring.y - TILE * 2)).toBe(false);
    expect(blockedAt(world, world.spring.x, world.spring.y + TILE * 3.5)).toBe(true);

    const centerX = (building.tx + 3) * TILE;
    expect(blockedAt(world, centerX, building.frontY - TILE * 3)).toBe(false);
    expect(blockedAt(world, centerX, building.frontY - TILE * 0.1)).toBe(true);
  });

  it("방명록 게시판은 막히고, 게시판 앞(Space로 여는 자리)은 스폰 데크라 걸을 수 있다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const { x, y } = world.guestbook;
    expect(tileUnder(world, x, y - TILE)).toBe("guestbook");
    expect(isBlockingTile("guestbook")).toBe(true);
    expect(tileUnder(world, x, y)).toBe("deck");
    expect(Math.abs(y - world.spawn.y)).toBeLessThan(TILE);
    expect(world.props).toContainEqual({ kind: "guestbook-board", tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) - 1 });
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

  it("스폰에서 진흙길을 따라 걸어서 강가 쉼터 잔교와 동·서 길 끝까지 갈 수 있다", () => {
    const world = createWorld(LOBBY_SEED, GAMES);
    const start = `${Math.floor(world.spawn.x / TILE)},${Math.floor(world.spawn.y / TILE)}`;
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      const [tx, ty] = (queue.pop() ?? "").split(",").map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${tx + dx},${ty + dy}`;
        if (seen.has(key) || Math.abs(tx + dx) > 90 || Math.abs(ty + dy) > 60 || isBlockingTile(world.tileAt(tx + dx, ty + dy))) continue;
        seen.add(key);
        queue.push(key);
      }
    }
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
