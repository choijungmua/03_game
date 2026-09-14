// 로비 오픈월드: seed 하나로 끝없는 타일 맵을 결정적으로 만든다 (맵은 하나로 고정, 사용자가 바꾸지 않는다).
// 저장하는 맵 데이터가 없고 누구의 브라우저에서든 같은 맵이 나온다 (멀티 플레이어가 같은 세상을 본다)
// 테마는 "카피바라 온천 습지 마을": 카피바라가 사는 남미 강가 습지 + 일본 동물원의 카피바라 유자 온천.
// 가운데 유자 온천을 두고 나무 데크 산책로가 좌우로 뻗으며, 날개마다 게임 오두막이 앞줄·뒷줄 지그재그로 서 있다.
// 오두막 지붕 위 아이콘(게임기·비행기 등)으로 무슨 게임인지 알리고, 문 앞에 가면 그 게임에 들어간다

import type { GameEntry } from "@/lib/games/types";
import { BUILDING_ASSETS } from "@/lib/lobby/assets";

export const TILE = 48;
export const LOBBY_SEED = "ggpli";
/** 걷기 속도(px/s). 서버의 순간이동 검사도 이 값을 쓴다 */
export const WALK_SPEED = 240;

export type Direction = "up" | "down" | "left" | "right";
export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];
/** 캐릭터가 바라보는 8방향 (걷기 스프라이트는 8방향, 앉기·때리기는 4방향만 있다) */
export type Facing = Direction | "up-left" | "up-right" | "down-left" | "down-right";
export const FACINGS: readonly Facing[] = [...DIRECTIONS, "up-left", "up-right", "down-left", "down-right"];
const DIAGONAL = Math.SQRT1_2;
export const FACING_VECTORS: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  "up-left": [-DIAGONAL, -DIAGONAL],
  "up-right": [DIAGONAL, -DIAGONAL],
  "down-left": [-DIAGONAL, DIAGONAL],
  "down-right": [DIAGONAL, DIAGONAL],
};

/** 4방향 스프라이트만 있는 동작(앉기·때리기)에 쓰는 가장 가까운 상하좌우. 대각선은 옆모습 */
export function toDirection(facing: Facing): Direction {
  if (facing.endsWith("left")) return "left";
  if (facing.endsWith("right")) return "right";
  return facing === "up" ? "up" : "down";
}

export const TILES = [
  "meadow", // 마을 안 풀밭
  "grass", // 마을 밖 풀밭
  "mud", // 진흙길
  "water", // 습지 물
  "deck", // 나무 데크 산책로
  "tree",
  "rock", // 이끼 바위 줄
  "fence", // 갈대 울타리
  "building",
  "spring", // 유자 온천
  "log", // 통나무 의자
  "lantern",
  "reeds",
  "guestbook", // 방명록 게시판
] as const;
export type Tile = (typeof TILES)[number];
const WALKABLE: ReadonlySet<Tile> = new Set<Tile>(["meadow", "grass", "mud", "deck"]);

/** 오두막 한 채 폭·깊이(타일) */
export const BUILDING_WIDTH = 6;
export const BUILDING_DEPTH = 5;
export const BUILDING_VARIANTS = BUILDING_ASSETS.length;
export const SPRING_RADIUS = 2.6;
/** 온천 가운데(타일) */
const SPRING_TY = 2;
/** 가운데 대표 오두막 정면 y(타일) */
const CENTER_FRONT = -5;
/** 날개 오두막: 첫 오두막 가운데 x, 간격, 정면 y(앞줄·뒷줄 번갈아 → 오두막이 한 줄로 늘어서지 않는다) */
const WING_START = 10;
const WING_STEP = 9;
const WING_FRONTS = [3, -4];
/** 마을 위·아래 울타리 줄(타일). 마을 안쪽은 y ∈ (TOP, BOTTOM) */
const TOP = -11;
const BOTTOM = 10;
/** 가로 데크 산책로 두 줄(타일 y). 스폰·동서 입구가 이 줄에 있다 */
const DECK_ROWS = [6, 7];

export type DoorGame = Pick<GameEntry, "slug" | "title">;

export interface Door extends DoorGame {
  /** 오두막 문 바로 앞 월드 좌표(px). 여기에 가까이 가면 입장 */
  x: number;
  y: number;
}

export interface Building {
  slug: string;
  variant: number;
  /** 오두막 왼쪽 타일 x, 정면(마을 쪽) 경계의 월드 y(px) */
  tx: number;
  frontY: number;
}

export interface Seat {
  /** 앉았을 때 엉덩이 위치(px) */
  seatX: number;
  seatY: number;
  /** 통나무 하나에 두 마리가 앉는 왼쪽·오른쪽 자리의 엉덩이 x(px) */
  spots: readonly [number, number];
  /** 일어나면 서는 위치(px) — 통나무 바로 앞 */
  standY: number;
}

