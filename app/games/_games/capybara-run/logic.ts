// 카피바라 런 물리. 1프레임 = 1/60초, 논리 화면 640×300(px). 카피바라는 화면 왼쪽에 고정되고 세상이 왼쪽으로 흐른다.
// 모든 x는 출발점부터 잰 세상 좌표, 화면 x = 세상 x - distance. 실제 화면은 기기 해상도로 키워 그린다

export const WIDTH = 640;
export const HEIGHT = 300;
export const GROUND = 262;
export const PLAYER_X = 130;
export const PLAYER_W = 30;
export const PLAYER_H = 34;
export const SLIDE_H = 18;
/** 철봉 높이. 한 번 점프로는 머리가 안 닿고 2단 점프해야 잡힌다 */
export const BAR_Y = 80;
/** 매달렸을 때 철봉에서 발까지 */
export const HANG_DROP = PLAYER_H + 8;
export const MAX_HEARTS = 3;
export const COIN_R = 8;

const GRAVITY = 0.8;
const JUMP_SPEED = 12.5;
const DOUBLE_JUMP_SPEED = 11.5;
/** 공중에서 ↓를 누르면 이만큼 더 빨리 떨어진다 */
const FAST_FALL = 1.6;
export const START_SPEED = 5;
export const MAX_SPEED = 19;
/** 프레임마다 빨라지는 양. 60초에 약 +4.3, 3분 넘게 달려야 최고 속도 */
const ACCELERATION = 0.0012;
/** 부딪힌 뒤 깜빡이며 다시 안 맞는 프레임 */
const HURT_FRAMES = 80;
/** 버틴 1초마다 점수 */
export const SECOND_POINTS = 10;
export const COIN_POINTS = 10;
/** 한 묶음 코인을 하나도 안 놓치고 다 먹으면 코인 하나당 이만큼 더 */
export const BONUS_PER_COIN = 20;

export type HazardKind = "log" | "branch" | "fire" | "thorn" | "pit" | "bar" | "step" | "spring";

export const PASS_POINTS: Record<HazardKind, number> = { log: 20, branch: 30, fire: 30, thorn: 60, pit: 40, bar: 120, step: 50, spring: 30 };
export const HAZARD_NAMES: Record<HazardKind, string> = {
  log: "통나무",
  branch: "나뭇가지",
  fire: "불길",
  thorn: "가시덩굴",
  pit: "낭떠러지",
  bar: "철봉 완주",
  step: "계단",
  spring: "버섯 점프",
};

/** 스테이지가 시작되는 프레임 (1: 처음, 2: 35초, 3: 80초) */
export const STAGE_START = [0, 0, 60 * 35, 60 * 80] as const;
export const STAGE_NAMES = ["", "햇살 들판", "노을 언덕", "달빛 숲"] as const;
/** 보너스 타임 길이: 스테이지 시작 보상 / 별 아이템 */
export const STAGE_BONUS_FRAMES = 240;
export const STAR_BONUS_FRAMES = 360;
/** 버섯을 밟으면 튀어 오르는 속도 (2단 점프보다 높다) */
const SPRING_SPEED = 17;

export interface Hazard {
  id: number;
  kind: HazardKind;
  x: number;
  w: number;
  /** 계단 블록 윗면 높이(y). 다른 장애물은 0 */
  top: number;
  passed: boolean;
  hit: boolean;
}

export type ItemKind = "coin" | "heart" | "star";

export interface Coin {
  id: number;
  /** 코인 말고도 하트(회복)·별(보너스 타임)이 같은 자리에 놓인다 */
  kind: ItemKind;
  x: number;
  y: number;
  /** 같은 묶음 코인. 묶음을 다 먹으면 보너스 */
  group: number;
  taken: boolean;
}

export type Mode = "run" | "air" | "slide" | "hang";

export interface Player {
  /** 발 높이(y) */
  y: number;
  vy: number;
  /** 이번 공중에서 쓴 점프 수 (0~2) */
  jumps: number;
  mode: Mode;
  /** 2단 점프 뒤 지난 프레임 (덤블링 회전용, 안 돌면 -1) */
  spin: number;
}

