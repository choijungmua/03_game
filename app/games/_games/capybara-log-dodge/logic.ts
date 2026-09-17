// 카피바라 통나무 피하기 규칙. 화면·입력과 분리해 테스트한다
// 좌표는 기기와 상관없는 고정 게임 세계(GAME_WIDTH × GAME_HEIGHT). 카피바라는 아래쪽에서 위로 달리고 통나무는 위에서 굴러 내려온다
// 피하는 방법은 세 가지: 좌우 이동, 점프(바닥 통나무), 숙이기(머리 높이 통나무)

export const GAME_WIDTH = 450;
export const GAME_HEIGHT = 800;

export const CAPYBARA_Y = 660;
/** 판정 박스 반폭·반높이. 그림(72px)보다 훨씬 작게 잡아 억울한 충돌이 없게 한다 */
export const CAPYBARA_HALF_WIDTH = 15;
export const CAPYBARA_HALF_HEIGHT = 18;
/** 좌우 최대 이동 속도(px/s). 드래그도 이 속도를 넘지 못한다 (웨이브 사이 도달 가능성 계산 기준) */
export const MOVE_SPEED = 620;
/** 점프 한 번 체공 시간. 이 동안 바닥 통나무를 넘는다 */
export const JUMP_MS = 560;
/** 숙이기를 뗀 뒤에도 이만큼은 숙인 채로 있다 (짧게 눌러도 가로대를 지나가게) */
export const DUCK_MS = 320;
/** 전체 폭 통나무가 이 거리(px) 안으로 다가오면 "점프!"/"숙여!" 안내를 띄운다 */
export const CUE_DISTANCE = 240;

export const LOG_THICKNESS = 34;
/** 가로 통나무 벽의 틈. 카피바라 폭의 3배 이상 */
export const MIN_GAP = CAPYBARA_HALF_WIDTH * 2 * 3;
/** 이 거리(px) 안으로 스쳐 지나가면 "아슬아슬" */
export const NEAR_MISS_PX = 16;
export const NEAR_MISS_SLOWMO_MS = 150;
export const NEAR_MISS_TIME_SCALE = 0.35;
/** 이 시간에 통나무 종류·밀도 곡선이 끝나고, 그 뒤로는 러시 구간 — 속도가 끝없이 오른다 */
export const PEAK_MS = 60_000;
/** 러시 구간에서 1초마다 더해지는 낙하 속도(px/s). 120초면 보통 통나무가 약 1400px/s */
export const RUSH_SPEED_PER_S = 14;
/** 웨이브 간격 하한. MOVE_SPEED로 화면 끝에서 끝(GAME_WIDTH - MIN_GAP)까지 갈 수 있는 시간보다 짧아지지 않는다 */
export const MIN_WAVE_INTERVAL_MS = 600;
/** 탭 전환 등으로 프레임 간격이 튀어도 한 번에 이만큼만 진행 */
const MAX_STEP_MS = 50;
const SPLIT_Y = 300;
const SPLIT_WIDTH = 160;
/** 허들·가로대는 다른 통나무보다 조금 느리게 내려와 타이밍을 볼 여유를 준다 */
export const FULL_WIDTH_SPEED_RATIO = 0.85;

/** 웨이브마다 느릿·보통·빠름 중 하나. 허들·가로대·쪼개지는 통나무는 타이밍이 흔들리지 않게 늘 보통 */
export type Pace = "slow" | "normal" | "fast";
export const PACE_SPEED: Record<Pace, number> = { slow: 0.65, normal: 1, fast: 1.5 };
const SLOW_FROM_MS = 3_000;
const FAST_FROM_MS = 6_000;
/** 속도가 다른 웨이브가 겹쳐 한꺼번에 막지 않게, 새 웨이브는 앞 통나무보다 이만큼 늦게 카피바라 줄에 닿는다 */
export const ARRIVAL_GAP_MS = 350;
/** 둘 중 하나라도 점프·숙이기로 지나가야 하면 체공 시간보다 넉넉히 */
export const ACTION_ARRIVAL_GAP_MS = JUMP_MS + 140;

/** 허들과 가로대가 연달아 오는 콤보 웨이브 */
export const COMBO_UNLOCK_MS = 22_000;
const COMBO_CHANCE = 0.25;
/** 콤보 두 통나무가 카피바라에 닿는 시간 차(s) */
const COMBO_GAP_S = 0.95;