export interface Prop {
  kind: "lantern" | "reeds" | "guestbook-board";
  tx: number;
  ty: number;
}

export interface World {
  seed: string;
  doors: Door[];
  buildings: Building[];
  seats: Seat[];
  props: Prop[];
  spring: { x: number; y: number };
  /** 방명록 게시판 바로 앞 월드 좌표(px). 여기 가까이서 Space를 누르면 방명록이 열린다 */
  guestbook: { x: number; y: number };
  /** 마을 안쪽 경계(타일): x ∈ [-halfWidth, halfWidth-1], y ∈ [top, bottom] */
  village: { halfWidth: number; top: number; bottom: number };
  spawn: { x: number; y: number };
  tileAt(tx: number, ty: number): Tile;
}

export function isBlockingTile(tile: Tile) {
  return !WALKABLE.has(tile);
}

/** 발 위치(px)에서 reach(px) 안의 가장 가까운 물 타일 가운데. 없으면 null — 낚시 찌를 던질 곳 */
export function nearestWater(tileAt: (tx: number, ty: number) => Tile, x: number, y: number, reach: number) {
  const range = Math.ceil(reach / TILE);
  const fx = Math.floor(x / TILE);
  const fy = Math.floor(y / TILE);
  let best: { x: number; y: number } | null = null;
  let bestDistance = reach;
  for (let ty = fy - range; ty <= fy + range; ty++) {
    for (let tx = fx - range; tx <= fx + range; tx++) {
      if (tileAt(tx, ty) !== "water") continue;
      const wx = (tx + 0.5) * TILE;
      const wy = (ty + 0.5) * TILE;
      const distance = Math.hypot(wx - x, wy - y);
      if (distance <= bestDistance) {
        best = { x: wx, y: wy };
        bestDistance = distance;
      }
    }
  }
  return best;
}

function seedNumber(seed: string) {
  let hash = 2166136261; // FNV-1a
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 격자 좌표 → [0, 1) 난수. 같은 입력이면 항상 같은 값 */
export function hash2(seed: number, x: number, y: number) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function valueNoise(seed: number, x: number, y: number, scale: number) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const sx = smooth(fx - x0);
  const sy = smooth(fy - y0);
  const top = lerp(hash2(seed, x0, y0), hash2(seed, x0 + 1, y0), sx);
  const bottom = lerp(hash2(seed, x0, y0 + 1), hash2(seed, x0 + 1, y0 + 1), sx);
  return lerp(top, bottom, sy);
}

