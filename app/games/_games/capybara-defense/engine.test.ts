import { describe, expect, it } from "vitest";
import { CELLS, RARITIES, RULES, advanceGame, createGame, getEnemyPoint, getUnitDamage, getUpgradeCost, pauseGame, placeUnit, resumeGame, sellUnit, startGame, summonUnit, upgradeClass } from "./engine";
import type { DefenseEnemy, DefenseState, DefenseUnit } from "./engine";

const unit: DefenseUnit = { id: 1, classId: "warrior", rarity: "common", cellIndex: 0, position: null, cooldownMs: 0, mana: 100, focusEnemyId: null };
function enemy(overrides: Partial<DefenseEnemy> = {}): DefenseEnemy {
  return { id: 100, round: 1, name: "test", size: "large", shield: 0, maxShield: 0, armor: 0, lockedUntilMs: 0, slowedUntilMs: 0, gasReward: 1, progress: 0, hp: 20, maxHp: 20, isBoss: false, deadlineMs: null, ...overrides };
}
function playing(overrides: Partial<DefenseState> = {}): DefenseState {
  return { ...startGame(createGame(7)), ...overrides };
}
function finalBattle(enemies: DefenseEnemy[], units: DefenseUnit[] = []): DefenseState {
  return playing({ round: 120, spawnedThisRound: 9, roundElapsedMs: 6_000, elapsedMs: 720_000, enemies, units });
}

describe("new defense public actions", () => {
  it("Given a seed When twelve summons are repeated Then identities match and gold pays every summon", () => {
    const run = () => { let state = playing(); for (let count = 0; count < 12; count += 1) state = summonUnit(state).state; return state; };
    const state = run();
    expect(state.units).toEqual(run().units);
    expect(state.gold).toBe(0);
    expect(state.units.every(item => item.cellIndex === null)).toBe(true);
    expect(summonUnit(state)).toMatchObject({ state, error: expect.any(String) });
  });
  it("Given capacity is full When summoning Then no money or RNG is consumed", () => {
    const state = playing({ gold: 1_000, units: CELLS.map(cell => ({ ...unit, id: cell.index + 1, cellIndex: cell.index })) });
    const result = summonUnit(state);
    expect(result.state).toBe(state);
    expect(result.error).not.toBeNull();
  });
  it.each([-1, 24, 0.5, NaN])("Given invalid cell %s When placing Then state is unchanged", cell => {
    const state = playing({ units: [unit] });
    const result = placeUnit(state, unit.id, cell);
    expect(result.state).toBe(state);
    expect(result.error).not.toBeNull();
  });
  it("Given an occupied cell When placing another unit Then existing occupants are preserved", () => {
    const state = playing({ units: [unit, { ...unit, id: 2, cellIndex: null }] });
    expect(placeUnit(state, 2, 0).state).toBe(state);
    expect(placeUnit(state, 99, 1).state).toBe(state);
  });
  it("Given a placed unit When moving Then exactly one cell contains it", () => {
    const state = playing({ units: [unit] });
    const result = placeUnit(state, 1, 5);
    expect(result.error).toBeNull();
    expect(result.state.units).toEqual([{ ...unit, cellIndex: 5 }]);
    expect(state.units[0].cellIndex).toBe(0);
  });
  it.each(RARITIES.filter(item => item.sellGold > 0))("Given $id unit When selling twice Then refund happens only once", rarity => {
    const state = playing({ gold: 0, units: [{ ...unit, rarity: rarity.id }] });
    const result = sellUnit(state, 1);
    expect(result.state.gold).toBe(rarity.sellGold);
    expect(result.state.units).toHaveLength(0);
    expect(sellUnit(result.state, 1).state).toBe(result.state);
  });
  it("Given exact upgrade funds When upgrading Then damage and next price increase only for that class", () => {
    const state = playing({ gold: 35 });
    const result = upgradeClass(state, "warrior");
    expect(result.state.gold).toBe(0);
    expect(result.state.classLevels).toEqual({ warrior: 1, archer: 0, mage: 0 });
    expect(getUpgradeCost(result.state, "warrior")).toBe(42);
    expect(getUnitDamage(result.state, unit)).toBeCloseTo(31.2);
    expect(upgradeClass(result.state, "warrior").state).toBe(result.state);
  });
  it("Given a maxed class When upgrading Then gold stays unchanged", () => {
    const state = playing({ gold: 100_000, classLevels: { warrior: 20, archer: 0, mage: 0 } });
    expect(upgradeClass(state, "warrior").state).toBe(state);
  });
  it.each(["idle", "paused", "won", "lost"] as const)("Given %s phase When actions are attempted Then state is unchanged", phase => {
    const state = playing({ phase, units: [unit] });
    expect([summonUnit(state), sellUnit(state, 1), placeUnit(state, 1, 2), upgradeClass(state, "mage")].every(result => result.state === state && result.error !== null)).toBe(true);
  });
  it("Given 20,000 seed draws When summoning Then common rarity and class outcomes occur with stated broad frequencies", () => {
    const draws = Array.from({ length: 20_000 }, (_, seed) => summonUnit(startGame(createGame(seed))).state.units[0]);
    expect(new Set(draws.map(item => item.classId)).size).toBe(3);
    for (const rarity of RARITIES.filter(item => item.weight >= 1)) {
      const ratio = draws.filter(item => item.rarity === rarity.id).length / draws.length;
      expect(ratio).toBeGreaterThan(rarity.weight / 100 * 0.6);
      expect(ratio).toBeLessThan(rarity.weight / 100 * 1.4);
    }
  });
});

