import {
  ACCESSORY_EFFECT_BONUS,
  ARMOR_SHIELD_BONUS,
  CLASS_WEIGHTS,
  DEFENSE_RULES,
  EQUIPMENT_RARITY_WEIGHTS,
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_WEIGHTS,
  HERO_CLASSES,
  HERO_TIERS,
  WEAPON_ATTACK_BONUS,
} from "./constants";
import { calculateAttackDamage, weightedPick } from "./balance";
import type {
  EquipmentComparison,
  EquipmentDrop,
  EquipmentDropState,
  EquipmentEffect,
  EquipmentId,
  EquipmentInventory,
  EquipmentItem,
  EquipmentLoadout,
  EquipmentSource,
  EquipmentState,
  EquipResult,
  FinalEquipmentStats,
  HeroEquipmentBaseStats,
  UnequipResult,
} from "./equipment-types";
import type { EquipmentSlot, HeroClass, HeroTier, RandomSource } from "./types";
import { DefenseConfigError } from "./types";

type DropRollInput = {
  readonly id: EquipmentId;
  readonly enemyKind: "normal" | "boss";
  readonly round: number;
  readonly random: RandomSource;
};

export type {
  EquipmentComparison,
  EquipmentDrop,
  EquipmentDropState,
  EquipmentEffect,
  EquipmentId,
  EquipmentInventory,
  EquipmentItem,
  EquipmentLoadout,
  EquipmentSource,
  EquipmentState,
  EquipResult,
  FinalEquipmentStats,
  HeroEquipmentBaseStats,
  UnequipResult,
} from "./equipment-types";

type EquipInput = EquipmentState & {
  readonly heroClass: HeroClass;
  readonly itemId: EquipmentId;
};

type UnequipInput = EquipmentState & {
  readonly slot: EquipmentSlot;
};

type ComparisonInput = {
  readonly heroClass: HeroClass;
  readonly tier: HeroTier;
  readonly classUpgradeLevel: number;
  readonly tierUpgradeLevel: number;
  readonly base: HeroEquipmentBaseStats;
  readonly loadout: EquipmentLoadout;
  readonly candidate: EquipmentItem;
};

function assertNever(value: never): never {
  throw new DefenseConfigError(`Unknown equipment variant: ${String(value)}`);
}

function zeroEffect(): EquipmentEffect {
  return {
    attackBonus: 0,
    shieldBonus: 0,
    attackSpeedBonus: 0,
    rangeBonus: 0,
    manaBonus: 0,
    cooldownReduction: 0,
    skillEffectBonus: 0,
  };
}

export function getEquipmentEffect(slot: EquipmentSlot, rarity: HeroTier): EquipmentEffect {
  const effect = zeroEffect();
  switch (slot) {
    case "weapon":
      return { ...effect, attackBonus: WEAPON_ATTACK_BONUS[rarity] };
    case "armor":
      return { ...effect, shieldBonus: ARMOR_SHIELD_BONUS[rarity] };
    case "accessory": {
      const bonus = ACCESSORY_EFFECT_BONUS[rarity];
      return {
        ...effect,
        attackSpeedBonus: bonus,
        rangeBonus: bonus,
        manaBonus: bonus,
        cooldownReduction: bonus,
        skillEffectBonus: bonus,
      };
    }
    default:
      return assertNever(slot);
  }
}

export function createEmptyLoadout(): EquipmentLoadout {
  return { weapon: null, armor: null, accessory: null };
}

export function createEmptyInventory(): EquipmentInventory {
  return { items: [], collectedIds: [] };
}

export function rollEquipmentDrop(input: DropRollInput): EquipmentDrop | null {
  if (!Number.isInteger(input.round) || input.round < 1 || input.round > DEFENSE_RULES.totalRounds) {
    throw new DefenseConfigError(`Equipment round must be between 1 and ${DEFENSE_RULES.totalRounds}`);
  }
  const checkedRandom: RandomSource = () => {
    const value = input.random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new DefenseConfigError("Equipment random source must return a value from 0 inclusive to 1 exclusive");
    }
    return value;
  };
  if (input.enemyKind === "normal" && checkedRandom() >= DEFENSE_RULES.normalEquipmentDropChance) return null;

  const source: EquipmentSource = input.enemyKind;
  const rarity = weightedPick(HERO_TIERS, EQUIPMENT_RARITY_WEIGHTS, checkedRandom);
  const slot = weightedPick(EQUIPMENT_SLOTS, EQUIPMENT_SLOT_WEIGHTS, checkedRandom);
  const requiredClass = weightedPick(HERO_CLASSES, CLASS_WEIGHTS, checkedRandom);
  return {
    item: { id: input.id, slot, rarity, requiredClass, source, effect: getEquipmentEffect(slot, rarity) },
    area: source === "boss" ? "reward" : "world",
    spawnedRound: input.round,
    expiresAtRound: input.round + DEFENSE_RULES.equipmentDropRounds,
  };
}

