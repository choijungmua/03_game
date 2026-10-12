import type { Ability, AttackType, DefenseClass, DefenseRarity, DefenseState, DefenseUnit, EnemySize } from "./defense-model";

export const RULES = {
  tickMs: 50, totalRounds: 120, boardWidth: 720, boardHeight: 480,
  summonCost: 10, maxUnits: 24, enemyLimit: 80, startingGold: 120,
  roundDurationMs: 6_000, bossDurationMs: 30_000, bossEvery: 10,
  enemiesPerRound: 8, spawnIntervalMs: 650, killGold: 0, bossGold: 35, roundGold: 15,
  maxUpgradeLevel: 20, upgradeBaseCost: 35, upgradeCostGrowth: 1.2, upgradeDamage: 0.3,
  enemyLoopMs: 28_000, enemyBaseHp: 24, enemyLinearHp: 2.1, enemyQuadraticHp: 0.25, bossHpMultiplier: 10,
  gasGoldRate: 3, abilityMana: 50, maxMana: 100, manaPerSecond: 5, exchangeCost: 80, exchangeChance: 0.65, ticketGambleChance: 0.3,
} as const;
export const CLASSES = [
  { id: "warrior", label: "전사", damage: 24, range: 170, attackMs: 700, splashRadius: 0, attackType: "normal", upgradeCost: 35, growth: 0.3, ability: "lockdown" },
  { id: "archer", label: "궁수", damage: 13, range: 300, attackMs: 450, splashRadius: 0, attackType: "concussive", upgradeCost: 30, growth: 0.34, ability: "ensnare" },
  { id: "mage", label: "마법사", damage: 14, range: 220, attackMs: 1_100, splashRadius: 105, attackType: "explosive", upgradeCost: 40, growth: 0.38, ability: "emp" },
] as const;
export const RARITIES = [
  { id: "common", label: "일반", weight: 65, damageMultiplier: 1, sellGold: 5 },
  { id: "rare", label: "레어", weight: 24, damageMultiplier: 1.5, sellGold: 6 },
  { id: "ancient", label: "고대", weight: 7, damageMultiplier: 2, sellGold: 7 },
  { id: "relic", label: "유물", weight: 2.5, damageMultiplier: 2.6, sellGold: 8 },
  { id: "saga", label: "서사", weight: 1, damageMultiplier: 3.3, sellGold: 9 },
  { id: "legendary", label: "전설", weight: 0.4, damageMultiplier: 5, sellGold: 0 },
  { id: "epic", label: "에픽", weight: 0.08, damageMultiplier: 6.5, sellGold: 0 },
  { id: "mythic", label: "신화", weight: 0.019, damageMultiplier: 8.5, sellGold: 0 },
  { id: "primordial", label: "태초", weight: 0.0009, damageMultiplier: 11, sellGold: 0 },
  { id: "apocalypse", label: "종말", weight: 0.0001, damageMultiplier: 15, sellGold: 0 },
] as const;
export const CELLS = Array.from({ length: RULES.maxUnits }, (_, index) => ({ index, x: 110 + (index % 6) * 100, y: 90 + Math.floor(index / 6) * 100 }));
export const DAMAGE_MATCHUPS: Record<AttackType, Record<EnemySize, number>> = {
  normal: { small: 1, medium: 1, large: 1 }, explosive: { small: 0.5, medium: 0.75, large: 1 }, concussive: { small: 1, medium: 0.5, large: 0.25 },
};
export function classStats(id: DefenseClass) { return CLASSES.find(item => item.id === id) ?? CLASSES[0]; }
export function rarityStats(id: DefenseRarity) { return RARITIES.find(item => item.id === id) ?? RARITIES[0]; }
export function rarityRank(id: DefenseRarity): number { return RARITIES.findIndex(item => item.id === id); }
export function getWavePressure(round: number): number { return 1 + 5.5 * (Math.max(0, Math.min(120, round) - 30) / 90) ** 1.5; }
export function getUpgradeCost(state: DefenseState, classId: DefenseClass): number { return Math.ceil(classStats(classId).upgradeCost * RULES.upgradeCostGrowth ** state.classLevels[classId]); }
export function getUnitStats(state: DefenseState, unit: DefenseUnit) {
  const stats = classStats(unit.classId);
  const rank = rarityRank(unit.rarity);
  const ability: Ability | null = rank >= 6 ? stats.ability : null;
  return {
    damage: stats.damage * rarityStats(unit.rarity).damageMultiplier * (1 + state.classLevels[unit.classId] * stats.growth),
    range: stats.range + rank * (unit.classId === "warrior" ? 13 : 9),
    attackMs: Math.round(stats.attackMs / (1 + rank * (unit.classId === "archer" ? 0.09 : 0.045))),
    splashRadius: stats.splashRadius + (unit.classId === "mage" ? rank * 7 : rank >= 4 ? rank * 5 : 0),
    attackType: rank >= 8 ? "normal" as const : stats.attackType, bypassArmor: rank >= 7, ability,
  };
}
export function getUnitDamage(state: DefenseState, unit: DefenseUnit): number { return getUnitStats(state, unit).damage; }
export function getUnitPoint(unit: DefenseUnit) { return unit.position ?? (unit.cellIndex === null ? null : CELLS[unit.cellIndex] ?? null); }
export function getEnemyPoint(progress: number): { x: number; y: number } {
  const distance = (((progress % 1) + 1) % 1) * 2_160;
  if (distance < 660) return { x: 30 + distance, y: 30 };
  if (distance < 1_080) return { x: 690, y: 30 + distance - 660 };
  if (distance < 1_740) return { x: 690 - (distance - 1_080), y: 450 };
  return { x: 30, y: 450 - (distance - 1_740) };
}
const WAVE_TYPES = [
  { name: "갈대 들쥐", size: "small", armor: 0, shieldRatio: 0 },
  { name: "늪지 멧돼지", size: "medium", armor: 2, shieldRatio: 0 },
  { name: "바위 거북", size: "large", armor: 5, shieldRatio: 0 },
  { name: "수정 반딧불", size: "small", armor: 1, shieldRatio: 0.35 },
  { name: "갑옷 악어", size: "large", armor: 8, shieldRatio: 0.2 },
  { name: "안개 늑대", size: "medium", armor: 3, shieldRatio: 0.5 },
] as const;
export function getWaveInfo(round: number) {
  const wave = WAVE_TYPES[(Math.max(1, round) - 1) % WAVE_TYPES.length] ?? WAVE_TYPES[0];
  const bossCount = round % 30 === 0 && round !== 120 ? 2 : round % 10 === 0 ? 1 : 0;
  const bonus = round % 15 === 0 && bossCount === 0;
  const rewardRarity: DefenseRarity = round >= 100 ? "primordial" : round >= 80 ? "mythic" : round >= 60 ? "epic" : round >= 40 ? "legendary" : round >= 20 ? "saga" : "relic";
  return { ...wave, round, name: bonus ? "황금 연못" : wave.name, bonus, bossCount, count: RULES.enemiesPerRound + bossCount,
    bossName: round === 120 ? "심연의 군주" : round % 30 === 0 ? "쌍둥이 수호자" : round % 20 === 0 ? "수정 여왕" : "늪지 파수꾼", rewardRarity,
    bossDurationMs: round % 30 === 0 ? 35_000 : RULES.bossDurationMs };
}
export const COLLECTIONS = [
  { id: "first-team", label: "첫 수비대", minimumRank: 0, gold: 60, ticket: "ancient" },
  { id: "ancient-team", label: "고대의 동료", minimumRank: 2, gold: 100, ticket: "legendary" },
  { id: "legendary-team", label: "전설의 수비대", minimumRank: 5, gold: 150, ticket: "mythic" },
  { id: "epic-team", label: "지원 전문가", minimumRank: 6, gold: 200, ticket: "apocalypse" },
] as const;
export function getCollectionProgress(state: DefenseState) {
  return COLLECTIONS.map(collection => {
    const classes = CLASSES.filter(item => state.units.some(unit => unit.classId === item.id && rarityRank(unit.rarity) >= collection.minimumRank)).map(item => item.id);
    return { ...collection, classes, current: classes.length, required: 3, registered: state.registeredCollections.includes(collection.id), ready: classes.length === 3 && !state.registeredCollections.includes(collection.id) };
  });
}
export const KILL_MILESTONES = [{ kills: 50, gold: 40, ticket: "rare" }, { kills: 200, gold: 80, ticket: "saga" }, { kills: 500, gold: 120, ticket: "epic" }, { kills: 800, gold: 160, ticket: "mythic" }] as const;
export function random(state: DefenseState): number {
  state.rngState = (state.rngState + 0x6d2b79f5) >>> 0;
  let value = state.rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
}
