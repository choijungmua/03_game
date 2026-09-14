import { describe, expect, it } from "vitest";

import {
  BOMB_BOSS_RATIO,
  BOSS_CLEAR_SCORE,
  BOSS_PATTERN_MS,
  BOSS_PATTERNS,
  BOSS_REWARD_LEVELS,
  CHARGE_WINDUP_MS,
  createState,
  DASHER_SPEED,
  DASHER_STOP_RATIO,
  DASHER_WINDUP_MS,
  DROP_CHANCES,
  type Enemy,
  EXPLOSION_MS,
  FIRE_INTERVAL_MS,
  type GameState,
  getBossHomeY,
  getBossPattern,
  getBossPhase,
  getDifficulty,
  getPlaneY,
  getStageConfig,
  getWeaponSpec,
  INVINCIBLE_MS,
  isShieldUp,
  LOW_LEVEL_FIRE_SLOWDOWN,
  MAX_BULLETS,
  MAX_SHOTS,
  MAX_HP,
  MAX_WEAPON_LEVEL,
  MIN_ENEMY_FIRE_INTERVAL_MS,
  MIN_SPAWN_INTERVAL_MS,
  PEAK_STAGE,
  pickDrop,
  PITY_KILLS,
  PLANE_HALF_WIDTH,
  SKILL_GAUGE_MAX,
  SKILL_PER_KILL,
  SKILLS,
  spawnEnemy,
  STAGE_BANNER_MS,
  step,
  WEAPON_DROPS,
  type WeaponKind,
} from "./logic";

const IDLE = { direction: 0, targetX: null } as const;
/** 아이템 드롭이 안 나오고 적이 항상 직선형으로 나오게 한다 */
const noLuck = () => 0.99;

function playing(overrides: Partial<GameState> = {}): GameState {
  // 배너와 스폰은 끄고 필요한 것만 올려놓는다
  return { ...createState(400, 800), bannerMs: 0, spawnInMs: 1e9, fireInMs: 1e9, ...overrides };
}

function enemy(overrides: Partial<Enemy> = {}): Enemy {
  return { id: 99, kind: "straight", x: 200, y: 300, r: 15, vx: 0, vy: 0, hp: 1, maxHp: 1, fireInMs: 1e9, flashMs: 0, timerMs: 0, split: false, ...overrides };
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
    expect(state.fireInMs).toBeLessThanOrEqual(getWeaponSpec("basic", 1).intervalMs);
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
    for (let t = 0; t <= getWeaponSpec("basic", 1).intervalMs * 3; t += 16) step(state, 16, IDLE);
    expect(state.bullets.length).toBeGreaterThanOrEqual(3);
  });
});

