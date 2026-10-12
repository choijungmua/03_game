import { beforeEach, describe, expect, it, vi } from "vitest";
import { playGameSound } from "@/lib/lobby/settings";
import { GAME_SOUNDS } from "@/lib/games/constants";
import { advanceGame, applyCommand, createGame, makeUnit, startGame, summonUnit } from "./engine";
import type { DefenseRarity, DefenseState } from "./engine";
import { testEnemy, testGame, testUnit } from "./defense-test-fixtures";
import { createDefenseAudio } from "./audio";

vi.mock("@/lib/lobby/settings", () => ({ playGameSound: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
describe("defense sound events", () => {
  it("waits for a gesture and routes summon feedback through shared settings", () => {
    const audio = createDefenseAudio(), state = startGame(createGame(7));
    audio.observe(state, 0);
    const summoned = summonUnit(state).state;
    audio.observe(summoned, 10);
    expect(playGameSound).not.toHaveBeenCalled();
    audio.unlock();
    audio.observe(summonUnit(summoned).state, 20);
    expect(playGameSound).toHaveBeenCalledWith(GAME_SOUNDS.pickup);
  });
  it("rate limits attacks and does not replay unchanged snapshots", () => {
    const audio = createDefenseAudio(); audio.unlock();
    const state = summonUnit(startGame(createGame(7))).state;
    audio.observe(state, 0);
    const attack = { ...state, units: state.units.map(unit => ({ ...unit, cooldownMs: 100 })) };
    audio.observe(attack, 10); audio.observe(attack, 11);
    audio.observe({ ...attack, units: attack.units.map(unit => ({ ...unit, cooldownMs: 200 })) }, 20);
    expect(playGameSound).toHaveBeenCalledTimes(1);
    expect(playGameSound).toHaveBeenCalledWith(GAME_SOUNDS.hit);
  });
  const raritySounds = [
    ["common", GAME_SOUNDS.pickup], ["rare", GAME_SOUNDS.pickup], ["saga", GAME_SOUNDS.pickup],
    ["legendary", GAME_SOUNDS.record], ["epic", GAME_SOUNDS.record], ["mythic", GAME_SOUNDS.record],
    ["primordial", GAME_SOUNDS.record], ["apocalypse", GAME_SOUNDS.record],
  ] as const satisfies readonly (readonly [DefenseRarity, readonly unknown[]])[];
  it.each(raritySounds)("Given a %s ticket When redeemed Then plays its acquisition cue once", (rarity, sound) => {
    const audio = createDefenseAudio(); audio.unlock();
    const state = testGame({ nextId: 2, tickets: [{ id: 1, rarity }] });
    audio.observe(state, 0);
    audio.observe(applyCommand(state, { type: "ticket", ticketId: 1, classId: "mage" }).state, 10);
    expect(vi.mocked(playGameSound).mock.calls).toEqual([[sound]]);
  });
  const rewardScenarios: readonly { name: string; before: DefenseState; earn: (state: DefenseState) => DefenseState }[] = [
    { name: "boss", before: testGame({ nextId: 200, units: [testUnit], enemies: [testEnemy({ hp: 1, isBoss: true, round: 100 })] }), earn: state => advanceGame(state, 50) },
    { name: "milestone", before: testGame({ nextId: 200, kills: 49, units: [testUnit], enemies: [testEnemy({ hp: 1 })] }), earn: state => advanceGame(state, 50) },
    { name: "collection", before: testGame({ nextId: 4, units: [makeUnit(1, "warrior", "common"), makeUnit(2, "archer", "common"), makeUnit(3, "mage", "common")] }), earn: state => applyCommand(state, { type: "collection", collectionId: "first-team" }).state },
  ];
  it.each(rewardScenarios)("Given a $name reward When earned Then its chime takes priority over attacks", ({ before, earn }) => {
    const audio = createDefenseAudio(); audio.unlock(); audio.observe(before, 0);
    const after = earn(before);
    audio.observe(after, 50);
    expect(after.tickets).toHaveLength(1);
    expect(vi.mocked(playGameSound).mock.calls).toEqual([[GAME_SOUNDS.correct]]);
  });
  it("Given several tickets in one tick When earned Then coalesces the rewards into one chime", () => {
    const audio = createDefenseAudio(); audio.unlock();
    const state = testGame({ nextId: 200, kills: 49, units: [testUnit], enemies: [testEnemy({ hp: 1, isBoss: true })] });
    audio.observe(state, 0);
    const next = advanceGame(state, 50);
    audio.observe(next, 50);
    expect(next.tickets).toHaveLength(2);
    expect(vi.mocked(playGameSound).mock.calls).toEqual([[GAME_SOUNDS.correct]]);
  });
  it("Given a rare acquisition alongside a ticket When observed Then only the rare chime plays", () => {
    const audio = createDefenseAudio(); audio.unlock(); audio.observe(testGame(), 0);
    audio.observe(testGame({ nextId: 4, units: [makeUnit(1, "mage", "common"), makeUnit(2, "mage", "legendary")], tickets: [{ id: 3, rarity: "rare" }] }), 50);
    expect(vi.mocked(playGameSound).mock.calls).toEqual([[GAME_SOUNDS.record]]);
  });
  it.each(["won", "lost"] as const)("Given %s alongside rewards When observed Then only the result cue plays", phase => {
    const audio = createDefenseAudio(); audio.unlock(); audio.observe(testGame(), 0);
    audio.observe(testGame({ phase, nextId: 3, units: [makeUnit(1, "mage", "legendary")], tickets: [{ id: 2, rarity: "rare" }] }), 50);
    expect(vi.mocked(playGameSound).mock.calls).toEqual([[phase === "won" ? GAME_SOUNDS.success : GAME_SOUNDS.fail]]);
  });
  it("Given rewards already present on join When observing or unlocking Then stays silent", () => {
    const audio = createDefenseAudio();
    const joined = testGame({ elapsedMs: 5000, nextId: 3, units: [makeUnit(1, "mage", "legendary")], tickets: [{ id: 2, rarity: "rare" }] });
    audio.observe(joined, 0); audio.unlock();
    audio.observe({ ...joined }, 50);
    expect(playGameSound).not.toHaveBeenCalled();
  });
  it("Given locked rewards When unlocking and observing the same rewards Then does not replay them", () => {
    const audio = createDefenseAudio(); audio.observe(testGame(), 0);
    const reward = testGame({ nextId: 3, units: [makeUnit(1, "mage", "legendary")], tickets: [{ id: 2, rarity: "rare" }] });
    audio.observe(reward, 10); audio.unlock();
    audio.observe({ ...reward }, 20);
    expect(playGameSound).not.toHaveBeenCalled();
  });
  it.each([0, 50])("Given old snapshots %i ms behind When replayed between rewards Then no reward repeats", elapsedMs => {
    const audio = createDefenseAudio(); audio.unlock();
    const before = testGame({ elapsedMs: 100 });
    const reward = { ...before, elapsedMs: 100 + elapsedMs, nextId: 3, units: [makeUnit(1, "mage", "legendary")], tickets: [{ id: 2, rarity: "rare" as const }] };
    audio.observe(before, 0); audio.observe(reward, 10); vi.clearAllMocks();
    audio.observe({ ...before }, 20); audio.observe({ ...reward }, 30); audio.observe(reward, 40);
    expect(playGameSound).not.toHaveBeenCalled();
  });
  it("Given a retry with reused ids When starting again Then only newly acquired rewards play", () => {
    const audio = createDefenseAudio(); audio.unlock();
    audio.observe(testGame({ elapsedMs: 5000, nextId: 3, units: [makeUnit(1, "mage", "legendary")], tickets: [{ id: 2, rarity: "rare" }] }), 0);
    const fresh = startGame(createGame(7));
    audio.observe(fresh, 10); audio.observe({ ...fresh }, 20);
    expect(playGameSound).not.toHaveBeenCalled();
    audio.observe(summonUnit(fresh).state, 30);
    expect(vi.mocked(playGameSound).mock.calls).toEqual([[GAME_SOUNDS.pickup]]);
  });
  it("Given a new seed with existing rewards When joining Then establishes a silent baseline", () => {
    const audio = createDefenseAudio(); audio.unlock(); audio.observe(testGame(), 0);
    audio.observe(testGame({ seed: 9, elapsedMs: 5000, nextId: 3, units: [makeUnit(1, "mage", "legendary")], tickets: [{ id: 2, rarity: "rare" }] }), 50);
    expect(playGameSound).not.toHaveBeenCalled();
  });
});
