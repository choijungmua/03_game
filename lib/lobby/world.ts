// 로비 오픈월드: seed 하나로 끝없는 타일 맵을 결정적으로 만든다 (맵은 하나로 고정, 사용자가 바꾸지 않는다).
// 저장하는 맵 데이터가 없고 누구의 브라우저에서든 같은 맵이 나온다 (멀티 플레이어가 같은 세상을 본다)
// 테마는 "카피바라 온천 습지 마을": 카피바라가 사는 남미 강가 습지 + 일본 동물원의 카피바라 유자 온천.
// 가운데 유자 온천을 두고 나무 데크 산책로가 좌우로 뻗으며, 날개마다 게임 오두막이 앞줄·뒷줄 지그재그로 서 있다.
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
/** 목욕 중 발이 다닐 수 있는 물 안쪽 반지름(타일). 그림의 물 타원(3.2 × 1.8)보다 조금 안쪽 */
export const BATH_RX = 2.9;
export const BATH_RY = 1.5;
/** 온천 가운데(타일). 위 가운데 오두막 문·아래 방명록 게시판·가로 데크와 한 칸 넘게 띄우고, 그림 바닥(가운데 + 4타일)이 게시판 그림에 닿지 않게 조금 올린다 */
const SPRING_TY = 0.75;

