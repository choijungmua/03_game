import {
  ACCESSORY_EFFECT_BONUS, ARMOR_SHIELD_BONUS, CLASS_WEIGHTS, DEFENSE_RULES,
  EQUIPMENT_SLOTS, EQUIPMENT_RARITY_WEIGHTS, EQUIPMENT_SLOT_WEIGHTS, GACHA_WEIGHTS,
  HERO_CLASSES, HERO_STATS, HERO_TIERS, MAPS, TIER_MULTIPLIERS, WEAPON_ATTACK_BONUS,
  getRoundConfig, validateDefenseContract,
} from "./constants";
import type {
  AttackDamageInput, DefenseSimulation, DefenseSimulationOptions, HeroClass,
  HeroTier, MapId, ProbabilityTable, RandomSource,
} from "./types";
import { DefenseConfigError, parseHeroClass, parseHeroTier, parseMapId } from "./types";
export { parseHeroClass, parseHeroTier, parseMapId } from "./types";
export { getRoundConfig, validateProbabilityTable } from "./constants";

const MAP_PACING_SECONDS: Readonly<Record<MapId, number>> = Object.freeze({
  "reed-marsh": 0.4,
  "hot-spring": 0,
  "moonlit-orchard": 0.8,
});

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => ((state = (state * 1_664_525 + 1_013_904_223) >>> 0) / 2 ** 32);
}

export function weightedPick<Key extends string>(
  items: readonly Key[],
  weights: ProbabilityTable<Key>,
  random: RandomSource,
): Key {
  if (items.length === 0) {
    throw new DefenseConfigError("Cannot pick from an empty probability table");
  }
  let cursor = random() * 100;
  for (const item of items) {
    cursor -= weights[item];
    if (cursor < 0) return item;
  }
  const fallback = items.at(-1);
  if (fallback === undefined) throw new DefenseConfigError("Cannot pick from an empty probability table");
  return fallback;
}

export function calculateUpgradeCost(currentLevel: number): number {
  if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel >= DEFENSE_RULES.maxUpgradeLevel) {
    throw new DefenseConfigError(`Upgrade level must be between 0 and ${DEFENSE_RULES.maxUpgradeLevel - 1}`);
  }
  return Math.ceil(DEFENSE_RULES.upgradeBaseCost * DEFENSE_RULES.upgradeCostGrowth ** currentLevel);
}

export function calculateAttackDamage(input: AttackDamageInput): number {
  const heroClass = parseHeroClass(input.heroClass);
  const tier = parseHeroTier(input.tier);
  const classMultiplier = 1 + input.classUpgradeLevel * DEFENSE_RULES.classUpgradePerLevel;
  const tierUpgradeMultiplier = 1 + input.tierUpgradeLevel * DEFENSE_RULES.tierUpgradePerLevel;
  const equipmentMultiplier = 1 + input.equipmentAttackBonus;
  return (
    HERO_STATS[heroClass].baseAttack *
    TIER_MULTIPLIERS[tier] *
    classMultiplier *
    tierUpgradeMultiplier *
    equipmentMultiplier
  );
}

