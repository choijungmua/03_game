import { HERO_TIERS, SKILLS } from "./constants";
import type { ClockSpeed, HeroClass, HeroTier, MapPoint } from "./types";
import { DefenseConfigError } from "./types";

export const SKILL_IDS = ["war-cry", "armor-break", "arrow-rain", "focused-shot", "chain-shuriken", "weak-point", "binding-field", "meteor"] as const;
export type SkillId = (typeof SKILL_IDS)[number];
type TargetKind = "self" | "point" | "enemy";

export const MANA_RULES = Object.freeze({ baseMax: 100, perSecond: 1.2, perHit: 0.4, perKill: 2.5 });
const TARGET_KINDS = Object.freeze({
  "war-cry": "self", "armor-break": "point", "arrow-rain": "point", "focused-shot": "self",
  "chain-shuriken": "enemy", "weak-point": "enemy", "binding-field": "point", meteor: "point",
} as const satisfies Readonly<Record<SkillId, TargetKind>>);
const ADVANCED_SKILLS = new Set<SkillId>(["armor-break", "focused-shot", "weak-point", "meteor"]);
const TARGETING_SPEED_RATIO = 0.35;
const BOSS_ARMOR_BREAK_RATIO = 0.45;
const BOSS_SLOW_RATIO = 0.4;
const MAX_SKILL_MULTIPLIER = 2;

export type SkillRosterMember = { readonly heroClass: HeroClass; readonly tier: HeroTier };
export type SkillEnemy = {
  readonly id: string;
  readonly position: MapPoint;
  readonly boss: boolean;
  readonly armor: number;
  readonly shield: number;
  readonly health: number;
};
export type SkillTarget =
  | { readonly kind: "self" }
  | { readonly kind: "point"; readonly position: MapPoint }
  | { readonly kind: "enemy"; readonly enemyId: string };
export type SkillPreview = {
  readonly skillId: SkillId;
  readonly manaCost: number;
  readonly cooldownMs: number;
  readonly range: number;
  readonly durationMs: number;
  readonly effectScale: number;
  readonly targetKind: TargetKind;
};
type SkillTargeting = SkillPreview & {
  readonly origin: MapPoint;
  readonly previousSpeed: ClockSpeed;
  readonly startedAtMs: number;
};
export type SkillState = {
  readonly mana: { readonly current: number; readonly max: number };
  readonly cooldownReadyAt: Readonly<Partial<Record<SkillId, number>>>;
  readonly targeting: SkillTargeting | null;
};

type ArmorTarget = { readonly id: string; readonly armorReduction: number; readonly shieldDamage: number };
type SlowTarget = { readonly id: string; readonly speedMultiplier: number };
type MeteorTarget = { readonly id: string; readonly damage: number; readonly shieldDamage: number };
export type SkillEffect =
  | { readonly kind: "war-cry"; readonly attackMultiplier: number; readonly attackSpeedMultiplier: number; readonly durationMs: number }
  | { readonly kind: "armor-break"; readonly targets: readonly ArmorTarget[]; readonly durationMs: number }
  | { readonly kind: "arrow-rain"; readonly targetIds: readonly string[]; readonly volleys: number; readonly damagePerVolley: number }
  | { readonly kind: "focused-shot"; readonly rangeMultiplier: number; readonly projectileBonus: number; readonly durationMs: number }
  | { readonly kind: "chain-shuriken"; readonly targetIds: readonly string[]; readonly damages: readonly number[] }
  | { readonly kind: "weak-point"; readonly targetId: string; readonly damageTakenMultiplier: number; readonly criticalChanceBonus: number; readonly durationMs: number }
  | { readonly kind: "binding-field"; readonly targets: readonly SlowTarget[]; readonly durationMs: number }
  | { readonly kind: "meteor"; readonly targets: readonly MeteorTarget[] };

export type SkillStartResult =
  | { readonly kind: "targeting"; readonly state: SkillState; readonly simulationSpeed: number; readonly preview: SkillPreview }
  | { readonly kind: "locked"; readonly state: SkillState }
  | { readonly kind: "cooldown"; readonly state: SkillState; readonly remainingMs: number }
  | { readonly kind: "insufficient-mana"; readonly state: SkillState; readonly requiredMana: number; readonly currentMana: number };
