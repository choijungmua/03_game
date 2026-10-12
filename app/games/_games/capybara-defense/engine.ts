import type { ActionResult, DefenseState } from "./defense-model";
import { CELLS, RULES, getWaveInfo } from "./defense-rules";
import { fight, spawnWave } from "./defense-combat";
export type * from "./defense-model";
export * from "./defense-rules";
export * from "./defense-economy";
export { castAbility } from "./defense-combat";
export { applyCommand, parseDefenseCommand } from "./defense-commands";

export function createGame(seed: number): DefenseState {
  const normalizedSeed = Number.isFinite(seed) ? seed >>> 0 : 1;
  return {
    phase: "idle", seed: normalizedSeed, rngState: normalizedSeed, round: 1, elapsedMs: 0, roundElapsedMs: 0,
    gold: RULES.startingGold, gas: 0, kills: 0, units: [], enemies: [], classLevels: { warrior: 0, archer: 0, mage: 0 },
    nextId: 1, spawnedThisRound: 0, finalBossDefeated: false, resultReason: null, tickRemainderMs: 0,
    speed: 1, tickets: [], registeredCollections: [], killMilestones: [],
  };
}
export function startGame(state: DefenseState): DefenseState { return state.phase === "idle" ? { ...state, phase: "playing" } : state; }
export function pauseGame(state: DefenseState): DefenseState { return state.phase === "playing" ? { ...state, phase: "paused" } : state; }
export function resumeGame(state: DefenseState): DefenseState { return state.phase === "paused" ? { ...state, phase: "playing" } : state; }
export function placeUnit(state: DefenseState, id: number, cellIndex: number): ActionResult {
  if (state.phase !== "playing") return { state, error: "전투 중에 배치할 수 있어요." };
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= CELLS.length) return { state, error: "배치할 칸을 선택해 주세요." };
  if (!state.units.some(unit => unit.id === id)) return { state, error: "유닛을 선택해 주세요." };
  if (state.units.some(unit => unit.cellIndex === cellIndex && unit.id !== id)) return { state, error: "이미 유닛이 있는 칸이에요." };
  return { state: { ...state, units: state.units.map(unit => unit.id === id ? { ...unit, cellIndex, position: null } : unit) }, error: null };
}
function tick(state: DefenseState): void {
  state.elapsedMs += RULES.tickMs;
  state.roundElapsedMs += RULES.tickMs;
  spawnWave(state);
  fight(state);
  if (state.round === RULES.totalRounds && state.spawnedThisRound === getWaveInfo(state.round).count && state.finalBossDefeated && state.enemies.length === 0) {
    state.phase = "won"; state.resultReason = "120라운드의 모든 적을 물리쳤어요."; return;
  }
  if (state.enemies.some(enemy => enemy.deadlineMs !== null && enemy.deadlineMs <= state.elapsedMs)) {
    state.phase = "lost"; state.resultReason = "보스 제한 시간이 끝났어요."; return;
  }
  if (state.enemies.length >= RULES.enemyLimit) {
    state.phase = "lost"; state.resultReason = "적이 너무 많이 쌓였어요."; return;
  }
  if (state.roundElapsedMs >= RULES.roundDurationMs && state.round < RULES.totalRounds) {
    state.round += 1; state.roundElapsedMs = 0; state.spawnedThisRound = 0; state.gold += RULES.roundGold;
  }
}
export function advanceGame(state: DefenseState, deltaMs: number): DefenseState {
  if (state.phase !== "playing" || !Number.isFinite(deltaMs) || deltaMs <= 0) return state;
  const next: DefenseState = { ...state, units: state.units.map(unit => ({ ...unit })), enemies: state.enemies.map(enemy => ({ ...enemy })),
    tickets: [...state.tickets], killMilestones: [...state.killMilestones], tickRemainderMs: state.tickRemainderMs + deltaMs * state.speed };
  while (next.tickRemainderMs >= RULES.tickMs && next.phase === "playing") { next.tickRemainderMs -= RULES.tickMs; tick(next); }
  if (next.phase !== "playing") next.tickRemainderMs = 0;
  return next;
}
