import { createGame, makeUnit, startGame } from "./engine";
import type { DefenseEnemy, DefenseState } from "./engine";
export const testUnit = { ...makeUnit(1, "warrior", "common"), position: { x: 100, y: 90 } };
export function testEnemy(overrides: Partial<DefenseEnemy> = {}): DefenseEnemy {
  return { id: 100, round: 1, name: "target", size: "large", progress: 0, hp: 1_000, maxHp: 1_000, shield: 0, maxShield: 0, armor: 0, isBoss: false, deadlineMs: null, lockedUntilMs: 0, slowedUntilMs: 0, gasReward: 1, ...overrides };
}
export function testGame(overrides: Partial<DefenseState> = {}): DefenseState {
  return { ...startGame(createGame(7)), spawnedThisRound: 8, ...overrides };
}