export type SkillCastResult =
  | { readonly kind: "cast"; readonly state: SkillState; readonly simulationSpeed: ClockSpeed; readonly effect: SkillEffect }
  | { readonly kind: "invalid-target"; readonly state: SkillState; readonly reason: "wrong-kind" | "missing-enemy" | "out-of-range" };

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new DefenseConfigError(`${name} must be finite and non-negative`);
}

function tierIndex(tier: HeroTier): number {
  return HERO_TIERS.indexOf(tier);
}

function definitionFor(skillId: SkillId) {
  const definition = SKILLS.find((candidate) => candidate.id === skillId);
  if (definition === undefined) throw new DefenseConfigError(`Unknown skill: ${skillId}`);
  return definition;
}

function classFor(skillId: SkillId): HeroClass {
  return definitionFor(skillId).heroClass;
}

export function createSkillState(maxMana: number = MANA_RULES.baseMax, currentMana: number = maxMana): SkillState {
  assertFinite(maxMana, "maxMana");
  assertFinite(currentMana, "currentMana");
  if (maxMana === 0 || currentMana > maxMana) throw new DefenseConfigError("Mana must satisfy 0 <= current <= max and max > 0");
  return Object.freeze({ mana: Object.freeze({ current: currentMana, max: maxMana }), cooldownReadyAt: Object.freeze({}), targeting: null });
}

export function getUnlockedSkills(roster: readonly SkillRosterMember[]): readonly SkillId[] {
  return SKILL_IDS.filter((skillId) => roster.some((hero) =>
    hero.heroClass === classFor(skillId) && (!ADVANCED_SKILLS.has(skillId) || tierIndex(hero.tier) >= tierIndex("epic")),
  ));
}

export function getSkillPreview(skillId: SkillId, input: {
  readonly tier: HeroTier; readonly upgradeLevel: number; readonly effectMultiplier: number; readonly cooldownMultiplier: number;
}): SkillPreview {
  if (!Number.isInteger(input.upgradeLevel) || input.upgradeLevel < 0 || input.upgradeLevel > 10) throw new DefenseConfigError("upgradeLevel must be an integer from 0 to 10");
  assertFinite(input.effectMultiplier, "effectMultiplier");
  assertFinite(input.cooldownMultiplier, "cooldownMultiplier");
  if (input.effectMultiplier === 0 || input.effectMultiplier > MAX_SKILL_MULTIPLIER || input.cooldownMultiplier === 0 || input.cooldownMultiplier > MAX_SKILL_MULTIPLIER) {
    throw new DefenseConfigError(`Skill multipliers must be greater than zero and at most ${MAX_SKILL_MULTIPLIER}`);
  }
  const definition = definitionFor(skillId);
  const tierLevel = tierIndex(input.tier);
  const effectScale = (1 + tierLevel * 0.15 + input.upgradeLevel * 0.1) * input.effectMultiplier;
  return Object.freeze({
    skillId, manaCost: definition.manaCost,
    cooldownMs: Math.round(definition.cooldownMs * Math.max(0.35, input.cooldownMultiplier * (1 - input.upgradeLevel * 0.025))),
    range: Math.round(definition.radius * (1 + tierLevel * 0.03 + input.upgradeLevel * 0.02)),
    durationMs: Math.round(definition.durationMs * effectScale), effectScale, targetKind: TARGET_KINDS[skillId],
  });
}

export function advanceSkillResources(state: SkillState, input: { readonly elapsedMs: number; readonly hits: number; readonly kills: number; readonly nowMs: number }): SkillState {
  assertFinite(input.elapsedMs, "elapsedMs");
  assertFinite(input.nowMs, "nowMs");
  if (!Number.isInteger(input.hits) || input.hits < 0 || !Number.isInteger(input.kills) || input.kills < 0) {
    throw new DefenseConfigError("Mana hit and kill counts must be non-negative integers");
  }
  const recovered = input.elapsedMs / 1_000 * MANA_RULES.perSecond + input.hits * MANA_RULES.perHit + input.kills * MANA_RULES.perKill;
  const cooldownReadyAt = Object.fromEntries(Object.entries(state.cooldownReadyAt).filter(([, readyAt]) => readyAt > input.nowMs));
  return Object.freeze({ ...state, mana: Object.freeze({ ...state.mana, current: Math.min(state.mana.max, state.mana.current + recovered) }), cooldownReadyAt: Object.freeze(cooldownReadyAt) });
}

