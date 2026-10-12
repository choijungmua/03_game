import { describe, expect, it } from "vitest";
import { advanceGame, applyCommand, parseDefenseCommand } from "./engine";
import type { DefenseCommand } from "./engine";
import { testEnemy, testGame, testUnit } from "./defense-test-fixtures";

describe("command trust boundary", () => {
  it.each([null, [], {}, { type: "delete" }, { type: "convert", amount: -1 }, { type: "sell", unitId: Number.MAX_SAFE_INTEGER + 1 },
    { type: "move", unitIds: Array.from({ length: 25 }, (_, i) => i + 1), x: 100, y: 100 },
    { type: "move", unitIds: [1, 1], x: 100, y: 100 }, { type: "move", unitIds: [1], x: NaN, y: 100 },
    { type: "move", unitIds: [1], x: 100, y: Infinity }, { type: "focus", unitIds: [], enemyId: 1 }, { type: "speed", speed: 8 },
    { type: "ticket", ticketId: 1, classId: "rogue" }, { type: "collection", collectionId: "x".repeat(65) }])("Given malformed input %j When parsing Then reject", value => {
    expect(parseDefenseCommand(value)).toBeNull();
  });
  const actions: DefenseCommand[] = [{ type: "summon" }, { type: "move", unitIds: [1], x: 200, y: 200 }, { type: "focus", unitIds: [1], enemyId: 100 },
    { type: "sell", unitId: 1 }, { type: "upgrade", classId: "mage" }, { type: "speed", speed: 4 }, { type: "ticket", ticketId: 10, classId: "gamble" },
    { type: "exchange", unitId: 1, classId: "mage" }, { type: "convert", amount: 5 }, { type: "collection", collectionId: "first-team" }, { type: "ability", unitId: 1, enemyId: 100 }];
  it.each(["idle", "paused", "won", "lost"] as const)("Given %s When game actions arrive Then preserve every value and RNG", phase => {
    const state = testGame({ phase, gas: 10, gold: 1_000, units: [testUnit], enemies: [testEnemy()], tickets: [{ id: 10, rarity: "epic" }] });
    for (const action of actions) { const result = applyCommand(state, action); expect(result.state).toBe(state); expect(result.error).not.toBeNull(); }
  });
  it("Given two units When moving as a group Then free coordinates overlap without mutating snapshot", () => {
    const state = testGame({ units: [testUnit, { ...testUnit, id: 2 }] });
    const next = applyCommand(state, { type: "move", unitIds: [1, 2], x: 123.5, y: 155.75 }).state;
    expect(next.units.map(unit => unit.position)).toEqual([{ x: 123.5, y: 155.75 }, { x: 123.5, y: 155.75 }]);
    expect(state.units[0].position).toEqual({ x: 100, y: 90 });
  });
  it("Given a group with one missing unit When moving Then atomic rejection leaves all units", () => {
    const state = testGame({ units: [testUnit] });
    expect(applyCommand(state, { type: "move", unitIds: [1, 999], x: 200, y: 200 }).state).toBe(state);
  });
  it.each([1, 2, 4] as const)("Given speed %s When advancing wall time Then only engine multiplies once", speed => {
    const state = testGame();
    expect(advanceGame(applyCommand(state, { type: "speed", speed }).state, 1_000).elapsedMs).toBe(speed * 1_000);
  });
  it("Given a focus target When attacking Then target receives damage before an earlier enemy", () => {
    const state = testGame({ units: [testUnit], enemies: [testEnemy(), testEnemy({ id: 101 })] });
    const result = advanceGame(applyCommand(state, { type: "focus", unitIds: [1], enemyId: 101 }).state, 50);
    expect(result.enemies.map(enemy => enemy.hp)).toEqual([1_000, 976]);
  });
});