/** 따라오는 통나무는 이 높이까지만 카피바라 쪽으로 휘어 오고, 그 뒤로는 곧게 떨어진다 */
export const CHASE_STOP_Y = 420;
const CHASE_SPEED = 150;

/** 유자 보호막: 먹으면 통나무 한 번을 막아 준다 */
export const PICKUP_RADIUS = 22;
const PICKUP_SPEED = 200;
const PICKUP_FIRST_MS = 9_000;
/** 막은 뒤 잠깐 무적 (같은 통나무 줄에 연달아 맞지 않게) */
export const SHIELD_INVINCIBLE_MS = 1_200;
/** 아슬아슬이 이 시간 안에 이어지면 콤보 */
export const COMBO_WINDOW_MS = 2_500;
/** 아슬아슬 콤보가 이 수의 배수에 닿으면 유자 보호막 보상 — 아슬아슬하게 스칠수록 이득 */
export const COMBO_SHIELD_AT = 3;

export type LogKind = "roll" | "hurdle" | "wall" | "beam" | "bounce" | "split" | "chase";
/** low는 점프로 넘고, high는 숙여서 지나가고, full은 좌우로만 피한다 */
export type LogHeight = "low" | "high" | "full";

export const LOG_HEIGHTS: Record<LogKind, LogHeight> = {
  roll: "low",
  hurdle: "low",
  wall: "full",
  beam: "high",
  bounce: "full",
  split: "full",
  chase: "full",
};

/** 난이도 곡선에서 이 시간이 지나야 등장한다 */
export const LOG_UNLOCK_MS: Record<LogKind, number> = {
  roll: 0,
  hurdle: 4_000,
  wall: 8_000,
  beam: 12_000,
  bounce: 18_000,
  chase: 24_000,
  split: 30_000,
};

export interface Log {
  id: number;
  kind: LogKind;
  /** 중심 좌표 */
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  pace: Pace;
  /** 세로로 겹친 동안 카피바라와의 가장 가까운 가로 거리. 다 지나가면 아슬아슬 판정에 쓴다 */
  closest: number;
}

export interface GameState {
  elapsedMs: number;
  x: number;
  logs: Log[];
  nextId: number;
  waveInMs: number;
  nearMisses: number;
  /** 남은 슬로모션 시간(실제 ms) */
  slowmoMs: number;
  /** 마지막 아슬아슬 순간(elapsedMs). 화면 글자 표시용 */
  lastNearMissAt: number | null;
  /** 맞은 통나무 종류. null이면 아직 달리는 중 */
  hitBy: LogKind | null;
  /** 좌(-1)·정지(0)·우(1) — 스프라이트 방향 */
  lean: -1 | 0 | 1;
  /** 남은 체공 시간. 0이면 땅에 있음 */
  jumpMs: number;
  /** 남은 숙이기 시간. 0이면 서 있음 */
  duckMs: number;
  /** 연달아 이어진 아슬아슬 수 */
  combo: number;
  /** 떨어지는 유자 보호막. 없으면 null */
  pickup: { x: number; y: number } | null;
  /** 다음 유자가 나올 때까지 남은 시간 (보호막이 없고 유자도 없을 때만 줄어든다) */
  pickupInMs: number;
  shield: boolean;
  /** 보호막이 막은 뒤 남은 무적 시간 */
  invincibleMs: number;
  /** 보호막을 먹은·쓴 순간(elapsedMs). 화면 글자 표시용 */
  lastShieldAt: number | null;
  lastBlockAt: number | null;
  random: () => number;
}

export interface GameInput {
  direction: number;
  /** 드래그 목표 x. 없으면 null */
  targetX: number | null;
  /** 이번 프레임에 점프를 눌렀는지 (체공 중이면 무시) */
  jump: boolean;
  /** 숙이기를 누르고 있는지 */
  duck: boolean;
}

