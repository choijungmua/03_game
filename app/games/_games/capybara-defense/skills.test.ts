import { describe, expect, it } from "vitest";
import { advanceSkillResources, beginSkillTargeting, cancelSkillTargeting, confirmSkillCast, createSkillState, getSkillPreview, getUnlockedSkills, type SkillEnemy, type SkillId } from "./skills";

const origin = Object.freeze({ x: 0, y: 0 });
const warriorRoster = Object.freeze([{ heroClass: "warrior", tier: "epic" }] as const);
const allRoster = Object.freeze([{ heroClass: "warrior", tier: "epic" }, { heroClass: "archer", tier: "epic" }, { heroClass: "rogue", tier: "epic" }, { heroClass: "mage", tier: "epic" }] as const);
const enemies = Object.freeze([
  { id: "normal-a", position: { x: 40, y: 0 }, boss: false, armor: 20, shield: 50, health: 200 },
  { id: "normal-b", position: { x: 80, y: 0 }, boss: false, armor: 12, shield: 30, health: 160 },
  { id: "boss", position: { x: 100, y: 0 }, boss: true, armor: 40, shield: 100, health: 1_000 },
] satisfies readonly SkillEnemy[]);

function aim(skillId: SkillId, state = createSkillState(100, 100), clockSpeed: 1 | 2 = 1) {
  return beginSkillTargeting(state, {
    skillId, roster: allRoster, upgradeLevel: 0, effectMultiplier: 1,
    cooldownMultiplier: 1, clockSpeed, origin, nowMs: 1_000,
  });
}

function cast(skillId: SkillId, target: { readonly kind: "self" } | { readonly kind: "point"; readonly position: { readonly x: number; readonly y: number } } | { readonly kind: "enemy"; readonly enemyId: string }) {
  const started = aim(skillId);
  expect(started.kind).toBe("targeting");
  if (started.kind !== "targeting") throw new Error("Expected targeting state");
  return confirmSkillCast(started.state, { target, enemies, nowMs: 1_000 });
}

describe("active skill unlocks and resources", () => {
  it("Given class and tier roster When unlocks are queried Then base skills unlock by class and advanced skills at epic", () => {
    // Given
    const roster = [{ heroClass: "warrior", tier: "common" }, { heroClass: "mage", tier: "epic" }] as const;
    // When
    const unlocked = getUnlockedSkills(roster);
    // Then
    expect(unlocked).toEqual(["war-cry", "binding-field", "meteor"]);
  });

  it("Given elapsed time, hits, and kills When mana regenerates Then every source contributes and max mana caps it", () => {
    // Given
    const state = createSkillState(120, 10);
    // When
    const next = advanceSkillResources(state, { elapsedMs: 5_000, hits: 4, kills: 2, nowMs: 6_000 });
    // Then
    expect(next.mana.current).toBeCloseTo(22.6);
    expect(advanceSkillResources(next, { elapsedMs: 500_000, hits: 0, kills: 0, nowMs: 506_000 }).mana.current).toBe(120);
  });

  it("Given a selected 2x speed When targeting is cancelled Then play slows above zero and restores exactly", () => {
    // Given
    const started = aim("war-cry", createSkillState(), 2);
    expect(started.kind).toBe("targeting");
    if (started.kind !== "targeting") throw new Error("Expected targeting state");
    // When
    const cancelled = cancelSkillTargeting(started.state);
    // Then
    expect(started.simulationSpeed).toBeGreaterThan(0);
    expect(started.simulationSpeed).toBeLessThan(2);
    expect(cancelled.simulationSpeed).toBe(2);
    expect(cancelled.state.mana.current).toBe(100);
    expect(cancelled.state.cooldownReadyAt["war-cry"]).toBeUndefined();
  });

  it("Given a selected 2x speed When a valid cast is confirmed Then play restores exactly to 2x", () => {
    // Given
    const started = aim("war-cry", createSkillState(), 2);
    expect(started.kind).toBe("targeting");
    if (started.kind !== "targeting") throw new Error("Expected targeting state");
    // When
    const result = confirmSkillCast(started.state, { target: { kind: "self" }, enemies, nowMs: 1_000 });
    // Then
    expect(result.kind).toBe("cast");
    if (result.kind !== "cast") throw new Error("Expected cast");
    expect(result.simulationSpeed).toBe(2);
  });

  it("Given insufficient mana When targeting begins Then required/current are reported without state change", () => {
    // Given
    const state = createSkillState(100, 20);
    // When
    const result = beginSkillTargeting(state, {
      skillId: "armor-break", roster: warriorRoster, upgradeLevel: 0, effectMultiplier: 1,
      cooldownMultiplier: 1, clockSpeed: 1, origin, nowMs: 500,
    });
    // Then
    expect(result).toMatchObject({ kind: "insufficient-mana", requiredMana: 45, currentMana: 20, state });
    expect(result.state).toBe(state);
  });

  it("Given a cooldown boundary When time reaches readyAt Then the skill becomes targetable", () => {
    // Given
    const first = cast("war-cry", { kind: "self" });
    expect(first.kind).toBe("cast");
    if (first.kind !== "cast") throw new Error("Expected cast");
    const readyAt = first.state.cooldownReadyAt["war-cry"];
    expect(readyAt).toBe(25_000);
    expect(first.state.mana.current).toBe(65);
    expect(first.simulationSpeed).toBe(1);
    // When
    const blocked = beginSkillTargeting(first.state, {
      skillId: "war-cry", roster: warriorRoster, upgradeLevel: 0, effectMultiplier: 1,
      cooldownMultiplier: 1, clockSpeed: 1, origin, nowMs: 24_999,
    });
    const ready = beginSkillTargeting(first.state, {
      skillId: "war-cry", roster: warriorRoster, upgradeLevel: 0, effectMultiplier: 1,
      cooldownMultiplier: 1, clockSpeed: 1, origin, nowMs: 25_000,
    });
    // Then
    expect(blocked).toMatchObject({ kind: "cooldown", remainingMs: 1 });
    expect(ready.kind).toBe("targeting");
  });

  it("Given a missing class When an advanced skill is selected Then it stays locked without consuming resources", () => {
    // Given
    const state = createSkillState();
    // When
    const result = beginSkillTargeting(state, {
      skillId: "meteor", roster: warriorRoster, upgradeLevel: 0, effectMultiplier: 1,
      cooldownMultiplier: 1, clockSpeed: 1, origin, nowMs: 0,
    });
    // Then
    expect(result).toEqual({ kind: "locked", state });
    expect(result.state).toBe(state);
  });
});

