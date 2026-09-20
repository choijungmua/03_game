import type {
  BossDefinition,
  DefenseMap,
  EquipmentSlot,
  HeroClass,
  HeroStats,
  HeroTier,
  MonsterTheme,
  ProbabilityTable,
  RoundConfig,
  SkillDefinition,
} from "./types";
import { DefenseConfigError } from "./types";
import { getMonsterTheme } from "./assets";

export const HERO_CLASSES = ["warrior", "archer", "rogue", "mage"] as const satisfies readonly HeroClass[];
export const HERO_TIERS = ["common", "rare", "epic", "legendary", "mythic", "primordial"] as const satisfies readonly HeroTier[];
export const EQUIPMENT_SLOTS = ["weapon", "armor", "accessory"] as const satisfies readonly EquipmentSlot[];

export const DEFENSE_RULES = Object.freeze({
  startingLife: 20,
  startingMoney: 10,
  drawCost: 3,
  mergeCount: 3,
  topTierConversionCost: 50,
  heroInventoryCapacity: 24,
  ticketEveryRounds: 15,
  ticketChallengeSuccessChance: 0.2,
  missingClassGuaranteeDraws: 8,
  lowTierPityStartsAfter: 5,
  lowTierPityStep: 1,
  lowTierPityMaxBonus: 10,
  mergeUndoMs: 5_000,
  totalRounds: 100,
  combatMs: 50_000,
  preparationMs: 10_000,
  withinPairDelayMs: 250,
  betweenPairDelayMs: 650,
  normalEquipmentDropChance: 0.02,
  bossEquipmentDrops: 1,
  equipmentDropRounds: 5,
  classUpgradePerLevel: 0.1,
  tierUpgradePerLevel: 0.08,
  upgradeBaseCost: 4,
  upgradeCostGrowth: 1.6,
  maxUpgradeLevel: 10,
  moneyPerKills: 10,
  overloadWarningCount: 100,
  overloadDangerCount: 120,
  overloadLossCount: 130,
  personalShieldChanceMin: 0.02,
  personalShieldChanceMax: 0.08,
  standardShieldHealthRatio: 0.5,
  shieldBreakDamageMultiplier: 1.5,
  minimumBossResponseMs: 1_500,
  maxFrameDeltaMs: 250,
  speedEaseMs: 400,
});

export const MAPS = Object.freeze([
  {
    id: "reed-marsh", name: "갈대 습지", gimmick: "slow-zone", pathLength: 1_180,
    path: [{ x: 80, y: 80 }, { x: 375, y: 80 }, { x: 375, y: 375 }, { x: 80, y: 375 }, { x: 80, y: 80 }],
    gimmickZone: [0.32, 0.48],
  },
  {
    id: "hot-spring", name: "유자 온천", gimmick: "mana-spring", pathLength: 1_260,
    path: [{ x: 80, y: 80 }, { x: 410, y: 80 }, { x: 410, y: 380 }, { x: 80, y: 380 }, { x: 80, y: 80 }],
    gimmickZone: [0.52, 0.64],
  },
  {
    id: "moonlit-orchard", name: "달빛 과수원", gimmick: "critical-grove", pathLength: 1_340,
    path: [{ x: 80, y: 80 }, { x: 430, y: 80 }, { x: 430, y: 400 }, { x: 80, y: 400 }, { x: 80, y: 80 }],
    gimmickZone: [0.7, 0.84],
  },
] satisfies readonly DefenseMap[]);

export const TIER_MULTIPLIERS: Readonly<Record<HeroTier, number>> = Object.freeze({
  common: 1,
  rare: 1.8,
  epic: 3.2,
  legendary: 5.5,
  mythic: 9,
  primordial: 15,
});

export const GACHA_WEIGHTS: ProbabilityTable<HeroTier> = Object.freeze({
  common: 60,
  rare: 25,
  epic: 10,
  legendary: 4,
  mythic: 0.9,
  primordial: 0.1,
});
export const CLASS_WEIGHTS: ProbabilityTable<HeroClass> = Object.freeze({ warrior: 25, archer: 25, rogue: 25, mage: 25 });

export const HERO_STATS: Readonly<Record<HeroClass, HeroStats>> = Object.freeze({
  warrior: { baseAttack: 14, attackIntervalMs: [1_400, 1_300, 1_200, 1_100, 1_000, 900], range: [110, 115, 120, 125, 130, 140], projectileCount: [1, 1, 1, 1, 1, 1], specialty: "ramp" },
  archer: { baseAttack: 9, attackIntervalMs: [1_000, 950, 900, 850, 800, 750], range: [230, 250, 270, 290, 315, 340], projectileCount: [1, 1, 2, 2, 3, 4], specialty: "multi-shot" },
  rogue: { baseAttack: 8, attackIntervalMs: [780, 740, 700, 660, 620, 580], range: [165, 175, 185, 200, 215, 230], projectileCount: [1, 2, 2, 3, 4, 5], specialty: "bounce" },
  mage: { baseAttack: 11, attackIntervalMs: [1_500, 1_420, 1_340, 1_260, 1_180, 1_100], range: [195, 205, 220, 235, 250, 270], projectileCount: [1, 1, 1, 1, 1, 1], specialty: "area" },
});

