import { describe, expect, it } from "vitest";

import {
  BOSS_CLEAR_SCORE,
  BOSS_PATTERNS,
  CHARGE_WINDUP_MS,
  createState,
  DROP_CHANCES,
  type Enemy,
  EXPLOSION_MS,
  FIRE_INTERVAL_MS,
  type GameState,
  getBossHomeY,
  getBossPattern,
  getDifficulty,
  getPlaneY,
  getStageConfig,
  INVINCIBLE_MS,
  MAX_HP,
  PEAK_STAGE,
  pickDrop,
  PLANE_HALF_WIDTH,
  STAGE_BANNER_MS,
  step,
} from "./logic";

const IDLE = { direction: 0, targetX: null } as const;
/** 아이템 드롭이 안 나오고 적이 항상 직선형으로 나오게 한다 */
const noLuck = () => 0.99;

function playing(overrides: Partial<GameState> = {}): GameState {
  // 배너와 스폰은 끄고 필요한 것만 올려놓는다
  return { ...createState(400, 800), bannerMs: 0, spawnInMs: 1e9, fireInMs: 1e9, ...overrides };
}

function enemy(overrides: Partial<Enemy> = {}): Enemy {
  return { id: 99, kind: "straight", x: 200, y: 300, r: 15, vx: 0, vy: 0, hp: 1, fireInMs: 1e9, flashMs: 0, ...overrides };
}

describe("이동", () => {
  it("드래그 목표 x로 옮기되 화면 밖으로는 못 나간다", () => {
    const state = playing();
    step(state, 16, { direction: 0, targetX: -50 });
    expect(state.planeX).toBe(PLANE_HALF_WIDTH);
    expect(state.bank).toBe(-1);
    step(state, 16, { direction: 0, targetX: 120 });
    expect(state.planeX).toBe(120);
    expect(state.bank).toBe(1);
    step(state, 16, { direction: 0, targetX: 120 });
    expect(state.bank).toBe(0);
  });

  it("음수 프레임 간격(rAF 첫 프레임)이 들어와도 시간이 거꾸로 가지 않는다", () => {
    const state = createState(400, 800);
    step(state, -30, IDLE);
    expect(state.bannerMs).toBe(STAGE_BANNER_MS);
    expect(state.fireInMs).toBeLessThanOrEqual(FIRE_INTERVAL_MS.basic);
  });
});

describe("자동 사격", () => {
  it("무기마다 한 번에 나가는 총알 수가 다르다", () => {
    for (const [weapon, count] of [["basic", 1], ["double", 2], ["spread", 3]] as const) {
      const state = playing({ weapon, fireInMs: 0 });
      step(state, 16, IDLE);
      expect(state.bullets).toHaveLength(count);
    }
  });

  it("연사 간격마다 계속 쏜다", () => {
    const state = playing({ fireInMs: 0 });
    for (let t = 0; t <= FIRE_INTERVAL_MS.basic * 3; t += 16) step(state, 16, IDLE);
    expect(state.bullets.length).toBeGreaterThanOrEqual(3);
  });
});

describe("총알 → 적", () => {
  it("일반 적은 체력이 0이 되면 사라지고 점수가 오른다", () => {
    const state = playing({
      enemies: [enemy()],
      bullets: [{ x: 200, y: 300, r: 3, vx: 0, vy: 0, weapon: "basic", hitIds: [] }],
    });
    step(state, 16, IDLE, noLuck);
    expect(state.enemies).toHaveLength(0);
    expect(state.stageKills).toBe(1);
    expect(state.explosions).toHaveLength(1);

    // 폭발은 애니메이션이 끝나면 지워진다
    for (let t = 0; t < EXPLOSION_MS + 50; t += 16) step(state, 16, IDLE, noLuck);
    expect(state.explosions).toHaveLength(0);
    expect(state.score).toBeGreaterThan(0);
  });

  it("보스는 맞아도 죽지 않는다", () => {
    const boss = enemy({ kind: "boss", r: 44, y: 200 });
    const state = playing({
      stage: 5,
      enemies: [boss],
      bullets: [{ x: 200, y: 200, r: 3, vx: 0, vy: 0, weapon: "basic", hitIds: [] }],
    });
    step(state, 16, IDLE, noLuck);
    expect(state.enemies).toContain(boss);
    expect(state.bullets).toHaveLength(0);
  });
});