export interface RunState {
  frame: number;
  distance: number;
  speed: number;
  player: Player;
  hazards: Hazard[];
  coins: Coin[];
  /** 묶음별 [전체 수, 먹은 수, 놓친 적 있는지] */
  groups: Record<number, { total: number; taken: number; missed: boolean }>;
  nextX: number;
  nextId: number;
  seed: number;
  score: number;
  coinCount: number;
  hearts: number;
  hurt: number;
  over: boolean;
  stage: 1 | 2 | 3;
  /** 남은 보너스 타임 프레임. 이 동안은 다치지 않고, 낭떠러지가 막히고, 코인이 쏟아지며, 코인 점수 두 배 */
  bonus: number;
}

export interface RunInput {
  /** 이번 프레임에 점프를 새로 눌렀는지 */
  jump: boolean;
  /** ↓(숙이기)를 누르고 있는지 */
  down: boolean;
}

export type RunEvent =
  | { type: "points"; points: number; label: string }
  | { type: "coin"; x: number; y: number }
  | { type: "bonus"; points: number }
  | { type: "stage"; stage: 2 | 3 }
  | { type: "jump" | "double" | "grab" | "land" | "hurt" | "fall" | "over" | "spring" | "heart" | "bonusStart" | "bonusEnd" };

/** 시드 고정 난수 (mulberry32). 같은 시드면 같은 코스 */
function random(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function createRun(seed = Date.now() % 2147483647): RunState {
  return {
    frame: 0,
    distance: 0,
    speed: START_SPEED,
    player: { y: GROUND, vy: 0, jumps: 0, mode: "run", spin: -1 },
    hazards: [],
    coins: [],
    groups: {},
    nextX: WIDTH,
    nextId: 1,
    seed,
    score: 0,
    coinCount: 0,
    hearts: MAX_HEARTS,
    hurt: 0,
    over: false,
    stage: 1,
    bonus: 0,
  };
}

/** 부딪히면 다치는 상자 (세상 좌표). 낭떠러지·철봉·계단 윗면은 다치는 게 아니라 따로 처리 */
export function hazardBox(hazard: Hazard): { left: number; right: number; top: number; bottom: number } | null {
  const { x, w } = hazard;
  switch (hazard.kind) {
    case "log":
      return { left: x + 4, right: x + w - 4, top: GROUND - 26, bottom: GROUND };
    case "branch":
      // 서 있으면 머리가 닿고, 숙이면 지나간다
      return { left: x + 6, right: x + w - 6, top: GROUND - 170, bottom: GROUND - SLIDE_H - 5 };
    case "fire":
      return { left: x + 6, right: x + w - 6, top: GROUND - 20, bottom: GROUND };
    case "thorn":
      return { left: x + 4, right: x + w - 4, top: GROUND - 22, bottom: GROUND };
    case "step":
      // 옆면에 부딪히는 판정 (윗면에 서는 건 groundAt)
      return { left: x + 2, right: x + w, top: hazard.top + 6, bottom: GROUND };
    default:
      return null;
  }
}

export function playerBox(player: Player, distance: number) {
  const height = player.mode === "slide" ? SLIDE_H : PLAYER_H;
  const left = distance + PLAYER_X - PLAYER_W / 2 + 4;
  return { left, right: left + PLAYER_W - 8, top: player.y - height + 3, bottom: player.y };
}

/** 이 x에서 발을 디딜 높이. 낭떠러지 위면 Infinity */
function groundAt(hazards: Hazard[], worldX: number, feet: number, bonus = false) {
  let ground = !bonus && hazards.some((hazard) => hazard.kind === "pit" && worldX > hazard.x && worldX < hazard.x + hazard.w) ? Infinity : GROUND;
  for (const hazard of hazards) {
    // 계단 윗면: 발이 윗면보다 조금 아래까지는 올라선 것으로 본다 (옆면 판정과 겹치지 않게)
    if (hazard.kind === "step" && worldX > hazard.x - 8 && worldX < hazard.x + hazard.w + 6 && feet <= hazard.top + 10) ground = Math.min(ground, hazard.top);
  }
  return ground;
}

// --- 코스 조각 ---
// 손으로 짠 조각을 시드 난수로 이어 붙인다. 코인은 정답 경로(점프 궤적·숙이는 높이·매달리는 높이)를 따라 놓는다

interface Builder {
  add: (kind: HazardKind, x: number, w: number, top?: number) => void;
  coins: (points: [number, number][]) => void;
  item: (kind: Exclude<ItemKind, "coin">, x: number, y: number) => void;
  roll: () => number;
  speed: number;
}

/** 1단 점프 체공 프레임과 최고 높이 (발 기준) */
const JUMP_FRAMES = (2 * JUMP_SPEED) / GRAVITY;
const JUMP_PEAK = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);

