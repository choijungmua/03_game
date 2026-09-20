import type { EquipmentSlot, HeroClass, HeroTier } from "./types";

export type EquipmentId = `equipment-${string}`;
export type EquipmentSource = "normal" | "boss";
export type EquipmentArea = "world" | "reward";

export type EquipmentEffect = {
  readonly attackBonus: number;
  readonly shieldBonus: number;
  readonly attackSpeedBonus: number;
  readonly rangeBonus: number;
  readonly manaBonus: number;
  readonly cooldownReduction: number;
  readonly skillEffectBonus: number;
};

export type EquipmentItem = {
  readonly id: EquipmentId;
  readonly slot: EquipmentSlot;
  readonly rarity: HeroTier;
  readonly requiredClass: HeroClass;
  readonly source: EquipmentSource;
  readonly effect: EquipmentEffect;
};

export type EquipmentLoadout = Readonly<Record<EquipmentSlot, EquipmentItem | null>>;
export type EquipmentInventory = {
  readonly items: readonly EquipmentItem[];
  readonly collectedIds: readonly EquipmentId[];
};

export type EquipmentDrop = {
  readonly item: EquipmentItem;
  readonly area: EquipmentArea;
  readonly spawnedRound: number;
  readonly expiresAtRound: number;
};

export type EquipmentDropState =
  | { readonly kind: "active"; readonly roundsRemaining: number }
  | { readonly kind: "warning"; readonly roundsRemaining: 1 }
  | { readonly kind: "expired"; readonly roundsRemaining: 0 };

export type EquipmentState = {
  readonly inventory: EquipmentInventory;
  readonly loadout: EquipmentLoadout;
};

export type EquipResult =
  | ({ readonly kind: "equipped"; readonly replaced: EquipmentItem | null } & EquipmentState)
  | ({ readonly kind: "class-restricted" | "not-found" } & EquipmentState);

export type UnequipResult =
  | ({ readonly kind: "unequipped"; readonly item: EquipmentItem } & EquipmentState)
  | ({ readonly kind: "empty" } & EquipmentState);

export type HeroEquipmentBaseStats = {
  readonly attackIntervalMs: number;
  readonly range: number;
  readonly maxMana: number;
  readonly skillEffect: number;
  readonly shield: number;
};

export type FinalEquipmentStats = HeroEquipmentBaseStats & {
  readonly attack: number;
  readonly cooldownMultiplier: number;
};

export type EquipmentComparison =
  | {
      readonly kind: "comparison";
      readonly before: FinalEquipmentStats;
      readonly after: FinalEquipmentStats;
      readonly delta: FinalEquipmentStats;
    }
  | { readonly kind: "class-restricted" };
