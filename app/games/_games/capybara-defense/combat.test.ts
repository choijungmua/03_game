import { describe, expect, it } from "vitest";

import { HERO_CLASSES, HERO_STATS, HERO_TIERS } from "./constants";
import {
  createCombatState,
  getAttackProfile,
  getRangePreview,
  resolveAttack,
  selectTarget,
  type CombatHero,
  type CombatTarget,
} from "./combat";
import type { HeroClass, HeroTier, TargetPriority } from "./types";

const hero = (
  heroClass: HeroClass,
  tier: HeroTier,
  priority: TargetPriority = "first",
): CombatHero => ({
  id: "hero-test",
  heroClass,
  tier,
  position: { x: 0, y: 0 },
  priority,
  classUpgradeLevel: 0,
  tierUpgradeLevel: 0,
  equipmentAttackBonus: 0,
  criticalChance: 0,
});

const target = (
  id: string,
  x: number,
  progress: number,
  health = 100,
  boss = false,
): CombatTarget => ({
  id,
  position: { x, y: 0 },
  progress,
  health,
  maxHealth: health,
  armor: 0,
  boss,
  active: true,
});

describe("four-class combat profiles", () => {
  it("defines deterministic attack behavior for every class and tier", () => {
    // Given: all 24 class-tier combinations.
    const combinations = HERO_CLASSES.flatMap((heroClass) =>
      HERO_TIERS.map((tier) => ({ heroClass, tier, profile: getAttackProfile(heroClass, tier) })),
    );

    // When: their renderer-neutral profiles are inspected.
    // Then: every profile has a usable cadence, range, count, and typed atlas frames.
    expect(combinations).toHaveLength(24);
    for (const { heroClass, tier, profile } of combinations) {
      const tierIndex = HERO_TIERS.indexOf(tier);
      expect(profile.range).toBe(HERO_STATS[heroClass].range[tierIndex]);
      expect(profile.attackIntervalMs).toBe(HERO_STATS[heroClass].attackIntervalMs[tierIndex]);
      expect(profile.projectileCount).toBeGreaterThanOrEqual(1);
      expect(profile.projectileFrame).toMatch(/^projectile\./);
      expect(profile.effectFrame).toMatch(/^skill\./);
    }
  });

  it("grows each class into its declared specialty across tiers", () => {
    // Given: common and primordial profiles for every class.
    const warrior = [getAttackProfile("warrior", "common"), getAttackProfile("warrior", "primordial")];
    const archer = [getAttackProfile("archer", "common"), getAttackProfile("archer", "primordial")];
    const rogue = [getAttackProfile("rogue", "common"), getAttackProfile("rogue", "primordial")];
    const mage = [getAttackProfile("mage", "common"), getAttackProfile("mage", "primordial")];

    // When: tier growth is compared.
    // Then: ramp, multishot/rain, bounce, and bolt/meteor identities are distinct.
    expect(warrior.map((profile) => [profile.attackKind, profile.maxRampHits])).toEqual([
      ["melee-ramp", 3],
      ["melee-ramp", 8],
    ]);
    expect(archer.map((profile) => [profile.attackKind, profile.projectileCount, profile.areaRadius])).toEqual([
      ["arrow", 1, 0],
      ["arrow-rain", 4, 96],
    ]);
    expect(rogue.map((profile) => [profile.attackKind, profile.projectileCount, profile.bounceCount])).toEqual([
      ["shuriken", 1, 0],
      ["shuriken", 5, 5],
    ]);
    expect(mage.map((profile) => [profile.attackKind, profile.areaRadius])).toEqual([
      ["energy-bolt", 0],
      ["meteor", 112],
    ]);
  });

  it("exposes distinct strengths and weaknesses through range, speed, and area", () => {
    // Given: epic heroes.
    const profiles = Object.fromEntries(
      HERO_CLASSES.map((heroClass) => [heroClass, getAttackProfile(heroClass, "epic")]),
    );

    // When/Then: each class owns one observable advantage.
    expect(profiles.archer.range).toBeGreaterThan(profiles.mage.range);
    expect(profiles.rogue.attackIntervalMs).toBeLessThan(profiles.archer.attackIntervalMs);
    expect(profiles.mage.areaRadius).toBeGreaterThan(profiles.warrior.areaRadius);
    expect(profiles.warrior.baseDamage).toBeGreaterThan(profiles.archer.baseDamage);
  });

  it("matches the common-tier single-target DPS fixtures", () => {
    // Given: the first-tier base profiles without criticals or ramp stacks.
    const dps = HERO_CLASSES.map((heroClass) => {
      const profile = getAttackProfile(heroClass, "common");
      return profile.baseDamage / (profile.attackIntervalMs / 1_000);
    });

    // When/Then: the formula produces the declared class cadence fixtures.
    expect(dps).toEqual([
      10,
      9,
      expect.closeTo(10.256_410_256_4, 10),
      expect.closeTo(7.333_333_333_3, 10),
    ]);
  });
});