function strongestTier(roster: readonly SkillRosterMember[], heroClass: HeroClass): HeroTier | null {
  let strongest: HeroTier | null = null;
  for (const hero of roster) if (hero.heroClass === heroClass && (strongest === null || tierIndex(hero.tier) > tierIndex(strongest))) strongest = hero.tier;
  return strongest;
}

export function beginSkillTargeting(state: SkillState, input: {
  readonly skillId: SkillId; readonly roster: readonly SkillRosterMember[]; readonly upgradeLevel: number;
  readonly effectMultiplier: number; readonly cooldownMultiplier: number; readonly clockSpeed: ClockSpeed;
  readonly origin: MapPoint; readonly nowMs: number;
}): SkillStartResult {
  assertFinite(input.nowMs, "nowMs");
  assertFinite(input.origin.x, "origin.x");
  assertFinite(input.origin.y, "origin.y");
  const tier = strongestTier(input.roster, classFor(input.skillId));
  if (tier === null || !getUnlockedSkills(input.roster).includes(input.skillId)) return Object.freeze({ kind: "locked", state });
  const preview = getSkillPreview(input.skillId, { tier, upgradeLevel: input.upgradeLevel, effectMultiplier: input.effectMultiplier, cooldownMultiplier: input.cooldownMultiplier });
  const readyAt = state.cooldownReadyAt[input.skillId] ?? 0;
  if (readyAt > input.nowMs) return Object.freeze({ kind: "cooldown", state, remainingMs: readyAt - input.nowMs });
  if (state.mana.current < preview.manaCost) return Object.freeze({ kind: "insufficient-mana", state, requiredMana: preview.manaCost, currentMana: state.mana.current });
  const targeting = Object.freeze({ ...preview, origin: Object.freeze({ ...input.origin }), previousSpeed: input.clockSpeed, startedAtMs: input.nowMs });
  const nextState = Object.freeze({ ...state, targeting });
  return Object.freeze({ kind: "targeting", state: nextState, simulationSpeed: input.clockSpeed * TARGETING_SPEED_RATIO, preview });
}

export function cancelSkillTargeting(state: SkillState): { readonly state: SkillState; readonly simulationSpeed: ClockSpeed } {
  if (state.targeting === null) throw new DefenseConfigError("No skill targeting is active");
  return Object.freeze({ state: Object.freeze({ ...state, targeting: null }), simulationSpeed: state.targeting.previousSpeed });
}

function distance(left: MapPoint, right: MapPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function areaEnemies(center: MapPoint, radius: number, enemies: readonly SkillEnemy[]): readonly SkillEnemy[] {
  return enemies.filter((enemy) => enemy.health > 0 && distance(center, enemy.position) <= radius);
}

function validateEnemies(enemies: readonly SkillEnemy[]): void {
  if (new Set(enemies.map((enemy) => enemy.id)).size !== enemies.length) throw new DefenseConfigError("Skill enemy IDs must be unique");
  for (const enemy of enemies) {
    assertFinite(enemy.position.x, "enemy.position.x"); assertFinite(enemy.position.y, "enemy.position.y");
    assertFinite(enemy.armor, "enemy.armor"); assertFinite(enemy.shield, "enemy.shield"); assertFinite(enemy.health, "enemy.health");
  }
}

function assertNever(value: never): never {
  throw new DefenseConfigError(`Unknown skill target: ${String(value)}`);
}

function targetPoint(targeting: SkillTargeting, point: MapPoint): MapPoint | "out-of-range" {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || distance(targeting.origin, point) > targeting.range) return "out-of-range";
  return point;
}

function targetCenter(targeting: SkillTargeting, target: SkillTarget, enemies: readonly SkillEnemy[]): MapPoint | "wrong-kind" | "missing-enemy" | "out-of-range" {
  if (target.kind !== targeting.targetKind) return "wrong-kind";
  switch (target.kind) {
    case "self": return targeting.origin;
    case "point": return targetPoint(targeting, target.position);
    case "enemy": {
      const enemy = enemies.find((candidate) => candidate.id === target.enemyId && candidate.health > 0);
      return enemy === undefined ? "missing-enemy" : targetPoint(targeting, enemy.position);
    }
    default: return assertNever(target);
  }
}