/** 가운데에서 (x, y) 떨어진 점이 반폭 hx·hy, 모서리 반지름 r인 둥근 사각형 안쪽이면 음수 */
export function roundedRectDistance(x: number, y: number, hx: number, hy: number, r: number) {
  const qx = Math.abs(x) - (hx - r);
  const qy = Math.abs(y) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** 온천 가운데에서 (dx, dy)px 떨어진 점이 반지름 rx·ry(타일) 타원의 몇 배 거리인지. 1보다 작으면 안쪽 */
export const ellipseDistance = (dx: number, dy: number, rx: number, ry: number) => Math.hypot(dx / (rx * TILE), dy / (ry * TILE));
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
/** 마을 울타리 모서리 반지름(타일) */
const VILLAGE_CORNER = 6;
/** 동·서 입구에서 습지로 뻗는 진흙길 길이, 남문에서 강가 쉼터 북문까지 길이(타일) */
const SIDE_TRAIL = 30;
const SOUTH_TRAIL = 18;
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
  spring: { x: number; y: number };
  /** 방명록 게시판 바로 앞 월드 좌표(px). 여기 가까이서 Space를 누르면 방명록이 열린다 */
  guestbook: { x: number; y: number };
  /** 마을 안쪽 경계(타일): x ∈ [-halfWidth, halfWidth-1], y ∈ [top, bottom] */
  village: { halfWidth: number; top: number; bottom: number };
  spawn: { x: number; y: number };
  tileAt(tx: number, ty: number): Tile;
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
  // 쉼터 연못 앞 통나무 두 개 (잔교 양옆)
  seatSpots.push([-6, REST_CY - 4], [4, REST_CY - 4]);
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
  const lanterns: [number, number][] = [
    [-W + 3, TOP + 2],
    [W - 4, TOP + 2],
    [-W + 1, 5],
    [W - 2, 5],
    [-4, 5],
    [3, 5],
    // 쉼터 네 귀퉁이
    [-9, REST_CY - 5],
    [8, REST_CY - 5],
    [-11, REST_CY + 2],
    [10, REST_CY + 2],
  ];
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
  const reeds: [number, number][] = [
    [-15, -7],
    [14, -7],
    [-15, 3],
    [14, 3],
    [-24, 3],
    [23, 3],
  ];
  // 쉼터 연못가 갈대
  reeds.push([-7, REST_CY + 3], [6, REST_CY + 3], [-3, REST_CY + 5], [2, REST_CY + 5]);
  for (const [tx, ty] of reeds) {
    if (ty < BOTTOM && (tx < -W + 1 || tx > W - 2)) continue;
    place(tx, ty, "reeds");
    props.push({ kind: "reeds", tx, ty });
  }
  // 방명록 게시판: 스폰에서 가운데 오두막으로 올라가는 데크 갈래길 왼쪽 길가
  const [guestbookTx, guestbookTy] = [-2, 5];
  place(guestbookTx, guestbookTy, "guestbook");
  props.push({ kind: "guestbook-board", tx: guestbookTx, ty: guestbookTy });
  const guestbook = { x: (guestbookTx + 0.5) * TILE, y: (guestbookTy + 1.5) * TILE };
  // 사과나무: 온천 뒤 양옆, 첫 날개 오두막 사이, 남쪽 울타리 앞. 오두막·데크·다른 장식과 겹치는 자리는 건너뛴다
  const appleTrees: World["appleTrees"] = [];
  const appleSpots: [number, number][] = [
    [-7, -8],
    [6, -8],
    [-15, -1],
    [14, -1],
    [-9, 8],
    [8, 8],
  ];
  for (const [tx, ty] of appleSpots) {
    if (tx < -W + 1 || tx > W - 2 || buildingAt(tx, ty) || deckSpur(tx, ty) || special.has(`${tx},${ty}`)) continue;
    place(tx, ty, "tree");
    appleTrees.push({ x: (tx + 0.5) * TILE, y: (ty + 1) * TILE });
  }

  /** 마을·쉼터 안쪽(타일 가운데 기준) */
  const inVillage = (tx: number, ty: number) => roundedRectDistance(tx + 0.5, ty + 0.5, W, (BOTTOM - TOP - 1) / 2, VILLAGE_CORNER) < 0;
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
      ? snapToRing(tx + 0.5, ty + 0.5, 0, W, (BOTTOM - TOP - 1) / 2, VILLAGE_CORNER)
      : snapToRing(tx + 0.5, ty + 0.5, REST_CY, REST_HX, REST_HY, REST_CORNER);
  }

  function tileAt(tx: number, ty: number): Tile {
    const cx = tx + 0.5;
    const cy = ty + 0.5;
    const decoration = special.get(`${tx},${ty}`);

    // 마을 안쪽
    if (inVillage(tx, ty)) {
      if (buildingAt(tx, ty)) return "building";
      const springDistance = ellipseDistance(cx * TILE, (cy - SPRING_TY) * TILE, SPRING_RX + 1, SPRING_RY + 1);
      if (ellipseDistance(cx * TILE, (cy - SPRING_TY) * TILE, SPRING_RX, SPRING_RY) < 1) return "spring";
      if (decoration) return decoration;
      // 온천 둘레 한 칸은 풀밭으로 비워 둔다 (가운데 오두막 데크 갈래길이 온천 밑으로 지나가지 않게)
      if (DECK_ROWS.includes(ty) || (deckSpur(tx, ty) && springDistance >= 1)) return "deck";
      if (ty > DECK_ROWS[1] && Math.abs(cx) < 2.5) return "deck"; // 남문으로 가는 데크
      return "meadow";
    }
    // 둥근 갈대 울타리와 동·서·남 입구(데크)
    if (onRing(inVillage, tx, ty)) {
      const sideGate = Math.abs(cx) > W / 2 && DECK_ROWS.includes(ty);
      return sideGate || (cy > 0 && Math.abs(cx) < 2.5) ? "deck" : "fence";
    }
    // 강가 쉼터: 둥근 울타리 안 연못과 북문에서 연못 가운데까지 뻗은 데크 잔교
    if (inRest(tx, ty)) {
      if (decoration) return decoration;
      if (Math.abs(cx) < 1 && cy < REST_CY + POND_DY) return "deck";
      if (Math.hypot(cx / POND_RX, (cy - REST_CY - POND_DY) / POND_RY) < 1) return "water";
      return "meadow";
    }
    if (onRing(inRest, tx, ty)) return cy < REST_CY && Math.abs(cx) < 2.5 ? "deck" : "fence";
    if (decoration) return decoration; // 길가 등불
    // 등불 켜진 구불구불한 진흙길
    const sideOffset = Math.abs(cy - sideTrailY(cx));
    const southOffset = Math.abs(cx - southTrailX(cy));
    const alongSide = Math.abs(cx) >= W - VILLAGE_CORNER && Math.abs(cx) <= W + SIDE_TRAIL;
    const alongSouth = cy > BOTTOM && cy < REST_CY - REST_HY;
    if ((alongSide && sideOffset < 2) || (alongSouth && southOffset < 2)) return "mud";
    // 마을·길·쉼터 둘레 풀밭은 물·나무 없이 넉넉하게 비워 둔다
    if (tx >= -W - 7 && tx <= W + 6 && ty >= TOP - 6 && ty <= BOTTOM + 6) return "grass";
    if ((alongSide && sideOffset < 8) || (alongSouth && southOffset < 11)) return "grass";
    if (roundedRectDistance(cx, cy - REST_CY, REST_HX + 5, REST_HY + 5, REST_CORNER + 5) < 0) return "grass";

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
    appleTrees,
    spring: { x: 0, y: SPRING_TY * TILE },
    guestbook,
    village: { halfWidth: W, top: TOP + 1, bottom: BOTTOM - 1 },
    spawn: { x: 0, y: (DECK_ROWS[0] + 0.5) * TILE },
    tileAt,
    fenceSpot,
  };
}
