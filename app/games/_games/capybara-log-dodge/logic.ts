// 카피바라 통나무 피하기 규칙. 화면·입력과 분리해 테스트한다
// 좌표는 기기와 상관없는 고정 게임 세계(GAME_WIDTH × GAME_HEIGHT). 카피바라는 아래쪽에서 위로 달리고 통나무는 위에서 굴러 내려온다

export const GAME_WIDTH = 450;
export const GAME_HEIGHT = 800;

export const CAPYBARA_Y = 660;
/** 판정 박스 반폭·반높이. 그림(72px)보다 훨씬 작게 잡아 억울한 충돌이 없게 한다 */
export const CAPYBARA_HALF_WIDTH = 15;
export const CAPYBARA_HALF_HEIGHT = 18;
/** 좌우 최대 이동 속도(px/s). 드래그도 이 속도를 넘지 못한다 (웨이브 사이 도달 가능성 계산 기준) */
export const MOVE_SPEED = 620;

export const LOG_THICKNESS = 34;
/** 가로 통나무 벽의 틈. 카피바라 폭의 3배 이상 */
export const MIN_GAP = CAPYBARA_HALF_WIDTH * 2 * 3;
/** 이 거리(px) 안으로 스쳐 지나가면 "아슬아슬" */
export const NEAR_MISS_PX = 16;
export const NEAR_MISS_SLOWMO_MS = 150;
export const NEAR_MISS_TIME_SCALE = 0.35;
/** 이 시간에 난이도가 최고가 되고 이후 유지 */
export const PEAK_MS = 60_000;
/** 탭 전환 등으로 프레임 간격이 튀어도 한 번에 이만큼만 진행 */
const MAX_STEP_MS = 50;
const SPLIT_Y = 300;
const SPLIT_WIDTH = 160;

export type LogKind = "roll" | "wall" | "bounce" | "split";

/** 난이도 곡선에서 이 시간이 지나야 등장한다 */
export const LOG_UNLOCK_MS: Record<LogKind, number> = { roll: 0, wall: 8_000, bounce: 18_000, split: 30_000 };

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
  random: () => number;
}

export interface GameInput {
  direction: number;
  /** 드래그 목표 x. 없으면 null */
  targetX: number | null;
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
  return {
    level,
    fallSpeed: 260 + 300 * level,
    waveIntervalMs: 1300 - 600 * level,
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
    random,
  };
}

function between(random: () => number, min: number, max: number) {
  return min + (max - min) * random();
}

type LogSeed = Omit<Log, "id" | "closest">;

/** 한 웨이브에 나올 통나무들. 모두 화면 위에서 같은 줄로 출발하고, 가로로는 반드시 MIN_GAP 이상 빈 곳이 남는다 */
export function createWave(random: () => number, elapsedMs: number): LogSeed[] {
  const { fallSpeed } = getDifficulty(elapsedMs);
  const kinds = (Object.keys(LOG_UNLOCK_MS) as LogKind[]).filter((kind) => elapsedMs >= LOG_UNLOCK_MS[kind]);
  const kind = kinds[Math.floor(random() * kinds.length)];
  const y = -LOG_THICKNESS;

  if (kind === "wall") {
    const gapWidth = between(random, MIN_GAP, MIN_GAP * 1.5);
    const gapLeft = between(random, 0, GAME_WIDTH - gapWidth);
    const gapRight = gapLeft + gapWidth;
    const logs: LogSeed[] = [];
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

/** 한 프레임 진행. realDtMs는 실제 경과 시간 — 슬로모션이면 게임 시간은 느리게 흐른다 */
export function step(state: GameState, realDtMs: number, input: GameInput) {
  if (state.hitBy) return;
  const realDt = Math.min(MAX_STEP_MS, Math.max(0, realDtMs));
  const slowmo = state.slowmoMs > 0;
  state.slowmoMs = Math.max(0, state.slowmoMs - realDt);
  const dt = slowmo ? realDt * NEAR_MISS_TIME_SCALE : realDt;
  state.elapsedMs += dt;

  // 이동: 드래그 목표가 있으면 그쪽으로, 없으면 방향키. 둘 다 MOVE_SPEED 상한
  const maxMove = (MOVE_SPEED * dt) / 1000;
  const wanted = input.targetX !== null ? input.targetX - state.x : input.direction * maxMove;
  const move = Math.max(-maxMove, Math.min(maxMove, wanted));
  const prevX = state.x;
  state.x = Math.max(CAPYBARA_HALF_WIDTH, Math.min(GAME_WIDTH - CAPYBARA_HALF_WIDTH, state.x + move));
  const moved = state.x - prevX;
  state.lean = Math.abs(moved) < 0.01 ? 0 : moved < 0 ? -1 : 1;

  state.waveInMs -= dt;
  if (state.waveInMs <= 0) {
    addLogs(state, createWave(state.random, state.elapsedMs));
    state.waveInMs += getDifficulty(state.elapsedMs).waveIntervalMs;
  }

  const seconds = dt / 1000;
  const capTop = CAPYBARA_Y - CAPYBARA_HALF_HEIGHT;
  const capBottom = CAPYBARA_Y + CAPYBARA_HALF_HEIGHT;
  const kept: Log[] = [];
  const pieces: LogSeed[] = [];

  for (const log of state.logs) {
    log.x += log.vx * seconds;
    log.y += log.vy * seconds;
    if (log.vx !== 0 && (log.x - log.w / 2 < 0 || log.x + log.w / 2 > GAME_WIDTH)) {
      log.vx = -log.vx;
      log.x = Math.max(log.w / 2, Math.min(GAME_WIDTH - log.w / 2, log.x));
    }

    if (log.kind === "split" && log.w >= SPLIT_WIDTH && log.y >= SPLIT_Y) {
      // 큰 통나무가 반으로 쪼개져 양옆 대각선으로 튕겨 나간다 (조각은 SPLIT_WIDTH보다 작아 다시 쪼개지지 않는다)
      const w = log.w / 2;
      pieces.push(
        { kind: "split", x: Math.max(w / 2, log.x - w / 2), y: log.y, w, h: LOG_THICKNESS, vx: -log.vy * 0.5, vy: log.vy },
        { kind: "split", x: Math.min(GAME_WIDTH - w / 2, log.x + w / 2), y: log.y, w, h: LOG_THICKNESS, vx: log.vy * 0.5, vy: log.vy },
      );
      continue;
    }

    const logTop = log.y - log.h / 2;
    const logBottom = log.y + log.h / 2;
    const horizontalGap = Math.abs(log.x - state.x) - log.w / 2 - CAPYBARA_HALF_WIDTH;

    if (logBottom >= capTop && logTop <= capBottom) {
      if (horizontalGap < 0) {
        state.hitBy = log.kind;
        return;
      }
      log.closest = Math.min(log.closest, horizontalGap);
    }

    if (logTop > capBottom && log.closest !== Infinity) {
      if (log.closest <= NEAR_MISS_PX) {
        state.nearMisses += 1;
        state.lastNearMissAt = state.elapsedMs;
        state.slowmoMs = NEAR_MISS_SLOWMO_MS;
      }
      log.closest = Infinity;
    }

    if (logTop < GAME_HEIGHT) kept.push(log);
  }

  state.logs = kept;
  addLogs(state, pieces);
}

const DEATH_LINES: Record<LogKind, string> = {
  roll: "굴러온 통나무에 정면으로 박았어요",
  wall: "통나무 벽의 틈을 못 찾았어요",
  bounce: "튕겨 온 통나무에 옆구리를 맞았어요",
  split: "쪼개진 통나무 조각에 맞았어요",
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
