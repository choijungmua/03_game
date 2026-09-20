import { describe, expect, it } from "vitest";

import { DEFENSE_RULES, MAPS, getRoundConfig } from "./constants";
import {
  acquireDamageNumber,
  acquireMonster,
  acquireProjectile,
  activeMonsterCount,
  advanceDefenseEngine,
  createDefenseEngine,
  damageMonster,
  defeatMonster,
  releaseDamageNumber,
  releaseProjectile,
  restartDefenseEngine,
  setDefenseClockSpeed,
} from "./logic";

function advanceExact(engine: ReturnType<typeof createDefenseEngine>, milliseconds: number): void {
  let remaining = milliseconds;
  while (remaining > 0 && engine.phase !== "result") {
    const step = Math.min(remaining, DEFENSE_RULES.maxFrameDeltaMs);
    advanceDefenseEngine(engine, step);
    for (const monster of engine.monsters) if (monster.active) defeatMonster(monster);
    remaining -= step;
  }
}

describe("카피바라 디펜스 라운드 엔진", () => {
  it("Given 세 맵 When 경로를 읽으면 Then 같은 시작·도착점의 서로 다른 폐쇄 루프다", () => {
    const [first] = MAPS;
    const sharedPoint = first.path[0];

    expect(new Set(MAPS.map((map) => JSON.stringify(map.path))).size).toBe(3);
    expect(MAPS.every((map) => map.path[0].x === sharedPoint.x && map.path[0].y === sharedPoint.y)).toBe(true);
    expect(MAPS.every((map) => map.path[0].x === map.path.at(-1)?.x && map.path[0].y === map.path.at(-1)?.y)).toBe(true);
    expect(new Set(MAPS.map((map) => map.gimmick)).size).toBe(3);
  });

  it.each(MAPS)("Given $name When round lifecycle runs Then exact 50s/10s phases reach round 100 clear", (map) => {
    const engine = createDefenseEngine(map.id);

    for (let round = 1; round <= DEFENSE_RULES.totalRounds; round += 1) {
      expect(engine.phase).toBe("combat");
      expect(engine.round).toBe(round);
      advanceExact(engine, DEFENSE_RULES.combatMs - DEFENSE_RULES.maxFrameDeltaMs);
      expect(engine.phase).toBe("combat");
      advanceExact(engine, DEFENSE_RULES.maxFrameDeltaMs);
      if (round === DEFENSE_RULES.totalRounds) break;
      expect(engine.phase).toBe("preparation");
      advanceExact(engine, DEFENSE_RULES.preparationMs);
    }

    expect(engine.phase).toBe("result");
    expect(engine.outcome).toBe("clear");
    expect(engine.round).toBe(100);
  });

  it("Given combat begins When fake clock advances Then monsters spawn 2 then delay then 2", () => {
    const engine = createDefenseEngine("reed-marsh");

    advanceDefenseEngine(engine, 1);
    expect(engine.totalSpawned).toBe(1);
    advanceDefenseEngine(engine, 249);
    expect(engine.totalSpawned).toBe(2);
    advanceDefenseEngine(engine, 250);
    expect(engine.totalSpawned).toBe(2);
    advanceDefenseEngine(engine, 149);
    expect(engine.totalSpawned).toBe(2);
    advanceDefenseEngine(engine, 1);
    expect(engine.totalSpawned).toBe(3);
    advanceDefenseEngine(engine, 250);
    expect(engine.totalSpawned).toBe(4);
  });

  it("Given boss and shield rounds When first monsters spawn Then schedule inputs are preserved", () => {
    const bossEngine = createDefenseEngine("hot-spring", 10);
    const shieldEngine = createDefenseEngine("hot-spring", 5);

    advanceDefenseEngine(bossEngine, 1);
    advanceDefenseEngine(shieldEngine, 1);

    expect(getRoundConfig(10).kind).toBe("boss");
    expect(bossEngine.monsters.find((monster) => monster.active)?.kind).toBe("boss");
    expect(getRoundConfig(5).kind).toBe("shield");
    expect(shieldEngine.monsters.find((monster) => monster.active)?.shield).toBeGreaterThan(0);
  });

  it("Given boss and normal spawns When shields are acquired Then boss multiplier and personal rolls reach the engine", () => {
    const bossEngine = createDefenseEngine("reed-marsh", 10);
    const normalEngine = createDefenseEngine("reed-marsh", 11);
    const bossConfig = getRoundConfig(10);
    const normalConfig = getRoundConfig(11);

    const boss = acquireMonster(bossEngine, bossConfig, 0, 1);
    const personal = acquireMonster(normalEngine, normalConfig, 0, 0);
    const unshielded = acquireMonster(normalEngine, normalConfig, 1, 1);

    expect(boss.maxShield).toBe(boss.maxHealth * bossConfig.shieldRatio * (bossConfig.boss?.shieldMultiplier ?? 0));
    expect(boss.shield).toBe(boss.maxShield);
    expect(personal.maxShield).toBe(personal.maxHealth * DEFENSE_RULES.standardShieldHealthRatio);
    expect(unshielded.maxShield).toBe(0);
  });

  it("Given an engine monster with shield When shield-break damage lands Then shield and HP update separately", () => {
    const engine = createDefenseEngine("reed-marsh", 5);
    const monster = acquireMonster(engine, getRoundConfig(5), 0, 1);
    monster.maxHealth = 100;
    monster.health = 100;
    monster.maxShield = 30;
    monster.shield = 30;

    const result = damageMonster(monster, { amount: 30, kind: "shield-break" });

    expect(result).toMatchObject({ shieldDamage: 30, healthDamage: 15, shieldBroken: true });
    expect(monster).toMatchObject({ health: 85, shield: 0, maxHealth: 100, maxShield: 30 });
  });

  it("Given a fast monster When warning ends Then it keeps the response window and eases speed", () => {
    const engine = createDefenseEngine("moonlit-orchard");
    const config = getRoundConfig(1);
    const fast = acquireMonster(engine, config, 7);
    engine.spawnIndex = config.spawnCount;
    const initialSpeed = fast.speed;

    let warningRemainingMs = config.fastEnemyResponseMs;
    while (warningRemainingMs > DEFENSE_RULES.maxFrameDeltaMs) {
      advanceDefenseEngine(engine, DEFENSE_RULES.maxFrameDeltaMs);
      warningRemainingMs -= DEFENSE_RULES.maxFrameDeltaMs;
    }
    expect(fast.progress).toBe(0);
    advanceDefenseEngine(engine, warningRemainingMs);
    expect(fast.progress).toBe(0);
    advanceDefenseEngine(engine, 100);

    expect(fast.speed).toBeGreaterThan(initialSpeed);
    expect(fast.speed).toBeLessThan(fast.targetSpeed);
  });

  it("Given 살아 있는 몬스터 When 한 바퀴를 넘으면 Then 사라지거나 생명을 깎지 않고 다음 바퀴를 돈다", () => {
    const engine = createDefenseEngine("reed-marsh");
    const config = getRoundConfig(1);
    const monster = acquireMonster(engine, config, 0);
    engine.spawnIndex = config.spawnCount;
    monster.progress = engine.map.pathLength - 1;
    monster.warningRemainingMs = 0;
    monster.speed = 10;
    monster.targetSpeed = 10;
    const lives = engine.lives;

    advanceDefenseEngine(engine, 1_000);

    expect(monster.active).toBe(true);
    expect(monster.progress).toBeGreaterThanOrEqual(0);
    expect(monster.progress).toBeLessThan(engine.map.pathLength);
    expect(engine.lives).toBe(lives);
  });

  it("Given 이전 라운드 생존 몬스터 When 다음 라운드가 시작되면 Then 새 몬스터와 함께 남는다", () => {
    const engine = createDefenseEngine("hot-spring");
    const firstConfig = getRoundConfig(1);
    const survivor = acquireMonster(engine, firstConfig, 0);
    engine.spawnIndex = firstConfig.spawnCount;

    for (let elapsed = 0; elapsed < DEFENSE_RULES.combatMs + DEFENSE_RULES.preparationMs; elapsed += DEFENSE_RULES.maxFrameDeltaMs) {
      advanceDefenseEngine(engine, DEFENSE_RULES.maxFrameDeltaMs);
    }
    advanceDefenseEngine(engine, 1);

    expect(engine.round).toBe(2);
    expect(survivor.active).toBe(true);
    expect(survivor.round).toBe(1);
    expect(engine.monsters.some((monster) => monster.active && monster.round === 2)).toBe(true);
  });

  it("Given each map gimmick zone When a monster enters Then its distinct effect is applied", () => {
    const engines = MAPS.map((map) => createDefenseEngine(map.id));
    const monsters = engines.map((engine) => {
      const config = getRoundConfig(1);
      engine.spawnIndex = config.spawnCount;
      const monster = acquireMonster(engine, config, 0);
      monster.progress = engine.map.pathLength * ((engine.map.gimmickZone[0] + engine.map.gimmickZone[1]) / 2);
      return monster;
    });

    for (const engine of engines) advanceDefenseEngine(engine, 1);

    expect(monsters[0].targetSpeed).toBeLessThan(monsters[0].baseSpeed);
    expect(monsters[0].speed).toBeLessThan(monsters[0].baseSpeed);
    expect(monsters[0].speed).toBeGreaterThan(monsters[0].targetSpeed);
    expect(engines[1].manaGenerated).toBe(1);
    expect(monsters[2].vulnerable).toBe(true);
  });

  it.each(MAPS)("Given $name monsters finish the loop When twenty circle Then they persist and restart resets", (map) => {
    const engine = createDefenseEngine(map.id);
    const config = getRoundConfig(1);
    for (let index = 0; index < DEFENSE_RULES.startingLife; index += 1) {
      const monster = acquireMonster(engine, config, index);
      monster.progress = engine.map.pathLength - 1;
      monster.warningRemainingMs = 0;
      monster.speed = 1_000;
      monster.targetSpeed = 1_000;
    }

    advanceDefenseEngine(engine, 10);
    expect(activeMonsterCount(engine)).toBe(DEFENSE_RULES.startingLife);
    expect(engine.monsters.every((monster) => !monster.active || monster.progress < engine.map.pathLength)).toBe(true);
    expect(engine.phase).toBe("combat");
    expect(engine.outcome).toBeNull();
    expect(engine.lives).toBe(DEFENSE_RULES.startingLife);

    restartDefenseEngine(engine);
    expect(engine.phase).toBe("combat");
    expect(engine.round).toBe(1);
    expect(engine.lives).toBe(20);
    expect(engine.clockSpeed).toBe(1);
  });

  it("Given 131 monsters remain When one tick advances Then overload fails immediately at 131 / 130", () => {
    const engine = createDefenseEngine("reed-marsh");
    const config = getRoundConfig(1);
    for (let index = 0; index < 131; index += 1) acquireMonster(engine, config, index);

    advanceDefenseEngine(engine, 1);

    expect(engine.phase).toBe("result");
    expect(engine.failure).toEqual({ kind: "overload", current: 131, limit: 130 });
    expect(activeMonsterCount(engine)).toBe(131);
    expect(engine.totalSpawned).toBe(0);
  });

  it("Given 130 monsters remain at a spawn boundary When one spawns Then overload stops at exactly 131", () => {
    const engine = createDefenseEngine("reed-marsh");
    const config = getRoundConfig(1);
    for (let index = 0; index < 130; index += 1) acquireMonster(engine, config, index);

    advanceDefenseEngine(engine, 250);

    expect(engine.failure).toEqual({ kind: "overload", current: 131, limit: 130 });
    expect(activeMonsterCount(engine)).toBe(131);
    expect(engine.totalSpawned).toBe(1);
  });

  it("Given released pooled objects When acquired again Then identities and array sizes are reused", () => {
    const engine = createDefenseEngine("hot-spring");
    const monster = acquireMonster(engine, getRoundConfig(1), 0);
    const projectile = acquireProjectile(engine);
    const damageNumber = acquireDamageNumber(engine);
    defeatMonster(monster);
    releaseProjectile(projectile);
    releaseDamageNumber(damageNumber);

    expect(acquireMonster(engine, getRoundConfig(1), 1)).toBe(monster);
    expect(acquireProjectile(engine)).toBe(projectile);
    expect(acquireDamageNumber(engine)).toBe(damageNumber);
    expect([engine.monsters.length, engine.projectiles.length, engine.damageNumbers.length]).toEqual([1, 1, 1]);
  });

  it("Given interrupted timer and stale result When advanced Then delta is capped and result remains stable", () => {
    const engine = createDefenseEngine("reed-marsh");
    setDefenseClockSpeed(engine, 2);
    advanceDefenseEngine(engine, 120_000);
    expect(engine.phaseElapsedMs).toBe(DEFENSE_RULES.maxFrameDeltaMs * 2);

    const cleared = createDefenseEngine("reed-marsh", 100);
    advanceExact(cleared, DEFENSE_RULES.combatMs);
    const elapsedAtClear = cleared.totalElapsedMs;
    advanceDefenseEngine(cleared, 120_000);
    expect(cleared.phase).toBe("result");
    expect(cleared.outcome).toBe("clear");
    expect(cleared.totalElapsedMs).toBe(elapsedAtClear);
  });

  it("Given malformed inputs When creating or advancing Then typed config errors reject them", () => {
    expect(() => createDefenseEngine("unknown-map")).toThrow("Unknown defense map");
    const engine = createDefenseEngine("reed-marsh");
    expect(() => advanceDefenseEngine(engine, Number.NaN)).toThrow("Delta milliseconds");
    expect(() => advanceDefenseEngine(engine, -1)).toThrow("Delta milliseconds");
    expect(() => setDefenseClockSpeed(engine, 3)).toThrow("Clock speed");
  });
});
