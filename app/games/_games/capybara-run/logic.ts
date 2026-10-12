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
export const START_SPEED = 7;
export const MAX_SPEED = 19;
/** 프레임마다 빨라지는 양. 60초에 약 +9 */
const ACCELERATION = 0.0025;
/** 부딪힌 뒤 깜빡이며 다시 안 맞는 프레임 */
const HURT_FRAMES = 80;
/** 버틴 1초마다 점수 */
export const SECOND_POINTS = 10;
export const COIN_POINTS = 10;
/** 한 묶음 코인을 하나도 안 놓치고 다 먹으면 코인 하나당 이만큼 더 */
export const BONUS_PER_COIN = 20;

export type HazardKind = "log" | "branch" | "fire" | "thorn" | "pit" | "bar" | "step";

export const PASS_POINTS: Record<HazardKind, number> = { log: 20, branch: 30, fire: 30, thorn: 60, pit: 40, bar: 120, step: 50 };
export const HAZARD_NAMES: Record<HazardKind, string> = {
  log: "통나무",
  branch: "나뭇가지",
  fire: "불길",
  thorn: "가시덩굴",
  pit: "낭떠러지",
  bar: "철봉 완주",
  step: "계단",
};

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

export interface Coin {
  id: number;
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
  | { type: "jump" | "double" | "grab" | "land" | "hurt" | "fall" | "over" };

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
function groundAt(hazards: Hazard[], worldX: number, feet: number) {
  let ground = hazards.some((hazard) => hazard.kind === "pit" && worldX > hazard.x && worldX < hazard.x + hazard.w) ? Infinity : GROUND;
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
  roll: () => number;
  speed: number;
}

/** 점프 한 번 궤적을 따라 놓는 코인 */
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
    b.coins(arc(x - b.speed * 8, 32 + b.speed * 16, 80, 6));
    return x + 32;
  },
  (x, b) => {
    const w = 60 + b.roll() * 50;
    b.add("fire", x, w);
    b.coins(arc(x - b.speed * 8, w + b.speed * 16, 85, 7));
    return x + w;
  },
  (x, b) => {
    b.add("branch", x, 54);
    b.coins(line(x - 40, GROUND - 10, 6, 24));
    return x + 54;
  },
  (x, b) => {
    const w = 90 + b.roll() * 40 + b.speed * 4;
    b.add("pit", x, w);
    b.coins(arc(x - 10, w + 20, 90, 7));
    return x + w;
  },
  (x, b) => {
    // 통나무 바로 뒤 불길: 점프 두 번 연속
    b.add("log", x, 32);
    const fire = x + 32 + b.speed * 24;
    b.add("fire", fire, 70);
    b.coins([...arc(x - b.speed * 8, 32 + b.speed * 16, 80, 5), ...arc(fire - b.speed * 8, 70 + b.speed * 16, 85, 5)]);
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
    const thorn = x + 60 + b.speed * 22;
    b.add("thorn", thorn, 140);
    const fire = thorn + 140 + b.speed * 22;
    b.add("fire", fire, 60);
    b.coins([...arc(x - b.speed * 8, 60 + b.speed * 16, 85, 5), ...arc(thorn - b.speed * 6, 140 + b.speed * 14, 150, 7), ...arc(fire - b.speed * 8, 60 + b.speed * 16, 85, 5)]);
    return fire + 60;
  },
];

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
      for (const [x, y] of points) coins.push({ id: id++, x, y, group, taken: false });
    },
    roll,
    speed: state.speed,
  };
  const pool = state.frame > 60 * 15 && roll() < 0.45 ? HARD : EASY;
  const chunk = pool[Math.floor(roll() * pool.length)];
  const end = chunk(state.nextX, builder);
  const nextX = end + state.speed * (55 + roll() * 35);
  return { ...state, hazards, coins, groups, nextId: id, nextX, seed };
}

function overlaps(a: ReturnType<typeof playerBox>, b: NonNullable<ReturnType<typeof hazardBox>>) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function barAt(hazards: Hazard[], worldX: number) {
  return hazards.find((hazard) => hazard.kind === "bar" && worldX >= hazard.x && worldX <= hazard.x + hazard.w);
}

function movePlayer(player: Player, input: RunInput, hazards: Hazard[], worldX: number, events: RunEvent[]): Player {
  const next = { ...player, spin: player.spin >= 0 ? player.spin + 1 : -1 };
  if (next.mode === "hang") {
    if (input.jump) {
      // 철봉에서 뛰어내리며 점프 (한 번 더 2단 점프 가능)
      Object.assign(next, { mode: "air", vy: -7, jumps: 1 });
      events.push({ type: "jump" });
    } else if (!barAt(hazards, worldX) || input.down) {
      Object.assign(next, { mode: "air", vy: 0, jumps: 1 });
    } else {
      return next;
    }
  }

  const floor = groundAt(hazards, worldX, next.y);
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
    if (next.y - PLAYER_H <= BAR_Y + 8 && next.vy < 4 && barAt(hazards, worldX)) {
      events.push({ type: "grab" });
      return { y: BAR_Y + HANG_DROP, vy: 0, jumps: 0, mode: "hang", spin: -1 };
    }
    const land = groundAt(hazards, worldX, before);
    if (next.vy >= 0 && before <= land && next.y >= land) {
      events.push({ type: "land" });
      Object.assign(next, { y: land, vy: 0, jumps: 0, spin: -1, mode: input.down ? "slide" : "run" });
    }
    return next;
  }
  next.y = floor;
  next.mode = input.down ? "slide" : "run";
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
    distance: state.distance + state.speed,
    hurt: Math.max(0, state.hurt - 1),
  };
  while (next.nextX < next.distance + WIDTH * 2) next = spawn(next);

  const worldX = next.distance + PLAYER_X;
  let player = movePlayer(next.player, input, next.hazards, worldX, events);
  const body = playerBox(player, next.distance);
  let { score, hearts, hurt, distance, coinCount } = next;
  const groups = { ...next.groups };

  const hazards = next.hazards
    .filter((hazard) => hazard.x + hazard.w > distance - 200)
    .map((hazard) => {
      const box = hazardBox(hazard);
      if (box && !hazard.hit && hurt === 0 && overlaps(body, box)) {
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
      if (near) {
        score += COIN_POINTS;
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
      if (coin.x < body.left - COIN_R && groups[coin.group] && !groups[coin.group].missed) groups[coin.group] = { ...groups[coin.group], missed: true };
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
  return { state: { ...next, distance, player, hazards, coins, groups, score, coinCount, hearts, hurt, over }, events };
}
