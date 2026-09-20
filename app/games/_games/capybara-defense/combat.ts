import type { DefenseFrameId } from "./assets";
import { calculateAttackDamage } from "./balance";
import { DEFENSE_RULES, HERO_STATS, HERO_TIERS } from "./constants";
import type { HeroClass, HeroTier, MapPoint, TargetPriority } from "./types";
import { DefenseConfigError } from "./types";

export type CombatHero = Readonly<{
  id: string;
  heroClass: HeroClass;
  tier: HeroTier;
  position: MapPoint;
  priority: TargetPriority;
  classUpgradeLevel: number;
  tierUpgradeLevel: number;
  equipmentAttackBonus: number;
  criticalChance: number;
}>;

export type CombatTarget = Readonly<{
  id: string;
  position: MapPoint;
  progress: number;
  health: number;
  maxHealth: number;
  armor: number;
  boss: boolean;
  active: boolean;
}>;

export type AttackKind = "melee-ramp" | "arrow" | "arrow-rain" | "shuriken" | "energy-bolt" | "meteor";

export type AttackProfile = Readonly<{
  attackKind: AttackKind;
  baseDamage: number;
  attackIntervalMs: number;
  range: number;
  projectileCount: number;
  bounceCount: number;
  areaRadius: number;
  maxRampHits: number;
  projectileFrame: DefenseFrameId;
  effectFrame: DefenseFrameId;
}>;

export type CombatState = Readonly<{
  warriorTargetId: string | null;
  warriorRampHits: number;
}>;

export type DamageHit = Readonly<{
  targetId: string;
  damage: number;
}>;

export type DamageEvent = Readonly<{
  targetId: string;
  value: number;
  critical: boolean;
  boss: boolean;
  label: "일반" | "치명타" | "보스" | "치명타 · 보스";
  style: "normal" | "critical" | "boss" | "critical-boss";
}>;

export type CombatProjectile = Readonly<{
  frame: DefenseFrameId;
  effectFrame: DefenseFrameId;
  targetIds: readonly string[];
}>;

export type AttackResult = Readonly<{
  kind: "hit" | "no-target";
  state: CombatState;
  hits: readonly DamageHit[];
  projectiles: readonly CombatProjectile[];
  damageEvents: readonly DamageEvent[];
}>;

type AttackOptions = Readonly<{
  criticalRoll: number;
  damageNumbers: boolean;
}>;

const WARRIOR_RAMP_HITS = [3, 4, 5, 6, 7, 8] as const;
const ARCHER_AREA_RADIUS = [0, 0, 0, 56, 76, 96] as const;
const ROGUE_BOUNCES = [0, 1, 2, 3, 4, 5] as const;
const MAGE_AREA_RADIUS = [0, 0, 44, 64, 88, 112] as const;
const PROJECTILE_FRAMES = {
  warrior: "projectile.acorn",
  archer: "projectile.leaf-dart",
  rogue: "projectile.golden-seed",
  mage: "projectile.water-drop",
} as const satisfies Readonly<Record<HeroClass, DefenseFrameId>>;
const EFFECT_FRAMES = {
  warrior: "skill.ground-thump",
  archer: "skill.leaf-volley",
  rogue: "skill.acorn-barrage",
  mage: "skill.firefly-swarm",
} as const satisfies Readonly<Record<HeroClass, DefenseFrameId>>;

function assertNever(value: never): never {
  throw new DefenseConfigError(`Unhandled combat variant: ${String(value)}`);
}

function tierIndex(tier: HeroTier): number {
  return HERO_TIERS.indexOf(tier);
}

function attackKind(heroClass: HeroClass, index: number): AttackKind {
  switch (heroClass) {
    case "warrior": return "melee-ramp";
    case "archer": return index >= 3 ? "arrow-rain" : "arrow";
    case "rogue": return "shuriken";
    case "mage": return index >= 2 ? "meteor" : "energy-bolt";
    default: return assertNever(heroClass);
  }
}