export function createWorld(seed: string, games: readonly DoorGame[]): World {
  const s = seedNumber(seed);

  // 첫 게임은 온천 북쪽 가운데, 나머지는 좌우 날개에 한 쌍씩(왼쪽·오른쪽 대칭)
  // ponytail: 게임이 수십 개를 넘으면 날개가 너무 길어진다. 그때는 카테고리 오두막 또는 날개 뒷골목 줄 추가
  const pairs = Math.ceil(Math.max(0, games.length - 1) / 2);
  const W = Math.max(14, WING_START + Math.max(0, pairs - 1) * WING_STEP + BUILDING_WIDTH / 2 + 5);

  const buildings: Building[] = [];
  const doors: Door[] = [];
  games.forEach((game, i) => {
    const pair = Math.ceil(i / 2);
    const side = i === 0 ? 0 : i % 2 === 1 ? -1 : 1;
    const centerX = side * (WING_START + (pair - 1) * WING_STEP);
    const front = i === 0 ? CENTER_FRONT : WING_FRONTS[(pair - 1) % WING_FRONTS.length];
    buildings.push({ slug: game.slug, variant: i % BUILDING_VARIANTS, tx: centerX - BUILDING_WIDTH / 2, frontY: front * TILE });
    doors.push({ slug: game.slug, title: game.title, x: centerX * TILE, y: (front + 0.5) * TILE });
  });
  const buildingAt = (tx: number, ty: number) =>
    buildings.some(
      (building) =>
        tx >= building.tx &&
        tx < building.tx + BUILDING_WIDTH &&
        ty >= building.frontY / TILE - BUILDING_DEPTH &&
        ty < building.frontY / TILE,
    );
  // 가로 데크에서 각 오두막 문까지 이어지는 데크 갈래길 (문 가운데 양옆 두 칸)
  const deckSpur = (tx: number, ty: number) =>
    doors.some((door) => {
      const px = door.x / TILE;
      const py = Math.floor(door.y / TILE);
      return (tx === px - 1 || tx === px) && ty >= Math.min(py, DECK_ROWS[0]) && ty <= Math.max(py, DECK_ROWS[0]);
    });

  // 마을 장식: 타일 t의 좌우 대칭 짝은 -t-1
  const special = new Map<string, Tile>();
  const seats: Seat[] = [];
  const props: Prop[] = [];
  const place = (tx: number, ty: number, tile: Tile) => special.set(`${tx},${ty}`, tile);
  const seatSpots: [number, number][] = [
    [-7, 3],
    [5, 3],
    [-7, -2],
    [5, -2],
  ];
  for (const [leftTx, ty] of seatSpots) {
    place(leftTx, ty, "log");
    place(leftTx + 1, ty, "log");
    const seatX = (leftTx + 1) * TILE;
    seats.push({
      seatX,
      seatY: (ty + 0.62) * TILE,
      spots: [seatX - TILE * 0.55, seatX + TILE * 0.55],
      standY: (ty + 1.6) * TILE,
    });
  }
  const lanterns: [number, number][] = [
    [-W + 1, TOP + 1],
    [W - 2, TOP + 1],
    [-W + 1, 5],
    [W - 2, 5],
    [-4, 5],
    [3, 5],
  ];
  for (const [tx, ty] of lanterns) {
    place(tx, ty, "lantern");
    props.push({ kind: "lantern", tx, ty });
  }
  const reeds: [number, number][] = [
    [-15, -7],
    [14, -7],
    [-15, 3],
    [14, 3],
    [-24, 3],
    [23, 3],
  ];
  for (const [tx, ty] of reeds) {
    if (tx < -W + 1 || tx > W - 2) continue;
    place(tx, ty, "reeds");
    props.push({ kind: "reeds", tx, ty });
  }
  // 방명록 게시판: 스폰에서 가운데 오두막으로 올라가는 데크 갈래길 왼쪽 길가
  const [guestbookTx, guestbookTy] = [-2, 5];
  place(guestbookTx, guestbookTy, "guestbook");
  props.push({ kind: "guestbook-board", tx: guestbookTx, ty: guestbookTy });
  const guestbook = { x: (guestbookTx + 0.5) * TILE, y: (guestbookTy + 1.5) * TILE };

  function tileAt(tx: number, ty: number): Tile {
    const cx = tx + 0.5;
    const cy = ty + 0.5;
    const insideX = tx >= -W && tx < W;
    const gateY = Math.abs(cy - (DECK_ROWS[0] + 1)) < 2; // 동·서 입구는 가로 데크 높이

    // 마을 안쪽
    if (insideX && ty > TOP && ty < BOTTOM) {
      if (buildingAt(tx, ty)) return "building";
      if (Math.hypot(cx, cy - SPRING_TY) < SPRING_RADIUS) return "spring";
      const decoration = special.get(`${tx},${ty}`);
      if (decoration) return decoration;
      if (DECK_ROWS.includes(ty) || deckSpur(tx, ty)) return "deck";
      if (ty > DECK_ROWS[1] && Math.abs(cx) < 2.5) return "deck"; // 남문으로 가는 데크
      return "meadow";
    }
    // 갈대 울타리 테두리와 동·서·남 입구
    if (tx >= -W - 1 && tx <= W && (ty === TOP || ty === BOTTOM)) {
      return ty === BOTTOM && Math.abs(cx) < 2.5 ? "deck" : "fence";
    }
    if ((tx === -W - 1 || tx === W) && ty > TOP && ty < BOTTOM) return gateY ? "deck" : "fence";
    // 입구에서 뻗어 나가는 진흙길
    if (ty > BOTTOM && ty <= BOTTOM + 8 && Math.abs(cx) < 2.5) return "mud";
    if (((tx < -W - 1 && tx >= -W - 9) || (tx > W && tx <= W + 8)) && gateY) return "mud";
    // 마을 둘레 풀밭은 물·나무 없이 넉넉하게 비워 둔다
    if (tx >= -W - 7 && tx <= W + 6 && ty >= TOP - 6 && ty <= BOTTOM + 6) return "grass";

    // 바깥 습지: 물웅덩이, 진흙 물가, 이끼 바위 줄, 열대 나무
    const height = valueNoise(s, tx, ty, 24) * 0.65 + valueNoise(s + 1, tx, ty, 7) * 0.35;
    if (height < 0.3) return "water";
    if (height < 0.35) return "mud";
    const ridge = valueNoise(s + 2, tx, ty, 18);
    if (height > 0.4 && Math.abs(ridge - 0.5) < 0.025 && hash2(s + 3, tx, ty) > 0.12) return "rock";
    if (height > 0.5 && hash2(s + 4, tx, ty) < (height - 0.5) * 1.6) return "tree";
    return "grass";
  }

  return {
    seed,
    doors,
    buildings,
    seats,
    props,
    spring: { x: 0, y: SPRING_TY * TILE },
    guestbook,
    village: { halfWidth: W, top: TOP + 1, bottom: BOTTOM - 1 },
    spawn: { x: 0, y: (DECK_ROWS[0] + 0.5) * TILE },
    tileAt,
  };
}
