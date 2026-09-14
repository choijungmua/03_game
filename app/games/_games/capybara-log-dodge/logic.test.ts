import { describe, expect, it } from "vitest";

import {
  CAPYBARA_HALF_HEIGHT,
  CAPYBARA_HALF_WIDTH,
  CAPYBARA_Y,
  createRandom,
  createState,
  createWave,
  FULL_WIDTH_SPEED_RATIO,
  GAME_WIDTH,
  type GameState,
  getCourseDate,
  getCue,
  getDeathLine,
  getDifficulty,
  JUMP_MS,
  type Log,
  LOG_HEIGHTS,
  LOG_THICKNESS,
  type LogKind,
  MIN_GAP,
  MOVE_SPEED,
  NEAR_MISS_TIME_SCALE,
  parseChallenge,
  PEAK_MS,
  seedFromText,
  step,
  widestGap,
} from "./logic";

const IDLE = { direction: 0, targetX: null, jump: false, duck: false } as const;

function playing(overrides: Partial<GameState> = {}): GameState {
  // 웨이브는 끄고 필요한 통나무만 올려놓는다
  return { ...createState(createRandom(1)), waveInMs: 1e9, ...overrides };
}

function log(overrides: Partial<Log> = {}): Log {
  return { id: 99, kind: "roll", x: 225, y: CAPYBARA_Y, w: 100, h: LOG_THICKNESS, vx: 0, vy: 0, closest: Infinity, ...overrides };
}

/** 카피바라 바로 위에서 화면 폭 전체로 내려오는 통나무 */
function incoming(kind: LogKind): Log {
  return log({ kind, x: GAME_WIDTH / 2, w: GAME_WIDTH, y: CAPYBARA_Y - 60, vy: 400 });
}

/** 통나무가 카피바라를 완전히 지나갈 때까지(0.5초) 진행 */
function runPast(state: GameState, input: { jump?: boolean; duck?: boolean }) {
  step(state, 16, { ...IDLE, ...input });
  for (let i = 0; i < 30; i += 1) step(state, 16, { ...IDLE, duck: input.duck ?? false });
}

describe("공정성", () => {
  it("좌우로만 피하는 통나무 사이에는 어떤 seed·시간이든 MIN_GAP 이상 틈이 있다", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const random = createRandom(seed);
      for (let t = 0; t <= PEAK_MS * 1.5; t += 2_500) {
        const full = createWave(random, t).filter((seedLog) => LOG_HEIGHTS[seedLog.kind] === "full");
        expect(widestGap(full)).toBeGreaterThanOrEqual(MIN_GAP - 0.001);
      }
    }
  });

  it("최고 난이도에서도 웨이브 사이에 화면 끝에서 끝까지 갈 수 있다", () => {
    const { waveIntervalMs } = getDifficulty(PEAK_MS);
    expect((MOVE_SPEED * waveIntervalMs) / 1000).toBeGreaterThanOrEqual(GAME_WIDTH - MIN_GAP);
  });

  it("가장 느린 허들도 체공 시간 안에 카피바라를 지나가 점프 타이밍 여유가 있다", () => {
    const speed = getDifficulty(0).fallSpeed * FULL_WIDTH_SPEED_RATIO;
    const passMs = ((LOG_THICKNESS + CAPYBARA_HALF_HEIGHT * 2) / speed) * 1000;
    expect(passMs).toBeLessThan(JUMP_MS * 0.7);
  });

  it("같은 seed면 같은 코스가 나온다 (오늘의 통나무)", () => {
    const a = createWave(createRandom(seedFromText("2026-09-14")), 20_000);
    const b = createWave(createRandom(seedFromText("2026-09-14")), 20_000);
    expect(a).toEqual(b);
  });

  it("아직 해금 안 된 통나무는 나오지 않는다", () => {
    const random = createRandom(7);
    for (let i = 0; i < 100; i += 1) {
      for (const seedLog of createWave(random, 0)) expect(seedLog.kind).toBe("roll");
      for (const seedLog of createWave(random, 5_000)) expect(seedLog.kind).not.toBe("beam");
    }
  });
});

describe("이동", () => {
  it("드래그 목표로 가되 속도 상한과 화면 끝을 지킨다", () => {
    const state = playing();
    step(state, 16, { ...IDLE, targetX: -500 });
    expect(state.x).toBeCloseTo(GAME_WIDTH / 2 - (MOVE_SPEED * 16) / 1000);
    expect(state.lean).toBe(-1);
    for (let i = 0; i < 100; i += 1) step(state, 16, { ...IDLE, targetX: -500 });
    expect(state.x).toBe(CAPYBARA_HALF_WIDTH);
  });
});

