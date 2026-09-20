import { describe, expect, it } from "vitest";
import { aggregateDefenseResults } from "./results";
import type { DefenseCombatEvent } from "./results";

describe("디펜스 결과 집계", () => {
  it("직업 피해·최고 기여 유닛·처치·누수를 한 번만 합산한다", () => {
    // Given
    const events = [
      { kind: "damage", heroClass: "archer", unitId: "hero-1", amount: 80 },
      { kind: "damage", heroClass: "mage", unitId: "hero-2", amount: 120 },
      { kind: "damage", heroClass: "archer", unitId: "hero-1", amount: 60 },
      { kind: "kill", unitId: "hero-1" },
      { kind: "kill", unitId: "hero-2" },
      { kind: "kill", unitId: "hero-1" },
      { kind: "leak", count: 3 },
    ] as const;

    // When
    const result = aggregateDefenseResults(events);

    // Then
    expect(result).toEqual({
      classDamage: { warrior: 0, archer: 140, rogue: 0, mage: 120 },
      topUnit: { unitId: "hero-1", damage: 140, kills: 2 },
      kills: 3,
      leaks: 3,
      totalDamage: 260,
    });
  });

  it("이벤트가 없으면 빈 결과를 안정적으로 제공한다", () => {
    // Given
    const events: readonly DefenseCombatEvent[] = [];

    // When
    const result = aggregateDefenseResults(events);

    // Then
    expect(result).toEqual({
      classDamage: { warrior: 0, archer: 0, rogue: 0, mage: 0 },
      topUnit: null,
      kills: 0,
      leaks: 0,
      totalDamage: 0,
    });
  });
});
