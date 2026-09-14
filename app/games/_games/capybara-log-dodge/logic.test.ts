import { describe, expect, it } from "vitest";

import {
  CAPYBARA_HALF_WIDTH,
  CAPYBARA_Y,
  createRandom,
  createState,
  createWave,
  GAME_WIDTH,
  type GameState,
  getCourseDate,
  getDeathLine,
  getDifficulty,
  type Log,
  LOG_THICKNESS,
  MIN_GAP,
  MOVE_SPEED,
  NEAR_MISS_TIME_SCALE,
  parseChallenge,
  PEAK_MS,
  seedFromText,
  step,
  widestGap,
} from "./logic";

const IDLE = { direction: 0, targetX: null } as const;

function playing(overrides: Partial<GameState> = {}): GameState {
  // 웨이브는 끄고 필요한 통나무만 올려놓는다
  return { ...createState(createRandom(1)), waveInMs: 1e9, ...overrides };
}

function log(overrides: Partial<Log> = {}): Log {
  return { id: 99, kind: "roll", x: 225, y: CAPYBARA_Y, w: 100, h: LOG_THICKNESS, vx: 0, vy: 0, closest: Infinity, ...overrides };
}

describe("공정성", () => {
  it("어떤 seed·시간이든 웨이브에는 MIN_GAP 이상 틈이 있다", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const random = createRandom(seed);
      for (let t = 0; t <= PEAK_MS * 1.5; t += 2_500) {
        expect(widestGap(createWave(random, t))).toBeGreaterThanOrEqual(MIN_GAP - 0.001);
      }
    }
  });

  it("최고 난이도에서도 웨이브 사이에 화면 끝에서 끝까지 갈 수 있다", () => {
    const { waveIntervalMs } = getDifficulty(PEAK_MS);
    expect((MOVE_SPEED * waveIntervalMs) / 1000).toBeGreaterThanOrEqual(GAME_WIDTH - MIN_GAP);
  });

  it("같은 seed면 같은 코스가 나온다 (오늘의 통나무)", () => {
    const a = createWave(createRandom(seedFromText("2026-09-14")), 20_000);
    const b = createWave(createRandom(seedFromText("2026-09-14")), 20_000);
    expect(a).toEqual(b);
  });

  it("아직 해금 안 된 통나무는 나오지 않는다", () => {
    const random = createRandom(7);
    for (let i = 0; i < 100; i += 1) {
      for (const seed of createWave(random, 0)) expect(seed.kind).toBe("roll");
    }
  });
});

describe("이동", () => {
  it("드래그 목표로 가되 속도 상한과 화면 끝을 지킨다", () => {
    const state = playing();
    step(state, 16, { direction: 0, targetX: -500 });
    expect(state.x).toBeCloseTo(GAME_WIDTH / 2 - (MOVE_SPEED * 16) / 1000);
    expect(state.lean).toBe(-1);
    for (let i = 0; i < 100; i += 1) step(state, 16, { direction: 0, targetX: -500 });
    expect(state.x).toBe(CAPYBARA_HALF_WIDTH);
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

  it("5초 안에 죽으면 납작 문구가 붙는다", () => {
    expect(getDeathLine("roll", 3_200)).toBe("3.2초 만에 납작! 굴러온 통나무에 정면으로 박았어요");
    expect(getDeathLine("wall", 12_000)).toBe("통나무 벽의 틈을 못 찾았어요");
  });

  it("오늘의 코스 날짜는 한국 시간 기준이다", () => {
    // UTC 9월 13일 16시 = 한국 9월 14일 새벽 1시
    expect(getCourseDate(Date.UTC(2026, 8, 13, 16))).toBe("2026-09-14");
  });
});
