import { describe, expect, it } from "vitest";

import { calculateHeroUnitDamage, createHeroInventory, createHeroUnit, drawHero, purchaseHeroUpgrade } from "./heroes";
import { parseUpgradeTarget } from "./economy";

describe("카피바라 디펜스 공용 지갑과 런타임 강화", () => {
  it("Given 10원 지갑 When 뽑기 뒤 직업 강화를 구매하면 Then 하나의 지갑이 10→7→3으로만 변한다", () => {
    const drawn = drawHero(createHeroInventory(10), () => 0);

    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(drawn.state.economy.money).toBe(7);
    const upgraded = purchaseHeroUpgrade(drawn.state, parseUpgradeTarget("class", "warrior"));
    expect(upgraded.kind).toBe("purchased");
    if (upgraded.kind !== "purchased") return;
    expect(upgraded.state.economy.money).toBe(3);
    expect(upgraded.state.economy.classUpgradeLevels.warrior).toBe(1);
    expect(upgraded.state.units).toHaveLength(1);
  });

  it("Given 충분한 한 지갑 When 등급 강화를 구매하면 Then 직업 강화와 별개로 비용과 상태를 갱신한다", () => {
    const result = purchaseHeroUpgrade(createHeroInventory(11), parseUpgradeTarget("tier", "legendary"));

    expect(result.kind).toBe("purchased");
    if (result.kind !== "purchased") return;
    expect(result.state.economy.money).toBe(7);
    expect(result.state.economy.classUpgradeLevels.warrior).toBe(0);
    expect(result.state.economy.tierUpgradeLevels.legendary).toBe(1);
  });

  it("Given 강화된 지갑 When 실제 영웅 공격력을 계산하면 Then 해당 직업·등급만 Task 4 공식으로 변한다", () => {
    const warrior = createHeroUnit("hero-1", "warrior", "legendary");
    const archer = createHeroUnit("hero-2", "archer", "legendary");
    const classUpgrade = purchaseHeroUpgrade(createHeroInventory(20), parseUpgradeTarget("class", "warrior"));
    const tierUpgrade = purchaseHeroUpgrade(createHeroInventory(20), parseUpgradeTarget("tier", "legendary"));

    expect(classUpgrade.kind).toBe("purchased");
    expect(tierUpgrade.kind).toBe("purchased");
    if (classUpgrade.kind !== "purchased" || tierUpgrade.kind !== "purchased") return;
    expect(calculateHeroUnitDamage(warrior, classUpgrade.state.economy)).toBeCloseTo(84.7, 10);
    expect(calculateHeroUnitDamage(archer, classUpgrade.state.economy)).toBeCloseTo(49.5, 10);
    expect(calculateHeroUnitDamage(warrior, tierUpgrade.state.economy)).toBeCloseTo(83.16, 10);
  });

  it("Given 구매 결과 When 원본이나 중첩 강화 값을 바꾸려 하면 Then 모두 불변이다", () => {
    const drawn = drawHero(createHeroInventory(10), () => 0);

    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    const upgraded = purchaseHeroUpgrade(drawn.state, parseUpgradeTarget("class", "warrior"));
    expect(upgraded.kind).toBe("purchased");
    if (upgraded.kind !== "purchased") return;
    expect(Object.isFrozen(upgraded.state)).toBe(true);
    expect(Object.isFrozen(upgraded.state.units)).toBe(true);
    expect(Object.isFrozen(upgraded.state.economy)).toBe(true);
    expect(Object.isFrozen(upgraded.state.economy.classUpgradeLevels)).toBe(true);
    expect(drawn.state.economy.money).toBe(7);
  });
});