export const EQUIPMENT_RARITY_WEIGHTS: ProbabilityTable<HeroTier> = Object.freeze({
  common: 60,
  rare: 25,
  epic: 10,
  legendary: 4,
  mythic: 0.9,
  primordial: 0.1,
});
export const EQUIPMENT_SLOT_WEIGHTS: ProbabilityTable<EquipmentSlot> = Object.freeze({ weapon: 45, armor: 30, accessory: 25 });
export const WEAPON_ATTACK_BONUS: Readonly<Record<HeroTier, number>> = Object.freeze({ common: 0.05, rare: 0.1, epic: 0.18, legendary: 0.3, mythic: 0.5, primordial: 0.8 });
export const ARMOR_SHIELD_BONUS: Readonly<Record<HeroTier, number>> = Object.freeze({ common: 0.05, rare: 0.1, epic: 0.16, legendary: 0.24, mythic: 0.36, primordial: 0.55 });
export const ACCESSORY_EFFECT_BONUS: Readonly<Record<HeroTier, number>> = Object.freeze({ common: 0.03, rare: 0.06, epic: 0.1, legendary: 0.16, mythic: 0.24, primordial: 0.35 });

export const SKILLS = Object.freeze([
  { id: "war-cry", heroClass: "warrior", name: "전투의 함성", manaCost: 35, cooldownMs: 24_000, radius: 300, durationMs: 7_000 },
  { id: "armor-break", heroClass: "warrior", name: "갑옷 분쇄", manaCost: 45, cooldownMs: 30_000, radius: 150, durationMs: 8_000 },
  { id: "arrow-rain", heroClass: "archer", name: "화살비", manaCost: 40, cooldownMs: 26_000, radius: 170, durationMs: 4_000 },
  { id: "focused-shot", heroClass: "archer", name: "집중 사격", manaCost: 30, cooldownMs: 22_000, radius: 320, durationMs: 8_000 },
  { id: "chain-shuriken", heroClass: "rogue", name: "연쇄 표창", manaCost: 30, cooldownMs: 18_000, radius: 240, durationMs: 0 },
  { id: "weak-point", heroClass: "rogue", name: "급소 표식", manaCost: 35, cooldownMs: 25_000, radius: 70, durationMs: 9_000 },
  { id: "binding-field", heroClass: "mage", name: "속박장", manaCost: 45, cooldownMs: 28_000, radius: 180, durationMs: 6_000 },
  { id: "meteor", heroClass: "mage", name: "메테오", manaCost: 60, cooldownMs: 36_000, radius: 190, durationMs: 0 },
] satisfies readonly SkillDefinition[]);

const MONSTER_SPECIALS = ["steady", "swift", "armored", "regenerating", "splitting", "slowing"] as const;
export const MONSTER_THEMES: readonly MonsterTheme[] = Object.freeze(
  Array.from({ length: 100 }, (_, index) => {
    const round = index + 1;
    const visual = getMonsterTheme(round);
    return {
      ...visual,
      round,
      hue: (index * 47) % 360,
      sizeMultiplier: 0.9 + (index % 5) * 0.05,
      speedMultiplier: 0.94 + (index % 4) * 0.04,
      healthMultiplier: 0.95 + (index % 6) * 0.03,
      armorBonus: index % 7 === 6 ? 3 : index % 3,
      special: MONSTER_SPECIALS[index % MONSTER_SPECIALS.length],
    };
  }),
);

const BOSS_DATA = [
  ["늪의 큰발", "marsh-charge", "진흙 돌진", "표시된 길을 곧 돌진해요", "lane", 1_800],
  ["김나는 대장", "steam-heal", "온천 회복", "회복 증기가 모이고 있어요", "boss", 2_200],
  ["달빛 뿔", "moon-stomp", "달빛 내려찍기", "원 안에서 벗어나세요", "circle", 2_000],
  ["갈대 장군", "reed-bulwark", "갈대 방벽", "보호막을 펼치려 해요", "boss", 1_900],
  ["유자 왕", "citrus-haste", "유자 가속", "적들이 곧 빨라져요", "ring", 2_300],
  ["밤톨 기사", "acorn-volley", "도토리 일제사격", "표시된 길에 도토리가 떨어져요", "lane", 2_100],
  ["연꽃 마녀", "lotus-bind", "연꽃 속박", "속박 원이 닫히고 있어요", "circle", 2_400],
  ["폭포 수호자", "waterfall-push", "폭포 밀치기", "파도 길을 피하세요", "lane", 1_850],
  ["황금 이빨", "golden-roar", "황금 포효", "포효 고리가 퍼져요", "ring", 2_500],
  ["태초의 카피킹", "primal-split", "태초의 분열", "분열 기운이 모이고 있어요", "boss", 3_000],
] as const satisfies readonly (readonly [string, BossDefinition["ability"], string, string, BossDefinition["warningShape"], number])[];
export const BOSSES: readonly BossDefinition[] = Object.freeze(
  BOSS_DATA.map(([name, ability, abilityName, warningText, warningShape, windupMs], index) => ({
    id: `boss-${index + 1}` as const,
    round: (index + 1) * 10,
    name,
    ability,
    abilityName,
    warningText,
    warningShape,
    windupMs,
    firstUseDelayMs: windupMs + 1_500,
    scale: 1.6 + index * 0.04,
    healthMultiplier: 7 + index * 0.8,
    shieldMultiplier: 1.5 + index * 0.15,
  })),
);

