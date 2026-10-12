import { describe, expect, it } from "vitest";
import { CLASSES, RULES, advanceGame, applyCommand, getUnitStats, getUpgradeCost, getWaveInfo, makeUnit } from "./engine";
import { damageEnemy } from "./defense-combat";
import type { AttackType, EnemySize } from "./engine";
import { testEnemy, testGame, testUnit } from "./defense-test-fixtures";

describe("combat roles", () => {
  it("Given a focused enemy killed this tick When advancing Then all dead focus references clear without mutating input", () => {
    const state = testGame({ units: [{ ...testUnit, focusEnemyId: 100 }, { ...testUnit, id: 2, position: null, cellIndex: null, cooldownMs: 500, focusEnemyId: 100 }], enemies: [testEnemy({ hp: 1 }), testEnemy({ id: 101 })] });
    const next = advanceGame(state, RULES.tickMs);
    expect(next.enemies.some(enemy => enemy.id === 100)).toBe(false);
    expect(next.units.map(unit => unit.focusEnemyId)).toEqual([null, null]);
    expect(state.units.map(unit => unit.focusEnemyId)).toEqual([100, 100]);
    expect(state.enemies[0].hp).toBe(1);
    const later = advanceGame(next, 1000);
    expect(later.enemies.find(enemy => enemy.id === 101)?.hp).toBeLessThan(next.enemies.find(enemy => enemy.id === 101)?.hp ?? 0);
  });
  const matchups: [AttackType, EnemySize, number][] = [["normal", "small", 100], ["normal", "medium", 100], ["normal", "large", 100], ["explosive", "small", 50], ["explosive", "medium", 75], ["explosive", "large", 100], ["concussive", "small", 100], ["concussive", "medium", 50], ["concussive", "large", 25]];
  it.each(matchups)("Given %s attack on %s When resolving 100 damage Then applies %s", (attackType, size, damage) => {
    const enemy = testEnemy({ size });
    damageEnemy(enemy, { ...getUnitStats(testGame(), testUnit), attackType, damage: 100 });
    expect(enemy.hp).toBe(1_000 - damage);
  });
  it("Given shields and armor When attack overflows Then shields absorb full damage before size and armor", () => {
    const enemy = testEnemy({ size: "small", shield: 40, armor: 10 });
    damageEnemy(enemy, { ...getUnitStats(testGame(), testUnit), attackType: "explosive", damage: 100 });
    expect(enemy.shield).toBe(0); expect(enemy.hp).toBe(980);
  });
  it("Given mythical bypass When hitting armored target Then armor is ignored", () => {
    const state = testGame();
    const stats = getUnitStats(state, { ...testUnit, rarity: "mythic" });
    const enemy = testEnemy({ armor: 100 });
    damageEnemy(enemy, stats);
    expect(enemy.hp).toBe(1_000 - stats.damage);
  });
  it.each(["primordial", "apocalypse"] as const)("Given %s archer When attacking large enemies Then uses normal damage", rarity => {
    const stats = getUnitStats(testGame(), { ...testUnit, classId: "archer", rarity });
    const enemy = testEnemy(); damageEnemy(enemy, stats);
    expect(enemy.hp).toBe(1_000 - stats.damage);
  });
  it.each(CLASSES)("Given $id higher rank When comparing stats Then range speed damage and growth differ", item => {
    const state = testGame();
    const low = getUnitStats(state, makeUnit(1, item.id, "common"));
    const high = getUnitStats(state, makeUnit(1, item.id, "epic"));
    expect(high.damage).toBeGreaterThan(low.damage); expect(high.range).toBeGreaterThan(low.range); expect(high.attackMs).toBeLessThan(low.attackMs); expect(high.splashRadius).toBeGreaterThan(low.splashRadius);
    expect(new Set(CLASSES.map(entry => getUpgradeCost(state, entry.id))).size).toBe(3);
  });
  it.each(CLASSES)("Given epic $id When casting Then its support effect consumes mana and preserves input", item => {
    const unit = { ...testUnit, classId: item.id, rarity: "epic" as const };
    const state = testGame({ units: [unit], enemies: [testEnemy({ shield: 300 })] });
    const result = applyCommand(state, { type: "ability", unitId: 1, enemyId: 100 });
    expect(result.error).toBeNull(); expect(result.state.units[0].mana).toBe(50); expect(state.units[0].mana).toBe(100);
    switch (item.id) {
      case "warrior": expect(result.state.enemies[0].lockedUntilMs).toBe(3_000); break;
      case "archer": expect(result.state.enemies[0].slowedUntilMs).toBe(6_000); break;
      case "mage": expect(result.state.enemies[0].shield).toBe(0); break;
    }
    expect(advanceGame(result.state, 1_000).units[0].mana).toBe(55);
  });
  it("Given insufficient mana or unreachable target When casting Then command is rejected", () => {
    const state = testGame({ units: [{ ...testUnit, rarity: "epic", mana: 49 }], enemies: [testEnemy()] });
    expect(applyCommand(state, { type: "ability", unitId: 1, enemyId: 100 }).state).toBe(state);
    const distant = { ...state, units: [{ ...testUnit, rarity: "epic" as const, position: { x: 670, y: 430 } }] };
    expect(applyCommand(distant, { type: "ability", unitId: 1, enemyId: 100 }).state).toBe(distant);
  });
  it("Given lockdown or ensnare When time advances Then movement freezes or slows without stopping boss deadline", () => {
    const state = testGame({ enemies: [testEnemy({ lockedUntilMs: 2_000 }), testEnemy({ id: 101, slowedUntilMs: 2_000 }), testEnemy({ id: 102 })] });
    const next = advanceGame(state, 1_000);
    expect(next.enemies[0].progress).toBe(0); expect(next.enemies[1].progress).toBeCloseTo(next.enemies[2].progress * 0.4);
    expect(advanceGame(testGame({ enemies: [testEnemy({ isBoss: true, deadlineMs: 50, lockedUntilMs: 2_000 })] }), 50).phase).toBe("lost");
  });
});
describe("wave variety", () => {
  it("Given a defeated late boss When rewards resolve Then a primordial choice ticket and gold are awarded once", () => {
    const state = testGame({ nextId: 200, units: [testUnit], enemies: [testEnemy({ hp: 1, round: 100, isBoss: true })] });
    const next = advanceGame(state, 50);
    expect(next.tickets).toEqual([{ id: 200, rarity: "primordial" }]);
    expect(next.gold).toBe(state.gold + RULES.bossGold);
    expect(advanceGame(next, 50).tickets).toEqual(next.tickets);
    expect(state.tickets).toEqual([]);
  });
  it("Given normal wave When spawns complete Then multiple sizes and names appear", () => {
    const state = advanceGame(testGame({ spawnedThisRound: 0 }), 5_500);
    expect(new Set(state.enemies.map(enemy => enemy.size)).size).toBeGreaterThan(1);
    expect(new Set(state.enemies.map(enemy => enemy.name)).size).toBeGreaterThan(1);
  });
  it("Given paired boss wave When spawns complete Then both bosses carry distinct ids and timed rewards", () => {
    const state = advanceGame(testGame({ round: 30, spawnedThisRound: 0 }), 5_900);
    expect(state.enemies.filter(enemy => enemy.isBoss)).toHaveLength(2);
    expect(state.spawnedThisRound).toBe(10);
    expect(getWaveInfo(100).rewardRarity).toBe("primordial");
  });
  it("Given bonus wave When one enemy dies Then extra gas is earned", () => {
    const normal = advanceGame(testGame({ round: 14, spawnedThisRound: 0 }), 50).enemies[0];
    const bonus = advanceGame(testGame({ round: 15, spawnedThisRound: 0 }), 50).enemies[0];
    expect(bonus.gasReward).toBeGreaterThan(normal.gasReward);
    const state = advanceGame(testGame({ units: [testUnit], enemies: [{ ...bonus, hp: 1 }] }), RULES.tickMs);
    expect(state.gas).toBe(bonus.gasReward);
  });
});
