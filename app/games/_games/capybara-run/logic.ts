// 카피바라 런 물리. 1프레임 = 1/60초, 화면 좌표(px). 카피바라는 화면 왼쪽에 고정되고 세상이 왼쪽으로 흐른다.
// 장애물 x는 출발점부터 잰 세상 좌표, 화면 x = 장애물 x - distance

export const WIDTH = 640;
export const HEIGHT = 300;
export const GROUND = 262;
export const PLAYER_X = 120;
export const PLAYER_W = 40;
export const PLAYER_H = 44;
export const SLIDE_H = 22;
/** 철봉 높이. 한 번 점프로는 머리가 안 닿고 2단 점프해야 잡힌다 */
export const BAR_Y = 76;
/** 매달렸을 때 몸이 철봉 아래로 늘어지는 길이 (머리~발) */
export const HANG_DROP = PLAYER_H + 6;
export const MAX_HEARTS = 3;

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
const HURT_FRAMES = 70;
/** 버틴 1초마다 점수 */
export const SECOND_POINTS = 10;

export type HazardKind = "log" | "branch" | "fire" | "thorn" | "bar";

export const PASS_POINTS: Record<HazardKind, number> = { log: 20, branch: 30, fire: 30, thorn: 60, bar: 100 };
export const HAZARD_NAMES: Record<HazardKind, string> = {
  log: "통나무",
  branch: "나뭇가지",
  fire: "불길",
  thorn: "가시덩굴",
  bar: "철봉 완주",
};

export interface Hazard {
  id: number;
  kind: HazardKind;
  x: number;
  w: number;
  passed: boolean;
  hit: boolean;
}

export type Mode = "run" | "air" | "slide" | "hang";

export interface Player {
  /** 발 높이(y). 매달렸을 때도 발 기준 */
  y: number;
  vy: number;
  /** 이번 공중에서 쓴 점프 수 (0~2) */
  jumps: number;
  mode: Mode;
}

export interface RunState {
  frame: number;
  distance: number;
  speed: number;
  player: Player;
  hazards: Hazard[];
  /** 다음 장애물을 놓을 세상 x */
  nextX: number;
  nextId: number;
  seed: number;
  score: number;
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
  | { type: "jump" | "double" | "grab" | "hurt" | "over" };

/** 시드 고정 난수 (mulberry32). 같은 시드면 같은 코스 */
function random(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, (seed + 0x6d2b79f5) | 0];
}

export function createRun(seed = Date.now() % 2147483647): RunState {
  return {
    frame: 0,
    distance: 0,
    speed: START_SPEED,
    player: { y: GROUND, vy: 0, jumps: 0, mode: "run" },
    hazards: [],
    nextX: WIDTH + 200,
    nextId: 1,
    seed,
    score: 0,
    hearts: MAX_HEARTS,
    hurt: 0,
    over: false,
  };
}

/** 장애물 판정 상자 (세상 좌표). 철봉은 부딪히는 게 아니라 잡는 것이라 null */
export function hazardBox(hazard: Hazard): { left: number; right: number; top: number; bottom: number } | null {
  const { x, w } = hazard;
  switch (hazard.kind) {
    case "log":
      return { left: x + 4, right: x + w - 4, top: GROUND - 30, bottom: GROUND };
    case "branch":
      // 서 있으면 머리가 닿고, 숙이면 지나간다. 한 번 점프로는 몸통이 걸린다
      return { left: x + 6, right: x + w - 6, top: GROUND - 160, bottom: GROUND - SLIDE_H - 6 };
    case "fire":
      return { left: x + 6, right: x + w - 6, top: GROUND - 22, bottom: GROUND };
    case "thorn":
      return { left: x + 4, right: x + w - 4, top: GROUND - 26, bottom: GROUND };
    case "bar":
      return null;
  }
}

export function playerBox(player: Player, distance: number) {
  const height = player.mode === "slide" ? SLIDE_H : PLAYER_H;
  const left = distance + PLAYER_X - PLAYER_W / 2 + 6;
  return { left, right: left + PLAYER_W - 12, top: player.y - height + 4, bottom: player.y };
}

/**
 * 다음 장애물 묶음을 놓는다. 처음 15초는 통나무·나뭇가지·불만, 그 뒤 가시덩굴과 철봉(밑에 가시덩굴)이 섞인다.
 * 간격은 속도에 비례해서 빨라져도 반응할 시간(프레임)이 비슷하게 남는다
 */