/**
 * 장애물 가운데(center)를 넘는 1단 점프의 실제 궤적에 놓는 코인. 몸통 가운데 높이에 놓아
 * 가운데에 맞춰 한 번만 뛰면 다 먹고, 조금 이르거나 늦어도 몸통(34px)이 받아 준다
 */
export function jumpArc(center: number, speed: number, count: number): [number, number][] {
  const span = JUMP_FRAMES * speed;
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 0.5) / count;
    return [center - span / 2 + span * t, GROUND - PLAYER_H / 2 - JUMP_PEAK * 4 * t * (1 - t)];
  });
}

/** 점프 한 번 궤적을 따라 놓는 코인 (2단 점프·버섯처럼 1단 점프가 아닌 곳) */
function arc(start: number, width: number, height: number, count: number): [number, number][] {
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 0.5) / count;
    return [start + width * t, GROUND - 18 - height * Math.sin(Math.PI * t)];
  });
}

function line(start: number, y: number, count: number, gap = 26): [number, number][] {
  return Array.from({ length: count }, (_, index) => [start + index * gap, y]);
}

type Chunk = (x: number, b: Builder) => number;

/** 첫 15초 조각 */
const EASY: Chunk[] = [
  (x, b) => {
    b.coins(line(x, GROUND - 18, 8));
    return x + 8 * 26;
  },
  (x, b) => {
    b.add("log", x, 32);
    b.coins(jumpArc(x + 16, b.speed, 6));
    return x + 32;
  },
  (x, b) => {
    const w = 60 + b.roll() * 50;
    b.add("fire", x, w);
    b.coins(jumpArc(x + w / 2, b.speed, 7));
    return x + w;
  },
  (x, b) => {
    b.add("branch", x, 54);
    b.coins(line(x - 40, GROUND - 10, 6, 24));
    return x + 54;
  },
  (x, b) => {
    // 폭이 속도에 비례해 느릴 때도 1단 점프로 넉넉히 건넌다 (점프 길이는 속도×31)
    const w = b.speed * (14 + b.roll() * 8);
    b.add("pit", x, w);
    b.coins(jumpArc(x + w / 2, b.speed, 7));
    return x + w;
  },
  (x, b) => {
    // 통나무 바로 뒤 불길: 점프 두 번 연속
    b.add("log", x, 32);
    const fire = x + 32 + b.speed * 36;
    b.add("fire", fire, 70);
    b.coins([...jumpArc(x + 16, b.speed, 5), ...jumpArc(fire + 35, b.speed, 5)]);
    return fire + 70;
  },
];