describe("총알 → 적", () => {
  it("일반 적은 체력이 0이 되면 사라지고 점수가 오른다", () => {
    const state = playing({
      enemies: [enemy()],
      bullets: [{ x: 200, y: 300, r: 3, vx: 0, vy: 0, weapon: "basic", damage: 1, hitIds: [] }],
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

  it("보스는 맞은 피해만큼 체력이 깎이고, 0이 되면 격파되어 다음 스테이지로 넘어가며 무기 레벨이 오른다", () => {
    const boss = enemy({ kind: "boss", r: 44, y: 200, hp: 5, maxHp: 100 });
    const bullet = (damage: number) => ({ x: 200, y: 200, r: 3, vx: 0, vy: 0, weapon: "pierce" as const, damage, hitIds: [] });
    const state = playing({ stage: 5, weaponLevel: 3, enemies: [boss], bullets: [bullet(2)] });
    step(state, 16, IDLE, noLuck);
    expect(boss.hp).toBe(3);
    // 관통탄도 보스는 뚫지 못한다
    expect(state.bullets).toHaveLength(0);
    expect(state.stage).toBe(5);

    state.bullets.push(bullet(3));
    step(state, 16, IDLE, noLuck);
    expect(state.stage).toBe(6);
    expect(state.score).toBeGreaterThanOrEqual(BOSS_CLEAR_SCORE);
    expect(state.weaponLevel).toBe(3 + BOSS_REWARD_LEVELS);
    expect(state.explosions.length).toBeGreaterThanOrEqual(5);
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
  it("무기 아이템은 총을 바꾸고 레벨을 올리며, 회복은 최대 체력을 넘지 않는다", () => {
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
    expect(state.weaponLevel).toBe(2);
    expect(state.hp).toBe(MAX_HP);
    expect(state.items).toHaveLength(0);
  });

  it("아이템은 종류별 확률이 따로 있고, 좋은 무기일수록 드물게 떨어진다", () => {
    const { double, spread, rapid, pierce } = DROP_CHANCES;
    expect(double).toBeGreaterThan(spread);
    expect(spread).toBeGreaterThan(rapid);
    expect(rapid).toBeGreaterThan(pierce);
    // 천천히 강해지도록 드물게(5% 안팎) 떨어진다
    const total = Object.values(DROP_CHANCES).reduce((sum, chance) => sum + chance, 0);
    expect(total).toBeGreaterThan(0.04);
    expect(total).toBeLessThan(0.08);

    // 한 번 굴린 값이 어느 구간에 들어가느냐로 아이템이 정해지고, 합계를 넘으면 아무것도 없다
    expect(pickDrop(() => 0)).toBe("double");
    expect(pickDrop(() => total - pierce / 2)).toBe("pierce");
    expect(pickDrop(() => total + 0.001)).toBeNull();
    expect(pickDrop(() => 0.99)).toBeNull();
  });
});

describe("무기 레벨", () => {
  const WEAPONS: readonly WeaponKind[] = ["basic", "double", "spread", "rapid", "pierce"];

  function weaponItem(kind: (typeof WEAPON_DROPS)[number]) {
    return { kind, x: 200, y: getPlaneY(playing()), r: 13, vx: 0, vy: 0 };
  }

  it("어떤 무기 간식이든 레벨이 1씩 쌓이고, 최대 레벨을 넘지 않는다", () => {
    const state = playing({ weaponLevel: MAX_WEAPON_LEVEL - 1, items: [weaponItem("double"), weaponItem("rapid")] });
    step(state, 16, IDLE);
    expect(state.weaponLevel).toBe(MAX_WEAPON_LEVEL);
    expect(state.weapon).toBe("rapid");
  });

  it("맞으면 레벨이 1 내려가고, 1 아래로는 내려가지 않는다", () => {
    const planeY = getPlaneY(playing());
    const shot = { x: 200, y: planeY, r: 5, vx: 0, vy: 0, fromBoss: false };
    const state = playing({ weaponLevel: 5, shots: [{ ...shot }] });
    step(state, 16, IDLE);
    expect(state.weaponLevel).toBe(4);

    const weakest = playing({ weaponLevel: 1, shots: [{ ...shot }] });
    step(weakest, 16, IDLE);
    expect(weakest.weaponLevel).toBe(1);
  });

  it("레벨이 오를수록 탄 수·피해는 줄지 않고 발사 간격은 늘지 않으며, 10레벨은 1레벨보다 확실히 세다", () => {
    for (const weapon of WEAPONS) {
      for (let level = 2; level <= MAX_WEAPON_LEVEL; level += 1) {
        const prev = getWeaponSpec(weapon, level - 1);
        const next = getWeaponSpec(weapon, level);
        expect(next.pattern.length).toBeGreaterThanOrEqual(prev.pattern.length);
        expect(next.damage).toBeGreaterThanOrEqual(prev.damage);
        expect(next.intervalMs).toBeLessThanOrEqual(prev.intervalMs);
      }
      const first = getWeaponSpec(weapon, 1);
      const max = getWeaponSpec(weapon, MAX_WEAPON_LEVEL);
      // 초당 피해량(탄 수 × 피해 ÷ 간격)이 1레벨의 2.5배 넘게 오른다
      const dps = (spec: typeof first) => (spec.pattern.length * spec.damage) / spec.intervalMs;
      expect(dps(max)).toBeGreaterThan(dps(first) * 2.5);
    }
    expect(getWeaponSpec("spread", MAX_WEAPON_LEVEL).pattern).toHaveLength(11);
    expect(getWeaponSpec("basic", MAX_WEAPON_LEVEL).pattern).toHaveLength(5);
  });

  it("시작 총(1레벨)은 살살 쏘고, 10레벨은 원래 연사 속도 그대로다", () => {
    expect(getWeaponSpec("basic", 1).intervalMs).toBeCloseTo(FIRE_INTERVAL_MS.basic * LOW_LEVEL_FIRE_SLOWDOWN);
    expect(getWeaponSpec("basic", 1).intervalMs).toBeGreaterThanOrEqual(300);
    expect(getWeaponSpec("basic", MAX_WEAPON_LEVEL).intervalMs).toBeCloseTo(FIRE_INTERVAL_MS.basic * (1 - 0.03 * (MAX_WEAPON_LEVEL - 1)));
  });

  it("레벨 피해만큼 적 체력을 깎는다", () => {
    const state = playing({
      enemies: [enemy({ hp: 5 })],
      bullets: [{ x: 200, y: 300, r: 3, vx: 0, vy: 0, weapon: "basic", damage: 3, hitIds: [] }],
    });
    step(state, 16, IDLE, noLuck);
    expect(state.enemies[0].hp).toBe(2);
  });

  it("아이템 없이 PITY_KILLS번 격추하면 무기 간식을 반드시 떨어뜨린다", () => {
    const state = playing({ killsSinceDrop: PITY_KILLS - 2, enemies: [enemy({ id: 1 }), enemy({ id: 2, x: 100 })] });
    state.bullets = [
      { x: 200, y: 300, r: 3, vx: 0, vy: 0, weapon: "basic", damage: 1, hitIds: [] },
      { x: 100, y: 300, r: 3, vx: 0, vy: 0, weapon: "basic", damage: 1, hitIds: [] },
    ];
    step(state, 16, IDLE, noLuck);
    expect(state.items).toHaveLength(1);
    expect(WEAPON_DROPS).toContain(state.items[0].kind);
    expect(state.killsSinceDrop).toBe(0);
  });

  it("화면에 내 탄이 너무 많으면 더 쏘지 않는다", () => {
    const bullet = { x: 200, y: 400, r: 3, vx: 0, vy: 0, weapon: "basic" as const, damage: 1, hitIds: [] };
    const state = playing({ fireInMs: 0, bullets: Array.from({ length: MAX_BULLETS }, () => ({ ...bullet, hitIds: [] })) });
    step(state, 16, IDLE);
    expect(state.bullets).toHaveLength(MAX_BULLETS);
  });
});

describe("새 천적", () => {
  function bullet(weapon: WeaponKind, x = 200, y = 300) {
    return { x, y, r: 3, vx: 0, vy: 0, weapon, damage: 1, hitIds: [] };
  }

  it("스테이지가 오를 때마다 새 천적이 합류하고, 종류 확률 합은 0.9를 넘지 않는다", () => {
    expect(getStageConfig(3).dasherChance).toBe(0);
    expect(getStageConfig(4).dasherChance).toBeGreaterThan(0);
    expect(getStageConfig(5).shieldChance).toBe(0);
    expect(getStageConfig(6).shieldChance).toBeGreaterThan(0);
    expect(getStageConfig(6).splitterChance).toBe(0);
    expect(getStageConfig(7).splitterChance).toBeGreaterThan(0);
    expect(getStageConfig(7).homingChance).toBe(0);
    expect(getStageConfig(8).homingChance).toBeGreaterThan(0);
    for (const stage of [1, 8, PEAK_STAGE, 200]) {
      const c = getStageConfig(stage);
      const total = c.zigzagChance + c.shooterChance + c.dasherChance + c.shieldChance + c.splitterChance + c.homingChance;
      expect(total).toBeLessThanOrEqual(0.9);
    }

    // 굴린 값이 칼새 구간에 들어가면 칼새가 나온다
    const c = getStageConfig(8);
    const dasher = spawnEnemy(playing({ stage: 8 }), () => c.shooterChance + c.zigzagChance + c.dasherChance / 2);
    expect(dasher.kind).toBe("dasher");
    expect(dasher.timerMs).toBe(DASHER_WINDUP_MS);
  });

  it("방패를 든 아르마딜로는 일반 총알을 막고, 쏘느라 방패를 내렸을 때나 관통탄에는 맞는다", () => {
    const shield = enemy({ kind: "shield", r: 18, hp: 5, maxHp: 5 });
    const state = playing({ enemies: [shield], bullets: [bullet("basic")] });
    step(state, 16, IDLE, noLuck);
    expect(shield.hp).toBe(5);
    expect(state.bullets).toHaveLength(0);
    expect(state.shieldBlocks).toBe(1);

    state.bullets.push(bullet("pierce"));
    step(state, 16, IDLE, noLuck);
    expect(shield.hp).toBe(4);

    // 다음 프레임에 쏘면서 방패를 내린다
    shield.fireInMs = 0;
    step(state, 16, IDLE, noLuck);
    expect(isShieldUp(shield)).toBe(false);
    state.bullets.push(bullet("basic"));
    step(state, 16, IDLE, noLuck);
    expect(shield.hp).toBe(3);
  });

  it("칼새는 정해진 높이에 멈춰 경고한 뒤 아주 빠르게 내리꽂는다", () => {
    const state = playing();
    const dasher = enemy({ kind: "dasher", r: 13, y: state.height * DASHER_STOP_RATIO + 1, vy: 300, timerMs: DASHER_WINDUP_MS });
    state.enemies = [dasher];
    step(state, 16, IDLE);
    expect(dasher.vy).toBe(0);

    for (let t = 0; t < DASHER_WINDUP_MS - 32; t += 16) step(state, 16, IDLE);
    expect(dasher.vy).toBe(0);

    for (let t = 0; t < 64; t += 16) step(state, 16, IDLE);
    expect(dasher.vy).toBe(DASHER_SPEED);
  });

  it("독화살개구리는 격추되면 작은 개구리 둘로 갈라지고, 작은 개구리는 더 갈라지지 않는다", () => {
    const frog = enemy({ kind: "splitter", r: 17, split: true, hp: 1, maxHp: 4 });
    const state = playing({ enemies: [frog], bullets: [bullet("basic")] });
    step(state, 16, IDLE, noLuck);
    expect(state.enemies).toHaveLength(2);
    expect(state.enemies.every((child) => child.kind === "splitter" && !child.split && child.r < frog.r)).toBe(true);
    expect(state.splits).toBe(1);

    for (const child of state.enemies) {
      child.hp = 1;
      state.bullets.push(bullet("basic", child.x, child.y));
    }
    step(state, 16, IDLE, noLuck);
    expect(state.enemies).toHaveLength(0);
    expect(state.splits).toBe(1);
  });

  it("흡혈박쥐는 비행기 쪽으로 방향을 틀어 따라온다", () => {
    const state = playing({ planeX: 350 });
    const bat = enemy({ kind: "homing", r: 12, x: 100, y: 200, vy: 100 });
    state.enemies = [bat];
    for (let t = 0; t < 500; t += 16) step(state, 16, IDLE);
    expect(bat.vx).toBeGreaterThan(0);
    expect(bat.x).toBeGreaterThan(100);
  });
});

describe("스킬", () => {
  const basicBullet = () => ({ x: 200, y: 300, r: 3, vx: 0, vy: 0, weapon: "basic" as const, damage: 1, hitIds: [] });

  it("격추할 때마다 스킬 게이지가 차고, 최대를 넘지 않는다", () => {
    const fresh = playing({ enemies: [enemy()], bullets: [basicBullet()] });
    step(fresh, 16, IDLE, noLuck);
    expect(fresh.skillGauge).toBe(SKILL_PER_KILL);

    const almost = playing({ skillGauge: SKILL_GAUGE_MAX - 1, enemies: [enemy()], bullets: [basicBullet()] });
    step(almost, 16, IDLE, noLuck);
    expect(almost.skillGauge).toBe(SKILL_GAUGE_MAX);
  });

  it("게이지가 비용보다 모자라면 스킬이 나가지 않는다", () => {
    const shot = { x: 200, y: 100, r: 5, vx: 0, vy: 0, fromBoss: false };
    const state = playing({ skillGauge: SKILLS.bomb.cost - 1, shots: [shot] });
    step(state, 16, { ...IDLE, skill: "bomb" });
    expect(state.shots).toHaveLength(1);
    expect(state.bombMs).toBe(0);
    expect(state.skillGauge).toBe(SKILLS.bomb.cost - 1);
  });

  it("방어막 동안은 적 탄에 맞지 않고 닿은 탄이 사라지며, 끝나면 다시 맞는다", () => {
    const planeY = getPlaneY(playing());
    const shot = () => ({ x: 200, y: planeY, r: 5, vx: 0, vy: 0, fromBoss: false });
    const state = playing({ skillGauge: SKILLS.barrier.cost, shots: [shot()] });
    step(state, 16, { ...IDLE, skill: "barrier" });
    expect(state.hp).toBe(MAX_HP);
    expect(state.shots).toHaveLength(0);
    expect(state.skillGauge).toBe(0);

    for (let t = 0; t < SKILLS.barrier.ms; t += 16) step(state, 16, IDLE);
    state.shots.push(shot());
    step(state, 16, IDLE);
    expect(state.hp).toBe(MAX_HP - 1);
  });

  it("폭주 동안은 무기 레벨이 3 높은 것처럼 쏜다", () => {
    const state = playing({ weaponLevel: 1, skillGauge: SKILLS.overdrive.cost, fireInMs: 0 });
    step(state, 16, { ...IDLE, skill: "overdrive" });
    expect(state.overdriveMs).toBeGreaterThan(0);
    expect(state.bullets).toHaveLength(getWeaponSpec("basic", 4).pattern.length);
    expect(state.bullets.length).toBeGreaterThan(getWeaponSpec("basic", 1).pattern.length);
  });

  it("폭탄은 적 탄을 지우고 방패병까지 일반 적을 부수며, 보스에게는 최대 체력 비율만큼 피해를 준다", () => {
    const shield = enemy({ id: 1, kind: "shield", r: 18, x: 100, hp: 5, maxHp: 5 });
    const boss = enemy({ id: 2, kind: "boss", r: 44, x: 300, y: 200, hp: 1000, maxHp: 1000 });
    const state = playing({
      skillGauge: SKILLS.bomb.cost,
      enemies: [shield, boss],
      shots: [{ x: 50, y: 500, r: 5, vx: 0, vy: 0, fromBoss: true }],
    });
    step(state, 16, { ...IDLE, skill: "bomb" }, noLuck);
    expect(state.shots).toHaveLength(0);
    expect(state.enemies).toEqual([boss]);
    expect(boss.hp).toBe(1000 - Math.ceil(1000 * BOMB_BOSS_RATIO));
    expect(state.bombMs).toBeGreaterThan(0);
  });
});

describe("스테이지", () => {
  it("5스테이지마다 보스가 나온다", () => {
    expect(getStageConfig(4).boss).toBe(false);
    expect(getStageConfig(5).boss).toBe(true);
    expect(getStageConfig(10).boss).toBe(true);
  });

  it("초반은 쉽고 갈수록 어려워지며, 최고 난이도 뒤로도 계속 빨라진다", () => {
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
    // 러시: 최고 난이도 뒤로도 스테이지마다 적·탄이 더 빨라진다 (65스테이지면 2.5배)
    for (let stage = PEAK_STAGE + 1; stage <= PEAK_STAGE * 4; stage += 1) {
      expect(getStageConfig(stage).enemySpeed).toBeGreaterThan(getStageConfig(stage - 1).enemySpeed);
      expect(getStageConfig(stage).shotSpeed).toBeGreaterThan(getStageConfig(stage - 1).shotSpeed);
    }
    expect(getStageConfig(PEAK_STAGE + 25).enemySpeed).toBeCloseTo(getStageConfig(PEAK_STAGE).enemySpeed * 2.5);
  });

  it("아무리 높은 스테이지도 출현·사격 간격은 하한 아래로 내려가지 않고, 적 체력·탄 수는 상한을 넘지 않는다", () => {
    const late = getStageConfig(201);
    expect(late.spawnIntervalMs).toBe(MIN_SPAWN_INTERVAL_MS);
    expect(late.enemyFireIntervalMs).toBe(MIN_ENEMY_FIRE_INTERVAL_MS);
    expect(late.enemyHp).toBeLessThanOrEqual(60);
    expect(late.enemyShotCount).toBeLessThanOrEqual(5);
  });

  it("뒤 스테이지 적은 훨씬 단단하고, 쏘는 적은 부채꼴로 여러 발을 쏜다", () => {
    expect(getStageConfig(PEAK_STAGE).enemyHp).toBeGreaterThanOrEqual(getStageConfig(1).enemyHp * 20);
    expect(getStageConfig(1).enemyShotCount).toBe(1);
    expect(getStageConfig(PEAK_STAGE).enemyShotCount).toBe(5);

    const state = playing({ stage: PEAK_STAGE, enemies: [enemy({ kind: "shooter", r: 18, fireInMs: 0 })] });
    step(state, 16, IDLE);
    expect(state.shots).toHaveLength(5);
  });

  it("화면에 적 탄이 너무 많으면 적이 더 쏘지 않는다", () => {
    const shot = { x: 10, y: 10, r: 5, vx: 0, vy: 0, fromBoss: false };
    const state = playing({
      enemies: [enemy({ kind: "shooter", r: 18, fireInMs: 0 })],
      shots: Array.from({ length: MAX_SHOTS }, () => ({ ...shot })),
    });
    step(state, 16, IDLE);
    expect(state.shots).toHaveLength(MAX_SHOTS);
  });

  it("목표만큼 격추하면 다음 스테이지로 넘어가고 배너가 뜬다", () => {
    const state = playing({ stageKills: getStageConfig(1).killGoal });
    step(state, 16, IDLE);
    expect(state.stage).toBe(2);
    expect(state.bannerMs).toBe(STAGE_BANNER_MS);
  });

  it("보스 스테이지는 시간이 지나도 보스를 격파하기 전에는 넘어가지 않고, 뒤 보스일수록 체력이 많다", () => {
    const state = playing({ stage: 5, hp: 1e6 });
    for (let t = 0; t < 60_000; t += 50) step(state, 50, IDLE, noLuck);
    expect(state.stage).toBe(5);
    expect(getStageConfig(10).bossHp).toBeGreaterThan(getStageConfig(5).bossHp);
    expect(getStageConfig(15).bossHp).toBeGreaterThan(getStageConfig(10).bossHp);
  });
});

describe("보스 패턴", () => {
  /** 자리 잡은 보스와, 죽지도 스테이지를 넘기지도 않는 상태 */
  function bossFight(overrides: Partial<GameState> = {}) {
    const state = playing({ stage: 5, hp: 1e6, ...overrides });
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

  it("체력이 1/3 아래로 떨어지면 3페이즈가 되어 패턴이 더 빨리 바뀐다", () => {
    expect(getBossPhase({ hp: 100, maxHp: 100 })).toBe(1);
    expect(getBossPhase({ hp: 50, maxHp: 100 })).toBe(2);
    expect(getBossPhase({ hp: 10, maxHp: 100 })).toBe(3);

    const { state, boss } = bossFight({ bossPatternIndex: BOSS_PATTERNS.indexOf("ring") });
    boss.hp = 10;
    boss.maxHp = 100;
    let elapsed = 0;
    while (getBossPattern(state) === "ring" && elapsed < 10_000) {
      step(state, 16, IDLE);
      elapsed += 16;
    }
    expect(elapsed).toBeLessThan(BOSS_PATTERN_MS.ring * 0.7);
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