export function getAttackProfile(heroClass: HeroClass, tier: HeroTier): AttackProfile {
  const index = tierIndex(tier);
  const stats = HERO_STATS[heroClass];
  return Object.freeze({
    attackKind: attackKind(heroClass, index),
    baseDamage: calculateAttackDamage({ heroClass, tier, classUpgradeLevel: 0, tierUpgradeLevel: 0, equipmentAttackBonus: 0 }),
    attackIntervalMs: stats.attackIntervalMs[index] ?? stats.attackIntervalMs[0],
    range: stats.range[index] ?? stats.range[0],
    projectileCount: stats.projectileCount[index] ?? stats.projectileCount[0],
    bounceCount: heroClass === "rogue" ? (ROGUE_BOUNCES[index] ?? 0) : 0,
    areaRadius: heroClass === "archer"
      ? (ARCHER_AREA_RADIUS[index] ?? 0)
      : heroClass === "mage" ? (MAGE_AREA_RADIUS[index] ?? 0) : 0,
    maxRampHits: heroClass === "warrior" ? (WARRIOR_RAMP_HITS[index] ?? 0) : 0,
    projectileFrame: PROJECTILE_FRAMES[heroClass],
    effectFrame: EFFECT_FRAMES[heroClass],
  });
}

export function createCombatState(): CombatState {
  return Object.freeze({ warriorTargetId: null, warriorRampHits: 0 });
}

export function getRangePreview(hero: CombatHero, center: MapPoint, valid: boolean): Readonly<{ center: MapPoint; radius: number; valid: boolean }> {
  return Object.freeze({ center: Object.freeze({ ...center }), radius: getAttackProfile(hero.heroClass, hero.tier).range, valid });
}

function distanceSquared(left: MapPoint, right: MapPoint): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function compareTargets(priority: TargetPriority, origin: MapPoint, left: CombatTarget, right: CombatTarget): number {
  switch (priority) {
    case "first": return right.progress - left.progress || left.id.localeCompare(right.id);
    case "last": return left.progress - right.progress || left.id.localeCompare(right.id);
    case "strongest": return right.maxHealth - left.maxHealth || right.health - left.health || left.id.localeCompare(right.id);
    case "nearest": return distanceSquared(origin, left.position) - distanceSquared(origin, right.position) || left.id.localeCompare(right.id);
    default: return assertNever(priority);
  }
}

function eligibleTargets(hero: CombatHero, targets: readonly CombatTarget[]): readonly CombatTarget[] {
  const rangeSquared = getAttackProfile(hero.heroClass, hero.tier).range ** 2;
  return targets
    .filter((candidate) => candidate.active && candidate.health > 0 && distanceSquared(hero.position, candidate.position) <= rangeSquared)
    .toSorted((left, right) => compareTargets(hero.priority, hero.position, left, right));
}

export function selectTarget(hero: CombatHero, targets: readonly CombatTarget[]): CombatTarget | null {
  return eligibleTargets(hero, targets)[0] ?? null;
}

function validateAttack(hero: CombatHero, targets: readonly CombatTarget[], options: AttackOptions): void {
  if (!Number.isFinite(options.criticalRoll) || options.criticalRoll < 0 || options.criticalRoll >= 1) {
    throw new DefenseConfigError("criticalRoll must be finite and between 0 inclusive and 1 exclusive");
  }
  if (!Number.isInteger(hero.classUpgradeLevel) || hero.classUpgradeLevel < 0 || hero.classUpgradeLevel > DEFENSE_RULES.maxUpgradeLevel) {
    throw new DefenseConfigError(`classUpgradeLevel must be between 0 and ${DEFENSE_RULES.maxUpgradeLevel}`);
  }
  if (!Number.isInteger(hero.tierUpgradeLevel) || hero.tierUpgradeLevel < 0 || hero.tierUpgradeLevel > DEFENSE_RULES.maxUpgradeLevel) {
    throw new DefenseConfigError(`tierUpgradeLevel must be between 0 and ${DEFENSE_RULES.maxUpgradeLevel}`);
  }
  if (!Number.isFinite(hero.equipmentAttackBonus) || hero.equipmentAttackBonus < 0) {
    throw new DefenseConfigError("equipmentAttackBonus must be finite and non-negative");
  }
  if (!Number.isFinite(hero.criticalChance) || hero.criticalChance < 0 || hero.criticalChance > 1) {
    throw new DefenseConfigError("criticalChance must be between 0 and 1");
  }
  if (new Set(targets.map((target) => target.id)).size !== targets.length) {
    throw new DefenseConfigError("Combat target IDs must be unique");
  }
}