function skillEffect(input: { readonly targeting: SkillTargeting; readonly target: SkillTarget; readonly center: MapPoint; readonly enemies: readonly SkillEnemy[] }): SkillEffect {
  const { targeting, target, center, enemies } = input;
  const scale = targeting.effectScale;
  const affected = areaEnemies(center, targeting.range, enemies);
  switch (targeting.skillId) {
    case "war-cry": return Object.freeze({ kind: "war-cry", attackMultiplier: 1 + 0.25 * scale, attackSpeedMultiplier: 1 + 0.18 * scale, durationMs: targeting.durationMs });
    case "armor-break": return Object.freeze({ kind: "armor-break", durationMs: targeting.durationMs, targets: affected.map((enemy) => Object.freeze({ id: enemy.id, armorReduction: Math.min(enemy.armor * (enemy.boss ? 0.35 : 0.8), 10 * scale * (enemy.boss ? BOSS_ARMOR_BREAK_RATIO : 1)), shieldDamage: Math.min(enemy.shield * (enemy.boss ? 0.35 : 0.8), 30 * scale * (enemy.boss ? BOSS_ARMOR_BREAK_RATIO : 1)) })) });
    case "arrow-rain": return Object.freeze({ kind: "arrow-rain", targetIds: affected.map((enemy) => enemy.id), volleys: 5 + Math.floor(scale), damagePerVolley: 12 * scale });
    case "focused-shot": return Object.freeze({ kind: "focused-shot", rangeMultiplier: 1 + 0.3 * scale, projectileBonus: Math.max(1, Math.floor(scale)), durationMs: targeting.durationMs });
    case "chain-shuriken": {
      if (target.kind !== "enemy") throw new DefenseConfigError("Chain shuriken requires an enemy target");
      const primary = enemies.find((enemy) => enemy.id === target.enemyId);
      if (primary === undefined) throw new DefenseConfigError("Chain shuriken target disappeared");
      const chain = [primary, ...enemies.filter((enemy) => enemy !== primary && enemy.health > 0).toSorted((left, right) => distance(primary.position, left.position) - distance(primary.position, right.position))].slice(0, 3 + Math.floor(scale));
      return Object.freeze({ kind: "chain-shuriken", targetIds: chain.map((enemy) => enemy.id), damages: chain.map((_, index) => 36 * scale * 0.8 ** index) });
    }
    case "weak-point": {
      if (target.kind !== "enemy") throw new DefenseConfigError("Weak point requires an enemy target");
      return Object.freeze({ kind: "weak-point", targetId: target.enemyId, damageTakenMultiplier: 1 + 0.22 * scale, criticalChanceBonus: 0.12 * scale, durationMs: targeting.durationMs });
    }
    case "binding-field": return Object.freeze({ kind: "binding-field", durationMs: targeting.durationMs, targets: affected.map((enemy) => Object.freeze({ id: enemy.id, speedMultiplier: Math.max(enemy.boss ? 0.65 : 0.2, 1 - 0.45 * scale * (enemy.boss ? BOSS_SLOW_RATIO : 1)) })) });
    case "meteor": return Object.freeze({ kind: "meteor", targets: affected.map((enemy) => Object.freeze({ id: enemy.id, damage: 90 * scale, shieldDamage: enemy.boss ? Math.min(enemy.shield * 0.35, 35 * scale) : enemy.shield })) });
  }
}

export function confirmSkillCast(state: SkillState, input: { readonly target: SkillTarget; readonly enemies: readonly SkillEnemy[]; readonly nowMs: number }): SkillCastResult {
  if (state.targeting === null) throw new DefenseConfigError("No skill targeting is active");
  assertFinite(input.nowMs, "nowMs");
  if (input.nowMs < state.targeting.startedAtMs) throw new DefenseConfigError("Cast time cannot precede targeting time");
  validateEnemies(input.enemies);
  const center = targetCenter(state.targeting, input.target, input.enemies);
  if (typeof center === "string") return Object.freeze({ kind: "invalid-target", state, reason: center });
  const effect = skillEffect({ targeting: state.targeting, target: input.target, center, enemies: input.enemies });
  const nextState = Object.freeze({
    mana: Object.freeze({ ...state.mana, current: state.mana.current - state.targeting.manaCost }),
    cooldownReadyAt: Object.freeze({ ...state.cooldownReadyAt, [state.targeting.skillId]: input.nowMs + state.targeting.cooldownMs }),
    targeting: null,
  });
  return Object.freeze({ kind: "cast", state: nextState, simulationSpeed: state.targeting.previousSpeed, effect });
}