/** 15초 뒤 섞이는 조각 */
const HARD: Chunk[] = [
  (x, b) => {
    // 길게 깔린 가시덩굴: 2단 점프로 넘는다
    const w = 120 + b.roll() * 80;
    b.add("thorn", x, w);
    b.coins(arc(x - b.speed * 6, w + b.speed * 14, 150, 9));
    return x + w;
  },
  (x, b) => {
    // 계단: 1층은 점프, 2층은 1층 위에서 2단 점프해야 올라선다
    const first = GROUND - 62;
    const second = GROUND - 180;
    // 1층 폭은 속도에 비례 — 빨라져도 1층 위에서 뛸 시간이 0.5초쯤 남는다
    const w1 = b.speed * 30;
    const w2 = b.speed * 22;
    b.add("step", x, w1, first);
    b.add("step", x + w1, w2, second);
    b.coins([...line(x + 20, first - 16, Math.floor(w1 / 40), 32), ...line(x + w1 + 15, second - 16, Math.floor(w2 / 40), 32)]);
    return x + w1 + w2;
  },
  (x, b) => {
    // 철봉: 밑은 깊은 낭떠러지라 2단 점프로 잡고 매달려 건너야 한다. 매달린 높이에 코인 줄
    const length = 520 + b.roll() * 360;
    b.add("bar", x, length);
    b.add("pit", x + 40, length - 20);
    b.coins(line(x + 50, BAR_Y + HANG_DROP - 16, Math.floor((length - 80) / 32), 32));
    return x + length + 40;
  },
  (x, b) => {
    // 불길 두 개 사이 가시덩굴: 점프 → 2단 점프 → 점프
    b.add("fire", x, 60);
    const thorn = x + 60 + b.speed * 30;
    b.add("thorn", thorn, 140);
    const fire = thorn + 140 + b.speed * 30;
    b.add("fire", fire, 60);
    b.coins([...jumpArc(x + 30, b.speed, 5), ...arc(thorn - b.speed * 6, 140 + b.speed * 14, 150, 7), ...jumpArc(fire + 30, b.speed, 5)]);
    return fire + 60;
  },
  (x, b) => {
    // 버섯 점프: 밟으면 높이 튀어 올라 넓은 낭떠러지를 건넌다 (그냥 뛰면 못 건넘)
    b.add("spring", x, 36);
    const pit = b.speed * 30;
    b.add("pit", x + 50, pit);
    b.coins(arc(x + 10, pit + 80, 170, 10));
    return x + 50 + pit;
  },
  (x, b) => {
    // 가지 밑을 숙여 지나자마자 낭떠러지 점프
    b.add("branch", x, 54);
    const pit = x + 54 + b.speed * 14;
    b.add("pit", pit, 100 + b.speed * 3);
    b.coins([...line(x - 30, GROUND - 10, 4, 24), ...jumpArc(pit + 50 + b.speed * 1.5, b.speed, 6)]);
    return pit + 100 + b.speed * 3;
  },
];

/** 3스테이지에서 섞이는 조각 */
const EXPERT: Chunk[] = [
  (x, b) => {
    // 철봉 갈아타기: 첫 철봉에서 뛰어내려 공중에서 다음 철봉을 잡는다 (밑은 쭉 낭떠러지)
    const first = 380 + b.roll() * 120;
    const gap = b.speed * 7;
    const second = 360 + b.roll() * 120;
    b.add("bar", x, first);
    b.add("bar", x + first + gap, second);
    b.add("pit", x + 40, first + gap + second - 20);
    b.coins([...line(x + 50, BAR_Y + HANG_DROP - 16, Math.floor((first - 60) / 32), 32), ...line(x + first + gap + 20, BAR_Y + HANG_DROP - 16, Math.floor((second - 60) / 32), 32)]);
    return x + first + gap + second + 40;
  },
  (x, b) => {
    // 징검다리: 낭떠러지 - 작은 섬 - 낭떠러지 (섬은 내려서 바로 다시 뛸 만큼)
    const pit = 90 + b.speed * 3;
    const island = b.speed * 34;
    b.add("pit", x, pit);
    b.add("pit", x + pit + island, pit);
    b.coins([...jumpArc(x + pit / 2, b.speed, 5), ...jumpArc(x + pit + island + pit / 2, b.speed, 5)]);
    return x + pit * 2 + island;
  },
  (x, b) => {
    // 계단을 올라 낭떠러지를 뛰어 건너 반대편 계단으로
    const top = GROUND - 90;
    const w = b.speed * 26;
    const pit = b.speed * 20;
    b.add("step", x, w, top);
    b.add("pit", x + w, pit);
    b.add("step", x + w + pit, w, top);
    b.coins([...line(x + 20, top - 16, Math.floor(w / 40), 32), ...arc(x + w - 20, pit + 40, 110, 6).map(([cx, cy]) => [cx, cy - 90] as [number, number])]);
    return x + w * 2 + pit;
  },
  (x, b) => {
    // 버섯으로 튀어 올라 공중 별(보너스 타임) 잡기
    b.add("spring", x, 36);
    b.item("star", x + b.speed * 18, GROUND - 200);
    b.coins(arc(x + 10, b.speed * 34, 170, 8));
    return x + b.speed * 36;
  },
];

