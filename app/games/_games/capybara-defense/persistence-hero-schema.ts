import { createPlacementState } from "./placement";
import type { ManagedUnit, PlacementState } from "./placement";
import { InvalidDefenseSaveError, equipmentId, equipmentSlot, finite, heroClass, heroTier, heroUnitId, integer, isJsonRecord, record, targetPriority, text } from "./persistence-codec";
import type { EconomyState, EquipmentSlot, HeroInventory, HeroUnit, MapId } from "./types";
import { parseMapId } from "./types";

function equipmentMap(value: unknown): HeroUnit["equipment"] {
  if (!isJsonRecord(value)) throw new InvalidDefenseSaveError();
  const item = record(value, Object.keys(value));
  const result: Partial<Record<EquipmentSlot, string>> = {};
  for (const [key, equipment] of Object.entries(item)) result[equipmentSlot(key)] = equipmentId(equipment);
  return Object.freeze(result);
}

function unit(value: unknown): HeroUnit {
  const item = record(value, ["id", "heroClass", "tier", "stats", "equipment"]);
  const stats = record(item.stats, ["attackBonus", "kills"]);
  return Object.freeze({
    id: heroUnitId(item.id), heroClass: heroClass(item.heroClass), tier: heroTier(item.tier),
    stats: Object.freeze({ attackBonus: finite(stats.attackBonus), kills: integer(stats.kills) }),
    equipment: equipmentMap(item.equipment),
  });
}

function economy(value: unknown): EconomyState {
  const item = record(value, ["money", "kills", "classUpgradeLevels", "tierUpgradeLevels"]);
  const classes = record(item.classUpgradeLevels, ["warrior", "archer", "rogue", "mage"]);
  const tiers = record(item.tierUpgradeLevels, ["common", "rare", "epic", "legendary", "mythic", "primordial"]);
  return Object.freeze({
    money: integer(item.money), kills: integer(item.kills),
    classUpgradeLevels: Object.freeze({
      warrior: integer(classes.warrior, 0, 10), archer: integer(classes.archer, 0, 10),
      rogue: integer(classes.rogue, 0, 10), mage: integer(classes.mage, 0, 10),
    }),
    tierUpgradeLevels: Object.freeze({
      common: integer(tiers.common, 0, 10), rare: integer(tiers.rare, 0, 10),
      epic: integer(tiers.epic, 0, 10), legendary: integer(tiers.legendary, 0, 10),
      mythic: integer(tiers.mythic, 0, 10), primordial: integer(tiers.primordial, 0, 10),
    }),
  });
}

export function parseHeroInventory(value: unknown): HeroInventory {
  const item = record(value, ["units", "economy", "tickets", "awardedTicketRounds", "nextUnitId", "drawState"]);
  if (!Array.isArray(item.units) || !Array.isArray(item.awardedTicketRounds)) throw new InvalidDefenseSaveError();
  const units = item.units.map(unit);
  if (new Set(units.map((entry) => entry.id)).size !== units.length) throw new InvalidDefenseSaveError();
  const awardedTicketRounds = item.awardedTicketRounds.map((round) => integer(round, 15, 90));
  const nextUnitId = integer(item.nextUnitId, 1);
  if (
    awardedTicketRounds.some((round) => round % 15 !== 0) ||
    new Set(awardedTicketRounds).size !== awardedTicketRounds.length ||
    units.some((entry) => Number(entry.id.slice(5)) >= nextUnitId)
  ) {
    throw new InvalidDefenseSaveError();
  }
  const drawState = record(item.drawState, ["lowTierStreak", "missingClassStreak"]);
  return Object.freeze({
    units: Object.freeze(units), economy: economy(item.economy), tickets: integer(item.tickets),
    awardedTicketRounds: Object.freeze(awardedTicketRounds), nextUnitId,
    drawState: Object.freeze({
      lowTierStreak: integer(drawState.lowTierStreak), missingClassStreak: integer(drawState.missingClassStreak),
    }),
  });
}

function managedUnit(value: unknown): ManagedUnit {
  const item = record(value, ["unitId", "slotId", "priority", "range", "investedCost"]);
  if (item.slotId !== null && typeof item.slotId !== "string") throw new InvalidDefenseSaveError();
  return Object.freeze({
    unitId: heroUnitId(item.unitId), slotId: item.slotId, priority: targetPriority(item.priority),
    range: finite(item.range, Number.MIN_VALUE), investedCost: integer(item.investedCost),
  });
}

export function parsePlacement(value: unknown, mapId: MapId, money: number): PlacementState {
  const item = record(value, ["mapId", "money", "units"]);
  if (parseMapId(text(item.mapId)) !== mapId || integer(item.money) !== money || !Array.isArray(item.units)) {
    throw new InvalidDefenseSaveError();
  }
  return createPlacementState(mapId, item.units.map(managedUnit), money);
}