describe("점프·숙이기", () => {
  it("점프하면 허들을 넘고, 안 하면 걸린다", () => {
    const jumped = playing({ logs: [incoming("hurdle")] });
    runPast(jumped, { jump: true });
    expect(jumped.hitBy).toBeNull();

    const stayed = playing({ logs: [incoming("hurdle")] });
    runPast(stayed, {});
    expect(stayed.hitBy).toBe("hurdle");
  });

  it("숙이면 가로대를 지나가고, 점프로는 못 지나간다", () => {
    const ducked = playing({ logs: [incoming("beam")] });
    runPast(ducked, { duck: true });
    expect(ducked.hitBy).toBeNull();

    const jumped = playing({ logs: [incoming("beam")] });
    runPast(jumped, { jump: true });
    expect(jumped.hitBy).toBe("beam");
  });

  it("숙여서는 허들을, 점프로는 벽을 못 넘는다", () => {
    const ducked = playing({ logs: [incoming("hurdle")] });
    runPast(ducked, { duck: true });
    expect(ducked.hitBy).toBe("hurdle");

    const jumped = playing({ logs: [incoming("wall")] });
    runPast(jumped, { jump: true });
    expect(jumped.hitBy).toBe("wall");
  });

  it("체공 중에 다시 눌러도 점프가 늘어나지 않고, 숙이기는 착지 뒤에 이어진다", () => {
    const state = playing();
    step(state, 16, { ...IDLE, jump: true });
    step(state, 200, { ...IDLE, jump: true });
    expect(state.jumpMs).toBe(JUMP_MS - 50);
    expect(state.duckMs).toBe(0);
    for (let i = 0; i < 40; i += 1) step(state, 16, { ...IDLE, duck: true });
    expect(state.jumpMs).toBe(0);
    expect(state.duckMs).toBeGreaterThan(0);
  });

  it("허들·가로대가 가까워지면 알맞은 동작을 안내한다", () => {
    expect(getCue(playing({ logs: [log({ kind: "hurdle", w: GAME_WIDTH, y: CAPYBARA_Y - 150 })] }))).toBe("jump");
    expect(getCue(playing({ logs: [log({ kind: "beam", w: GAME_WIDTH, y: CAPYBARA_Y - 150 })] }))).toBe("duck");
    expect(getCue(playing({ logs: [log({ kind: "beam", w: GAME_WIDTH, y: 0 })] }))).toBeNull();
    expect(getCue(playing({ logs: [log({ kind: "roll", y: CAPYBARA_Y - 150 })] }))).toBeNull();
  });
});

describe("충돌·아슬아슬", () => {
  it("겹치면 맞은 통나무 종류로 끝나고 더 진행하지 않는다", () => {
    const state = playing({ logs: [log({ kind: "wall" })] });
    step(state, 16, IDLE);
    expect(state.hitBy).toBe("wall");
    const elapsed = state.elapsedMs;
    step(state, 16, IDLE);
    expect(state.elapsedMs).toBe(elapsed);
  });

  it("스치듯 지나가면 아슬아슬이 오르고 슬로모션이 걸린다", () => {
    // 카피바라 오른쪽 5px 옆으로 떨어지는 통나무
    const x = GAME_WIDTH / 2 + CAPYBARA_HALF_WIDTH + 5 + 50;
    const state = playing({ logs: [log({ x, y: CAPYBARA_Y - 60, vy: 600 })] });
    for (let i = 0; i < 40 && state.nearMisses === 0; i += 1) step(state, 16, IDLE);
    expect(state.hitBy).toBeNull();
    expect(state.nearMisses).toBe(1);
    const before = state.elapsedMs;
    step(state, 16, IDLE);
    expect(state.elapsedMs - before).toBeCloseTo(16 * NEAR_MISS_TIME_SCALE);
  });

  it("멀리 지나간 통나무는 아슬아슬이 아니다", () => {
    const state = playing({ logs: [log({ x: 20, w: 30, y: CAPYBARA_Y - 60, vy: 600 })] });
    for (let i = 0; i < 40; i += 1) step(state, 16, IDLE);
    expect(state.nearMisses).toBe(0);
  });

  it("큰 통나무는 한 번만 두 조각으로 쪼개진다", () => {
    const state = playing({ logs: [log({ kind: "split", x: 60, w: 160, y: 290, vy: 400 })] });
    for (let i = 0; i < 10; i += 1) step(state, 16, IDLE);
    expect(state.logs).toHaveLength(2);
    expect(state.logs.every((piece) => piece.w === 80)).toBe(true);
  });
});

describe("표시 문구", () => {
  it("공유 링크 ?vs=는 범위 안의 숫자만 받는다", () => {
    expect(parseChallenge("?vs=47.34")).toBe(47.3);
    expect(parseChallenge("?vs=abc")).toBeNull();
    expect(parseChallenge("?vs=-1")).toBeNull();
    expect(parseChallenge("?vs=5000")).toBeNull();
    expect(parseChallenge("")).toBeNull();
  });

  it("5초 안에 죽으면 납작 문구가 붙고, 허들·가로대는 피하는 법을 알려준다", () => {
    expect(getDeathLine("roll", 3_200)).toBe("3.2초 만에 납작! 굴러온 통나무에 정면으로 박았어요");
    expect(getDeathLine("wall", 12_000)).toBe("통나무 벽의 틈을 못 찾았어요");
    expect(getDeathLine("hurdle", 9_000)).toContain("점프");
    expect(getDeathLine("beam", 15_000)).toContain("숙여서");
  });

  it("오늘의 코스 날짜는 한국 시간 기준이다", () => {
    // UTC 9월 13일 16시 = 한국 9월 14일 새벽 1시
    expect(getCourseDate(Date.UTC(2026, 8, 13, 16))).toBe("2026-09-14");
  });
});
