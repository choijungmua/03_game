import { describe, expect, it } from "vitest";

import {
  ACCESSORY_EFFECT_BONUS,
  ARMOR_SHIELD_BONUS,
  EQUIPMENT_SLOTS,
  EQUIPMENT_RARITY_WEIGHTS,
  EQUIPMENT_SLOT_WEIGHTS,
  HERO_CLASSES,
  HERO_TIERS,
  WEAPON_ATTACK_BONUS,
} from "./constants";
import {
  collectEquipment,
  createEmptyInventory,
  createEmptyLoadout,
  equipEquipment,
  getEquipmentDropState,
  getEquipmentEffect,
  rollEquipmentDrop,
  unequipEquipment,
  type EquipmentInventory,
  type EquipmentItem,
} from "./equipment";
import { createSeededRandom } from "./balance";
import type { HeroClass, RandomSource } from "./types";

function sequenceRandom(...values: readonly number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    return value ?? Number.NaN;
  };
}

function commonItem(
  id: `equipment-${string}`,
  slot: EquipmentItem["slot"],
  requiredClass: HeroClass,
): EquipmentItem {
  return {
    id,
    slot,
    rarity: "common",
    requiredClass,
    source: "normal",
    effect:
      slot === "weapon"
        ? { attackBonus: 0.05, shieldBonus: 0, attackSpeedBonus: 0, rangeBonus: 0, manaBonus: 0, cooldownReduction: 0, skillEffectBonus: 0 }
        : slot === "armor"
          ? { attackBonus: 0, shieldBonus: 0.05, attackSpeedBonus: 0, rangeBonus: 0, manaBonus: 0, cooldownReduction: 0, skillEffectBonus: 0 }
          : { attackBonus: 0, shieldBonus: 0, attackSpeedBonus: 0.03, rangeBonus: 0.03, manaBonus: 0.03, cooldownReduction: 0.03, skillEffectBonus: 0.03 },
  };
}

function inventory(...items: readonly EquipmentItem[]): EquipmentInventory {
  return { items, collectedIds: items.map(({ id }) => id) };
}

