import { describe, expect, it } from "vitest";
import { advanceGame, applyCommand, CLASSES, getWaveInfo, makeUnit, RULES } from "./engine";
import { getDefenseReward, getNextDefenseGoal } from "./defense-feedback";
import { testEnemy, testGame, testUnit } from "./defense-test-fixtures";

describe("accepted reward feedback", () => {
  it("names the actual new defender when a random summon succeeds", () => {
    const before = testGame();
    const next = applyCommand(before, { type: "summon" }).state;
    expect(getDefenseReward(before, next)?.units).toEqual(next.units);
    expect(getDefenseReward(next, advanceGame(next, 50))).toBeNull();
  });
  it("does not celebrate when a purchase is rejected", () => {
    const before = testGame({ gold: 0 });
    const next = applyCommand(before, { type: "summon" }).state;
    expect(getDefenseReward(before, next)).toBeNull();
  });
  it("emphasizes the real ticket result when an epic ticket is used", () => {
    const before = testGame({ tickets: [{ id: 20, rarity: "epic" }] });
    const next = applyCommand(before, { type: "ticket", ticketId: 20, classId: "mage" }).state;
    expect(getDefenseReward(before, next)).toMatchObject({ units: [{ rarity: "epic", classId: "mage" }], tickets: [], celebrated: true });
  });
  it("reports both boss and milestone rewards when one kill earns both", () => {
    const before = testGame({ nextId: 200, kills: 49, units: [testUnit], enemies: [testEnemy({ hp: 1, round: 100, isBoss: true })] });
    const next = advanceGame(before, RULES.tickMs);
    expect(getDefenseReward(before, next)).toMatchObject({ bossDefeated: true, milestones: [50], tickets: [{ rarity: "primordial" }, { rarity: "rare" }], celebrated: true });
  });
  it("reports a collection reward once when an eligible trio registers", () => {
    const before = testGame({ nextId: 10, round: 70, units: CLASSES.map((item, i) => makeUnit(i + 1, item.id, "epic")) });
    const next = applyCommand(before, { type: "collection", collectionId: "epic-team" }).state;
    expect(getDefenseReward(before, next)).toMatchObject({ collections: ["epic-team"], tickets: [{ rarity: "apocalypse" }], units: [] });
    expect(getDefenseReward(next, applyCommand(next, { type: "collection", collectionId: "epic-team" }).state)).toBeNull();
  });
  it("does not replay old rewards when a run resets", () => {
    const before = applyCommand(testGame({ elapsedMs: 5000 }), { type: "summon" }).state;
    const next = testGame();
    expect(getDefenseReward(before, next)).toBeNull();
  });
});

describe("next special round", () => {
  it.each([[1, 10], [9, 10], [10, 15], [15, 20], [29, 30], [110, 120], [119, 120]])("previews the canonical wave after round %i", (round, expected) => {
    const next = getNextDefenseGoal(round);
    expect(next).toEqual(getWaveInfo(expected));
  });
  it("never advertises another round when the last round starts", () => {
    expect(getNextDefenseGoal(RULES.totalRounds)).toBeNull();
  });
});
