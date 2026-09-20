import { DEFENSE_RULES, MAPS, getRoundConfig } from "./constants";
import { getSpawnShieldRatio } from "./monsters";
import type {
  ClockSpeed,
  DamageNumberEntity,
  DefenseEngine,
  DefenseMap,
  MapId,
  MonsterEntity,
  ProjectileEntity,
  RoundConfig,
} from "./types";
import { DefenseConfigError, parseMapId } from "./types";

function findMap(mapId: string): DefenseMap {
  const validMapId = parseMapId(mapId);
  const map = MAPS.find((candidate) => candidate.id === validMapId);
  if (map === undefined) throw new DefenseConfigError(`Unknown defense map: ${mapId}`);
  return map;
}

function assertNever(value: never): never {
  throw new DefenseConfigError(`Unknown map gimmick: ${String(value)}`);
}

function failWithOverload(engine: DefenseEngine, current: number): void {
  engine.phase = "result";
  engine.outcome = "failure";
  engine.failure = { kind: "overload", current, limit: DEFENSE_RULES.overloadLossCount };
}

function scheduleMs(config: RoundConfig, spawnIndex: number): number {
  return Math.floor(spawnIndex / 2) * config.betweenPairDelayMs + (spawnIndex % 2) * config.withinPairDelayMs;
}

function updateMonster(engine: DefenseEngine, monster: MonsterEntity, deltaMs: number): void {
  if (!monster.active) return;
  const warningMs = Math.min(deltaMs, monster.warningRemainingMs);
  monster.warningRemainingMs -= warningMs;
  const movementMs = deltaMs - warningMs;
  if (movementMs === 0) return;

  const progressRatio = monster.progress / engine.map.pathLength;
  const inGimmickZone = progressRatio >= engine.map.gimmickZone[0] && progressRatio <= engine.map.gimmickZone[1];
  const fastMultiplier = monster.kind === "fast" ? 1.35 : 1;
  switch (engine.map.gimmick) {
    case "slow-zone":
      monster.targetSpeed = monster.baseSpeed * fastMultiplier * (inGimmickZone ? 0.7 : 1);
      break;
    case "mana-spring":
      monster.targetSpeed = monster.baseSpeed * fastMultiplier;
      if (inGimmickZone && !monster.manaSpringTriggered) {
        monster.manaSpringTriggered = true;
        engine.manaGenerated += 1;
      }
      break;
    case "critical-grove":
      monster.targetSpeed = monster.baseSpeed * fastMultiplier;
      monster.vulnerable = inGimmickZone;
      break;
    default:
      assertNever(engine.map.gimmick);
  }

  const linearProgress = Math.min(1, movementMs / DEFENSE_RULES.speedEaseMs);
  const easedProgress = 1 - (1 - linearProgress) ** 2;
  monster.speed += (monster.targetSpeed - monster.speed) * easedProgress;
  monster.progress += monster.speed * movementMs / 1_000;
  if (monster.progress < engine.map.pathLength) return;
  monster.progress %= engine.map.pathLength;
  monster.manaSpringTriggered = false;
}

function advanceCombat(engine: DefenseEngine, deltaMs: number): boolean {
  for (const monster of engine.monsters) updateMonster(engine, monster, deltaMs);
  if (engine.phase === "result") return true;

  const config = getRoundConfig(engine.round);
  const elapsedAfterTick = engine.phaseElapsedMs + deltaMs;
  while (engine.spawnIndex < config.spawnCount && scheduleMs(config, engine.spawnIndex) <= elapsedAfterTick) {
    acquireMonster(engine, config, engine.spawnIndex);
    engine.spawnIndex += 1;
    engine.totalSpawned += 1;
    const active = activeMonsterCount(engine);
    if (active > DEFENSE_RULES.overloadLossCount) {
      failWithOverload(engine, active);
      return true;
    }
  }
  return false;
}

export function createDefenseEngine(mapId: string, startingRound = 1): DefenseEngine {
  if (!Number.isInteger(startingRound) || startingRound < 1 || startingRound > DEFENSE_RULES.totalRounds) {
    throw new DefenseConfigError(`Starting round must be between 1 and ${DEFENSE_RULES.totalRounds}`);
  }
  return {
    map: findMap(mapId), phase: "combat", outcome: null, failure: null, round: startingRound,
    phaseElapsedMs: 0, totalElapsedMs: 0, clockSpeed: 1, lives: DEFENSE_RULES.startingLife,
    leakCount: 0, spawnIndex: 0, totalSpawned: 0, manaGenerated: 0, nextEntityId: 1,
    monsters: [], projectiles: [], damageNumbers: [],
  };
}

export function activeMonsterCount(engine: DefenseEngine): number {
  let count = 0;
  for (const monster of engine.monsters) count += monster.active ? 1 : 0;
  return count;
}