/** 보너스 타임: 장애물 없이 코인 물결 */
function coinRain(x: number, b: Builder) {
  const points: [number, number][] = [];
  for (let index = 0; index < 18; index += 1) points.push([x + index * 24, GROUND - 40 - Math.sin(index * 0.45) * 50]);
  b.coins(points);
  return x + 18 * 24;
}

/** 다음 조각을 놓는다. 조각 사이 간격은 속도에 비례해 빨라져도 반응할 시간이 비슷하게 남는다 */
function spawn(state: RunState): RunState {
  let seed = state.seed;
  const roll = () => {
    const [value, next] = random(seed);
    seed = next;
    return value;
  };
  const hazards = [...state.hazards];
  const coins = [...state.coins];
  const groups = { ...state.groups };
  let id = state.nextId;
  const builder: Builder = {
    add: (kind, x, w, top = 0) => hazards.push({ id: id++, kind, x, w, top, passed: false, hit: false }),
    coins: (points) => {
      const group = id++;
      groups[group] = { total: points.length, taken: 0, missed: false };
      for (const [x, y] of points) coins.push({ id: id++, kind: "coin", x, y, group, taken: false });
    },
    item: (kind, x, y) => {
      const group = id++;
      coins.push({ id: id++, kind, x, y, group, taken: false });
    },
    roll,
    speed: state.speed,
  };
  if (state.bonus > 0) {
    const end = coinRain(state.nextX, builder);
    return { ...state, hazards, coins, groups, nextId: id, nextX: end + 30, seed };
  }
  // 스테이지가 오를수록 어려운 조각이 자주 나오고 조각 사이 간격이 좁아진다
  const pick = roll();
  const pool =
    state.stage === 3 ? (pick < 0.45 ? EXPERT : pick < 0.8 ? HARD : EASY) : state.stage === 2 ? (pick < 0.6 ? HARD : EASY) : state.frame > 60 * 15 && pick < 0.25 ? HARD : EASY;
  const chunk = pool[Math.floor(roll() * pool.length)];
  const end = chunk(state.nextX, builder);
  // 가끔 하트(회복)·별(보너스 타임)을 조각 위에 띄운다
  const lucky = roll();
  if (lucky < 0.07) builder.item("heart", end + state.speed * 10, GROUND - 90);
  else if (state.stage >= 2 && lucky < 0.15) builder.item("star", end + state.speed * 10, GROUND - 150);
  // 장애물이 촘촘히 나오되, 조각 사이에 반응할 0.4~0.9초는 남긴다
  const gap = state.stage === 3 ? 24 + roll() * 16 : state.stage === 2 ? 28 + roll() * 20 : 32 + roll() * 22;
  const nextX = end + state.speed * gap;
  return { ...state, hazards, coins, groups, nextId: id, nextX, seed };
}

function overlaps(a: ReturnType<typeof playerBox>, b: NonNullable<ReturnType<typeof hazardBox>>) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function barAt(hazards: Hazard[], worldX: number) {
  return hazards.find((hazard) => hazard.kind === "bar" && worldX >= hazard.x && worldX <= hazard.x + hazard.w);
}

