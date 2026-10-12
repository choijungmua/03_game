import { CLASSES, RULES, advanceGame, applyCommand, createGame, getCollectionProgress, getUnitStats, getUpgradeCost, getWaveInfo, rarityRank, startGame } from "./engine";
import type { DefenseClass, DefenseState } from "./engine";

export type SimulationPolicy = "balanced" | "ranged" | "no-spend" | "no-upgrades" | "no-apocalypse";
export type SimulationResult = {
  seed: number; policy: SimulationPolicy; phase: string; failedRound: number | null; elapsedMs: number; kills: number;
  maxPopulation: number; gold: number; gas: number; maxApocalypseDeployed: number; classLevels: Record<DefenseClass, number>;
  populationByQuarter: number[];
  finalRound: number; finalSpawned: number; finalBossDefeated: boolean; remainingEnemies: number;
  bosses: { id: number; round: number; appearedMs: number; defeatedMs: number | null }[];
  economy: { round: number; gold: number; units: number; kills: number; tickets: number }[];
  collections: { id: string; round: number }[];
};
export function applyPolicy(input: DefenseState, policy: SimulationPolicy): DefenseState {
  if (policy === "no-spend" || input.phase !== "playing") return input;
  let state = input;
  if (state.gas > 0) state = applyCommand(state, { type: "convert", amount: state.gas }).state;
  for (const collection of getCollectionProgress(state).filter(item => item.ready)) state = applyCommand(state, { type: "collection", collectionId: collection.id }).state;
  for (const ticket of state.tickets) {
    if (policy === "no-apocalypse" && ticket.rarity === "apocalypse") continue;
    if (state.units.length >= RULES.maxUnits) {
      const weakest = state.units.filter(unit => rarityRank(unit.rarity) < 5).sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity))[0];
      if (!weakest) break;
      state = applyCommand(state, { type: "sell", unitId: weakest.id }).state;
    }
    const chosen = [...CLASSES].sort((a, b) => {
      const count = (classId: DefenseClass) => state.units.filter(unit => unit.classId === classId && rarityRank(unit.rarity) >= rarityRank(ticket.rarity)).length;
      return count(a.id) - count(b.id);
    })[0].id;
    state = applyCommand(state, { type: "ticket", ticketId: ticket.id, classId: chosen }).state;
  }
  const targetUnits = policy === "ranged" ? 18 : 22;
  while (state.units.length < targetUnits && state.gold >= RULES.summonCost) state = applyCommand(state, { type: "summon" }).state;
  for (const unit of state.units.filter(item => item.cellIndex === null && (item.position === null || item.position.x === RULES.boardWidth / 2 && item.position.y === RULES.boardHeight / 2))) {
    if (policy === "no-apocalypse" && unit.rarity === "apocalypse") { state = { ...state, units: state.units.map(item => item.id === unit.id ? { ...item, position: null } : item) }; continue; }
    state = applyCommand(state, { type: "move", unitIds: [unit.id], x: 130 + (unit.id % 4) * 80, y: 90 }).state;
  }
  if (policy !== "no-upgrades") {
    for (let count = 0; count < RULES.maxUpgradeLevel * CLASSES.length; count += 1) {
      const next = [...CLASSES].filter(item => state.classLevels[item.id] < RULES.maxUpgradeLevel && state.units.some(unit => unit.classId === item.id)).sort((a, b) => {
        const weight = (classId: DefenseClass) => policy === "ranged" && classId === "archer" ? 1.5 : 1;
        return state.classLevels[a.id] / weight(a.id) - state.classLevels[b.id] / weight(b.id);
      })[0];
      if (!next || state.gold < getUpgradeCost(state, next.id)) break;
      state = applyCommand(state, { type: "upgrade", classId: next.id }).state;
    }
  }
  const boss = state.enemies.find(enemy => enemy.isBoss);
  if (boss && state.units.length > 0) {
    state = applyCommand(state, { type: "focus", unitIds: state.units.map(unit => unit.id), enemyId: boss.id }).state;
    for (const unit of state.units.filter(item => getUnitStats(state, item).ability !== null && item.mana >= RULES.abilityMana)) state = applyCommand(state, { type: "ability", unitId: unit.id, enemyId: boss.id }).state;
  }
  return state;
}
export function simulateGame(seed: number, policy: SimulationPolicy): SimulationResult {
  let state = startGame(createGame(seed));
  let maxPopulation = 0;
  const populationByQuarter = [0, 0, 0, 0];
  let maxApocalypseDeployed = 0;
  const bosses: SimulationResult["bosses"] = [];
  const economy: SimulationResult["economy"] = [];
  const collections: SimulationResult["collections"] = [];
  while (state.phase === "playing" && state.elapsedMs < RULES.roundDurationMs * RULES.totalRounds + RULES.bossDurationMs * 2) {
    if (state.elapsedMs % 1_000 === 0) {
      state = applyPolicy(state, policy);
      for (const id of state.registeredCollections) if (!collections.some(item => item.id === id)) collections.push({ id, round: state.round });
      maxApocalypseDeployed = Math.max(maxApocalypseDeployed, state.units.filter(unit => unit.rarity === "apocalypse" && unit.position !== null).length);
    }
    if (economy.at(-1)?.round !== state.round) economy.push({ round: state.round, gold: state.gold, units: state.units.length, kills: state.kills, tickets: state.tickets.length });
    const before = state;
    state = advanceGame(state, RULES.tickMs);
    maxPopulation = Math.max(maxPopulation, state.enemies.length);
    const quarter = Math.min(3, Math.floor((state.round - 1) / 30));
    populationByQuarter[quarter] = Math.max(populationByQuarter[quarter], state.enemies.length);
    for (let index = before.spawnedThisRound; index < getWaveInfo(before.round).bossCount && before.roundElapsedMs + RULES.tickMs >= index * RULES.spawnIntervalMs; index += 1) {
      bosses.push({ id: before.nextId + index - before.spawnedThisRound, round: before.round, appearedMs: state.elapsedMs, defeatedMs: null });
    }
    for (const boss of bosses) if (boss.defeatedMs === null && !state.enemies.some(enemy => enemy.id === boss.id)) boss.defeatedMs = state.elapsedMs;
  }
  return { seed, policy, phase: state.phase, failedRound: state.phase === "lost" ? state.round : null, elapsedMs: state.elapsedMs, kills: state.kills, maxPopulation, populationByQuarter, gold: state.gold, gas: state.gas, maxApocalypseDeployed, classLevels: state.classLevels, bosses, economy, collections,
    finalRound: state.round, finalSpawned: state.spawnedThisRound, finalBossDefeated: state.finalBossDefeated, remainingEnemies: state.enemies.length };
}
export const SIMULATION_SEEDS = Array.from({ length: 16 }, (_, index) => index + 1);