export function simulateDefenseRun(
  mapId: MapId,
  seed: number,
  options: DefenseSimulationOptions = {},
): DefenseSimulation {
  validateDefenseContract();
  const validMapId = parseMapId(mapId);
  const map = MAPS.find((entry) => entry.id === validMapId);
  if (map === undefined) throw new DefenseConfigError(`Unknown defense map: ${mapId}`);
  const healthMultiplier = options.enemyHealthMultiplier ?? 1;
  if (!Number.isFinite(healthMultiplier) || healthMultiplier <= 0) {
    throw new DefenseConfigError("Enemy health multiplier must be positive");
  }
  const random = createSeededRandom(seed);
  const roster: Record<HeroClass, number[]> = { warrior: [0, 0, 0, 0, 0, 0], archer: [0, 0, 0, 0, 0, 0], rogue: [0, 0, 0, 0, 0, 0], mage: [0, 0, 0, 0, 0, 0] };
  const classUpgrades: Record<HeroClass, number> = { warrior: 0, archer: 0, rogue: 0, mage: 0 };
  const tierUpgrades = [0, 0, 0, 0, 0, 0];
  let money: number = DEFENSE_RULES.startingMoney;
  let minimumMoney: number = money;
  let lives = DEFENSE_RULES.startingLife;
  let killRemainder = 0;
  let totalKills = 0;
  let totalLeaks = 0;
  let bossRounds = 0;
  let shieldRounds = 0;
  let draws = 0;
  let merges = 0;
  let classUpgradePurchases = 0;
  let tierUpgradePurchases = 0;
  let equipmentDrops = 0;
  let ticketChallengesWon = 0;
  let weaponBonus = 0;
  let armorBonus = 0;
  let accessoryBonus = 0;
  let damageDealt = 0;
  let decisionSeconds = 0;
  let scheduleChecksum = 0;
  let roundsCompleted = 0;
  let failedRound: number | null = null;
  let allowMerges = false;

  const addHero = (heroClass: HeroClass, tier: HeroTier): void => {
    let tierIndex = HERO_TIERS.indexOf(tier);
    roster[heroClass][tierIndex] += 1;
    while (allowMerges && tierIndex < HERO_TIERS.length - 1 && roster[heroClass][tierIndex] >= DEFENSE_RULES.mergeCount) {
      roster[heroClass][tierIndex] -= DEFENSE_RULES.mergeCount;
      tierIndex += 1;
      roster[heroClass][tierIndex] += 1;
      merges += 1;
    }
  };

  const buyDraw = (): void => {
    money -= DEFENSE_RULES.drawCost;
    draws += 1;
    addHero(weightedPick(HERO_CLASSES, CLASS_WEIGHTS, random), weightedPick(HERO_TIERS, GACHA_WEIGHTS, random));
  };

  const heroDps = (round: number): number => {
    let dps = 0;
    for (const heroClass of HERO_CLASSES) {
      for (let tierIndex = 0; tierIndex < HERO_TIERS.length; tierIndex += 1) {
        const count = roster[heroClass][tierIndex];
        const stats = HERO_STATS[heroClass];
        const projectiles = 1 + (stats.projectileCount[tierIndex] - 1) * 0.6;
        const specialty = heroClass === "warrior" ? 1.45 : heroClass === "mage" ? 1.55 : heroClass === "rogue" ? 1.2 : 1;
        dps += count * calculateAttackDamage({ heroClass, tier: HERO_TIERS[tierIndex], classUpgradeLevel: classUpgrades[heroClass], tierUpgradeLevel: tierUpgrades[tierIndex], equipmentAttackBonus: weaponBonus }) * projectiles * specialty / (stats.attackIntervalMs[tierIndex] / 1_000);
      }
    }
    const mapBonus = validMapId === "reed-marsh" ? 1.15 : validMapId === "hot-spring" ? 1.12 : 1.18;
    return dps * (1 + accessoryBonus) * mapBonus * (round >= 10 ? 1.3 : 1);
  };

  for (let round = 1; round <= DEFENSE_RULES.totalRounds; round += 1) {
    allowMerges = round >= 6;
    if ((options.policy ?? "normal") === "normal") {
      if (round === 1) while (money >= DEFENSE_RULES.drawCost) buyDraw();
      if (round > 1 && (round - 1) % DEFENSE_RULES.ticketEveryRounds === 0) {
        const challenge = (round - 1) % 30 === 0;
        if (!challenge || random() < DEFENSE_RULES.ticketChallengeSuccessChance) {
          addHero(weightedPick(HERO_CLASSES, CLASS_WEIGHTS, random), challenge ? "primordial" : "mythic");
          ticketChallengesWon += challenge ? 1 : 0;
        }
      }
      if (round % 5 === 0) {
        const heroClass = HERO_CLASSES[(round / 5 - 1) % HERO_CLASSES.length];
        const level = classUpgrades[heroClass];
        if (level < DEFENSE_RULES.maxUpgradeLevel && money >= calculateUpgradeCost(level)) {
          money -= calculateUpgradeCost(level);
          classUpgrades[heroClass] += 1;
          classUpgradePurchases += 1;
        }
      }
      if (round % 7 === 0) {
        const tierIndex = Math.min(HERO_TIERS.length - 1, Math.floor((round - 1) / 20));
        const level = tierUpgrades[tierIndex];
        if (level < DEFENSE_RULES.maxUpgradeLevel && money >= calculateUpgradeCost(level)) {
          money -= calculateUpgradeCost(level);
          tierUpgrades[tierIndex] += 1;
          tierUpgradePurchases += 1;
        }
      }
      if (round > 1 && round % 2 === 0 && money >= DEFENSE_RULES.drawCost) buyDraw();
    }

    const config = getRoundConfig(round);
    const baseHealth = config.boss === null ? config.health : config.health / config.boss.healthMultiplier;
    const enemies = Array.from({ length: config.spawnCount }, (_, index) => {
      const boss = config.boss !== null && index === 0;
      const shielded = boss || (config.kind === "shield" && index < Math.ceil(config.spawnCount * config.shieldRatio)) || random() < config.personalShieldChance;
      const hp = (boss ? config.health : baseHealth * (0.85 + random() * 0.3)) * healthMultiplier * (1 + config.armor * 0.01);
      const shield = shielded ? hp * (boss ? config.shieldRatio * (config.boss?.shieldMultiplier ?? 1) : 0.5) : 0;
      const spawnMs = Math.floor(index / 2) * config.betweenPairDelayMs + index % 2 * config.withinPairDelayMs;
      const speed = config.speed * (0.85 + random() * 0.3) * (random() < 0.08 ? 1.35 : 1);
      const travelMs = Math.max(config.fastEnemyResponseMs, map.pathLength / speed * 1_000);
      return { boss, deadlineMs: spawnMs + travelMs, health: hp + shield };
    }).sort((left, right) => left.deadlineMs - right.deadlineMs);

    let damagePool = 0;
    let previousDeadlineMs = 0;
    let roundKills = 0;
    let bossKilled = false;
    const dps = heroDps(round);
    for (const enemy of enemies) {
      damagePool += dps * (enemy.deadlineMs - previousDeadlineMs) / 1_000;
      previousDeadlineMs = enemy.deadlineMs;
      const applied = Math.min(damagePool, enemy.health);
      damageDealt += applied;
      if (damagePool >= enemy.health) {
        damagePool -= enemy.health;
        roundKills += 1;
        bossKilled ||= enemy.boss;
      } else {
        damagePool = 0;
        totalLeaks += 1;
        lives -= Math.max(1, Math.ceil((enemy.boss ? 5 : 1) * (1 - armorBonus)));
      }
    }

    totalKills += roundKills;
    const rewardedKills = killRemainder + roundKills;
    money += Math.floor(rewardedKills / DEFENSE_RULES.moneyPerKills);
    killRemainder = rewardedKills % DEFENSE_RULES.moneyPerKills;
    bossRounds += config.kind === "boss" ? 1 : 0;
    shieldRounds += config.kind === "shield" ? 1 : 0;
    const drops = roundKills - (bossKilled ? 1 : 0);
    let roundDrops = bossKilled ? DEFENSE_RULES.bossEquipmentDrops : 0;
    for (let kill = 0; kill < drops; kill += 1) roundDrops += random() < DEFENSE_RULES.normalEquipmentDropChance ? 1 : 0;
    for (let drop = 0; drop < roundDrops; drop += 1) {
      equipmentDrops += 1;
      const rarity = weightedPick(HERO_TIERS, EQUIPMENT_RARITY_WEIGHTS, random);
      const slot = weightedPick(EQUIPMENT_SLOTS, EQUIPMENT_SLOT_WEIGHTS, random);
      if (slot === "weapon") weaponBonus = Math.max(weaponBonus, WEAPON_ATTACK_BONUS[rarity]);
      if (slot === "armor") armorBonus = Math.max(armorBonus, ARMOR_SHIELD_BONUS[rarity]);
      if (slot === "accessory") accessoryBonus = Math.max(accessoryBonus, ACCESSORY_EFFECT_BONUS[rarity]);
    }

    minimumMoney = Math.min(minimumMoney, money);
    decisionSeconds += 5.5 + MAP_PACING_SECONDS[validMapId] + random() * 3.5;
    scheduleChecksum = (scheduleChecksum * 31 + roundKills * 7 + totalLeaks * 13 + Math.round(config.health * healthMultiplier)) >>> 0;
    if (lives <= 0) {
      failedRound = round;
      break;
    }
    roundsCompleted = round;
  }

  const attemptedRounds = failedRound ?? DEFENSE_RULES.totalRounds;
  const timedSeconds = (DEFENSE_RULES.combatMs + DEFENSE_RULES.preparationMs) * attemptedRounds / 2 / 1_000;
  return Object.freeze({
    mapId: validMapId,
    seed,
    cleared: failedRound === null,
    roundsCompleted,
    failedRound,
    livesRemaining: lives,
    bossRounds,
    shieldRounds,
    minimumMoney,
    endingMoney: money,
    totalKills,
    totalLeaks,
    draws,
    merges,
    classUpgradePurchases,
    tierUpgradePurchases,
    equipmentDrops,
    ticketChallengesWon,
    damageDealt: Math.round(damageDealt),
    estimatedClearMinutes: Number(((timedSeconds + decisionSeconds) / 60).toFixed(3)),
    scheduleChecksum,
  });
}

validateDefenseContract();