function movePlayer(player: Player, input: RunInput, hazards: Hazard[], worldX: number, events: RunEvent[], bonus: boolean): Player {
  const next = { ...player, spin: player.spin >= 0 ? player.spin + 1 : -1 };
  if (next.mode === "hang") {
    if (input.jump) {
      // 뛰어내린 입력은 여기서 다 쓴다 (같은 입력이 2단 점프로 또 쓰이지 않게)
      input = { ...input, jump: false };
      // 철봉에서 뛰어내리며 점프 (한 번 더 2단 점프 가능)
      Object.assign(next, { mode: "air", vy: -7, jumps: 1 });
      events.push({ type: "jump" });
    } else if (!barAt(hazards, worldX) || input.down) {
      Object.assign(next, { mode: "air", vy: 0, jumps: 1 });
    } else {
      return next;
    }
  }

  const floor = groundAt(hazards, worldX, next.y, bonus);
  // 발밑 땅이 사라지면(낭떠러지·계단 끝) 떨어지기 시작
  if ((next.mode === "run" || next.mode === "slide") && next.y < floor) Object.assign(next, { mode: "air", vy: 0, jumps: 1 });

  const grounded = next.mode === "run" || next.mode === "slide";
  if (input.jump && grounded) {
    Object.assign(next, { mode: "air", vy: -JUMP_SPEED, jumps: 1, spin: -1 });
    events.push({ type: "jump" });
  } else if (input.jump && next.mode === "air" && next.jumps < 2) {
    Object.assign(next, { vy: -DOUBLE_JUMP_SPEED, jumps: 2, spin: 0 });
    events.push({ type: "double" });
  }

  if (next.mode === "air") {
    const before = next.y;
    next.vy += GRAVITY + (input.down ? FAST_FALL : 0);
    next.y += next.vy;
    // 꼭대기를 지나 내려오기 시작할 때 잡는다 (뛰어내리자마자 같은 철봉을 다시 잡지 않게)
    if (next.y - PLAYER_H <= BAR_Y + 8 && next.vy > -2 && next.vy < 4 && barAt(hazards, worldX)) {
      events.push({ type: "grab" });
      return { y: BAR_Y + HANG_DROP, vy: 0, jumps: 0, mode: "hang", spin: -1 };
    }
    const land = groundAt(hazards, worldX, before, bonus);
    if (next.vy >= 0 && before <= land && next.y >= land) {
      events.push({ type: "land" });
      Object.assign(next, { y: land, vy: 0, jumps: 0, spin: -1, mode: input.down ? "slide" : "run" });
    }
    return next;
  }
  next.y = floor;
  next.mode = input.down ? "slide" : "run";
  // 버섯을 밟으면 높이 튀어 오른다 (공중에서 한 번 더 2단 점프 가능)
  if (next.y >= GROUND - 1 && hazards.some((hazard) => hazard.kind === "spring" && worldX > hazard.x && worldX < hazard.x + hazard.w)) {
    events.push({ type: "spring" });
    return { ...next, mode: "air", vy: -SPRING_SPEED, jumps: 1, spin: 0 };
  }
  return next;
}

