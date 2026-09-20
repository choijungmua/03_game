import type { EquipmentState } from "./equipment-types";
import type { PlacementState } from "./placement";
import { InvalidDefenseSaveError, finite, integer, record, text } from "./persistence-codec";
import { parseEquipmentState } from "./persistence-equipment-schema";
import { parseHeroInventory, parsePlacement } from "./persistence-hero-schema";
import type { HeroInventory, MapId } from "./types";
import { DefenseConfigError, parseMapId } from "./types";

export type DefenseCheckpoint = Readonly<{
  mapId: MapId;
  round: number;
  phase: "preparation";
  lives: number;
  mana: number;
  heroInventory: HeroInventory;
  placement: PlacementState;
  equipment: EquipmentState;
}>;

export function parseDefenseCheckpoint(value: unknown): DefenseCheckpoint | null {
  try {
    const item = record(value, [
      "mapId",
      "round",
      "phase",
      "lives",
      "mana",
      "heroInventory",
      "placement",
      "equipment",
    ]);
    const mapId = parseMapId(text(item.mapId));
    const round = integer(item.round, 10, 90);
    if (round % 10 !== 0 || item.phase !== "preparation") throw new InvalidDefenseSaveError();
    const inventory = parseHeroInventory(item.heroInventory);
    const savedPlacement = parsePlacement(item.placement, mapId, inventory.economy.money);
    const savedEquipment = parseEquipmentState(item.equipment);
    const unitIds = new Set(inventory.units.map((unit) => unit.id));
    const equipmentItems = [
      ...savedEquipment.inventory.items,
      ...Object.values(savedEquipment.loadout).flatMap((entry) => entry ?? []),
    ];
    if (
      savedPlacement.units.length !== inventory.units.length ||
      savedPlacement.units.some((unit) => !unitIds.has(unit.unitId))
    ) {
      throw new InvalidDefenseSaveError();
    }
    for (const unit of inventory.units) {
      for (const [slot, id] of Object.entries(unit.equipment)) {
        if (!equipmentItems.some((equipment) => equipment.id === id && equipment.slot === slot)) {
          throw new InvalidDefenseSaveError();
        }
      }
    }
    return Object.freeze({
      mapId,
      round,
      phase: "preparation",
      lives: integer(item.lives, 0, 20),
      mana: finite(item.mana),
      heroInventory: inventory,
      placement: savedPlacement,
      equipment: savedEquipment,
    });
  } catch (error) {
    if (error instanceof InvalidDefenseSaveError || error instanceof DefenseConfigError) return null;
    throw error;
  }
}
