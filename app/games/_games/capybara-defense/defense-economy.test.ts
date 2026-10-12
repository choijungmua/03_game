import { describe, expect, it } from "vitest";
import { CLASSES, KILL_MILESTONES, RARITIES, RULES, advanceGame, applyCommand, getCollectionProgress, makeUnit, rarityRank, summonUnit } from "./engine";
import { testEnemy, testGame, testUnit } from "./defense-test-fixtures";

describe("reward economy", () => {
  it("spends exactly 10 gold to summon at the center and cannot farm gold by selling", () => {
    const poor = testGame({ gold: 9 });
    expect(summonUnit(poor).state).toBe(poor);
    const next = summonUnit(testGame({ gold: 10 })).state;
    expect(next.gold).toBe(0);
    expect(next.units[0].position).toEqual({ x: 360, y: 240 });
    expect(RARITIES.every(item => item.sellGold < RULES.summonCost)).toBe(true);
  });
  it("Given summon table When summoning seeded cohorts Then ten tiers share a normalized distribution", () => {
    expect(RARITIES.reduce((sum, rarity) => sum + rarity.weight, 0)).toBeCloseTo(100, 10);
    expect(new Set(RARITIES.map(rarity => rarity.id)).size).toBe(10);
    const run = () => Array.from({ length: 100 }, (_, seed) => summonUnit(testGame({ seed, rngState: seed })).state.units[0]);
    expect(run()).toEqual(run());
  });
  it.each(RARITIES.filter(rarity => rarity.sellGold === 0))("Given $id When selling Then reject without economic change", rarity => {
    const state = testGame({ units: [{ ...testUnit, rarity: rarity.id }] });
    expect(applyCommand(state, { type: "sell", unitId: 1 }).state).toBe(state);
  });
  it("Given a ticket When choosing mage Then exact tier/class arrives and replay cannot redeem", () => {
    const state = testGame({ tickets: [{ id: 20, rarity: "epic" }] });
    const result = applyCommand(state, { type: "ticket", ticketId: 20, classId: "mage" });
    expect(result.state.units[0]).toMatchObject({ classId: "mage", rarity: "epic" });
    expect(result.state.rngState).toBe(state.rngState);
    expect(applyCommand(result.state, { type: "ticket", ticketId: 20, classId: "mage" }).state).toBe(result.state);
  });
  it("Given guaranteed tier tickets When gambling across seeds Then both baseline and upper outcomes are reachable", () => {
    const rarities = Array.from({ length: 100 }, (_, seed) => applyCommand(testGame({ rngState: seed, tickets: [{ id: 20, rarity: "primordial" }] }), { type: "ticket", ticketId: 20, classId: "gamble" }).state.units[0].rarity);
    expect(new Set(rarities)).toEqual(new Set(["primordial", "apocalypse"]));
  });
  it("Given paid exchange When rolls succeed or fail Then tier and original unit survive and cost is paid once", () => {
    const outcomes = Array.from({ length: 100 }, (_, seed) => {
      const unit = { ...testUnit, rarity: "epic" as const };
      const state = testGame({ rngState: seed, units: [unit] });
      const next = applyCommand(state, { type: "exchange", unitId: 1, classId: "mage" }).state;
      expect(next.gold).toBe(state.gold - RULES.exchangeCost);
      expect(next.units[0].rarity).toBe("epic");
      if (next.units[0].classId === "warrior") expect(next.units[0]).toBe(unit);
      return next.units[0].classId;
    });
    expect(new Set(outcomes)).toEqual(new Set(["warrior", "mage"]));
  });
  it("Given killed enemies When rewards resolve Then gas accumulates before explicit gold conversion", () => {
    const state = testGame({ enemies: [testEnemy({ hp: 1 })], units: [testUnit] });
    const killed = advanceGame(state, 50);
    expect(killed.gold).toBe(state.gold);
    expect(killed.gas).toBe(1);
    const converted = applyCommand(killed, { type: "convert", amount: 1 }).state;
    expect(converted.gas).toBe(0); expect(converted.gold).toBe(state.gold + RULES.gasGoldRate);
    expect(applyCommand(converted, { type: "convert", amount: 1 }).state).toBe(converted);
  });
  it("Given epic trio When registering Then apocalypse reward is available once without consuming units", () => {
    const state = testGame({ round: 70, units: CLASSES.map((item, index) => makeUnit(index + 1, item.id, "epic")) });
    expect(getCollectionProgress(state).find(item => item.id === "epic-team")?.ready).toBe(true);
    const next = applyCommand(state, { type: "collection", collectionId: "epic-team" }).state;
    expect(next.units).toBe(state.units); expect(next.tickets[0].rarity).toBe("apocalypse");
    expect(applyCommand(next, { type: "collection", collectionId: "epic-team" }).state).toBe(next);
  });
  it("Given threshold kill When ticking again Then milestone rewards occur exactly once", () => {
    const state = testGame({ kills: 49, enemies: [testEnemy({ hp: 1 })], units: [testUnit] });
    const next = advanceGame(state, 50);
    expect(next.killMilestones).toEqual([50]); expect(next.tickets).toHaveLength(1);
    expect(advanceGame(next, 50).tickets).toHaveLength(1); expect(state.tickets).toHaveLength(0);
  });
  it("Given one batch crosses several kill thresholds When rewards resolve Then each threshold pays once and later ticks cannot duplicate it", () => {
    const first = KILL_MILESTONES[0], second = KILL_MILESTONES[1];
    const state = testGame({ kills: first.kills - 1, nextId: 1000, enemies: Array.from({ length: second.kills - first.kills + 1 }, (_, index) => testEnemy({ id: 100 + index, hp: 0 })) });
    const next = advanceGame(state, RULES.tickMs);
    expect(next.kills).toBe(second.kills);
    expect(next.killMilestones).toEqual([first.kills, second.kills]);
    expect(next.gold).toBe(state.gold + first.gold + second.gold);
    expect(next.tickets).toEqual([{ id: 1000, rarity: first.ticket }, { id: 1001, rarity: second.ticket }]);
    const repeated = advanceGame(next, RULES.tickMs);
    expect(repeated.gold).toBe(next.gold);
    expect(repeated.tickets).toEqual(next.tickets);
    expect(repeated.killMilestones).toEqual(next.killMilestones);
    expect(state.kills).toBe(first.kills - 1);
    expect(state.killMilestones).toEqual([]);
    expect(state.tickets).toEqual([]);
  });
  it("Given failed funds or capacity When gambling or exchanging Then RNG and resources do not change", () => {
    const state = testGame({ gold: 0, units: Array.from({ length: 24 }, (_, index) => makeUnit(index + 1, "warrior", "epic")), tickets: [{ id: 30, rarity: "epic" }] });
    expect(applyCommand(state, { type: "ticket", ticketId: 30, classId: "gamble" }).state).toBe(state);
    expect(applyCommand(state, { type: "exchange", unitId: 1, classId: "mage" }).state).toBe(state);
    expect(rarityRank("apocalypse")).toBeGreaterThan(rarityRank("primordial"));
  });
});
