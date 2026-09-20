import { describe, expect, it } from "vitest";

import { compareEquipment, createEmptyLoadout, type EquipmentItem } from "./equipment";

function commonItem(slot: EquipmentItem["slot"]): EquipmentItem {
  return {
    id: `equipment-compare-${slot}`,
    slot,
    rarity: "common",
    requiredClass: "warrior",
    source: "normal",
    effect:
      slot === "weapon"
        ? { attackBonus: 0.05, shieldBonus: 0, attackSpeedBonus: 0, rangeBonus: 0, manaBonus: 0, cooldownReduction: 0, skillEffectBonus: 0 }
        : slot === "armor"
          ? { attackBonus: 0, shieldBonus: 0.05, attackSpeedBonus: 0, rangeBonus: 0, manaBonus: 0, cooldownReduction: 0, skillEffectBonus: 0 }
          : { attackBonus: 0, shieldBonus: 0, attackSpeedBonus: 0.03, rangeBonus: 0.03, manaBonus: 0.03, cooldownReduction: 0.03, skillEffectBonus: 0.03 },
  };
}

describe("카피바라 디펜스 장비 능력치 비교", () => {
  it.each([
    ["weapon", 14.7, 1_000, 100, 100, 1, 100, 1],
    ["armor", 14, 1_000, 100, 100, 1, 105, 1],
    ["accessory", 14, 1_000 / 1.03, 103, 103, 1.03, 100, 0.97],
  ] as const)(
    "Given 전사 기본 능력치 When %s 장비를 비교하면 Then 교체 전후 최종 능력치가 정확하다",
    (slot, attack, attackIntervalMs, range, maxMana, skillEffect, shield, cooldownMultiplier) => {
      const comparison = compareEquipment({
        heroClass: "warrior",
        tier: "common",
        classUpgradeLevel: 0,
        tierUpgradeLevel: 0,
        base: { attackIntervalMs: 1_000, range: 100, maxMana: 100, skillEffect: 1, shield: 100 },
        loadout: createEmptyLoadout(),
        candidate: commonItem(slot),
      });

      expect(comparison.kind).toBe("comparison");
      if (comparison.kind !== "comparison") throw new Error("Matching class equipment was not comparable");
      expect(comparison.after.attack).toBeCloseTo(attack, 10);
      expect(comparison.after.attackIntervalMs).toBeCloseTo(attackIntervalMs, 10);
      expect(comparison.after.range).toBeCloseTo(range, 10);
      expect(comparison.after.maxMana).toBeCloseTo(maxMana, 10);
      expect(comparison.after.skillEffect).toBeCloseTo(skillEffect, 10);
      expect(comparison.after.shield).toBeCloseTo(shield, 10);
      expect(comparison.after.cooldownMultiplier).toBeCloseTo(cooldownMultiplier, 10);
      expect(comparison.delta.attack).toBeCloseTo(attack - 14, 10);
    },
  );
});