function projectilePaths(profile: AttackProfile, ordered: readonly CombatTarget[], primary: CombatTarget): readonly (readonly string[])[] {
  if (profile.attackKind === "shuriken") {
    return Array.from({ length: profile.projectileCount }, (_, index) =>
      ordered.slice(index).concat(ordered.slice(0, index)).slice(0, profile.bounceCount + 1).map((target) => target.id),
    );
  }
  if (profile.attackKind === "arrow" && profile.projectileCount > 1) {
    return ordered.slice(0, profile.projectileCount).map((target) => [target.id]);
  }
  return Array.from({ length: profile.projectileCount }, () => [primary.id]);
}

function attackedTargets(
  profile: AttackProfile,
  ordered: readonly CombatTarget[],
  primary: CombatTarget,
  paths: readonly (readonly string[])[],
): readonly CombatTarget[] {
  if (profile.areaRadius > 0) {
    const radiusSquared = profile.areaRadius ** 2;
    return ordered.filter((target) => distanceSquared(primary.position, target.position) <= radiusSquared);
  }
  const pathTargetIds = new Set(paths.flat());
  return ordered.filter((target) => pathTargetIds.has(target.id));
}

function eventFor(hit: DamageHit, target: CombatTarget, critical: boolean): DamageEvent {
  const label = critical ? (target.boss ? "치명타 · 보스" : "치명타") : target.boss ? "보스" : "일반";
  const style = critical ? (target.boss ? "critical-boss" : "critical") : target.boss ? "boss" : "normal";
  return Object.freeze({ targetId: hit.targetId, value: hit.damage, critical, boss: target.boss, label, style });
}

export function resolveAttack(hero: CombatHero, targets: readonly CombatTarget[], state: CombatState, options: AttackOptions): AttackResult {
  validateAttack(hero, targets, options);
  const ordered = eligibleTargets(hero, targets);
  const primary = ordered[0];
  if (primary === undefined) return Object.freeze({ kind: "no-target", state, hits: [], projectiles: [], damageEvents: [] });
  const profile = getAttackProfile(hero.heroClass, hero.tier);
  const sameWarriorTarget = hero.heroClass === "warrior" && state.warriorTargetId === primary.id;
  const rampHits = hero.heroClass === "warrior" ? Math.min(profile.maxRampHits, sameWarriorTarget ? state.warriorRampHits + 1 : 1) : 0;
  const nextState = Object.freeze({
    warriorTargetId: hero.heroClass === "warrior" ? primary.id : state.warriorTargetId,
    warriorRampHits: hero.heroClass === "warrior" ? rampHits : state.warriorRampHits,
  });
  const baseDamage = calculateAttackDamage(hero);
  const critical = options.criticalRoll < hero.criticalChance;
  const rampMultiplier = hero.heroClass === "warrior" ? 1 + (rampHits - 1) * 0.12 : 1;
  const paths = projectilePaths(profile, ordered, primary);
  const hitTargets = attackedTargets(profile, ordered, primary, paths);
  const hits = hitTargets.map((target) => Object.freeze({
    targetId: target.id,
    damage: Math.max(1, baseDamage * rampMultiplier * (critical ? 2 : 1) * (target.boss ? 0.8 : 1) - target.armor),
  }));
  const projectiles = paths.map((targetIds) => Object.freeze({
    frame: profile.projectileFrame,
    effectFrame: profile.effectFrame,
    targetIds: Object.freeze(targetIds),
  }));
  const damageEvents = options.damageNumbers
    ? hits.map((hit) => eventFor(hit, hitTargets.find((target) => target.id === hit.targetId) ?? primary, critical))
    : [];
  return Object.freeze({ kind: "hit", state: nextState, hits: Object.freeze(hits), projectiles: Object.freeze(projectiles), damageEvents: Object.freeze(damageEvents) });
}