describe("피격", () => {
  it("적 총알에 맞으면 체력이 1 줄고, 무적 시간 동안은 더 안 준다", () => {
    const planeY = getPlaneY(playing());
    const shot = () => ({ x: 200, y: planeY, r: 5, vx: 0, vy: 0, fromBoss: false });
    const state = playing({ shots: [shot()] });
    step(state, 16, IDLE);
    expect(state.hp).toBe(MAX_HP - 1);
    expect(state.invincibleMs).toBeGreaterThan(INVINCIBLE_MS - 20);

    state.shots.push(shot());
    step(state, 16, IDLE);
    expect(state.hp).toBe(MAX_HP - 1);
  });
});

describe("아이템", () => {
  it("무기 아이템은 총을 바꾸고, 회복은 최대 체력을 넘지 않는다", () => {
    const planeY = getPlaneY(playing());
    const state = playing({
      hp: MAX_HP,
      items: [
        { kind: "spread", x: 200, y: planeY, r: 13, vx: 0, vy: 0 },
        { kind: "heal", x: 200, y: planeY, r: 13, vx: 0, vy: 0 },
      ],
    });
    step(state, 16, IDLE);
    expect(state.weapon).toBe("spread");
    expect(state.hp).toBe(MAX_HP);
    expect(state.items).toHaveLength(0);
  });

  it("아이템은 종류별 확률이 따로 있고, 좋은 무기일수록 드물게 떨어진다", () => {
    const { double, spread, rapid, pierce } = DROP_CHANCES;
    expect(double).toBeGreaterThan(spread);
    expect(spread).toBeGreaterThan(rapid);
    expect(rapid).toBeGreaterThan(pierce);
    const total = Object.values(DROP_CHANCES).reduce((sum, chance) => sum + chance, 0);
    expect(total).toBeLessThan(0.03);

    // 한 번 굴린 값이 어느 구간에 들어가느냐로 아이템이 정해지고, 합계를 넘으면 아무것도 없다
    expect(pickDrop(() => 0)).toBe("double");
    expect(pickDrop(() => total - pierce / 2)).toBe("pierce");
    expect(pickDrop(() => total + 0.001)).toBeNull();
    expect(pickDrop(() => 0.99)).toBeNull();
  });
});

describe("스테이지", () => {
  it("5스테이지마다 보스가 나온다", () => {
    expect(getStageConfig(4).boss).toBe(false);
    expect(getStageConfig(5).boss).toBe(true);
    expect(getStageConfig(10).boss).toBe(true);
  });

  it("초반은 쉽고 갈수록 어려워지며, 최고 난이도 뒤로는 그대로 유지된다", () => {
    const first = getStageConfig(1);
    expect(first.enemyHp).toBe(2);
    expect(first.shooterChance).toBe(0);

    for (let stage = 2; stage <= PEAK_STAGE; stage += 1) {
      const prev = getStageConfig(stage - 1);
      const next = getStageConfig(stage);
      expect(next.enemySpeed).toBeGreaterThan(prev.enemySpeed);
      expect(next.shotSpeed).toBeGreaterThan(prev.shotSpeed);
    }
    // 제곱 곡선: 전반부(1→13)보다 후반부(13→25)에 훨씬 많이 오른다
    const mid = Math.ceil(PEAK_STAGE / 2);
    expect(getDifficulty(PEAK_STAGE) - getDifficulty(mid)).toBeGreaterThan(getDifficulty(mid) * 2);
    expect(getStageConfig(PEAK_STAGE * 4).enemySpeed).toBe(getStageConfig(PEAK_STAGE).enemySpeed);
  });

  it("아무리 높은 스테이지도 피할 수 있는 한계(속도·밀도 상한)를 넘지 않는다", () => {
    const late = getStageConfig(200);
    expect(late.shotSpeed).toBeLessThanOrEqual(420);
    expect(late.enemySpeed).toBeLessThanOrEqual(360);
    expect(late.spawnIntervalMs).toBeGreaterThanOrEqual(260);
    expect(late.enemyFireIntervalMs).toBeGreaterThanOrEqual(550);
    expect(late.enemyHp).toBeLessThanOrEqual(10);
    expect(late.bossSurviveMs).toBeLessThanOrEqual(38_000);
  });

  it("목표만큼 격추하면 다음 스테이지로 넘어가고 배너가 뜬다", () => {
    const state = playing({ stageKills: getStageConfig(1).killGoal });
    step(state, 16, IDLE);
    expect(state.stage).toBe(2);
    expect(state.bannerMs).toBe(STAGE_BANNER_MS);
  });

  it("보스 스테이지는 정해진 시간을 버티면 넘어간다", () => {
    const state = playing({ stage: 5, stageTimeMs: getStageConfig(5).bossSurviveMs - 10 });
    step(state, 16, IDLE);
    expect(state.stage).toBe(6);
    expect(state.score).toBeGreaterThanOrEqual(BOSS_CLEAR_SCORE);
  });
});