/** 같은 seed면 같은 통나무 순서가 나오는 난수 (mulberry32) */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 한국 시간 기준 오늘 날짜 "2026-09-14". 오늘의 코스 seed이자 기록의 코스 이름 */
export function getCourseDate(now: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

export function seedFromText(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export interface Difficulty {
  /** 0(시작) ~ 1(최고) */
  level: number;
  fallSpeed: number;
  waveIntervalMs: number;
}

export function getDifficulty(elapsedMs: number): Difficulty {
  const level = Math.min(1, elapsedMs / PEAK_MS) ** 2;
  const rushSeconds = Math.max(0, elapsedMs - PEAK_MS) / 1000;
  return {
    level,
    fallSpeed: 260 + 300 * level + RUSH_SPEED_PER_S * rushSeconds,
    waveIntervalMs: Math.max(MIN_WAVE_INTERVAL_MS, 1300 - 600 * level - 2 * rushSeconds),
  };
}

export function createState(random: () => number = Math.random): GameState {
  return {
    elapsedMs: 0,
    x: GAME_WIDTH / 2,
    logs: [],
    nextId: 1,
    waveInMs: 600,
    nearMisses: 0,
    slowmoMs: 0,
    lastNearMissAt: null,
    hitBy: null,
    lean: 0,
    jumpMs: 0,
    duckMs: 0,
    combo: 0,
    pickup: null,
    pickupInMs: PICKUP_FIRST_MS,
    shield: false,
    invincibleMs: 0,
    lastShieldAt: null,
    lastBlockAt: null,
    random,
  };
}

function between(random: () => number, min: number, max: number) {
  return min + (max - min) * random();
}

type LogSeed = Omit<Log, "id" | "closest">;
type PatternLog = Omit<LogSeed, "pace">;

/**
 * 한 웨이브에 나올 통나무들. 콤보 둘째 통나무 말고는 화면 위에서 같은 줄로 출발하고, 웨이브 전체가 같은 속도(pace)다.
 * 좌우로만 피하는(full) 통나무 사이에는 반드시 MIN_GAP 이상 틈이 있고, 화면 폭 전체를 막는 건 점프·숙이기로 지나가는 통나무뿐이다
 */
export function createWave(random: () => number, elapsedMs: number): LogSeed[] {
  const logs = createPattern(random, elapsedMs);
  const steady = logs.some((log) => log.kind === "hurdle" || log.kind === "beam" || log.kind === "split");
  const roll = random();
  const { level } = getDifficulty(elapsedMs);
  const pace: Pace =
    steady || elapsedMs < SLOW_FROM_MS
      ? "normal"
      : roll < 0.2
        ? "slow"
        : elapsedMs >= FAST_FROM_MS && roll < 0.35 + 0.2 * level
          ? "fast"
          : "normal";
  const speed = PACE_SPEED[pace];
  return logs.map((log) => ({ ...log, vx: log.vx * speed, vy: log.vy * speed, pace }));
}

function createPattern(random: () => number, elapsedMs: number): PatternLog[] {
  const { fallSpeed } = getDifficulty(elapsedMs);
  const y = -LOG_THICKNESS;

  if (elapsedMs >= COMBO_UNLOCK_MS && random() < COMBO_CHANCE) {
    // 허들→가로대(또는 반대)가 연달아: 점프하고 착지하자마자 숙이기
    const vy = fallSpeed * FULL_WIDTH_SPEED_RATIO;
    const [first, second] = random() < 0.5 ? (["hurdle", "beam"] as const) : (["beam", "hurdle"] as const);
    return [
      { kind: first, x: GAME_WIDTH / 2, y, w: GAME_WIDTH, h: LOG_THICKNESS, vx: 0, vy },
      { kind: second, x: GAME_WIDTH / 2, y: y - vy * COMBO_GAP_S, w: GAME_WIDTH, h: LOG_THICKNESS, vx: 0, vy },
    ];
  }

  const kinds = (Object.keys(LOG_UNLOCK_MS) as LogKind[]).filter((kind) => elapsedMs >= LOG_UNLOCK_MS[kind]);
  const kind = kinds[Math.floor(random() * kinds.length)];

  if (kind === "hurdle" || kind === "beam") {
    // 화면 폭 전체를 막는 통나무 — 바닥(허들)은 점프, 머리 높이(가로대)는 숙이기로만 지나간다
    return [{ kind, x: GAME_WIDTH / 2, y, w: GAME_WIDTH, h: LOG_THICKNESS, vx: 0, vy: fallSpeed * FULL_WIDTH_SPEED_RATIO }];
  }

  if (kind === "chase") {
    const w = 70;
    return [{ kind, x: between(random, w / 2, GAME_WIDTH - w / 2), y, w, h: LOG_THICKNESS, vx: 0, vy: fallSpeed * 0.75 }];
  }

  if (kind === "wall") {
    const gapWidth = between(random, MIN_GAP, MIN_GAP * 1.5);
    const gapLeft = between(random, 0, GAME_WIDTH - gapWidth);
    const gapRight = gapLeft + gapWidth;
    const logs: PatternLog[] = [];
    if (gapLeft > 0) logs.push({ kind, x: gapLeft / 2, y, w: gapLeft, h: LOG_THICKNESS, vx: 0, vy: fallSpeed * 0.8 });
    if (gapRight < GAME_WIDTH) {
      const w = GAME_WIDTH - gapRight;
      logs.push({ kind, x: gapRight + w / 2, y, w, h: LOG_THICKNESS, vx: 0, vy: fallSpeed * 0.8 });
    }
    return logs;
  }

  if (kind === "bounce") {
    const w = 70;
    return [
      {
        kind,
        x: between(random, w / 2, GAME_WIDTH - w / 2),
        y,
        w,
        h: LOG_THICKNESS,
        vx: (random() < 0.5 ? -1 : 1) * fallSpeed * 0.6,
        vy: fallSpeed * 0.9,
      },
    ];
  }

  if (kind === "split") {
    const w = SPLIT_WIDTH;
    return [{ kind, x: between(random, w / 2, GAME_WIDTH - w / 2), y, w, h: LOG_THICKNESS + 8, vx: 0, vy: fallSpeed * 0.7 }];
  }

  // roll: 가로 통나무 1~2개. 두 개면 사이·바깥에 MIN_GAP 이상 남도록 왼쪽·오른쪽 반에 하나씩
  const count = random() < 0.4 + 0.4 * getDifficulty(elapsedMs).level ? 2 : 1;
  const w = between(random, 90, 140);
  if (count === 1) return [{ kind, x: between(random, w / 2, GAME_WIDTH - w / 2), y, w, h: LOG_THICKNESS, vx: 0, vy: fallSpeed }];
  const half = GAME_WIDTH / 2;
  // 각 반쪽의 바깥 끝에 붙여 가운데에 GAME_WIDTH - 2w(≥170) 틈이 생기거나, 가운데 쪽에 붙여 양옆에 틈이 생긴다
  const outward = random() < 0.5;
  const leftX = outward ? w / 2 : half - w / 2 - MIN_GAP / 2;
  const rightX = outward ? GAME_WIDTH - w / 2 : half + w / 2 + MIN_GAP / 2;
  return [
    { kind, x: leftX, y, w, h: LOG_THICKNESS, vx: 0, vy: fallSpeed },
    { kind, x: rightX, y, w, h: LOG_THICKNESS, vx: 0, vy: fallSpeed },
  ];
}

/** 웨이브의 가로 빈 구간 중 가장 넓은 폭 (공정성 검사용) */
export function widestGap(logs: readonly Pick<Log, "x" | "w">[]) {
  const spans = logs.map((log) => [log.x - log.w / 2, log.x + log.w / 2]).sort((a, b) => a[0] - b[0]);
  let cursor = 0;
  let widest = 0;
  for (const [left, right] of spans) {
    widest = Math.max(widest, left - cursor);
    cursor = Math.max(cursor, right);
  }
  return Math.max(widest, GAME_WIDTH - cursor);
}

function addLogs(state: GameState, seeds: LogSeed[]) {
  for (const seed of seeds) {
    state.logs.push({ ...seed, id: state.nextId, closest: Infinity });
    state.nextId += 1;
  }
}

/** 카피바라 줄(CAPYBARA_Y)까지 남은 시간(ms) */
export function arrivalMs(log: Pick<Log, "y" | "vy">) {
  return ((CAPYBARA_Y - log.y) / log.vy) * 1000;
}

/** 앞서 내려오는 통나무보다 너무 일찍 닿는 웨이브는 속도는 그대로 두고 통째로 위에서 늦게 출발시킨다 */
function addWave(state: GameState, seeds: LogSeed[]) {
  let delayMs = 0;
  for (const seed of seeds) {
    for (const log of state.logs) {
      if (log.y >= CAPYBARA_Y || log.vy <= 0) continue;
      const action = LOG_HEIGHTS[log.kind] !== "full" || LOG_HEIGHTS[seed.kind] !== "full";
      delayMs = Math.max(delayMs, arrivalMs(log) + (action ? ACTION_ARRIVAL_GAP_MS : ARRIVAL_GAP_MS) - arrivalMs(seed));
    }
  }
  addLogs(state, seeds.map((seed) => ({ ...seed, y: seed.y - (seed.vy * delayMs) / 1000 })));
}

function stepPickup(state: GameState, dt: number) {
  if (!state.shield && !state.pickup) {
    state.pickupInMs -= dt;
    if (state.pickupInMs <= 0) {
      state.pickup = { x: between(state.random, 40, GAME_WIDTH - 40), y: -PICKUP_RADIUS };
      state.pickupInMs = between(state.random, 12_000, 18_000);
    }
  }
  const pickup = state.pickup;
  if (!pickup) return;
  pickup.y += (PICKUP_SPEED * dt) / 1000;
  if (
    Math.abs(pickup.x - state.x) < PICKUP_RADIUS + CAPYBARA_HALF_WIDTH &&
    Math.abs(pickup.y - CAPYBARA_Y) < PICKUP_RADIUS + CAPYBARA_HALF_HEIGHT
  ) {
    state.shield = true;
    state.lastShieldAt = state.elapsedMs;
    state.pickup = null;
  } else if (pickup.y - PICKUP_RADIUS > GAME_HEIGHT) {
    state.pickup = null;
  }
}

/** 지금 자세로 이 높이의 통나무를 지나갈 수 있는지 */
function clears(state: GameState, height: LogHeight) {
  return (height === "low" && state.jumpMs > 0) || (height === "high" && state.duckMs > 0);
}

/** 한 프레임 진행. realDtMs는 실제 경과 시간 — 슬로모션이면 게임 시간은 느리게 흐른다 */
export function step(state: GameState, realDtMs: number, input: GameInput) {
  if (state.hitBy) return;
  const realDt = Math.min(MAX_STEP_MS, Math.max(0, realDtMs));
  const slowmo = state.slowmoMs > 0;
  state.slowmoMs = Math.max(0, state.slowmoMs - realDt);
  const dt = slowmo ? realDt * NEAR_MISS_TIME_SCALE : realDt;
  state.elapsedMs += dt;

  // 이동: 드래그 목표가 있으면 그쪽으로, 없으면 방향키. 둘 다 MOVE_SPEED 상한. 점프·숙이기 중에도 좌우로 움직일 수 있다
  const maxMove = (MOVE_SPEED * dt) / 1000;
  const wanted = input.targetX !== null ? input.targetX - state.x : input.direction * maxMove;
  const move = Math.max(-maxMove, Math.min(maxMove, wanted));
  const prevX = state.x;
  state.x = Math.max(CAPYBARA_HALF_WIDTH, Math.min(GAME_WIDTH - CAPYBARA_HALF_WIDTH, state.x + move));
  const moved = state.x - prevX;
  state.lean = Math.abs(moved) < 0.01 ? 0 : moved < 0 ? -1 : 1;

  // 점프는 땅에 있을 때만 시작하고, 체공 중에 누른 숙이기는 착지하자마자 이어진다
  state.jumpMs = Math.max(0, state.jumpMs - dt);
  state.duckMs = Math.max(0, state.duckMs - dt);
  if (input.jump && state.jumpMs === 0) {
    state.jumpMs = JUMP_MS;
    state.duckMs = 0;
  } else if (input.duck && state.jumpMs === 0) {
    state.duckMs = DUCK_MS;
  }

  state.waveInMs -= dt;
  if (state.waveInMs <= 0) {
    addWave(state, createWave(state.random, state.elapsedMs));
    state.waveInMs += getDifficulty(state.elapsedMs).waveIntervalMs;
  }
  stepPickup(state, dt);
  state.invincibleMs = Math.max(0, state.invincibleMs - dt);

  const seconds = dt / 1000;
  const capTop = CAPYBARA_Y - CAPYBARA_HALF_HEIGHT;
  const capBottom = CAPYBARA_Y + CAPYBARA_HALF_HEIGHT;
  const kept: Log[] = [];
  const pieces: LogSeed[] = [];

  for (const log of state.logs) {
    if (log.kind === "chase") {
      log.vx = log.y < CHASE_STOP_Y ? Math.max(-CHASE_SPEED, Math.min(CHASE_SPEED, (state.x - log.x) * 3)) : 0;
    }
    log.x += log.vx * seconds;
    log.y += log.vy * seconds;
    if (log.vx !== 0 && (log.x - log.w / 2 < 0 || log.x + log.w / 2 > GAME_WIDTH)) {
      log.vx = -log.vx;
      log.x = Math.max(log.w / 2, Math.min(GAME_WIDTH - log.w / 2, log.x));
    }

    if (log.kind === "split" && log.w >= SPLIT_WIDTH && log.y >= SPLIT_Y) {
      // 큰 통나무가 반으로 쪼개져 양옆 대각선으로 튕겨 나간다 (조각은 SPLIT_WIDTH보다 작아 다시 쪼개지지 않는다)
      const w = log.w / 2;
      const { pace } = log;
      pieces.push(
        { kind: "split", x: Math.max(w / 2, log.x - w / 2), y: log.y, w, h: LOG_THICKNESS, vx: -log.vy * 0.5, vy: log.vy, pace },
        { kind: "split", x: Math.min(GAME_WIDTH - w / 2, log.x + w / 2), y: log.y, w, h: LOG_THICKNESS, vx: log.vy * 0.5, vy: log.vy, pace },
      );
      continue;
    }

    const logTop = log.y - log.h / 2;
    const logBottom = log.y + log.h / 2;
    const horizontalGap = Math.abs(log.x - state.x) - log.w / 2 - CAPYBARA_HALF_WIDTH;

    // 보호막이 막은 직후 무적 동안은 부딪혀도 지나간다
    if (state.invincibleMs <= 0 && logBottom >= capTop && logTop <= capBottom && !clears(state, LOG_HEIGHTS[log.kind])) {
      if (horizontalGap < 0) {
        if (!state.shield) {
          state.hitBy = log.kind;
          return;
        }
        // 유자 보호막이 통나무를 튕겨 내고 사라진다
        state.shield = false;
        state.invincibleMs = SHIELD_INVINCIBLE_MS;
        state.lastBlockAt = state.elapsedMs;
        continue;
      }
      log.closest = Math.min(log.closest, horizontalGap);
    }

    if (logTop > capBottom && log.closest !== Infinity) {
      if (log.closest <= NEAR_MISS_PX) {
        const chained = state.lastNearMissAt !== null && state.elapsedMs - state.lastNearMissAt <= COMBO_WINDOW_MS;
        state.combo = chained ? state.combo + 1 : 1;
        state.nearMisses += 1;
        state.lastNearMissAt = state.elapsedMs;
        state.slowmoMs = NEAR_MISS_SLOWMO_MS;
        if (state.combo % COMBO_SHIELD_AT === 0 && !state.shield) {
          state.shield = true;
          state.lastShieldAt = state.elapsedMs;
        }
      }
      log.closest = Infinity;
    }

    if (logTop < GAME_HEIGHT) kept.push(log);
  }

  state.logs = kept;
  addLogs(state, pieces);
}

/** 곧 닿을 허들·가로대에 맞는 동작. 화면 안내("점프!"/"숙여!")에 쓴다 */
export function getCue(state: GameState): "jump" | "duck" | null {
  const capTop = CAPYBARA_Y - CAPYBARA_HALF_HEIGHT;
  // 콤보 웨이브처럼 둘이 같이 오면 가까운 쪽 동작
  let cue: "jump" | "duck" | null = null;
  let nearest = CUE_DISTANCE;
  for (const log of state.logs) {
    if (log.kind !== "hurdle" && log.kind !== "beam") continue;
    const distance = capTop - (log.y + log.h / 2);
    if (distance >= 0 && distance < nearest) {
      nearest = distance;
      cue = log.kind === "hurdle" ? "jump" : "duck";
    }
  }
  return cue;
}

const DEATH_LINES: Record<LogKind, string> = {
  roll: "굴러온 통나무에 정면으로 박았어요",
  hurdle: "바닥 통나무에 걸려 넘어졌어요 — 점프로 넘어 보세요",
  wall: "통나무 벽의 틈을 못 찾았어요",
  beam: "머리 높이 통나무에 이마를 박았어요 — 숙여서 지나가 보세요",
  bounce: "튕겨 온 통나무에 옆구리를 맞았어요",
  split: "쪼개진 통나무 조각에 맞았어요",
  chase: "끝까지 쫓아온 통나무에 잡혔어요 — 휘어 오다 곧게 떨어질 때 옆으로 비켜 보세요",
};

export function getDeathLine(kind: LogKind, elapsedMs: number) {
  const line = DEATH_LINES[kind];
  return elapsedMs < 5_000 ? `${(elapsedMs / 1000).toFixed(1)}초 만에 납작! ${line}` : line;
}

/** 공유 링크의 ?vs= 값. 숫자가 아니거나 범위 밖이면 null */
export function parseChallenge(search: string): number | null {
  const raw = new URLSearchParams(search).get("vs");
  if (raw === null || raw.trim() === "") return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 999) return null;
  return Math.round(seconds * 10) / 10;
}

export function formatSeconds(ms: number) {
  return (Math.floor(ms / 100) / 10).toFixed(1);
}