describe("fixed clock and spatial combat", () => {
  it("Given equal total time When frame deltas differ Then complete engine state is equivalent", () => {
    const state = playing({ units: [unit] });
    const whole = advanceGame(state, 7_023);
    let sliced = state;
    for (const delta of [17, 23, 900, 2_000, 4_083]) sliced = advanceGame(sliced, delta);
    expect(sliced).toEqual(whole);
    expect(state.enemies).toHaveLength(0);
    expect(state.units[0].cooldownMs).toBe(0);
  });
  it.each([1, 2, 4] as const)("Given paused speed %s When time and actions arrive Then clocks and combat freeze until resume", speed => {
    const state = pauseGame(advanceGame(playing({ units: [unit], speed }), 75));
    expect(advanceGame(state, 10_000)).toBe(state);
    expect(summonUnit(state).state).toBe(state);
    const resumed = advanceGame(resumeGame(state), 25);
    expect(resumed.elapsedMs).toBe(100 * speed);
    expect(resumed.tickRemainderMs).toBe(0);
  });
  it.each([NaN, Infinity, -1, 0])("Given invalid delta %s When advancing Then state is unchanged", delta => {
    const state = playing();
    expect(advanceGame(state, delta)).toBe(state);
  });
  it("Given enemies beside the edge When comparing an edge and center warrior Then placement changes damage", () => {
    const state = playing({ spawnedThisRound: 8, enemies: [enemy({ hp: 100 })], units: [unit] });
    const edge = advanceGame(state, 50);
    const center = advanceGame({ ...state, units: [{ ...unit, cellIndex: 8 }] }, 50);
    expect(edge.enemies[0].hp).toBe(76);
    expect(center.enemies[0].hp).toBe(100);
  });
  it("Given a bench unit When enemies pass Then it cannot attack", () => {
    const state = playing({ spawnedThisRound: 8, enemies: [enemy({ hp: 100 })], units: [{ ...unit, cellIndex: null }] });
    expect(advanceGame(state, 50).enemies[0].hp).toBe(100);
  });
  it("Given a warrior cooldown When less than its attack interval passes Then attacks do not repeat", () => {
    const state = playing({ spawnedThisRound: 8, enemies: [enemy({ hp: 100 })], units: [unit] });
    expect(advanceGame(state, 700).enemies[0].hp).toBe(76);
    expect(advanceGame(state, 750).enemies[0].hp).toBe(52);
  });
  it("Given clustered enemies When a mage attacks Then splash damages both", () => {
    const state = playing({ spawnedThisRound: 8, enemies: [enemy({ hp: 100 }), enemy({ id: 101, hp: 100, progress: 0.01 })], units: [{ ...unit, classId: "mage" }] });
    expect(advanceGame(state, 50).enemies.map(item => item.hp)).toEqual([86, 86]);
  });
  it("Given distant enemies When comparing warrior and archer Then only the archer reaches them", () => {
    const state = playing({ spawnedThisRound: 8, enemies: [enemy({ hp: 100, progress: 0.13 })], units: [unit] });
    expect(advanceGame(state, 50).enemies[0].hp).toBe(100);
    expect(advanceGame({ ...state, units: [{ ...unit, classId: "archer" }] }, 50).enemies[0].hp).toBe(96.75);
  });
  it("Given one complete path loop When reading geometry Then corners and wrap meet", () => {
    expect(getEnemyPoint(0)).toEqual({ x: 30, y: 30 });
    expect(getEnemyPoint(0.5)).toEqual({ x: 690, y: 450 });
    expect(getEnemyPoint(1)).toEqual(getEnemyPoint(0));
  });
});