describe("eight distinct active skill effects", () => {
  it.each([
    ["war-cry", { kind: "self" }, "war-cry"],
    ["armor-break", { kind: "point", position: { x: 50, y: 0 } }, "armor-break"],
    ["arrow-rain", { kind: "point", position: { x: 50, y: 0 } }, "arrow-rain"],
    ["focused-shot", { kind: "self" }, "focused-shot"],
    ["chain-shuriken", { kind: "enemy", enemyId: "normal-a" }, "chain-shuriken"],
    ["weak-point", { kind: "enemy", enemyId: "normal-a" }, "weak-point"],
    ["binding-field", { kind: "point", position: { x: 50, y: 0 } }, "binding-field"],
    ["meteor", { kind: "point", position: { x: 50, y: 0 } }, "meteor"],
  ] as const)("Given %s When cast on a valid target Then its own effect is emitted", (skillId, target, effectKind) => {
    // Given / When
    const result = cast(skillId, target);
    // Then
    expect(result.kind).toBe("cast");
    if (result.kind !== "cast") throw new Error("Expected cast");
    expect(result.effect.kind).toBe(effectKind);
  });

  it("Given normal and boss enemies When armor break and binding field land Then boss debuffs are weaker", () => {
    // Given / When
    const armor = cast("armor-break", { kind: "point", position: { x: 50, y: 0 } });
    const bind = cast("binding-field", { kind: "point", position: { x: 50, y: 0 } });
    expect(armor.kind).toBe("cast");
    expect(bind.kind).toBe("cast");
    if (armor.kind !== "cast" || armor.effect.kind !== "armor-break" || bind.kind !== "cast" || bind.effect.kind !== "binding-field") {
      throw new Error("Expected debuff effects");
    }
    // Then
    const normalArmor = armor.effect.targets.find((target) => target.id === "normal-a");
    const bossArmor = armor.effect.targets.find((target) => target.id === "boss");
    const normalSlow = bind.effect.targets.find((target) => target.id === "normal-a");
    const bossSlow = bind.effect.targets.find((target) => target.id === "boss");
    expect(bossArmor?.armorReduction).toBeLessThan(normalArmor?.armorReduction ?? 0);
    expect(bossSlow?.speedMultiplier).toBeGreaterThan(normalSlow?.speedMultiplier ?? 1);
  });

  it("Given a normal shield and boss shield When meteor lands Then normal breaks and boss retains resistant shield", () => {
    // Given / When
    const result = cast("meteor", { kind: "point", position: { x: 50, y: 0 } });
    expect(result.kind).toBe("cast");
    if (result.kind !== "cast" || result.effect.kind !== "meteor") throw new Error("Expected meteor");
    // Then
    expect(result.effect.targets.find((target) => target.id === "normal-a")?.shieldDamage).toBe(50);
    expect(result.effect.targets.find((target) => target.id === "boss")?.shieldDamage).toBeLessThan(100);
  });

  it("Given warriors When battle cry is cast Then both attack and attack speed are boosted for a duration", () => {
    // Given / When
    const result = cast("war-cry", { kind: "self" });
    // Then
    expect(result.kind).toBe("cast");
    if (result.kind !== "cast" || result.effect.kind !== "war-cry") throw new Error("Expected battle cry");
    expect(result.effect.attackMultiplier).toBeGreaterThan(1);
    expect(result.effect.attackSpeedMultiplier).toBeGreaterThan(1);
    expect(result.effect.durationMs).toBeGreaterThan(0);
  });

  it("Given grouped enemies When arrow rain lands Then it deals repeated area damage", () => {
    // Given / When
    const result = cast("arrow-rain", { kind: "point", position: { x: 50, y: 0 } });
    // Then
    expect(result.kind).toBe("cast");
    if (result.kind !== "cast" || result.effect.kind !== "arrow-rain") throw new Error("Expected arrow rain");
    expect(result.effect.targetIds).toEqual(["normal-a", "normal-b", "boss"]);
    expect(result.effect.volleys).toBeGreaterThanOrEqual(5);
    expect(result.effect.damagePerVolley).toBeGreaterThan(0);
  });

  it("Given archers When focused shot is cast Then range and projectile count rise together", () => {
    // Given / When
    const result = cast("focused-shot", { kind: "self" });
    // Then
    expect(result.kind).toBe("cast");
    if (result.kind !== "cast" || result.effect.kind !== "focused-shot") throw new Error("Expected focused shot");
    expect(result.effect.rangeMultiplier).toBeGreaterThan(1);
    expect(result.effect.projectileBonus).toBeGreaterThanOrEqual(1);
    expect(result.effect.durationMs).toBeGreaterThan(0);
  });

  it("Given nearby enemies When chain shuriken is cast Then it bounces with decaying damage", () => {
    // Given / When
    const result = cast("chain-shuriken", { kind: "enemy", enemyId: "normal-a" });
    // Then
    expect(result.kind).toBe("cast");
    if (result.kind !== "cast" || result.effect.kind !== "chain-shuriken") throw new Error("Expected chain shuriken");
    expect(result.effect.targetIds).toEqual(["normal-a", "normal-b", "boss"]);
    expect(result.effect.damages[0]).toBeGreaterThan(result.effect.damages[1] ?? Number.POSITIVE_INFINITY);
  });

  it("Given an enemy When weak point is marked Then damage taken and critical chance rise for a duration", () => {
    // Given / When
    const result = cast("weak-point", { kind: "enemy", enemyId: "normal-a" });
    // Then
    expect(result.kind).toBe("cast");
    if (result.kind !== "cast" || result.effect.kind !== "weak-point") throw new Error("Expected weak point");
    expect(result.effect.targetId).toBe("normal-a");
    expect(result.effect.damageTakenMultiplier).toBeGreaterThan(1);
    expect(result.effect.criticalChanceBonus).toBeGreaterThan(0);
    expect(result.effect.durationMs).toBeGreaterThan(0);
  });

  it("Given higher tier and upgrades When a preview is calculated Then effect/range improve and cooldown drops", () => {
    // Given
    const common = getSkillPreview("arrow-rain", { tier: "common", upgradeLevel: 0, effectMultiplier: 1, cooldownMultiplier: 1 });
    // When
    const upgraded = getSkillPreview("arrow-rain", { tier: "primordial", upgradeLevel: 5, effectMultiplier: 1.2, cooldownMultiplier: 0.9 });
    // Then
    expect(upgraded.effectScale).toBeGreaterThan(common.effectScale);
    expect(upgraded.range).toBeGreaterThan(common.range);
    expect(upgraded.cooldownMs).toBeLessThan(common.cooldownMs);
  });

  it("Given extreme finite multipliers When a preview is calculated Then overflow is rejected", () => {
    // Given / When / Then
    expect(() => getSkillPreview("meteor", {
      tier: "primordial", upgradeLevel: 10, effectMultiplier: Number.MAX_VALUE, cooldownMultiplier: 1,
    })).toThrow();
    expect(() => getSkillPreview("meteor", {
      tier: "primordial", upgradeLevel: 10, effectMultiplier: 1, cooldownMultiplier: Number.MAX_VALUE,
    })).toThrow();
  });

  it("Given maximum supported scaling When binding field lands Then boss slow resistance remains stronger", () => {
    // Given
    const started = beginSkillTargeting(createSkillState(), {
      skillId: "binding-field", roster: allRoster, upgradeLevel: 10, effectMultiplier: 2,
      cooldownMultiplier: 1, clockSpeed: 1, origin, nowMs: 1_000,
    });
    expect(started.kind).toBe("targeting");
    if (started.kind !== "targeting") throw new Error("Expected targeting state");
    // When
    const result = confirmSkillCast(started.state, { target: { kind: "point", position: { x: 50, y: 0 } }, enemies, nowMs: 1_000 });
    // Then
    expect(result.kind).toBe("cast");
    if (result.kind !== "cast" || result.effect.kind !== "binding-field") throw new Error("Expected binding field");
    const normal = result.effect.targets.find((target) => target.id === "normal-a");
    const boss = result.effect.targets.find((target) => target.id === "boss");
    expect(boss?.speedMultiplier).toBeGreaterThan(normal?.speedMultiplier ?? 1);
  });
});

