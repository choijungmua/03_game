import { describe, expect, it } from "vitest";

import {
  createWorld,
  isBlockingTile,
  LOBBY_SEED,
  nearestWater,
  playerBodyBlocked,
  TILE,
  worldToViewport,
} from "./world";

const GAMES = Array.from({ length: 7 }, (_, index) => ({ slug: `game-${index}`, title: `게임 ${index}` }));
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

function findShoreApproach(world: ReturnType<typeof createWorld>) {
  for (let ty = -70; ty <= 70; ty += 1) {
    for (let tx = -100; tx <= 100; tx += 1) {
      const x = (tx - 0.5) * TILE;
      const y = (ty + 0.5) * TILE;
      if (world.tileAt(tx, ty) === "water" && !world.blockedAt(x, y)) return { x, y };
    }
  }
  throw new Error("walkable fishing shore not found");
}

describe("lobby interaction geometry", () => {
  it("keeps every interaction target at the same camera-relative point across CSS viewports", () => {
    // Given
    const world = createWorld(LOBBY_SEED, GAMES);
    const door = world.doors[0];
    const seat = world.seats[0];
    const spring = world.springs[0];
    const apple = world.appleTrees[0];
    if (!door || !seat || !spring || !apple) throw new Error("lobby interaction fixtures are incomplete");
    const targets = [
      { kind: "door", point: { x: door.x, y: door.y } },
      { kind: "seat", point: { x: seat.seatX, y: seat.standY } },
      { kind: "spring", point: { x: spring.x, y: spring.y + TILE * 4.1 } },
      { kind: "apple", point: { x: apple.x, y: apple.y + TILE * 1.5 } },
      { kind: "shore", point: findShoreApproach(world) },
      { kind: "guestbook", point: world.guestbook },
    ] as const;
    const camera = { x: world.spawn.x, y: world.spawn.y };

    // When
    const offsets = targets.map(({ kind, point }) => ({
      kind,
      offsets: VIEWPORTS.map((viewport) => {
        const screen = worldToViewport(point, camera, viewport);
        return { x: screen.x - viewport.width / 2, y: screen.y - viewport.height / 2 };
      }),
    }));

    // Then
    for (const { offsets: targetOffsets } of offsets) expect(targetOffsets[0]).toEqual(targetOffsets[1]);
  });

  it("keeps collision results in world space instead of scaling them with the viewport", () => {
    // Given
    const world = createWorld(LOBBY_SEED, GAMES);
    const door = world.doors[0];
    const spring = world.springs[0];
    if (!door || !spring) throw new Error("lobby collision fixtures are incomplete");
    const points = [
      { x: door.x, y: door.y - TILE * 0.1 },
      { x: door.x, y: door.y + TILE * 1.5 },
      { x: spring.x, y: spring.y + TILE * 1.05 },
      { x: spring.x, y: spring.y + TILE * 3.5 },
      { x: world.guestbook.x, y: world.guestbook.y - TILE },
    ] as const;
    const camera = { x: world.spawn.x, y: world.spawn.y };

    // When
    const results = points.map((point) =>
      VIEWPORTS.map((viewport) => {
        const screen = worldToViewport(point, camera, viewport);
        const restored = {
          x: screen.x - viewport.width / 2 + camera.x,
          y: screen.y - viewport.height / 2 + camera.y,
        };
        return playerBodyBlocked(world.blockedAt, restored);
      }),
    );

    // Then
    for (const [desktop, mobile] of results) expect(desktop).toBe(mobile);
    expect(results.some(([desktop]) => desktop)).toBe(true);
    expect(nearestWater(world.tileAt, world.spawn.x, world.spawn.y, TILE * 1.5)).toBeNull();
    expect(isBlockingTile(world.tileAt(Math.floor(world.guestbook.x / TILE), Math.floor((world.guestbook.y - TILE) / TILE)))).toBe(true);
  });
});