describe("targeting and range previews", () => {
  const targets = [
    target("a", 60, 0.7, 60),
    target("b", 30, 0.2, 200),
    target("c", 30, 0.7, 100),
  ];

  it.each([
    ["first", "a"],
    ["last", "b"],
    ["strongest", "b"],
    ["nearest", "b"],
  ] as const)("chooses %s targets with stable ID tie breaks", (priority, expectedId) => {
    // Given: enemies with tied progress and distance.
    // When: a priority selects a target.
    const selected = selectTarget(hero("archer", "common", priority), targets);

    // Then: the documented priority and stable ID tie break win.
    expect(selected?.id).toBe(expectedId);
  });

  it("uses the exact same effective range for preview and attacks", () => {
    // Given: one enemy exactly on the archer's rare-tier boundary.
    const unit = hero("archer", "rare");
    const preview = getRangePreview(unit, { x: 10, y: 20 }, true);
    const boundaryTarget = { ...target("edge", 0, 0.5), position: { x: 260, y: 20 } };

    // When: selecting from the preview placement.
    const selected = selectTarget({ ...unit, position: preview.center }, [boundaryTarget]);

    // Then: preview and selection share the same radius and validity.
    expect(preview).toEqual({ center: { x: 10, y: 20 }, radius: 250, valid: true });
    expect(selected?.id).toBe("edge");
  });

  it("ignores inactive, dead, and stale out-of-range targets", () => {
    // Given: only stale targets.
    const staleTargets = [
      { ...target("inactive", 10, 1), active: false },
      { ...target("dead", 10, 1), health: 0 },
      target("far", 1_000, 1),
    ];

    // When/Then: selection and resolution explicitly report no success.
    expect(selectTarget(hero("warrior", "common"), staleTargets)).toBeNull();
    expect(resolveAttack(hero("warrior", "common"), staleTargets, createCombatState(), {
      criticalRoll: 0,
      damageNumbers: true,
    })).toEqual({ kind: "no-target", state: createCombatState(), hits: [], projectiles: [], damageEvents: [] });
  });
});