export function validateProbabilityTable<Key extends string>(
  name: string,
  table: Readonly<Record<string, number>>,
  expectedKeys: readonly Key[],
): void {
  const actualKeys = Object.keys(table);
  if (actualKeys.length !== expectedKeys.length || expectedKeys.some((key) => !actualKeys.includes(key))) {
    throw new DefenseConfigError(`${name} probability keys must match: ${expectedKeys.join(", ")}`);
  }
  const weights = Object.values<number>(table);
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new DefenseConfigError(`${name} probability contains an invalid weight`);
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(total - 100) > 0.000_001) {
    throw new DefenseConfigError(`${name} probability must total 100; received ${total}`);
  }
}

export function validateDefenseContract(): void {
  validateProbabilityTable("hero gacha", GACHA_WEIGHTS, HERO_TIERS);
  validateProbabilityTable("hero class", CLASS_WEIGHTS, HERO_CLASSES);
  validateProbabilityTable("equipment rarity", EQUIPMENT_RARITY_WEIGHTS, HERO_TIERS);
  validateProbabilityTable("equipment slot", EQUIPMENT_SLOT_WEIGHTS, EQUIPMENT_SLOTS);
  if (MAPS.length !== 3 || MONSTER_THEMES.length !== DEFENSE_RULES.totalRounds || BOSSES.length !== 10) {
    throw new DefenseConfigError("Defense content must contain 3 maps, 100 themes, and 10 bosses");
  }
  if (new Set(MONSTER_THEMES.map((theme) => theme.id)).size !== MONSTER_THEMES.length
    || new Set(BOSSES.map((boss) => boss.ability)).size !== BOSSES.length
    || BOSSES.some((boss) => boss.windupMs < DEFENSE_RULES.minimumBossResponseMs
      || boss.firstUseDelayMs <= boss.windupMs)) {
    throw new DefenseConfigError("Monster themes and boss telegraphs must be unique and avoidable");
  }
}

export function getRoundConfig(round: number): RoundConfig {
  if (!Number.isInteger(round) || round < 1 || round > DEFENSE_RULES.totalRounds) {
    throw new DefenseConfigError(`Round must be between 1 and ${DEFENSE_RULES.totalRounds}`);
  }
  const boss = round % 10 === 0;
  const shield = !boss && round % 5 === 0;
  const bossDefinition = boss ? (BOSSES.find((entry) => entry.round === round) ?? null) : null;
  const theme = MONSTER_THEMES[round - 1];
  const baseHealth = Math.round(45 * 1.028 ** (round - 1) * theme.healthMultiplier);
  const spawnCount = Math.ceil((12 + (round - 1) * 0.4) / 2) * 2;
  return Object.freeze({
    round,
    kind: boss ? "boss" : shield ? "shield" : "normal",
    spawnCount: boss ? Math.max(2, Math.round(spawnCount * 0.6 / 2) * 2) : spawnCount,
    health: Math.round(baseHealth * (bossDefinition?.healthMultiplier ?? 1)),
    speed: Math.round((88 + round * 0.72) * theme.speedMultiplier),
    armor: Math.floor((round - 1) / 8) * 2 + theme.armorBonus,
    shieldRatio: boss ? 0.25 : shield ? (round < 35 ? 0.2 : round < 70 ? 0.35 : 0.5) : 0,
    personalShieldChance: boss || shield ? 0 : Math.min(
      DEFENSE_RULES.personalShieldChanceMax,
      DEFENSE_RULES.personalShieldChanceMin + round * 0.000_6,
    ),
    withinPairDelayMs: DEFENSE_RULES.withinPairDelayMs,
    betweenPairDelayMs: DEFENSE_RULES.betweenPairDelayMs,
    fastEnemyResponseMs: Math.max(1_500, 2_050 - round * 5.5),
    theme,
    boss: bossDefinition,
  });
}

validateDefenseContract();