describe("invalid and adversarial skill input", () => {
  it("Given a stale target When cast is confirmed Then mana, cooldown, and world snapshot remain unchanged", () => {
    // Given
    const started = aim("weak-point");
    expect(started.kind).toBe("targeting");
    if (started.kind !== "targeting") throw new Error("Expected targeting state");
    // When
    const result = confirmSkillCast(started.state, { target: { kind: "enemy", enemyId: "stale" }, enemies, nowMs: 1_000 });
    // Then
    expect(result).toMatchObject({ kind: "invalid-target", reason: "missing-enemy", state: started.state });
    expect(result.state).toBe(started.state);
    expect(enemies[0]?.shield).toBe(50);
  });

  it("Given a defeated target When cast is confirmed Then it is rejected as stale without resource use", () => {
    // Given
    const started = aim("weak-point");
    expect(started.kind).toBe("targeting");
    if (started.kind !== "targeting") throw new Error("Expected targeting state");
    const defeated = [{ ...enemies[0], health: 0 }].filter((enemy): enemy is SkillEnemy => enemy !== undefined);
    // When
    const result = confirmSkillCast(started.state, { target: { kind: "enemy", enemyId: "normal-a" }, enemies: defeated, nowMs: 1_000 });
    // Then
    expect(result).toMatchObject({ kind: "invalid-target", reason: "missing-enemy", state: started.state });
    expect(result.state).toBe(started.state);
  });

  it("Given a point outside cast range When confirmed Then no resource is consumed", () => {
    // Given
    const started = aim("meteor");
    expect(started.kind).toBe("targeting");
    if (started.kind !== "targeting") throw new Error("Expected targeting state");
    // When
    const result = confirmSkillCast(started.state, { target: { kind: "point", position: { x: 10_000, y: 0 } }, enemies, nowMs: 1_000 });
    // Then
    expect(result.kind).toBe("invalid-target");
    expect(result.state.mana.current).toBe(100);
    expect(result.state.cooldownReadyAt.meteor).toBeUndefined();
  });

  it("Given the wrong target kind When confirmed Then targeting remains active and resources stay unchanged", () => {
    // Given
    const started = aim("chain-shuriken");
    expect(started.kind).toBe("targeting");
    if (started.kind !== "targeting") throw new Error("Expected targeting state");
    // When
    const result = confirmSkillCast(started.state, { target: { kind: "self" }, enemies, nowMs: 1_000 });
    // Then
    expect(result).toMatchObject({ kind: "invalid-target", reason: "wrong-kind", state: started.state });
    expect(result.state).toBe(started.state);
  });

  it("Given malformed time, counters, state, or duplicate targets When processed Then the boundary rejects it", () => {
    // Given / When / Then
    expect(() => advanceSkillResources(createSkillState(), { elapsedMs: Number.NaN, hits: 0, kills: 0, nowMs: 0 })).toThrow();
    expect(() => advanceSkillResources(createSkillState(), { elapsedMs: 0, hits: -1, kills: 0, nowMs: 0 })).toThrow();
    expect(() => createSkillState(50, 51)).toThrow();
    const started = aim("meteor");
    if (started.kind !== "targeting") throw new Error("Expected targeting state");
    expect(() => confirmSkillCast(started.state, {
      target: { kind: "point", position: origin }, enemies: [enemies[0], enemies[0]].filter((enemy): enemy is SkillEnemy => enemy !== undefined), nowMs: 1_000,
    })).toThrow();
    expect(() => confirmSkillCast(started.state, { target: { kind: "point", position: origin }, enemies, nowMs: 999 })).toThrow();
  });
});