describe("attack resolution", () => {
  it("ramps warrior damage only while hitting the same target", () => {
    // Given: a warrior and two melee targets.
    const unit = hero("warrior", "common");
    const targets = [target("front", 40, 0.8, 1_000), target("back", 45, 0.2, 1_000)];
    const state = createCombatState();

    // When: the same target is hit three times, then priority changes targets.
    const first = resolveAttack(unit, targets, state, { criticalRoll: 0.99, damageNumbers: true });
    const second = resolveAttack(unit, targets, first.state, { criticalRoll: 0.99, damageNumbers: true });
    const third = resolveAttack(unit, targets, second.state, { criticalRoll: 0.99, damageNumbers: true });
    const switched = resolveAttack(
      { ...unit, priority: "last" },
      targets,
      third.state,
      { criticalRoll: 0.99, damageNumbers: true },
    );

    // Then: same-target damage rises and a target change resets it.
    expect(second.hits[0]?.damage).toBeGreaterThan(first.hits[0]?.damage ?? 0);
    expect(third.hits[0]?.damage).toBeGreaterThan(second.hits[0]?.damage ?? 0);
    expect(switched.hits[0]?.damage).toBe(first.hits[0]?.damage);
  });

  it("emits archer rain, rogue ricochets, and mage meteor with bounded hit sets", () => {
    // Given: six clustered targets.
    const targets = Array.from({ length: 6 }, (_, index) => target(`m-${index}`, 40 + index * 5, 1 - index / 10));

    // When: top-tier ranged classes attack.
    const rain = resolveAttack(hero("archer", "primordial"), targets, createCombatState(), { criticalRoll: 0.99, damageNumbers: true });
    const chain = resolveAttack(hero("rogue", "primordial"), targets, createCombatState(), { criticalRoll: 0.99, damageNumbers: true });
    const meteor = resolveAttack(hero("mage", "primordial"), targets, createCombatState(), { criticalRoll: 0.99, damageNumbers: true });

    // Then: projectile counts, ricochet paths, and AOE targets match each profile.
    expect(rain.projectiles).toHaveLength(4);
    expect(rain.hits.map((hit) => hit.targetId)).toEqual(targets.map((entry) => entry.id));
    expect(chain.projectiles).toHaveLength(5);
    expect(chain.projectiles.every((projectile) => projectile.targetIds.length <= 6)).toBe(true);
    expect(new Set(chain.hits.map((hit) => hit.targetId))).toHaveLength(6);
    expect(meteor.projectiles).toHaveLength(1);
    expect(meteor.hits.map((hit) => hit.targetId)).toEqual(targets.map((entry) => entry.id));
  });

  it("damages exactly the targets reached by rogue projectile paths", () => {
    // Given: more targets than five top-tier shurikens can reach through five bounces.
    const targets = Array.from({ length: 40 }, (_, index) => target(`chain-${index}`, 20 + index, 1 - index / 100));

    // When: the rogue attack resolves all projectile paths.
    const result = resolveAttack(hero("rogue", "primordial"), targets, createCombatState(), {
      criticalRoll: 0.99,
      damageNumbers: true,
    });

    // Then: no target receives damage without appearing on an actual path.
    const pathTargetIds = [...new Set(result.projectiles.flatMap((projectile) => projectile.targetIds))];
    expect(result.hits.map((hit) => hit.targetId)).toEqual(pathTargetIds);
  });

  it("applies the Task 4 formula at max upgrades before critical and boss modifiers", () => {
    // Given: a max-upgrade primordial mage, with 80% equipment attack, hitting a boss critically.
    const unit = {
      ...hero("mage", "primordial"),
      classUpgradeLevel: 10,
      tierUpgradeLevel: 10,
      equipmentAttackBonus: 0.8,
      criticalChance: 0.25,
    };

    // When: the critical boundary roll is just below the chance.
    const result = resolveAttack(unit, [target("boss", 20, 1, 10_000, true)], createCombatState(), {
      criticalRoll: 0.249_999,
      damageNumbers: true,
    });

    // Then: base × tier × class × tier-upgrade × equipment × critical × boss is exact.
    const task4Damage = 11 * 15 * 2 * 1.8 * 1.8;
    expect(result.hits[0]?.damage).toBeCloseTo(task4Damage * 2 * 0.8, 10);
    expect(result.damageEvents[0]).toMatchObject({
      value: task4Damage * 2 * 0.8,
      critical: true,
      boss: true,
      label: "치명타 · 보스",
      style: "critical-boss",
    });
  });

  it("suppresses damage-number events without changing resolved damage", () => {
    // Given: identical attacks with damage numbers on and off.
    const unit = { ...hero("archer", "epic"), criticalChance: 0.2 };
    const enemies = [target("enemy", 30, 1, 1_000)];

    // When: both attacks resolve with the same deterministic roll.
    const visible = resolveAttack(unit, enemies, createCombatState(), { criticalRoll: 0.1, damageNumbers: true });
    const hidden = resolveAttack(unit, enemies, createCombatState(), { criticalRoll: 0.1, damageNumbers: false });

    // Then: only feedback is suppressed.
    expect(hidden.hits).toEqual(visible.hits);
    expect(visible.damageEvents).toHaveLength(1);
    expect(hidden.damageEvents).toEqual([]);
  });

  it("rejects malformed rolls, duplicate targets, and formula inputs", () => {
    // Given: malformed deterministic inputs.
    const unit = hero("mage", "common");

    // When/Then: bad boundaries fail before combat mutates.
    expect(() => resolveAttack(unit, [target("a", 1, 1)], createCombatState(), { criticalRoll: Number.NaN, damageNumbers: true })).toThrow("criticalRoll");
    expect(() => resolveAttack(unit, [target("same", 1, 1), target("same", 2, 2)], createCombatState(), { criticalRoll: 0, damageNumbers: true })).toThrow("unique");
    expect(() => resolveAttack({ ...unit, classUpgradeLevel: 11 }, [target("a", 1, 1)], createCombatState(), { criticalRoll: 0, damageNumbers: true })).toThrow("classUpgradeLevel");
  });
});
