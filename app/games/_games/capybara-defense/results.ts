import type { HeroClass, HeroUnitId } from "./types";

export type DefenseCombatEvent =
  | Readonly<{ kind: "damage"; heroClass: HeroClass; unitId: HeroUnitId; amount: number }>
  | Readonly<{ kind: "kill"; unitId: HeroUnitId }>
  | Readonly<{ kind: "leak"; count: number }>;

export type DefenseResultStats = Readonly<{
  classDamage: Readonly<Record<HeroClass, number>>;
  topUnit: Readonly<{ unitId: HeroUnitId; damage: number; kills: number }> | null;
  kills: number;
  leaks: number;
  totalDamage: number;
}>;

type UnitTotals = { damage: number; kills: number };

export function aggregateDefenseResults(events: readonly DefenseCombatEvent[]): DefenseResultStats {
  const classDamage: Record<HeroClass, number> = { warrior: 0, archer: 0, rogue: 0, mage: 0 };
  const units = new Map<HeroUnitId, UnitTotals>();
  let kills = 0;
  let leaks = 0;
  let totalDamage = 0;

  for (const event of events) {
    switch (event.kind) {
      case "damage": {
        if (!Number.isFinite(event.amount) || event.amount < 0) throw new TypeError("Damage must be non-negative");
        classDamage[event.heroClass] += event.amount;
        totalDamage += event.amount;
        const totals = units.get(event.unitId) ?? { damage: 0, kills: 0 };
        totals.damage += event.amount;
        units.set(event.unitId, totals);
        break;
      }
      case "kill": {
        kills += 1;
        const totals = units.get(event.unitId) ?? { damage: 0, kills: 0 };
        totals.kills += 1;
        units.set(event.unitId, totals);
        break;
      }
      case "leak":
        if (!Number.isSafeInteger(event.count) || event.count < 0) throw new TypeError("Leaks must be non-negative");
        leaks += event.count;
        break;
    }
  }

  const top = [...units.entries()].sort(
    ([leftId, left], [rightId, right]) =>
      right.damage - left.damage || right.kills - left.kills || leftId.localeCompare(rightId),
  )[0];
  return Object.freeze({
    classDamage: Object.freeze(classDamage),
    topUnit: top === undefined
      ? null
      : Object.freeze({ unitId: top[0], damage: top[1].damage, kills: top[1].kills }),
    kills,
    leaks,
    totalDamage,
  });
}