describe("wave and terminal boundaries", () => {
  it("Given round 119 with surviving enemies When the round ends Then 120 starts without clearing them", () => {
    const state = playing({ round: 119, roundElapsedMs: 5_950, spawnedThisRound: 8, enemies: [enemy({ hp: 1_000 })] });
    const result = advanceGame(state, 50);
    expect(result.round).toBe(120);
    expect(result.enemies.map(item => item.id)).toEqual([100]);
    expect(result.phase).toBe("playing");
  });
  it("Given final round starts When its schedule runs Then the final boss and all eight adds spawn once", () => {
    const result = advanceGame(playing({ round: 120 }), 6_000);
    expect(result.round).toBe(120);
    expect(result.spawnedThisRound).toBe(9);
    expect(result.enemies.filter(item => item.isBoss)).toHaveLength(1);
    expect(result.enemies.filter(item => !item.isBoss)).toHaveLength(8);
    expect(result.phase).toBe("playing");
  });
  it("Given the final boss dies with adds alive When combat resolves Then the game continues", () => {
    const state = finalBattle([enemy({ isBoss: true, round: 120 }), enemy({ id: 101, hp: 100, progress: 0.5 })], [unit]);
    const result = advanceGame(state, 50);
    expect(result.finalBossDefeated).toBe(true);
    expect(result.phase).toBe("playing");
    expect(result.enemies).toHaveLength(1);
  });
  it("Given the final boss dies before all scheduled adds spawn When combat resolves Then victory waits", () => {
    const state = { ...finalBattle([enemy({ isBoss: true, round: 120 })], [unit]), spawnedThisRound: 1, roundElapsedMs: 100 };
    expect(advanceGame(state, 50).phase).toBe("playing");
  });
  it.each([1, 2, 4] as const)("Given speed %s and last boss dies at deadline When combat resolves Then victory wins the tie", speed => {
    const state = { ...finalBattle([enemy({ isBoss: true, round: 120, deadlineMs: 720_050 })], [unit]), speed };
    const result = advanceGame(state, 50);
    expect(result.phase).toBe("won");
    expect(result.round).toBe(120);
    expect(result.kills).toBe(1);
    expect(advanceGame(result, 100_000)).toBe(result);
  });
  it("Given an expired boss survives the attack When combat resolves Then the game is lost", () => {
    const state = finalBattle([enemy({ hp: 100, isBoss: true, round: 120, deadlineMs: 720_050 })], [unit]);
    expect(advanceGame(state, 50).phase).toBe("lost");
  });
  it("Given population reaches the limit When an enemy dies in the same tick Then combat prevents overload", () => {
    const enemies = Array.from({ length: 80 }, (_, index) => enemy({ id: index + 100, hp: index === 0 ? 20 : 100 }));
    const state = playing({ spawnedThisRound: 8, enemies, units: [unit] });
    expect(advanceGame(state, 50).phase).toBe("playing");
    expect(advanceGame({ ...state, units: [] }, 50).phase).toBe("lost");
  });
  it("Given the final boss is already dead When the last add dies Then victory is recorded once", () => {
    const state = { ...finalBattle([enemy()], [unit]), finalBossDefeated: true };
    const result = advanceGame(state, 50);
    expect(result.phase).toBe("won");
    expect(advanceGame(result, 1_000_000).gold).toBe(state.gold + RULES.killGold);
  });
  it.each(["won", "lost"] as const)("Given %s When time advances Then all terminal state stays frozen", phase => {
    const state = playing({ phase, round: 120 });
    expect(advanceGame(state, 1_000_000)).toBe(state);
    expect(startGame(state)).toBe(state);
    expect(resumeGame(state)).toBe(state);
  });
});