describe("카피바라 디펜스 장비", () => {
  it("Given Task 4 장비 계약 When 장비 엔진을 확장하면 Then 공개 확률과 효과 기준값을 보존한다", () => {
    expect(EQUIPMENT_RARITY_WEIGHTS).toEqual({
      common: 60,
      rare: 25,
      epic: 10,
      legendary: 4,
      mythic: 0.9,
      primordial: 0.1,
    });
    expect(EQUIPMENT_SLOT_WEIGHTS).toEqual({ weapon: 45, armor: 30, accessory: 25 });
    expect(WEAPON_ATTACK_BONUS).toEqual({
      common: 0.05,
      rare: 0.1,
      epic: 0.18,
      legendary: 0.3,
      mythic: 0.5,
      primordial: 0.8,
    });
    expect(ARMOR_SHIELD_BONUS).toEqual({
      common: 0.05,
      rare: 0.1,
      epic: 0.16,
      legendary: 0.24,
      mythic: 0.36,
      primordial: 0.55,
    });
    expect(ACCESSORY_EFFECT_BONUS).toEqual({
      common: 0.03,
      rare: 0.06,
      epic: 0.1,
      legendary: 0.16,
      mythic: 0.24,
      primordial: 0.35,
    });
  });

  it("Given 일반 몬스터와 보스 When 경계 난수로 드롭을 굴리면 Then 2%와 보스 1개 보장을 정확히 적용한다", () => {
    const misses = rollEquipmentDrop({
      id: "equipment-normal-miss",
      enemyKind: "normal",
      round: 3,
      random: sequenceRandom(0.02),
    });
    const normalDrop = rollEquipmentDrop({
      id: "equipment-normal-hit",
      enemyKind: "normal",
      round: 3,
      random: sequenceRandom(0.019_999, 0, 0, 0),
    });
    const bossDrop = rollEquipmentDrop({
      id: "equipment-boss",
      enemyKind: "boss",
      round: 10,
      random: sequenceRandom(0.999_999, 0.999_999, 0.999_999),
    });

    expect(misses).toBeNull();
    expect(normalDrop).toMatchObject({ area: "world", spawnedRound: 3, expiresAtRound: 8 });
    expect(bossDrop).toMatchObject({
      area: "reward",
      spawnedRound: 10,
      expiresAtRound: 15,
      item: { rarity: "primordial", slot: "accessory", requiredClass: "mage", source: "boss" },
    });
  });

  it("Given 고정 시드 When 충분한 보스 드롭을 굴리면 Then 공개 등급·부위 확률을 그대로 사용한다", () => {
    const random = createSeededRandom(11_2026);
    const rarityCounts = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0, primordial: 0 };
    const slotCounts = { weapon: 0, armor: 0, accessory: 0 };

    for (let index = 0; index < 100_000; index += 1) {
      const drop = rollEquipmentDrop({ id: `equipment-seeded-${index}`, enemyKind: "boss", round: 10, random });
      if (drop === null) throw new Error("Boss drop contract returned no item");
      rarityCounts[drop.item.rarity] += 1;
      slotCounts[drop.item.slot] += 1;
    }

    for (const rarity of HERO_TIERS) {
      expect(rarityCounts[rarity] / 1_000).toBeCloseTo(EQUIPMENT_RARITY_WEIGHTS[rarity], 0);
    }
    for (const slot of ["weapon", "armor", "accessory"] as const) {
      expect(slotCounts[slot] / 1_000).toBeCloseTo(EQUIPMENT_SLOT_WEIGHTS[slot], 0);
    }
  });

  it("Given 모든 등급 When 슬롯 효과를 조회하면 Then 무기·방어구·장신구 수치를 정확히 노출한다", () => {
    for (const rarity of HERO_TIERS) {
      expect(getEquipmentEffect("weapon", rarity)).toEqual({
        attackBonus: WEAPON_ATTACK_BONUS[rarity],
        shieldBonus: 0,
        attackSpeedBonus: 0,
        rangeBonus: 0,
        manaBonus: 0,
        cooldownReduction: 0,
        skillEffectBonus: 0,
      });
    }
    for (const rarity of HERO_TIERS) {
      expect(getEquipmentEffect("armor", rarity).shieldBonus).toBe(ARMOR_SHIELD_BONUS[rarity]);
    }
    for (const rarity of HERO_TIERS) {
      expect(getEquipmentEffect("accessory", rarity)).toMatchObject({
        attackSpeedBonus: ACCESSORY_EFFECT_BONUS[rarity],
        rangeBonus: ACCESSORY_EFFECT_BONUS[rarity],
        manaBonus: ACCESSORY_EFFECT_BONUS[rarity],
        cooldownReduction: ACCESSORY_EFFECT_BONUS[rarity],
        skillEffectBonus: ACCESSORY_EFFECT_BONUS[rarity],
      });
    }
  });

  it("Given 5라운드 유지 드롭 When 경고·만료 경계를 지나 수집하면 Then 만료 뒤 인벤토리를 바꾸지 않는다", () => {
    const drop = rollEquipmentDrop({
      id: "equipment-expiry",
      enemyKind: "boss",
      round: 10,
      random: sequenceRandom(0, 0, 0),
    });
    if (drop === null) throw new Error("Boss drop contract returned no item");

    expect(getEquipmentDropState(drop, 13)).toEqual({ kind: "active", roundsRemaining: 2 });
    expect(getEquipmentDropState(drop, 14)).toEqual({ kind: "warning", roundsRemaining: 1 });
    expect(getEquipmentDropState(drop, 15)).toEqual({ kind: "expired", roundsRemaining: 0 });
    const collected = collectEquipment({ drop, currentRound: 14, inventory: createEmptyInventory() });
    expect(collected).toMatchObject({ kind: "collected" });
    expect(collectEquipment({ drop, currentRound: 14, inventory: collected.inventory })).toEqual({
      kind: "already-collected",
      inventory: collected.inventory,
    });
    const equipped = equipEquipment({
      heroClass: "warrior",
      itemId: drop.item.id,
      inventory: collected.inventory,
      loadout: createEmptyLoadout(),
    });
    expect(collectEquipment({ drop, currentRound: 14, inventory: equipped.inventory })).toMatchObject({
      kind: "already-collected",
    });
    expect(collectEquipment({ drop, currentRound: 15, inventory: createEmptyInventory() })).toEqual({
      kind: "expired",
      inventory: createEmptyInventory(),
    });
  });

  it("Given 직업 제한 장비와 기존 장비 When 장착·교체·해제하면 Then 확인된 요청만 정확히 반영한다", () => {
    const oldWeapon = commonItem("equipment-old", "weapon", "warrior");
    const nextWeapon = commonItem("equipment-next", "weapon", "warrior");
    const mageWeapon = commonItem("equipment-mage", "weapon", "mage");
    const loadout = { ...createEmptyLoadout(), weapon: oldWeapon };

    const denied = equipEquipment({ heroClass: "warrior", itemId: mageWeapon.id, inventory: inventory(mageWeapon), loadout });
    expect(denied).toEqual({ kind: "class-restricted", inventory: inventory(mageWeapon), loadout });

    const equipped = equipEquipment({ heroClass: "warrior", itemId: nextWeapon.id, inventory: inventory(nextWeapon), loadout });
    expect(equipped).toMatchObject({ kind: "equipped", replaced: oldWeapon, inventory: { items: [oldWeapon] } });
    if (equipped.kind !== "equipped") throw new Error("Matching class equipment was not equipped");
    expect(equipped.loadout.weapon).toBe(nextWeapon);

    const unequipped = unequipEquipment({ slot: "weapon", inventory: equipped.inventory, loadout: equipped.loadout });
    expect(unequipped).toMatchObject({ kind: "unequipped", item: nextWeapon, inventory: { items: [oldWeapon, nextWeapon] } });
    if (unequipped.kind !== "unequipped") throw new Error("Equipped weapon was not removed");
    expect(unequipped.loadout.weapon).toBeNull();
  });

  it("Given 네 직업과 세 슬롯 When 장착 조건을 검사하면 Then 일치 직업만 모든 슬롯을 장착한다", () => {
    for (const heroClass of HERO_CLASSES) {
      const otherClass = HERO_CLASSES[(HERO_CLASSES.indexOf(heroClass) + 1) % HERO_CLASSES.length] ?? "warrior";
      for (const slot of EQUIPMENT_SLOTS) {
        const matching = commonItem(`equipment-${heroClass}-${slot}`, slot, heroClass);
        const restricted = commonItem(`equipment-${otherClass}-${slot}`, slot, otherClass);
        expect(equipEquipment({ heroClass, itemId: matching.id, inventory: inventory(matching), loadout: createEmptyLoadout() }).kind).toBe("equipped");
        expect(equipEquipment({ heroClass, itemId: restricted.id, inventory: inventory(restricted), loadout: createEmptyLoadout() }).kind).toBe("class-restricted");
      }
    }
  });

  it("Given 잘못된 난수와 존재하지 않는 아이템 When 장비 경계를 호출하면 Then 상태 변경 없이 거부한다", () => {
    expect(() =>
      rollEquipmentDrop({ id: "equipment-bad-rng", enemyKind: "boss", round: 10, random: () => Number.NaN }),
    ).toThrow("Equipment random source must return a value from 0 inclusive to 1 exclusive");

    const loadout = createEmptyLoadout();
    expect(equipEquipment({ heroClass: "warrior", itemId: "equipment-missing", inventory: createEmptyInventory(), loadout })).toEqual({
      kind: "not-found",
      inventory: createEmptyInventory(),
      loadout,
    });
  });
});
