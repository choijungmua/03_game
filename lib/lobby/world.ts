// 로비 오픈월드: seed 하나로 끝없는 타일 맵을 결정적으로 만든다 (맵은 하나로 고정, 사용자가 바꾸지 않는다).
// 저장하는 맵 데이터가 없고 누구의 브라우저에서든 같은 맵이 나온다 (멀티 플레이어가 같은 세상을 본다)
// 테마는 "카피바라 온천 습지 마을": 카피바라가 사는 남미 강가 습지 + 일본 동물원의 카피바라 유자 온천.
// 한가운데 큰 유자 온천을 데크 둘레길이 감싸고, 게임 오두막은 둘레길 북쪽에 부채꼴로 서서 문마다 데크가 곧장 내려온다.
// 남서·남동에는 노천탕이 하나씩 있고, 둘레길에서 동·서문으로 가로 데크, 남문으로 세로 데크가 뻗는다.
// 오두막 지붕 위 아이콘(게임기·비행기 등)으로 무슨 게임인지 알리고, 문 앞에 가면 그 게임에 들어간다.
// 마을은 모서리가 둥근 갈대 울타리로 둘러싸고, 등불 켜진 구불구불한 진흙길이 동·서 습지와 남쪽 "강가 쉼터"(둥근 울타리 연못 광장)로 이어진다

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
/** 온천(돌 테두리까지) 가로·세로 반지름(타일). 그림이 원근으로 납작한 타원이라 막는 영역도 타원이다 */
export const SPRING_RX = 4.6;
export const SPRING_RY = 3.6;
export const SPRING_COLLIDER_RY = 2.85;
export const SPRING_COLLIDER_OFFSET_Y = 1.05;
/** 목욕 중 발이 다닐 수 있는 물 안쪽 반지름(타일). 그림의 물 타원(3.2 × 1.8)보다 조금 안쪽 */
export const BATH_RX = 2.9;
export const BATH_RY = 0.95;
/** 그림 속 물 타원은 온천 가운데보다 아래에 있다 (목욕 자리 보정, 타일) */
export const BATH_OFFSET_Y = 1.45;
/** 온천 가운데(타일): 마을 한가운데 큰 온천 + 남서·남동 노천탕. 모두 같은 그림·같은 목욕 규칙 */
const SPRING_SPOTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-13, 12],
  [13, 12],
];