export function getEquipmentDropState(drop: EquipmentDrop, currentRound: number): EquipmentDropState {
  const roundsRemaining = drop.expiresAtRound - currentRound;
  if (roundsRemaining <= 0) return { kind: "expired", roundsRemaining: 0 };
  if (roundsRemaining === 1) return { kind: "warning", roundsRemaining: 1 };
  return { kind: "active", roundsRemaining };
}

export function collectEquipment(input: {
  readonly drop: EquipmentDrop;
  readonly currentRound: number;
  readonly inventory: EquipmentInventory;
}):
  | { readonly kind: "collected"; readonly inventory: EquipmentInventory; readonly item: EquipmentItem }
  | { readonly kind: "already-collected" | "expired"; readonly inventory: EquipmentInventory } {
  if (getEquipmentDropState(input.drop, input.currentRound).kind === "expired") {
    return { kind: "expired", inventory: input.inventory };
  }
  if (input.inventory.collectedIds.includes(input.drop.item.id)) {
    return { kind: "already-collected", inventory: input.inventory };
  }
  return {
    kind: "collected",
    inventory: {
      items: [...input.inventory.items, input.drop.item],
      collectedIds: [...input.inventory.collectedIds, input.drop.item.id],
    },
    item: input.drop.item,
  };
}

export function equipEquipment(input: EquipInput): EquipResult {
  const item = input.inventory.items.find((candidate) => candidate.id === input.itemId);
  if (item === undefined) return { kind: "not-found", inventory: input.inventory, loadout: input.loadout };
  if (item.requiredClass !== input.heroClass) {
    return { kind: "class-restricted", inventory: input.inventory, loadout: input.loadout };
  }
  const replaced = input.loadout[item.slot];
  const items = input.inventory.items.filter((candidate) => candidate.id !== item.id);
  return {
    kind: "equipped",
    replaced,
    inventory: { ...input.inventory, items: replaced === null ? items : [...items, replaced] },
    loadout: { ...input.loadout, [item.slot]: item },
  };
}

export function unequipEquipment(input: UnequipInput): UnequipResult {
  const item = input.loadout[input.slot];
  if (item === null) return { kind: "empty", inventory: input.inventory, loadout: input.loadout };
  return {
    kind: "unequipped",
    item,
    inventory: { ...input.inventory, items: [...input.inventory.items, item] },
    loadout: { ...input.loadout, [input.slot]: null },
  };
}

function finalStats(input: Omit<ComparisonInput, "candidate">, loadout: EquipmentLoadout): FinalEquipmentStats {
  const weapon = loadout.weapon?.effect.attackBonus ?? 0;
  const armor = loadout.armor?.effect.shieldBonus ?? 0;
  const accessory = loadout.accessory?.effect ?? zeroEffect();
  return {
    attack: calculateAttackDamage({
      heroClass: input.heroClass,
      tier: input.tier,
      classUpgradeLevel: input.classUpgradeLevel,
      tierUpgradeLevel: input.tierUpgradeLevel,
      equipmentAttackBonus: weapon,
    }),
    attackIntervalMs: input.base.attackIntervalMs / (1 + accessory.attackSpeedBonus),
    range: input.base.range * (1 + accessory.rangeBonus),
    maxMana: input.base.maxMana * (1 + accessory.manaBonus),
    skillEffect: input.base.skillEffect * (1 + accessory.skillEffectBonus),
    shield: input.base.shield * (1 + armor),
    cooldownMultiplier: 1 - accessory.cooldownReduction,
  };
}

export function compareEquipment(input: ComparisonInput): EquipmentComparison {
  if (input.candidate.requiredClass !== input.heroClass) return { kind: "class-restricted" };
  const before = finalStats(input, input.loadout);
  const after = finalStats(input, { ...input.loadout, [input.candidate.slot]: input.candidate });
  return {
    kind: "comparison",
    before,
    after,
    delta: {
      attack: after.attack - before.attack,
      attackIntervalMs: after.attackIntervalMs - before.attackIntervalMs,
      range: after.range - before.range,
      maxMana: after.maxMana - before.maxMana,
      skillEffect: after.skillEffect - before.skillEffect,
      shield: after.shield - before.shield,
      cooldownMultiplier: after.cooldownMultiplier - before.cooldownMultiplier,
    },
  };
}