describe("보스 패턴", () => {
  /** 자리 잡은 보스와, 죽지도 스테이지를 넘기지도 않는 상태 */
  function bossFight(overrides: Partial<GameState> = {}) {
    const state = playing({ stage: 5, hp: 1e6, stageTimeMs: -1e9, ...overrides });
    const boss = enemy({ kind: "boss", r: 44, x: 200, y: getBossHomeY(state), vx: 80, fireInMs: 0 });
    state.enemies = [boss];
    return { state, boss };
  }

  it("보스전 한 번에 다섯 가지 패턴이 돌아가며 나온다", () => {
    const { state } = bossFight();
    const seen = new Set<string>();
    for (let t = 0; t < 30_000; t += 16) {
      step(state, 16, IDLE);
      seen.add(getBossPattern(state));
    }
    expect(seen).toEqual(new Set(BOSS_PATTERNS));
  });

  it("원형 확산은 보스 한가운데서 사방으로 퍼진다", () => {
    const { state, boss } = bossFight({ bossPatternIndex: BOSS_PATTERNS.indexOf("ring") });
    step(state, 16, IDLE);
    expect(state.shots.length).toBeGreaterThanOrEqual(12);
    expect(state.shots.some((shot) => shot.vy < 0)).toBe(true);
    expect(state.shots.some((shot) => shot.vy > 0)).toBe(true);
    for (const shot of state.shots) expect(Math.hypot(shot.x - boss.x, shot.y - boss.y)).toBeLessThan(1);
  });

  it("격자 탄은 화면 위에서 한 줄로 내려오고, 지나갈 빈틈이 있다", () => {
    const { state } = bossFight({ bossPatternIndex: BOSS_PATTERNS.indexOf("grid") });
    step(state, 16, IDLE, () => 0.5);
    expect(state.shots.length).toBeGreaterThan(2);
    expect(new Set(state.shots.map((shot) => shot.y)).size).toBe(1);
    expect(state.shots.every((shot) => shot.vx === 0 && shot.vy > 0)).toBe(true);

    const xs = state.shots.map((shot) => shot.x).sort((a, b) => a - b);
    const gaps = xs.slice(1).map((x, index) => x - xs[index]);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(Math.min(...gaps) * 3 - 0.001);
  });

  it("돌격은 붉은 예고 동안 조준만 하고, 그 자리로 내리꽂았다가 제자리로 돌아온다", () => {
    const { state, boss } = bossFight({ bossPatternIndex: BOSS_PATTERNS.indexOf("charge"), planeX: 300 });
    const homeY = getBossHomeY(state);
    for (let t = 0; t < CHARGE_WINDUP_MS - 32; t += 16) step(state, 16, IDLE);
    expect(boss.y).toBe(homeY);
    expect(state.bossChargeX).toBe(300);

    let deepest = homeY;
    let xAtDeepest = boss.x;
    for (let t = 0; t < 4000; t += 16) {
      step(state, 16, IDLE);
      if (boss.y > deepest) {
        deepest = boss.y;
        xAtDeepest = boss.x;
      }
    }
    expect(deepest).toBeGreaterThan(homeY + 200);
    expect(Math.abs(xAtDeepest - 300)).toBeLessThan(10);
    expect(boss.y).toBe(homeY);
    expect(getBossPattern(state)).not.toBe("charge");
  });
});