/** 한 프레임 진행 */
export function step(state: RunState, input: RunInput): { state: RunState; events: RunEvent[] } {
  const events: RunEvent[] = [];
  if (state.over) return { state, events };

  let next: RunState = {
    ...state,
    frame: state.frame + 1,
    speed: Math.min(MAX_SPEED, state.speed + ACCELERATION),
    // 보너스 타임엔 더 빠르게 내달린다
    distance: state.distance + state.speed * (state.bonus > 0 ? 1.35 : 1),
    hurt: Math.max(0, state.hurt - 1),
    bonus: Math.max(0, state.bonus - 1),
  };
  if (state.bonus === 1) events.push({ type: "bonusEnd" });
  const startBonus = (frames: number) => {
    // 앞에 깔린 장애물·코인을 걷어내고 코인 물결로 채운다
    const ahead = next.distance + PLAYER_X + 60;
    if (next.bonus === 0) events.push({ type: "bonusStart" });
    next = {
      ...next,
      bonus: Math.max(next.bonus, frames),
      hazards: next.hazards.filter((hazard) => hazard.x + hazard.w < ahead || hazard.x < ahead),
      coins: next.coins.filter((coin) => coin.x < ahead),
      nextX: ahead + 80,
    };
  };
  const stage = next.frame >= STAGE_START[3] ? 3 : next.frame >= STAGE_START[2] ? 2 : 1;
  if (stage !== next.stage) {
    next = { ...next, stage };
    events.push({ type: "stage", stage: stage as 2 | 3 });
    startBonus(STAGE_BONUS_FRAMES);
  }
  while (next.nextX < next.distance + WIDTH * 2) next = spawn(next);

  const worldX = next.distance + PLAYER_X;
  let player = movePlayer(next.player, input, next.hazards, worldX, events, next.bonus > 0);
  const body = playerBox(player, next.distance);
  let { score, hearts, hurt, distance, coinCount } = next;
  const groups = { ...next.groups };
  let starPicked = false;

  const hazards = next.hazards
    .filter((hazard) => hazard.x + hazard.w > distance - 200)
    .map((hazard) => {
      const box = hazardBox(hazard);
      if (box && !hazard.hit && hurt === 0 && next.bonus === 0 && overlaps(body, box)) {
        hearts -= 1;
        hurt = HURT_FRAMES;
        events.push({ type: "hurt" });
        return { ...hazard, hit: true };
      }
      if (!hazard.passed && hazard.x + hazard.w < body.left) {
        if (!hazard.hit) {
          score += PASS_POINTS[hazard.kind];
          events.push({ type: "points", points: PASS_POINTS[hazard.kind], label: HAZARD_NAMES[hazard.kind] });
        }
        return { ...hazard, passed: true };
      }
      return hazard;
    });

  const coins = next.coins
    .filter((coin) => coin.x > distance - 100)
    .map((coin) => {
      if (coin.taken) return coin;
      const near = coin.x + COIN_R > body.left && coin.x - COIN_R < body.right && coin.y + COIN_R > body.top && coin.y - COIN_R < body.bottom;
      if (near && coin.kind !== "coin") {
        if (coin.kind === "heart") {
          hearts = Math.min(MAX_HEARTS, hearts + 1);
          events.push({ type: "heart" });
        } else starPicked = true;
        return { ...coin, taken: true };
      }
      if (near) {
        score += COIN_POINTS * (next.bonus > 0 ? 2 : 1);
        coinCount += 1;
        const group = { ...groups[coin.group] };
        group.taken += 1;
        groups[coin.group] = group;
        events.push({ type: "coin", x: coin.x - distance, y: coin.y });
        if (group.taken === group.total && !group.missed) {
          const bonus = group.total * BONUS_PER_COIN;
          score += bonus;
          events.push({ type: "bonus", points: bonus });
        }
        return { ...coin, taken: true };
      }
      if (coin.kind === "coin" && coin.x < body.left - COIN_R && groups[coin.group] && !groups[coin.group].missed) groups[coin.group] = { ...groups[coin.group], missed: true };
      return coin;
    });

  // 낭떠러지로 떨어지면 하트 하나를 잃고, 낭떠러지 건너편 땅에서 다시 달린다
  if (player.y > HEIGHT + 60) {
    hearts -= 1;
    hurt = HURT_FRAMES;
    events.push({ type: "fall" });
    const pit = hazards.find((hazard) => hazard.kind === "pit" && worldX >= hazard.x - 20 && worldX <= hazard.x + hazard.w + 20);
    if (pit) distance = pit.x + pit.w + 30 - PLAYER_X;
    player = { y: GROUND, vy: 0, jumps: 0, mode: "run", spin: -1 };
  }

  if (next.frame % 60 === 0) {
    score += SECOND_POINTS;
    events.push({ type: "points", points: SECOND_POINTS, label: `${next.frame / 60}초` });
  }
  const over = hearts <= 0;
  if (over) events.push({ type: "over" });
  next = { ...next, distance, player, hazards, coins, groups, score, coinCount, hearts, hurt, over };
  if (starPicked) startBonus(STAR_BONUS_FRAMES);
  return { state: next, events };
}
