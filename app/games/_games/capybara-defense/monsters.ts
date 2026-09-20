import { DEFENSE_RULES, getRoundConfig } from "./constants";
import type {
  MonsterDamageInput,
  MonsterDamageResult,
  MonsterEntity,
  MonsterVitals,
  PopulationAlert,
  RoundConfig,
  WavePreview,
} from "./types";
import { DefenseConfigError } from "./types";

function requireFiniteRange(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new DefenseConfigError(`${name} must be between ${minimum} and ${maximum}`);
  }
}

function validateVitals(vitals: MonsterVitals): void {
  requireFiniteRange("Health", vitals.health, 0, vitals.maxHealth);
  requireFiniteRange("Shield", vitals.shield, 0, vitals.maxShield);
  if (vitals.maxHealth <= 0 || vitals.maxShield < 0) {
    throw new DefenseConfigError("Maximum health must be positive and maximum shield cannot be negative");
  }
}

export function getSpawnShieldRatio(config: RoundConfig, spawnIndex: number, personalShieldRoll: number): number {
  if (!Number.isInteger(spawnIndex) || spawnIndex < 0 || spawnIndex >= config.spawnCount) {
    throw new DefenseConfigError("Spawn index must identify a monster in the round");
  }
  requireFiniteRange("Personal shield roll", personalShieldRoll, 0, 1);
  if (config.kind === "boss") {
    if (config.boss === null) throw new DefenseConfigError("Boss rounds require a boss definition");
    return spawnIndex === 0
      ? config.shieldRatio * config.boss.shieldMultiplier
      : 0;
  }
  if (config.kind === "shield") {
    return spawnIndex < Math.ceil(config.spawnCount * config.shieldRatio)
      ? DEFENSE_RULES.standardShieldHealthRatio
      : 0;
  }
  return personalShieldRoll < config.personalShieldChance
    ? DEFENSE_RULES.standardShieldHealthRatio
    : 0;
}

export function applyMonsterDamage(vitals: MonsterVitals, input: MonsterDamageInput): MonsterDamageResult {
  validateVitals(vitals);
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new DefenseConfigError("Monster damage must be finite and non-negative");
  }
  const effectiveDamage = input.kind === "shield-break" && vitals.shield > 0
    ? input.amount * DEFENSE_RULES.shieldBreakDamageMultiplier
    : input.amount;
  const shieldDamage = Math.min(vitals.shield, effectiveDamage);
  const healthDamage = Math.min(vitals.health, effectiveDamage - shieldDamage);
  return {
    vitals: {
      health: vitals.health - healthDamage,
      maxHealth: vitals.maxHealth,
      shield: vitals.shield - shieldDamage,
      maxShield: vitals.maxShield,
    },
    shieldDamage,
    healthDamage,
    shieldBroken: vitals.shield > 0 && shieldDamage === vitals.shield,
  };
}

export function damageMonster(monster: MonsterEntity, input: MonsterDamageInput): MonsterDamageResult {
  const result = applyMonsterDamage({
    health: monster.health,
    maxHealth: monster.maxHealth,
    shield: monster.shield,
    maxShield: monster.maxShield,
  }, input);
  monster.health = result.vitals.health;
  monster.shield = result.vitals.shield;
  if (monster.health === 0) monster.active = false;
  return result;
}

export function getNextWavePreview(currentRound: number): WavePreview | null {
  if (!Number.isInteger(currentRound) || currentRound < 0 || currentRound > DEFENSE_RULES.totalRounds) {
    throw new DefenseConfigError(`Current round must be between 0 and ${DEFENSE_RULES.totalRounds}`);
  }
  if (currentRound === DEFENSE_RULES.totalRounds) return null;
  const config = getRoundConfig(currentRound + 1);
  const boss = config.boss;
  const keyTraits = [
    config.theme.special,
    config.armor > 0 ? `방어 ${config.armor}` : "기본 방어",
    config.kind === "boss"
      ? `보스 보호막 ${Math.round(config.shieldRatio * 100)}%`
      : config.kind === "shield"
        ? `보호막 ${Math.round(config.shieldRatio * 100)}%`
        : "보호막 없음",
  ];
  return {
    round: config.round,
    count: config.spawnCount,
    kind: config.kind,
    keyTraits,
    shieldRatio: config.shieldRatio,
    isBoss: boss !== null,
    boss: boss === null ? null : {
      name: boss.name,
      abilityName: boss.abilityName,
      warningText: boss.warningText,
      warningMs: boss.windupMs,
    },
  };
}

export function getPopulationAlert(count: number): PopulationAlert {
  if (!Number.isInteger(count) || count < 0) {
    throw new DefenseConfigError("Alive monster count must be a non-negative integer");
  }
  if (count > DEFENSE_RULES.overloadLossCount) {
    return {
      count,
      level: "failure",
      text: `방어 실패! 몬스터 ${count} / ${DEFENSE_RULES.overloadLossCount}`,
      icon: "danger-paw",
      sound: "defense-failure",
      shouldFail: true,
    };
  }
  if (count >= DEFENSE_RULES.overloadDangerCount) {
    return {
      count,
      level: "danger",
      text: `매우 위험! 몬스터 ${count} / ${DEFENSE_RULES.overloadLossCount}`,
      icon: "danger-paw",
      sound: "population-danger",
      shouldFail: false,
    };
  }
  if (count >= DEFENSE_RULES.overloadWarningCount) {
    return {
      count,
      level: "warning",
      text: `주의! 몬스터 ${count} / ${DEFENSE_RULES.overloadLossCount}`,
      icon: "warning-paw",
      sound: "population-warning",
      shouldFail: false,
    };
  }
  return { count, level: "safe", text: "몬스터 수 안정", icon: "none", sound: "none", shouldFail: false };
}
