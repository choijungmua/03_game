export type DefenseClass = "warrior" | "archer" | "mage";
export type DefenseRarity = "common" | "rare" | "ancient" | "relic" | "saga" | "legendary" | "epic" | "mythic" | "primordial" | "apocalypse";
export type DefensePhase = "idle" | "playing" | "paused" | "won" | "lost";
export type AttackType = "normal" | "explosive" | "concussive";
export type EnemySize = "small" | "medium" | "large";
export type Ability = "lockdown" | "ensnare" | "emp";
export type Point = { x: number; y: number };
export type DefenseUnit = {
  id: number; classId: DefenseClass; rarity: DefenseRarity; cellIndex: number | null;
  position: Point | null; cooldownMs: number; mana: number; focusEnemyId: number | null;
};
export type DefenseEnemy = {
  id: number; round: number; name: string; size: EnemySize; progress: number; hp: number; maxHp: number;
  shield: number; maxShield: number; armor: number; isBoss: boolean; deadlineMs: number | null;
  lockedUntilMs: number; slowedUntilMs: number; gasReward: number;
};
export type RewardTicket = { id: number; rarity: DefenseRarity };
export type DefenseState = {
  phase: DefensePhase; seed: number; rngState: number; round: number; elapsedMs: number; roundElapsedMs: number;
  gold: number; gas: number; kills: number; units: DefenseUnit[]; enemies: DefenseEnemy[];
  classLevels: Record<DefenseClass, number>; nextId: number; spawnedThisRound: number;
  finalBossDefeated: boolean; resultReason: string | null; tickRemainderMs: number; speed: 1 | 2 | 4;
  tickets: RewardTicket[]; registeredCollections: string[]; killMilestones: number[];
};
export type ActionResult = { readonly state: DefenseState; readonly error: string | null };
export type DefenseCommand =
  | { type: "start" } | { type: "pause" } | { type: "resume" } | { type: "summon" }
  | { type: "move"; unitIds: number[]; x: number; y: number }
  | { type: "focus"; unitIds: number[]; enemyId: number | null }
  | { type: "sell"; unitId: number }
  | { type: "upgrade"; classId: DefenseClass }
  | { type: "speed"; speed: 1 | 2 | 4 }
  | { type: "ticket"; ticketId: number; classId: DefenseClass | "gamble" }
  | { type: "exchange"; unitId: number; classId: DefenseClass }
  | { type: "convert"; amount: number }
  | { type: "collection"; collectionId: string }
  | { type: "ability"; unitId: number; enemyId: number };
