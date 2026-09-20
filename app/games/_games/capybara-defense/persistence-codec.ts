import type { EquipmentId } from "./equipment-types";
import type { EquipmentSlot, HeroClass, HeroTier, HeroUnitId, TargetPriority } from "./types";

export type JsonRecord = Readonly<Record<string, unknown>>;
export class InvalidDefenseSaveError extends Error {}

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function record(value: unknown, keys: readonly string[]): JsonRecord {
  if (!isJsonRecord(value)) throw new InvalidDefenseSaveError();
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new InvalidDefenseSaveError();
  }
  return value;
}

export function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < minimum || value > maximum) {
    throw new InvalidDefenseSaveError();
  }
  return value;
}

export function finite(value: unknown, minimum = 0, maximum = Number.MAX_VALUE): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new InvalidDefenseSaveError();
  }
  return value;
}

export function text(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new InvalidDefenseSaveError();
  return value;
}

export function heroClass(value: unknown): HeroClass {
  switch (value) {
    case "warrior": case "archer": case "rogue": case "mage": return value;
    default: throw new InvalidDefenseSaveError();
  }
}

export function heroTier(value: unknown): HeroTier {
  switch (value) {
    case "common": case "rare": case "epic": case "legendary": case "mythic": case "primordial":
      return value;
    default: throw new InvalidDefenseSaveError();
  }
}

export function equipmentSlot(value: unknown): EquipmentSlot {
  switch (value) {
    case "weapon": case "armor": case "accessory": return value;
    default: throw new InvalidDefenseSaveError();
  }
}

export function targetPriority(value: unknown): TargetPriority {
  switch (value) {
    case "first": case "last": case "strongest": case "nearest": return value;
    default: throw new InvalidDefenseSaveError();
  }
}

function isHeroUnitId(value: unknown): value is HeroUnitId {
  return typeof value === "string" && /^hero-[1-9]\d*$/.test(value);
}

export function heroUnitId(value: unknown): HeroUnitId {
  if (!isHeroUnitId(value)) throw new InvalidDefenseSaveError();
  return value;
}

function isEquipmentId(value: unknown): value is EquipmentId {
  return typeof value === "string" && /^equipment-[a-z0-9-]+$/.test(value);
}

export function equipmentId(value: unknown): EquipmentId {
  if (!isEquipmentId(value)) throw new InvalidDefenseSaveError();
  return value;
}