/** 가운데에서 (x, y) 떨어진 점이 반폭 hx·hy, 모서리 반지름 r인 둥근 사각형 안쪽이면 음수 */
export function roundedRectDistance(x: number, y: number, hx: number, hy: number, r: number) {
  const qx = Math.abs(x) - (hx - r);
  const qy = Math.abs(y) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** 온천 가운데에서 (dx, dy)px 떨어진 점이 반지름 rx·ry(타일) 타원의 몇 배 거리인지. 1보다 작으면 안쪽 */
export const ellipseDistance = (dx: number, dy: number, rx: number, ry: number) => Math.hypot(dx / (rx * TILE), dy / (ry * TILE));
/** 가운데 큰 온천을 두르는 데크 둘레길: 가운데 줄의 반폭·반높이·모서리 반지름(타일). 폭은 두 칸, 곧은 변이라 타일 계단이 안 생긴다 */
const LOOP_RX = 8.5;
const LOOP_RY = 6.5;
const LOOP_CORNER = 3;
/** 둘레길에서 동·서문으로 뻗는 가로 데크 두 줄(타일 y) */
const DECK_ROWS = [0, 1];
/**
 * 오두막 자리 [문 가운데 x, 정면 y](타일). 첫 자리는 둘레길 북쪽 가운데, 나머지는 x 부호만 바꿔 좌우 대칭 한 쌍씩.
 * 문 앞 데크를 곧장 아래로 내리면 다른 오두막·온천에 걸리지 않고 둘레길이나 가로 데크에 닿는 자리만 골랐다
 */
const HUT_SLOTS: readonly (readonly [number, number])[] = [
  [0, -12],
  [11, -9],
  [20, -3],
  [7, -19],
  [15, -18],
  [28, -8],
];
/** 마을 아래 울타리 줄(타일). 위 울타리는 오두막 높이에 맞춰 정한다 */
const BOTTOM = 20;
/** 마을 울타리 모서리 반지름(타일) */
const VILLAGE_CORNER = 12;
/** 동·서 입구에서 습지로 뻗는 진흙길 길이, 남문에서 강가 쉼터 북문까지 길이(타일) */
const SIDE_TRAIL = 30;
const SOUTH_TRAIL = 18;
/**
 * 마을 밖 둘레 산책로: 마을 울타리에서 SIDE_TRAIL만큼 떨어져 마을을 크게 돌고, 동·서·남·북문 길이 모두 여기로 이어진다.
 * 길 폭은 반 폭 기준(3칸), 습지 물 위를 지나는 칸은 진흙 대신 나무 다리가 된다
 */
const RING_HALF_WIDTH = 1.5;
const RING_CORNER = 18;
/** 산책로 북쪽 줄은 마을 위에서 이만큼 더 위, 남쪽 줄은 강가 쉼터 아래로 이만큼 더 아래(타일) */
const RING_NORTH_GAP = 18;
const RING_SOUTH_GAP = 4;
/** 바깥 명소: 서쪽 호수(가로·세로 반지름), 산책로 바깥으로 나간 거리, 동쪽 바위 노천탕·북쪽 등불 공터까지 거리(타일) */
const LAKE_RX = 12;
const LAKE_RY = 8;
const LAKE_GAP = 14;
const WILD_SPRING_GAP = 12;
const GLADE_GAP = 11;
/** 강가 쉼터: 반폭·반높이·모서리 반지름, 가운데 y(타일) */
const REST_HX = 13;
const REST_HY = 8;
const REST_CORNER = 6;
export const REST_CY = BOTTOM + SOUTH_TRAIL + REST_HY + 1;
/** 쉼터 연못: 쉼터 가운데에서 아래로 내린 거리, 가로·세로 반지름(타일) */
const POND_DY = 1.5;
const POND_RX = 6;
const POND_RY = 3.2;

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
  /** 마을 안 사과나무 밑동 가운데(px). 나무 타일 한 칸은 막히고, 가까이서 Space로 사과를 딴다 */
  appleTrees: { x: number; y: number }[];
  /** 온천들(px): 마을 한가운데 큰 온천 + 노천탕. layerY는 앞뒤 가림을 정하는 그리기 기준 */
  springs: { x: number; y: number; layerY: number }[];
  /** 방명록 게시판 바로 앞 월드 좌표(px). 여기 가까이서 Space를 누르면 방명록이 열린다 */
  guestbook: { x: number; y: number };
  /** 마을 밖 명소 가운데(px): 서쪽 호수 선착장 끝·동쪽 바위 노천탕·북쪽 등불 공터 */
  landmarks: { pier: { x: number; y: number }; wildSpring: { x: number; y: number }; glade: { x: number; y: number } };
  /** 마을 안쪽 경계(타일): x ∈ [-halfWidth, halfWidth-1], y ∈ [top, bottom] */
  village: { halfWidth: number; top: number; bottom: number };
  spawn: { x: number; y: number };
  tileAt(tx: number, ty: number): Tile;
  blockedAt(x: number, y: number): boolean;
  /**
   * 울타리 칸의 그림 자리: 둥근 울타리 곡선 위의 점(px)과 바깥쪽 법선. 막히는 칸은 타일 그대로지만
   * 그림은 곡선을 따라 세워서 계단처럼 각져 보이지 않는다. 울타리 칸이 아니면 null
   */
  fenceSpot(tx: number, ty: number): { x: number; y: number; nx: number; ny: number } | null;
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

  // 첫 게임은 둘레길 북쪽 가운데, 나머지는 좌우 대칭 한 쌍씩 HUT_SLOTS 순서로 선다
  // ponytail: 자리(13채)를 넘는 오두막은 가로 데크 위쪽으로 동·서 끝에 이어 붙인다. 수십 채면 카테고리 오두막이 필요
  const buildings: Building[] = [];
  const doors: Door[] = [];
  games.forEach((game, i) => {
    const pair = Math.ceil(i / 2);
    const side = i === 0 ? 0 : i % 2 === 1 ? -1 : 1;
    const [slotX, front] = HUT_SLOTS[pair] ?? [37 + (pair - HUT_SLOTS.length) * 9, -3];
    const centerX = side * slotX;
    buildings.push({ slug: game.slug, variant: i % BUILDING_VARIANTS, tx: centerX - BUILDING_WIDTH / 2, frontY: front * TILE });
    doors.push({ slug: game.slug, title: game.title, x: centerX * TILE, y: (front + 0.5) * TILE });
  });
  const W = Math.max(24, ...buildings.map((building) => Math.abs(building.tx + BUILDING_WIDTH / 2) + BUILDING_WIDTH / 2 + 5));
  const TOP = Math.min(-12, ...buildings.map((building) => building.frontY / TILE - BUILDING_DEPTH - 3));
  /** 마을 안쪽 줄은 TOP+1 ~ BOTTOM-1. 둥근 사각형 가운데 y·반높이(타일) */
  const villageCy = (TOP + BOTTOM + 1) / 2;
  const villageHy = (BOTTOM - TOP - 1) / 2;
  const buildingAt = (tx: number, ty: number) =>
    buildings.some(
      (building) =>
        tx >= building.tx &&
        tx < building.tx + BUILDING_WIDTH &&
        ty >= building.frontY / TILE - BUILDING_DEPTH &&
        ty < building.frontY / TILE,
    );

  // 마을 밖: 마을을 크게 도는 둘레 산책로와 그 바깥 명소 세 곳(서쪽 호수 선착장·동쪽 바위 노천탕·북쪽 등불 공터)
  const ringHx = W + SIDE_TRAIL;
  const ringNorth = TOP - RING_NORTH_GAP;
  const ringSouth = REST_CY + REST_HY + RING_SOUTH_GAP;
  const ringCy = (ringNorth + ringSouth) / 2;
  const ringHy = (ringSouth - ringNorth) / 2;
  const onRingTrail = (cx: number, cy: number) => Math.abs(roundedRectDistance(cx, cy - ringCy, ringHx, ringHy, RING_CORNER)) < RING_HALF_WIDTH;
  const lake = { x: -(ringHx + LAKE_GAP + LAKE_RX), y: ringCy };
  const wildSpring: readonly [number, number] = [ringHx + WILD_SPRING_GAP, ringCy];
  const glade = { x: 0, y: ringNorth - GLADE_GAP };

  const springs = [...SPRING_SPOTS, wildSpring].map(([x, y]) => ({ x: x * TILE, y: y * TILE, layerY: y * TILE }));
  /** 온천 안이면 "spring", 둘레 한 칸이면 "around" (그 칸은 길·데크를 깔지 않고 비워 둔다) */
  const springHit = (cx: number, cy: number) => {
    for (const spring of springs) {
      const dx = cx * TILE - spring.x;
      const dy = cy * TILE - spring.y;
      if (ellipseDistance(dx, dy, SPRING_RX, SPRING_RY) < 1) return "spring" as const;
      if (ellipseDistance(dx, dy, SPRING_RX + 1, SPRING_RY + 1) < 1) return "around" as const;
    }
    return null;
  };
  /** 둘레길(가운데 줄에서 한 칸 안)·가로 데크(둘레길 옆부터 동·서문까지)·남문 데크 */
  const onLoop = (cx: number, cy: number) => Math.abs(roundedRectDistance(cx, cy, LOOP_RX, LOOP_RY, LOOP_CORNER)) < 1;
  const onMainDeck = (tx: number, ty: number) => {
    const cx = tx + 0.5;
    const cy = ty + 0.5;
    return onLoop(cx, cy) || (DECK_ROWS.includes(ty) && Math.abs(cx) >= LOOP_RX - 1) || (cy > LOOP_RY && Math.abs(cx) < 2);
  };
  // 문 앞 데크 갈래길: 문 가운데 양옆 두 칸을 곧장 아래로, 둘레길·가로 데크에 닿을 때까지
  const spurs = new Set<string>();
  for (const door of doors) {
    const px = door.x / TILE;
    for (let ty = Math.floor(door.y / TILE); ty < BOTTOM; ty++) {
      if (onMainDeck(px - 1, ty) || onMainDeck(px, ty)) break;
      spurs.add(`${px - 1},${ty}`).add(`${px},${ty}`);
    }
  }

  // 마을 장식: 타일 t의 좌우 대칭 짝은 -t-1
  const special = new Map<string, Tile>();
  const seats: Seat[] = [];
  const props: Prop[] = [];
  const place = (tx: number, ty: number, tile: Tile) => special.set(`${tx},${ty}`, tile);
  // 통나무 의자: 노천탕 앞, 남문 데크 양옆, 쉼터 연못 앞, 호수 선착장 들머리, 북쪽 등불 공터
  const seatSpots: [number, number][] = [
    [-14, 6],
    [12, 6],
    [-6, 11],
    [4, 11],
    [-6, REST_CY - 4],
    [4, REST_CY - 4],
    [-ringHx - 4, Math.round(ringCy) - 4],
    [Math.round(glade.x) - 5, Math.round(glade.y) + 3],
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
  // 동·서 길 가운데 줄(타일 y), 남쪽 길 가운데 줄(타일 x). 양 끝에서 0이 되는 사인 곡선이라 입구와 쉼터 북문에 똑바로 닿는다
  const sideTrailY = (cx: number) => DECK_ROWS[0] + 1 + 2.5 * Math.sin((2 * Math.PI * Math.max(0, Math.abs(cx) - W)) / SIDE_TRAIL);
  const southTrailX = (cy: number) => 3.5 * Math.sin((2 * Math.PI * (cy - BOTTOM - 1)) / SOUTH_TRAIL);
  /** 북문에서 둘레 산책로까지 올라가는 길 가운데 줄(타일 x) */
  const northTrailX = (cy: number) => 3.5 * Math.sin((2 * Math.PI * (cy - TOP)) / (TOP - ringNorth));
  const lanterns: [number, number][] = [
    // 둘레길 네 귀퉁이 바깥
    [-10, -5],
    [9, -5],
    [-11, 5],
    [10, 5],
    // 동·서문 안쪽, 노천탕 둘레
    [-W + 2, -1],
    [W - 3, -1],
    [-20, 12],
    [19, 12],
    [-9, 15],
    [8, 15],
    // 쉼터 네 귀퉁이
    [-9, REST_CY - 5],
    [8, REST_CY - 5],
    [-11, REST_CY + 2],
    [10, REST_CY + 2],
  ];
  // 바깥 명소 등불: 호수 선착장 들머리, 바위 노천탕 둘레, 북쪽 공터 둘레(둥글게)
  lanterns.push([-ringHx - 3, Math.round(ringCy) + 3], [Math.round(wildSpring[0]) - 7, Math.round(wildSpring[1]) + 5], [Math.round(wildSpring[0]) + 6, Math.round(wildSpring[1]) + 5]);
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 + Math.PI / 6;
    lanterns.push([Math.round(glade.x + Math.cos(angle) * 7), Math.round(glade.y + Math.sin(angle) * 5)]);
  }
  // 산책로 따라 등불: 네 변 가운데마다 길가 한 칸 바깥
  lanterns.push(
    [-ringHx - 3, Math.round(ringCy) - 14],
    [ringHx + 2, Math.round(ringCy) - 14],
    [-ringHx - 3, Math.round(ringCy) + 14],
    [ringHx + 2, Math.round(ringCy) + 14],
    [-16, Math.round(ringNorth) - 3],
    [15, Math.round(ringNorth) - 3],
    [-16, Math.round(ringSouth) + 2],
    [15, Math.round(ringSouth) + 2],
  );
  // 길 따라 등불: 동·서 길은 북쪽 길가에 좌우 대칭, 남쪽 길은 좌우 번갈아
  for (const step of [6, 14, 22]) {
    const ty = Math.floor(sideTrailY(W + step + 0.5) - 3);
    lanterns.push([W + step, ty], [-W - step - 1, ty]);
  }
  [4, 10, 16].forEach((step, i) => {
    const ty = BOTTOM + step;
    lanterns.push([Math.floor(southTrailX(ty + 0.5) + (i % 2 ? 3 : -3)), ty]);
  });
  for (const [tx, ty] of lanterns) {
    place(tx, ty, "lantern");
    props.push({ kind: "lantern", tx, ty });
  }
  // 바위 노천탕을 둘러싼 이끼 바위 (온천 둘레 한 칸 바깥)
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10;
    place(Math.round(wildSpring[0] + Math.cos(angle) * 7), Math.round(wildSpring[1] + Math.sin(angle) * 5.5), "rock");
  }
  const reeds: [number, number][] = [
    [-18, 16],
    [17, 16],
    [-12, 18],
    [11, 18],
    [-7, REST_CY + 3],
    [6, REST_CY + 3],
    [-3, REST_CY + 5],
    [2, REST_CY + 5],
    // 호수 물가 갈대
    [Math.round(lake.x + LAKE_RX) + 1, Math.round(lake.y) - 3],
    [Math.round(lake.x + LAKE_RX) + 1, Math.round(lake.y) + 3],
  ];
  for (const [tx, ty] of reeds) {
    place(tx, ty, "reeds");
    props.push({ kind: "reeds", tx, ty });
  }
  // 방명록 게시판: 스폰(둘레길 남쪽) 바로 아래 남문 데크 왼쪽 길가
  const [guestbookTx, guestbookTy] = [-4, 8];
  place(guestbookTx, guestbookTy, "guestbook");
  props.push({ kind: "guestbook-board", tx: guestbookTx, ty: guestbookTy });
  const guestbook = { x: (guestbookTx + 0.5) * TILE, y: (guestbookTy + 1.5) * TILE };
  // 사과나무: 가운데 오두막 양옆, 동·서 날개 풀밭, 노천탕 아래. 오두막·데크·다른 장식과 겹치는 자리는 건너뛴다
  const appleTrees: World["appleTrees"] = [];
  const appleSpots: [number, number][] = [
    [-5, -9],
    [4, -9],
    [-24, 6],
    [23, 6],
    [-9, 17],
    [8, 17],
    // 북쪽 등불 공터
    [Math.round(glade.x) + 4, Math.round(glade.y) + 3],
    [Math.round(glade.x) - 4, Math.round(glade.y) - 4],
  ];
  for (const [tx, ty] of appleSpots) {
    if (buildingAt(tx, ty) || spurs.has(`${tx},${ty}`) || onMainDeck(tx, ty) || special.has(`${tx},${ty}`)) continue;
    if (springHit(tx + 0.5, ty + 0.5)) continue;
    place(tx, ty, "tree");
    appleTrees.push({ x: (tx + 0.5) * TILE, y: (ty + 1) * TILE });
  }

  /** 마을·쉼터 안쪽(타일 가운데 기준) */
  const inVillage = (tx: number, ty: number) => roundedRectDistance(tx + 0.5, ty + 0.5 - villageCy, W, villageHy, VILLAGE_CORNER) < 0;
  const inRest = (tx: number, ty: number) => roundedRectDistance(tx + 0.5, ty + 0.5 - REST_CY, REST_HX, REST_HY, REST_CORNER) < 0;
  /** 안쪽 칸에 (대각선까지) 닿은 바깥 칸 = 울타리 줄. 계단처럼 꺾여도 틈이 없다 */
  const onRing = (inside: (tx: number, ty: number) => boolean, tx: number, ty: number) => {
    if (inside(tx, ty)) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) if (inside(tx + dx, ty + dy)) return true;
    }
    return false;
  };

  /** 둥근 사각형(가운데 y = centerY) 바깥 반 칸 곡선 위로 타일 가운데를 옮긴다 */
  const snapToRing = (cx: number, cy: number, centerY: number, hx: number, hy: number, r: number) => {
    const x = cx;
    const y = cy - centerY;
    const qx = Math.abs(x) - (hx - r);
    const qy = Math.abs(y) - (hy - r);
    if (qx > 0 && qy > 0) {
      const length = Math.hypot(qx, qy);
      const nx = (Math.sign(x) * qx) / length;
      const ny = (Math.sign(y) * qy) / length;
      const px = Math.sign(x) * (hx - r) + nx * (r + 0.5);
      const py = Math.sign(y) * (hy - r) + ny * (r + 0.5);
      return { x: px * TILE, y: (py + centerY) * TILE, nx, ny };
    }
    if (qx > qy) return { x: Math.sign(x) * (hx + 0.5) * TILE, y: cy * TILE, nx: Math.sign(x), ny: 0 };
    return { x: cx * TILE, y: (Math.sign(y) * (hy + 0.5) + centerY) * TILE, nx: 0, ny: Math.sign(y) };
  };
  function fenceSpot(tx: number, ty: number) {
    if (tileAt(tx, ty) !== "fence") return null;
    return onRing(inVillage, tx, ty)
      ? snapToRing(tx + 0.5, ty + 0.5, villageCy, W, villageHy, VILLAGE_CORNER)
      : snapToRing(tx + 0.5, ty + 0.5, REST_CY, REST_HX, REST_HY, REST_CORNER);
  }

  function tileAt(tx: number, ty: number): Tile {
    const cx = tx + 0.5;
    const cy = ty + 0.5;
    const decoration = special.get(`${tx},${ty}`);

    const spring = springHit(cx, cy);
    if (spring === "spring") return "spring";
    const aroundSpring = spring === "around";

    // 마을 안쪽
    if (inVillage(tx, ty)) {
      if (buildingAt(tx, ty)) return "building";
      if (decoration) return decoration;
      // 온천 둘레 한 칸은 풀밭으로 비워 둔다
      if (!aroundSpring && (onMainDeck(tx, ty) || spurs.has(`${tx},${ty}`))) return "deck";
      return "meadow";
    }
    // 둥근 갈대 울타리와 동·서·남 입구(데크)
    if (onRing(inVillage, tx, ty)) {
      const sideGate = Math.abs(cx) > W / 2 && DECK_ROWS.includes(ty);
      return sideGate || Math.abs(cx) < 2.5 ? "deck" : "fence"; // 남문·북문은 가운데 데크
    }
    // 강가 쉼터: 둥근 울타리 안 연못과 북문에서 연못 가운데까지 뻗은 데크 잔교
    if (inRest(tx, ty)) {
      if (decoration) return decoration;
      if (Math.abs(cx) < 1 && cy < REST_CY + POND_DY) return "deck";
      if (Math.hypot(cx / POND_RX, (cy - REST_CY - POND_DY) / POND_RY) < 1) return "water";
      return "meadow";
    }
    if (onRing(inRest, tx, ty)) return Math.abs(cx) < 2.5 ? "deck" : "fence"; // 쉼터 북문·남문
    if (decoration) return decoration; // 길가 등불
    // 서쪽 호수: 물 위로 뻗은 나무 선착장, 물가는 진흙
    const lakeDistance = Math.hypot((cx - lake.x) / LAKE_RX, (cy - lake.y) / LAKE_RY);
    if (lakeDistance < 1.2) {
      if (Math.abs(cy - ringCy) < 1 && cx > lake.x - 1 && cx < -ringHx) return "deck"; // 선착장
      return lakeDistance < 1 ? "water" : "mud";
    }

    // 등불 켜진 구불구불한 진흙길과 마을을 크게 도는 둘레 산책로
    const sideOffset = Math.abs(cy - sideTrailY(cx));
    const southOffset = Math.abs(cx - southTrailX(cy));
    const northOffset = Math.abs(cx - northTrailX(cy));
    const alongSide = Math.abs(cx) >= W - VILLAGE_CORNER && Math.abs(cx) <= ringHx;
    const alongSouth = cy > BOTTOM && cy < REST_CY - REST_HY;
    const alongRestSouth = cy > REST_CY && cy < ringSouth;
    const alongNorth = cy < TOP && cy > ringNorth;
    const alongGlade = Math.abs(cx - glade.x) < 1.5 && cy < ringNorth && cy > glade.y;
    const height = valueNoise(s, tx, ty, 24) * 0.65 + valueNoise(s + 1, tx, ty, 7) * 0.35;
    if (!aroundSpring) {
      // 산책로가 물 위를 지나는 칸은 진흙 대신 나무 다리
      if (onRingTrail(cx, cy)) return height < 0.35 ? "deck" : "mud";
      if (alongSide && sideOffset < 2) return "mud";
      if (alongSouth && southOffset < 2) return "mud";
      if (alongNorth && northOffset < 2) return "mud";
      if (alongRestSouth && Math.abs(cx) < 2) return "mud"; // 쉼터 남문에서 산책로로
      if (alongGlade) return "mud"; // 산책로에서 북쪽 등불 공터로
    }
    // 마을·길·명소 둘레 풀밭은 물·나무 없이 넉넉하게 비워 둔다
    if (tx >= -W - 7 && tx <= W + 6 && ty >= TOP - 6 && ty <= BOTTOM + 6) return "grass";
    if ((alongSide && sideOffset < 8) || (alongSouth && southOffset < 11) || (alongNorth && northOffset < 8)) return "grass";
    if (roundedRectDistance(cx, cy - REST_CY, REST_HX + 5, REST_HY + 5, REST_CORNER + 5) < 0) return "grass";
    if (Math.abs(roundedRectDistance(cx, cy - ringCy, ringHx, ringHy, RING_CORNER)) < 5) return "grass";
    if (Math.hypot((cx - glade.x) / 13, (cy - glade.y) / 10) < 1) return "grass";
    if (Math.hypot((cx - wildSpring[0]) / 11, (cy - wildSpring[1]) / 9) < 1) return "grass";
    if (alongRestSouth && Math.abs(cx) < 8) return "grass";

    // 바깥 습지: 물웅덩이, 진흙 물가, 이끼 바위 줄, 열대 나무
    if (height < 0.3) return "water";
    if (height < 0.35) return "mud";
    const ridge = valueNoise(s + 2, tx, ty, 18);
    if (height > 0.4 && Math.abs(ridge - 0.5) < 0.025 && hash2(s + 3, tx, ty) > 0.12) return "rock";
    if (height > 0.5 && hash2(s + 4, tx, ty) < (height - 0.5) * 1.6) return "tree";
    return "grass";
  }

  function blockedAt(x: number, y: number) {
    if (springs.some((spring) => ellipseDistance(x - spring.x, y - spring.y - SPRING_COLLIDER_OFFSET_Y * TILE, SPRING_RX, SPRING_COLLIDER_RY) < 1)) {
      return true;
    }
    if (
      buildings.some((building) => {
        const asset = BUILDING_ASSETS[building.variant];
        const centerX = (building.tx + BUILDING_WIDTH / 2) * TILE;
        return ellipseDistance(x - centerX, y - (building.frontY - TILE / 2), asset.width * 0.45, 0.5) < 1;
      })
    )
      return true;

    const tile = tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
    return tile === "building" || tile === "spring" ? false : isBlockingTile(tile);
  }

  return {
    seed,
    doors,
    buildings,
    seats,
    props,
    appleTrees,
    springs,
    guestbook,
    landmarks: {
      pier: { x: (lake.x + 2) * TILE, y: ringCy * TILE },
      wildSpring: { x: wildSpring[0] * TILE, y: wildSpring[1] * TILE },
      glade: { x: glade.x * TILE, y: glade.y * TILE },
    },
    village: { halfWidth: W, top: TOP + 1, bottom: BOTTOM - 1 },
    spawn: { x: 0, y: LOOP_RY * TILE },
    tileAt,
    blockedAt,
    fenceSpot,
  };
}