export function acquireMonster(engine: DefenseEngine, config: RoundConfig, spawnIndex: number, personalShieldRoll = ((config.round * 97 + spawnIndex * 53) % 1_000) / 1_000): MonsterEntity {
  let monster = engine.monsters.find((candidate) => !candidate.active);
  if (monster === undefined) {
    monster = {
      id: engine.nextEntityId, active: false, round: 0, kind: "normal", progress: 0, speed: 0,
      targetSpeed: 0, baseSpeed: 0, warningRemainingMs: 0, maxHealth: 0, health: 0,
      maxShield: 0, shield: 0, leakDamage: 1, vulnerable: false, manaSpringTriggered: false,
    };
    engine.nextEntityId += 1;
    engine.monsters.push(monster);
  }
  const boss = config.kind === "boss" && spawnIndex === 0;
  const fast = !boss && spawnIndex % 8 === 7;
  const shieldRatio = getSpawnShieldRatio(config, spawnIndex % config.spawnCount, personalShieldRoll);
  monster.active = true;
  monster.round = config.round;
  monster.kind = boss ? "boss" : fast ? "fast" : "normal";
  monster.progress = 0;
  monster.baseSpeed = config.speed;
  monster.speed = config.speed;
  monster.targetSpeed = config.speed * (fast ? 1.35 : 1);
  monster.warningRemainingMs = fast ? config.fastEnemyResponseMs : 0;
  monster.maxHealth = config.health;
  monster.health = config.health;
  monster.maxShield = config.health * shieldRatio;
  monster.shield = monster.maxShield;
  monster.leakDamage = boss ? 5 : 1;
  monster.vulnerable = false;
  monster.manaSpringTriggered = false;
  return monster;
}

export function defeatMonster(monster: MonsterEntity): void {
  monster.active = false;
}

export function acquireProjectile(engine: DefenseEngine): ProjectileEntity {
  let projectile = engine.projectiles.find((candidate) => !candidate.active);
  if (projectile === undefined) {
    projectile = { id: engine.nextEntityId, active: false, x: 0, y: 0 };
    engine.nextEntityId += 1;
    engine.projectiles.push(projectile);
  }
  projectile.active = true;
  projectile.x = 0;
  projectile.y = 0;
  return projectile;
}

export function releaseProjectile(projectile: ProjectileEntity): void {
  projectile.active = false;
}

export function acquireDamageNumber(engine: DefenseEngine): DamageNumberEntity {
  let damageNumber = engine.damageNumbers.find((candidate) => !candidate.active);
  if (damageNumber === undefined) {
    damageNumber = { id: engine.nextEntityId, active: false, value: 0 };
    engine.nextEntityId += 1;
    engine.damageNumbers.push(damageNumber);
  }
  damageNumber.active = true;
  damageNumber.value = 0;
  return damageNumber;
}

export function releaseDamageNumber(damageNumber: DamageNumberEntity): void {
  damageNumber.active = false;
}

export function setDefenseClockSpeed(engine: DefenseEngine, speed: number): void {
  if (speed !== 1 && speed !== 2) throw new DefenseConfigError("Clock speed must be 1 or 2");
  engine.clockSpeed = speed satisfies ClockSpeed;
}

export function advanceDefenseEngine(engine: DefenseEngine, deltaMs: number): void {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new DefenseConfigError("Delta milliseconds must be finite and non-negative");
  if (engine.phase === "result" || deltaMs === 0) return;
  const active = activeMonsterCount(engine);
  if (active > DEFENSE_RULES.overloadLossCount) {
    failWithOverload(engine, active);
    return;
  }

  let remainingMs = Math.min(deltaMs, DEFENSE_RULES.maxFrameDeltaMs) * engine.clockSpeed;
  while (remainingMs > 0 && engine.phase !== "result") {
    const phaseDurationMs = engine.phase === "combat" ? DEFENSE_RULES.combatMs : DEFENSE_RULES.preparationMs;
    const stepMs = Math.min(remainingMs, phaseDurationMs - engine.phaseElapsedMs);
    const resultReached = engine.phase === "combat" && advanceCombat(engine, stepMs);
    engine.phaseElapsedMs += stepMs;
    engine.totalElapsedMs += stepMs;
    remainingMs -= stepMs;
    if (resultReached) return;
    if (engine.phaseElapsedMs < phaseDurationMs) continue;
    if (engine.phase === "combat") {
      if (engine.round === DEFENSE_RULES.totalRounds) {
        engine.phase = "result";
        engine.outcome = "clear";
      } else {
        engine.phase = "preparation";
        engine.phaseElapsedMs = 0;
      }
    } else {
      engine.round += 1;
      engine.phase = "combat";
      engine.phaseElapsedMs = 0;
      engine.spawnIndex = 0;
    }
  }
}

export function restartDefenseEngine(engine: DefenseEngine): void {
  for (const monster of engine.monsters) monster.active = false;
  for (const projectile of engine.projectiles) projectile.active = false;
  for (const damageNumber of engine.damageNumbers) damageNumber.active = false;
  engine.phase = "combat";
  engine.outcome = null;
  engine.failure = null;
  engine.round = 1;
  engine.phaseElapsedMs = 0;
  engine.totalElapsedMs = 0;
  engine.clockSpeed = 1;
  engine.lives = DEFENSE_RULES.startingLife;
  engine.leakCount = 0;
  engine.spawnIndex = 0;
  engine.totalSpawned = 0;
  engine.manaGenerated = 0;
}

export type { DefenseEngine, MapId };
export { damageMonster } from "./monsters";
