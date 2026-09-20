import type { EquipmentEffect, EquipmentItem, EquipmentState } from "./equipment-types";
import { InvalidDefenseSaveError, equipmentId, equipmentSlot, finite, heroClass, heroTier, record } from "./persistence-codec";
import type { EquipmentSlot } from "./types";

function effect(value: unknown): EquipmentEffect {
  const item = record(value, ["attackBonus", "shieldBonus", "attackSpeedBonus", "rangeBonus", "manaBonus", "cooldownReduction", "skillEffectBonus"]);
  return Object.freeze({
    attackBonus: finite(item.attackBonus), shieldBonus: finite(item.shieldBonus),
    attackSpeedBonus: finite(item.attackSpeedBonus), rangeBonus: finite(item.rangeBonus),
    manaBonus: finite(item.manaBonus), cooldownReduction: finite(item.cooldownReduction, 0, 1),
    skillEffectBonus: finite(item.skillEffectBonus),
  });
}

function equipmentItem(value: unknown): EquipmentItem {
  const item = record(value, ["id", "slot", "rarity", "requiredClass", "source", "effect"]);
  if (item.source !== "normal" && item.source !== "boss") throw new InvalidDefenseSaveError();
  return Object.freeze({
    id: equipmentId(item.id), slot: equipmentSlot(item.slot), rarity: heroTier(item.rarity),
    requiredClass: heroClass(item.requiredClass), source: item.source, effect: effect(item.effect),
  });
}

export function parseEquipmentState(value: unknown): EquipmentState {
  const item = record(value, ["inventory", "loadout"]);
  const inventory = record(item.inventory, ["items", "collectedIds"]);
  const loadout = record(item.loadout, ["weapon", "armor", "accessory"]);
  if (!Array.isArray(inventory.items) || !Array.isArray(inventory.collectedIds)) throw new InvalidDefenseSaveError();
  const items = inventory.items.map(equipmentItem);
  const collectedIds = inventory.collectedIds.map(equipmentId);
  const parseLoadout = (slot: EquipmentSlot): EquipmentItem | null => {
    const candidate = loadout[slot];
    if (candidate === null) return null;
    const parsed = equipmentItem(candidate);
    if (parsed.slot !== slot) throw new InvalidDefenseSaveError();
    return parsed;
  };
  const loadoutItems = [parseLoadout("weapon"), parseLoadout("armor"), parseLoadout("accessory")];
  const activeIds = [...items.map((entry) => entry.id), ...loadoutItems.flatMap((entry) => entry?.id ?? [])];
  if (new Set(items.map((entry) => entry.id)).size !== items.length || new Set(collectedIds).size !== collectedIds.length || new Set(activeIds).size !== activeIds.length || activeIds.some((id) => !collectedIds.includes(id))) {
    throw new InvalidDefenseSaveError();
  }
  return Object.freeze({
    inventory: Object.freeze({ items: Object.freeze(items), collectedIds: Object.freeze(collectedIds) }),
    loadout: Object.freeze({ weapon: loadoutItems[0] ?? null, armor: loadoutItems[1] ?? null, accessory: loadoutItems[2] ?? null }),
  });
}