function spawn(state: RunState): RunState {
  let seed = state.seed;
  const roll = () => {
    const [value, next] = random(seed);
    seed = next;
    return value;
  };
  const hazards = [...state.hazards];
  let id = state.nextId;
  let x = state.nextX;
  const add = (kind: HazardKind, start: number, w: number) => hazards.push({ id: id++, kind, x: start, w, passed: false, hit: false });

  const late = state.frame > 60 * 15;
  const pick = roll();
  let end: number;
  if (late && pick < 0.2) {
    // 철봉: 2단 점프로 잡고 매달려 가시덩굴 위를 건넌다. 가시덩굴이 2단 점프로 넘기에는 길다
    const length = 520 + roll() * 380;
    add("bar", x, length);
    add("thorn", x + 50, length - 20);
    end = x + length + 40;
  } else if (late && pick < 0.38) {
    const length = 110 + roll() * 90;
    add("thorn", x, length);
    end = x + length;
  } else if (pick < 0.6) {
    const length = 60 + roll() * 60;
    add("fire", x, length);
    end = x + length;
  } else if (pick < 0.8) {
    add("branch", x, 50);
    end = x + 50;
  } else {
    add("log", x, 34);
    end = x + 34;
    // 가끔 통나무 바로 뒤 불길: 점프 두 번 연속
    if (roll() < 0.35) {
      add("fire", end + state.speed * 26, 70);
      end += state.speed * 26 + 70;
    }
  }
  // 다음 묶음까지 1~1.6초어치 거리
  x = end + state.speed * (60 + roll() * 36);
  return { ...state, hazards, nextId: id, nextX: x, seed };
}

function overlaps(a: ReturnType<typeof playerBox>, b: NonNullable<ReturnType<typeof hazardBox>>) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** 지금 머리 위·발밑 x에 걸친 철봉 */
function barAt(hazards: Hazard[], worldX: number) {
  return hazards.find((hazard) => hazard.kind === "bar" && worldX >= hazard.x && worldX <= hazard.x + hazard.w);
}

function movePlayer(player: Player, input: RunInput, hazards: Hazard[], worldX: number, events: RunEvent[]): Player {
  const next = { ...player };
  if (next.mode === "hang") {
    const bar = barAt(hazards, worldX);
    if (input.jump) {
      // 철봉에서 뛰어내리며 점프 (한 번 더 2단 점프 가능)
      Object.assign(next, { mode: "air", vy: -DOUBLE_JUMP_SPEED * 0.6, jumps: 1 });
      events.push({ type: "jump" });
    } else if (!bar || input.down) {
      Object.assign(next, { mode: "air", vy: 0, jumps: 1 });
    } else {
      return next;
    }
  }

  const grounded = next.mode === "run" || next.mode === "slide";
  if (input.jump && grounded) {
    Object.assign(next, { mode: "air", vy: -JUMP_SPEED, jumps: 1 });
    events.push({ type: "jump" });
  } else if (input.jump && next.mode === "air" && next.jumps < 2) {
    Object.assign(next, { vy: -DOUBLE_JUMP_SPEED, jumps: 2 });
    events.push({ type: "double" });
  }

  if (next.mode === "air") {
    next.vy += GRAVITY + (input.down ? FAST_FALL : 0);
    next.y += next.vy;
    const head = next.y - PLAYER_H;
    // 철봉 잡기: 머리가 철봉 높이까지 올라오면 매달린다
    if (head <= BAR_Y + 8 && barAt(hazards, worldX)) {
      events.push({ type: "grab" });
      return { y: BAR_Y + HANG_DROP, vy: 0, jumps: 0, mode: "hang" };
    }
    if (next.y >= GROUND) Object.assign(next, { y: GROUND, vy: 0, jumps: 0, mode: input.down ? "slide" : "run" });
    return next;
  }
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
  const player = movePlayer(next.player, input, next.hazards, worldX, events);
  const body = playerBox(player, next.distance);
  let { score, hearts, hurt } = next;

  const hazards = next.hazards
    .filter((hazard) => hazard.x + hazard.w > next.distance - 100)
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

  if (next.frame % 60 === 0) {
    score += SECOND_POINTS;
    events.push({ type: "points", points: SECOND_POINTS, label: `${next.frame / 60}초` });
  }
  const over = hearts <= 0;
  if (over) events.push({ type: "over" });
  return { state: { ...next, player, hazards, score, hearts, hurt, over }, events };
}
