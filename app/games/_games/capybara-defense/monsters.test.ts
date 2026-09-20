import { describe, expect, it } from "vitest";

import { BOSSES, DEFENSE_RULES, MONSTER_THEMES, getRoundConfig } from "./constants";
import {
  applyMonsterDamage,
  getNextWavePreview,
  getPopulationAlert,
  getSpawnShieldRatio,
} from "./monsters";
import { DefenseConfigError } from "./types";

describe("카피바라 디펜스 몬스터 계약", () => {
  it("Given 100 rounds When themes are enumerated Then IDs are unique and adjacent themes are not palette-only swaps", () => {
    const ids = MONSTER_THEMES.map((theme) => theme.id);

    expect(ids).toHaveLength(100);
    expect(new Set(ids).size).toBe(100);
    expect(
      MONSTER_THEMES.slice(1).every((theme, index) => {
        const previous = MONSTER_THEMES[index];
        return theme.body !== previous.body
          || theme.face !== previous.face
          || theme.decoration !== previous.decoration;
      }),
    ).toBe(true);
    expect(new Set(MONSTER_THEMES.map((theme) => theme.special)).size).toBeGreaterThan(4);
    expect(MONSTER_THEMES.every((theme) => theme.sizeMultiplier > 0 && theme.healthMultiplier > 0)).toBe(true);
    expect(new Set(MONSTER_THEMES.map((theme) => theme.speedMultiplier)).size).toBeGreaterThan(1);
    expect(new Set(MONSTER_THEMES.map((theme) => theme.healthMultiplier)).size).toBeGreaterThan(1);
    expect(new Set(MONSTER_THEMES.map((theme) => theme.armorBonus)).size).toBeGreaterThan(1);
  });

  it("Given ten bosses When abilities are enumerated Then each has a unique avoidable telegraph", () => {
    expect(BOSSES).toHaveLength(10);
    expect(new Set(BOSSES.map((boss) => boss.id)).size).toBe(10);
    expect(new Set(BOSSES.map((boss) => boss.ability)).size).toBe(10);
    expect(BOSSES.every((boss) => boss.scale >= 1.6)).toBe(true);
    expect(BOSSES.every((boss) => boss.windupMs >= DEFENSE_RULES.minimumBossResponseMs)).toBe(true);
    expect(BOSSES.every((boss) => boss.firstUseDelayMs > boss.windupMs)).toBe(true);
    expect(BOSSES.every((boss) => boss.warningText.length > 0 && boss.warningShape.length > 0)).toBe(true);
  });

  it("Given all rounds When shield schedules are inspected Then boss precedence and 20/35/50 percent waves are exact", () => {
    const shieldRounds = Array.from({ length: 100 }, (_, index) => getRoundConfig(index + 1))
      .filter((round) => round.kind === "shield");

    expect(shieldRounds.map((round) => [round.round, round.shieldRatio])).toEqual([
      [5, 0.2], [15, 0.2], [25, 0.2],
      [35, 0.35], [45, 0.35], [55, 0.35], [65, 0.35],
      [75, 0.5], [85, 0.5], [95, 0.5],
    ]);
    expect(Array.from({ length: 10 }, (_, index) => getRoundConfig((index + 1) * 10).kind))
      .toEqual(Array.from({ length: 10 }, () => "boss"));
    expect(
      Array.from({ length: 100 }, (_, index) => getRoundConfig(index + 1))
        .filter((round) => round.kind === "normal")
        .every((round) => round.personalShieldChance >= DEFENSE_RULES.personalShieldChanceMin
          && round.personalShieldChance <= DEFENSE_RULES.personalShieldChanceMax),
    ).toBe(true);
  });

  it("Given shield, boss, and normal spawns When shield assignment is resolved Then precedence and personal bounds hold", () => {
    const shield = getRoundConfig(5);
    const boss = getRoundConfig(10);
    const normal = getRoundConfig(11);

    expect(getSpawnShieldRatio(shield, 0, 1)).toBe(DEFENSE_RULES.standardShieldHealthRatio);
    expect(getSpawnShieldRatio(shield, shield.spawnCount - 1, 0)).toBe(0);
    expect(getSpawnShieldRatio(boss, 0, 1)).toBeGreaterThan(0);
    expect(getSpawnShieldRatio(normal, 0, normal.personalShieldChance - Number.EPSILON))
      .toBe(DEFENSE_RULES.standardShieldHealthRatio);
    expect(getSpawnShieldRatio(normal, 0, normal.personalShieldChance)).toBe(0);
  });

  it("Given HP and shield When normal and shield-break damage land Then bars drain separately and overflow reaches HP", () => {
    const first = applyMonsterDamage(
      { health: 100, maxHealth: 100, shield: 50, maxShield: 50 },
      { amount: 20, kind: "normal" },
    );
    const second = applyMonsterDamage(first.vitals, { amount: 30, kind: "shield-break" });

    expect(first).toEqual({
      vitals: { health: 100, maxHealth: 100, shield: 30, maxShield: 50 },
      shieldDamage: 20,
      healthDamage: 0,
      shieldBroken: false,
    });
    expect(second.shieldDamage).toBe(30);
    expect(second.healthDamage).toBe(15);
    expect(second.vitals).toEqual({ health: 85, maxHealth: 100, shield: 0, maxShield: 50 });
    expect(second.shieldBroken).toBe(true);
  });

  it("Given round 4 and 9 When next waves are previewed Then count, traits, shield, boss, and telegraph are disclosed", () => {
    const shield = getNextWavePreview(4);
    const boss = getNextWavePreview(9);

    expect(shield).toMatchObject({ round: 5, kind: "shield", isBoss: false, shieldRatio: 0.2 });
    expect(shield?.count).toBeGreaterThan(0);
    expect(shield?.keyTraits.length).toBeGreaterThan(0);
    expect(boss).toMatchObject({ round: 10, kind: "boss", isBoss: true });
    expect(boss?.boss?.warningMs).toBeGreaterThanOrEqual(DEFENSE_RULES.minimumBossResponseMs);
    expect(boss?.keyTraits).toContain("보스 보호막 25%");
    expect(getNextWavePreview(100)).toBeNull();
  });

  it.each([
    [99, "safe", "none", "none", false],
    [100, "warning", "warning-paw", "population-warning", false],
    [119, "warning", "warning-paw", "population-warning", false],
    [120, "danger", "danger-paw", "population-danger", false],
    [130, "danger", "danger-paw", "population-danger", false],
    [131, "failure", "danger-paw", "defense-failure", true],
  ] as const)(
    "Given %i alive When population is evaluated Then exact staged warning is returned",
    (count, level, icon, sound, shouldFail) => {
      const alert = getPopulationAlert(count);

      expect(alert).toMatchObject({ count, level, icon, sound, shouldFail });
      if (count >= 100) expect(alert.text).toContain(`${count} / 130`);
    },
  );

  it("Given malformed, dirty, and misleading inputs When monster helpers run Then typed boundaries reject or clamp them", () => {
    expect(() => getPopulationAlert(-1)).toThrow(DefenseConfigError);
    expect(() => getPopulationAlert(100.5)).toThrow(DefenseConfigError);
    expect(() => getNextWavePreview(-1)).toThrow(DefenseConfigError);
    expect(() => getSpawnShieldRatio({ ...getRoundConfig(10), boss: null }, 0, 0.5))
      .toThrow(DefenseConfigError);
    expect(() => applyMonsterDamage(
      { health: 101, maxHealth: 100, shield: 0, maxShield: 0 },
      { amount: 1, kind: "normal" },
    )).toThrow(DefenseConfigError);
    expect(() => applyMonsterDamage(
      { health: 100, maxHealth: 100, shield: 0, maxShield: 0 },
      { amount: Number.NaN, kind: "normal" },
    )).toThrow(DefenseConfigError);
  });
});
